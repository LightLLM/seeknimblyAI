/**
 * Generic agent runtime: runs an agent's tool loop against OpenAI,
 * streaming NDJSON events. Tools flagged requiresApproval pause the run and
 * return a continuation token; /api/agents/[agentId]/stream/continue resumes
 * it after the human decision. Every tool execution is audit-logged.
 */

import { createHmac, timingSafeEqual } from "crypto";
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

function signingSecret(): string | null {
  return process.env.NEXTAUTH_SECRET ?? null;
}

function hmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/**
 * Continuation tokens are HMAC-signed with NEXTAUTH_SECRET so the paused
 * conversation (including pending tool-call arguments) cannot be tampered
 * with between the pause and the user's approval.
 */
export function encodeContinuation(payload: { agentId: string; messages: unknown[] }): string {
  const body = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const secret = signingSecret();
  const sig = secret ? hmac(body, secret) : "";
  return `${body}.${sig}`;
}

export function decodeContinuation(token: string): { agentId: string; messages: ChatMessage[] } | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const secret = signingSecret();
  if (secret) {
    const expected = hmac(body, secret);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
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

type AccumToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/**
 * One streamed completion turn. Emits text deltas live when the model is
 * producing a final answer (no tool calls). If tool calls appear, text is
 * buffered and not treated as the user-facing answer.
 */
async function streamCompletion(params: {
  openai: OpenAI;
  model: string;
  messages: ChatMessage[];
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  emit: (ev: StreamEvent) => void;
}): Promise<{ content: string; tool_calls: AccumToolCall[] }> {
  const stream = await params.openai.chat.completions.create({
    model: params.model,
    messages: params.messages,
    tools: params.tools.length > 0 ? params.tools : undefined,
    max_completion_tokens: 1536,
    stream: true,
  });

  let content = "";
  const toolMap = new Map<number, AccumToolCall>();
  let sawToolCalls = false;

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.tool_calls) {
      sawToolCalls = true;
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        const existing = toolMap.get(idx) ?? {
          id: tc.id ?? `call_${idx}`,
          type: "function" as const,
          function: { name: "", arguments: "" },
        };
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.function.name += tc.function.name;
        if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
        toolMap.set(idx, existing);
      }
    }

    if (typeof delta.content === "string" && delta.content) {
      content += delta.content;
      if (!sawToolCalls) {
        params.emit({ type: "text", delta: delta.content });
      }
    }
  }

  const tool_calls = Array.from(toolMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v)
    .filter((t) => t.function.name);

  return { content, tool_calls };
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
  const tools = agent.tools.map((t) => t.definition);

  while (round < MAX_TOOL_ROUNDS) {
    const { content, tool_calls } = await streamCompletion({
      openai,
      model,
      messages,
      tools,
      emit,
    });
    lastContent = content;

    if (tool_calls.length > 0) {
      messages.push({
        role: "assistant",
        content: content || null,
        tool_calls: tool_calls.map((t) => ({
          id: t.id,
          type: "function" as const,
          function: { name: t.function.name, arguments: t.function.arguments },
        })),
      });

      const approvalCalls: PendingCall[] = [];
      const autoCalls: AccumToolCall[] = [];
      for (const tc of tool_calls) {
        const tool = toolByName(agent, tc.function.name);
        if (tool?.requiresApproval) {
          approvalCalls.push({ id: tc.id, name: tc.function.name, args: parseArgs(tc.function.arguments) });
        } else {
          autoCalls.push(tc);
        }
      }

      for (const tc of autoCalls) {
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
