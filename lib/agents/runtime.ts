/**
 * Generic agent runtime: runs an agent's tool loop against OpenAI,
 * streaming NDJSON events. Tools flagged requiresApproval pause the run and
 * return a continuation token; /api/agents/[agentId]/stream/continue resumes
 * it after the human decision. Every tool execution is audit-logged.
 */

import type OpenAI from "openai";
import { logAudit } from "@/lib/audit";
import type { AgentDefinition, ToolContext } from "@/lib/agents/types";
import { toolByName } from "@/lib/agents/types";

export type PendingCall = { id: string; name: string; args: Record<string, unknown> };

export type StreamEvent =
  | { type: "step"; id: string; label: string; status: "active" | "done" }
  | { type: "text"; delta: string }
  | { type: "done"; text: string }
  | { type: "error"; error: string }
  | { type: "pending_tool_calls"; calls: PendingCall[]; continuation: string };

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export function encodeContinuation(payload: { agentId: string; messages: unknown[] }): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
}

export function decodeContinuation(token: string): { agentId: string; messages: ChatMessage[] } | null {
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    if (typeof parsed?.agentId === "string" && Array.isArray(parsed?.messages)) {
      return parsed as { agentId: string; messages: ChatMessage[] };
    }
  } catch {
    // fall through
  }
  return null;
}

function serializeMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((m) => {
    if (m.role === "assistant" && "tool_calls" in m && m.tool_calls) {
      return {
        role: m.role,
        content: m.content ?? null,
        tool_calls: m.tool_calls.map((t) => ({
          id: t.id,
          type: "function" as const,
          function: {
            name: t.type === "function" ? t.function.name : "",
            arguments: t.type === "function" ? t.function.arguments : "{}",
          },
        })),
      };
    }
    if (m.role === "tool" && "tool_call_id" in m) {
      return { role: m.role, tool_call_id: m.tool_call_id, content: m.content };
    }
    return { role: m.role, content: (m as { content?: string }).content ?? "" };
  });
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  try {
    return JSON.parse(raw ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const MAX_TOOL_ROUNDS = 10;

/**
 * Runs the agent loop, emitting events. Ends with done | error |
 * pending_tool_calls (approval needed).
 */
export async function runAgentLoop(params: {
  agent: AgentDefinition;
  openai: OpenAI;
  model: string;
  messages: ChatMessage[];
  ctx: ToolContext;
  emit: (ev: StreamEvent) => void;
}): Promise<void> {
  const { agent, openai, model, messages, ctx, emit } = params;
  let round = 0;
  let lastContent = "";

  while (round < MAX_TOOL_ROUNDS) {
    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: agent.tools.map((t) => t.definition),
      max_completion_tokens: 1536,
    });

    const msg = response.choices?.[0]?.message;
    if (!msg) {
      emit({ type: "error", error: "No message in model response." });
      return;
    }
    lastContent = typeof msg.content === "string" ? msg.content : "";

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });

      const approvalCalls: PendingCall[] = [];
      const autoCalls: typeof msg.tool_calls = [];
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        const tool = toolByName(agent, tc.function.name);
        if (tool?.requiresApproval) {
          approvalCalls.push({ id: tc.id, name: tc.function.name, args: parseArgs(tc.function.arguments) });
        } else {
          autoCalls.push(tc);
        }
      }

      for (const tc of autoCalls) {
        if (tc.type !== "function") continue;
        const name = tc.function.name;
        const tool = toolByName(agent, name);
        emit({ type: "step", id: name, label: `Running ${name}…`, status: "active" });
        let result: string;
        if (!tool) {
          result = JSON.stringify({ error: `Unknown tool: ${name}` });
        } else {
          try {
            result = await tool.handler(parseArgs(tc.function.arguments), ctx);
          } catch (e) {
            const message = e instanceof Error ? e.message : "Tool failed";
            result = JSON.stringify({ error: message });
            await logAudit({ agent: agent.id, action: `tool_error:${name}`, status: "error", detail: message });
          }
        }
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
        emit({ type: "step", id: name, label: name, status: "done" });
      }

      if (approvalCalls.length > 0) {
        for (const call of approvalCalls) {
          await logAudit({
            agent: agent.id,
            action: `approval_requested:${call.name}`,
            status: "pending_approval",
            detail: JSON.stringify(call.args).slice(0, 500),
          });
        }
        emit({
          type: "pending_tool_calls",
          calls: approvalCalls,
          continuation: encodeContinuation({ agentId: agent.id, messages: serializeMessages(messages) }),
        });
        return;
      }

      round++;
      continue;
    }

    emit({ type: "done", text: lastContent.trim() || "Done." });
    return;
  }

  emit({ type: "done", text: lastContent.trim() || "Stopped after reaching the tool-round limit." });
}
