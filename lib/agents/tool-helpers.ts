import type OpenAI from "openai";
import { insertRow, isSupabaseConfigured } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import type { AgentTool, ToolHandler } from "@/lib/agents/types";

type JsonSchema = Record<string, unknown>;

export function makeTool(opts: {
  name: string;
  description: string;
  properties: Record<string, JsonSchema>;
  required?: string[];
  handler: ToolHandler;
  requiresApproval?: boolean;
}): AgentTool {
  const definition: OpenAI.Chat.Completions.ChatCompletionTool = {
    type: "function",
    function: {
      name: opts.name,
      description: opts.description,
      parameters: {
        type: "object",
        properties: opts.properties,
        required: opts.required ?? [],
      },
    },
  };
  return { definition, handler: opts.handler, requiresApproval: opts.requiresApproval };
}

export function str(description: string): JsonSchema {
  return { type: "string", description };
}
export function num(description: string): JsonSchema {
  return { type: "number", description };
}
export function bool(description: string): JsonSchema {
  return { type: "boolean", description };
}

export const demoNote = () =>
  isSupabaseConfigured() ? undefined : "demo mode: stored in memory only (Supabase not configured)";

/**
 * The draft-never-send rule, enforced in code: creates an outbox draft
 * (status=pending) and audit-logs it. Nothing is transmitted anywhere.
 */
export async function createDraft(params: {
  agent: string;
  channel: string;
  recipient?: string;
  subject?: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
}): Promise<string> {
  const draft = await insertRow("outbox_drafts", {
    agent: params.agent,
    channel: params.channel,
    recipient: params.recipient ?? null,
    subject: params.subject ?? null,
    body: params.body,
    entity_type: params.entity_type ?? null,
    entity_id: params.entity_id ?? null,
    status: "pending",
  });
  await logAudit({
    agent: params.agent,
    action: `draft_created:${params.channel}`,
    entity_type: "outbox_draft",
    entity_id: String(draft.id),
    status: "pending_approval",
    detail: `${params.subject ?? params.channel} → ${params.recipient ?? "n/a"}`,
  });
  return JSON.stringify({
    ok: true,
    draft_id: draft.id,
    status: "pending_approval",
    message:
      "Draft saved to the approval outbox. It will NOT be sent until a human approves it on the Approvals page.",
    note: demoNote(),
  });
}
