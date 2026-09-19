/**
 * Executes an automation: runs its agent's tool loop non-interactively.
 * Approval-required tool calls are NOT executed — the run pauses and records
 * that an interactive approval is needed; draft_* tools still work (outbox).
 * Every run writes an automation_runs row and audit entries.
 */

import OpenAI from "openai";
import { getOpenAIApiKey, getOpenAIAgentModel } from "@/lib/openai";
import { getAgent } from "@/lib/agents/registry";
import { runAgentLoop, type StreamEvent, type ChatMessage } from "@/lib/agents/runtime";
import { getAutomation } from "@/lib/automations";
import { insertRow, listRows, updateRow, runWithStoreContext } from "@/lib/store";
import { logAudit } from "@/lib/audit";

export type AutomationRunResult = {
  ok: boolean;
  automation_id: string;
  status: "completed" | "needs_approval" | "error" | "disabled" | "no_api_key";
  summary: string;
  pending_calls?: { name: string }[];
  org_id?: string;
};

export async function isAutomationEnabled(id: string): Promise<boolean> {
  const rows = await listRows("automation_settings", { filters: { automation_id: id }, limit: 1 });
  return rows.length > 0 ? Boolean(rows[0].enabled) : false;
}

export async function setAutomationEnabled(id: string, enabled: boolean): Promise<void> {
  const rows = await listRows("automation_settings", { filters: { automation_id: id }, limit: 1 });
  if (rows.length > 0) {
    await updateRow("automation_settings", String(rows[0].id), { enabled });
  } else {
    await insertRow("automation_settings", { automation_id: id, enabled });
  }
}

export async function runAutomation(id: string, opts: { force?: boolean; orgId?: string } = {}): Promise<AutomationRunResult> {
  const automation = getAutomation(id);
  if (!automation) {
    return { ok: false, automation_id: id, status: "error", summary: `Unknown automation: ${id}` };
  }
  if (!opts.force && !(await isAutomationEnabled(id))) {
    return { ok: false, automation_id: id, status: "disabled", summary: "Automation is disabled." };
  }
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return { ok: false, automation_id: id, status: "no_api_key", summary: "OPENAI_API_KEY not configured." };
  }
  const agent = getAgent(automation.agent);
  if (!agent) {
    return { ok: false, automation_id: id, status: "error", summary: `Unknown agent: ${automation.agent}` };
  }

  const model = getOpenAIAgentModel("gpt-4o");
  const openai = new OpenAI({ apiKey });
  const messages: ChatMessage[] = [
    { role: "system", content: agent.getSystemPrompt({ jurisdiction: "CA" }) },
    { role: "user", content: automation.prompt },
  ];

  let text = "";
  let pending: { name: string }[] = [];
  let errorMsg: string | null = null;
  const emit = (ev: StreamEvent) => {
    if (ev.type === "done") text = ev.text;
    if (ev.type === "error") errorMsg = ev.error;
    if (ev.type === "pending_tool_calls") pending = ev.calls.map((c) => ({ name: c.name }));
  };

  const execute = async () => {
    await logAudit({ agent: agent.id, action: `automation_started:${id}`, entity_type: "automation", entity_id: id });
    try {
      await runAgentLoop({
        agent,
        openai,
        model,
        messages,
        ctx: { openai, model, jurisdiction: "CA", orgId: opts.orgId },
        emit,
      });
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : "Automation failed";
    }

    const status: AutomationRunResult["status"] = errorMsg
      ? "error"
      : pending.length > 0
        ? "needs_approval"
        : "completed";
    const summary =
      errorMsg ??
      (text ||
        (pending.length > 0
          ? `Paused: ${pending.map((p) => p.name).join(", ")} requires interactive approval.`
          : "Done."));

    await insertRow("automation_runs", {
      automation_id: id,
      status,
      summary: summary.slice(0, 2000),
    });
    await logAudit({
      agent: agent.id,
      action: `automation_${status}:${id}`,
      entity_type: "automation",
      entity_id: id,
      status: status === "error" ? "error" : status === "needs_approval" ? "pending_approval" : "ok",
      detail: summary.slice(0, 500),
    });

    return {
      ok: status !== "error",
      automation_id: id,
      status,
      summary,
      pending_calls: pending,
      org_id: opts.orgId,
    };
  };

  if (opts.orgId) return runWithStoreContext({ orgId: opts.orgId }, execute);
  return execute();
}

/** Cron entry: run the automation once per org so each tenant stays isolated. */
export async function runAutomationForAllOrgs(
  id: string,
  opts: { force?: boolean } = {}
): Promise<{ results: AutomationRunResult[] }> {
  const orgs = await listRows("orgs", { limit: 100, skipOrgScope: true, orderBy: "created_at", ascending: true });
  if (orgs.length === 0) {
    return { results: [await runAutomation(id, opts)] };
  }
  const results: AutomationRunResult[] = [];
  for (const org of orgs) {
    results.push(await runAutomation(id, { ...opts, orgId: String(org.id) }));
  }
  return { results };
}
