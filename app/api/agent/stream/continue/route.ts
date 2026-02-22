import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIApiKey, getOpenAIModel } from "@/lib/openai";
import { check, record, rateLimitKey } from "@/lib/rateLimit";
import { getAgentSystemPrompt, type AgentParams } from "@/lib/agent-prompts";
import { AGENT_TOOLS, executeTool, toolRequiresApproval } from "@/lib/agent-tools";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

type PendingCall = { id: string; name: string; args: Record<string, unknown> };

type StreamEvent =
  | { type: "step"; id: string; label: string; status: "active" | "done" }
  | { type: "text"; delta: string }
  | { type: "done"; text: string }
  | { type: "error"; error: string }
  | { type: "pending_tool_calls"; calls: PendingCall[]; continuation: string };

function streamLine(ev: StreamEvent): string {
  return JSON.stringify(ev) + "\n";
}

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function parseSerializedMessages(raw: unknown[]): ChatMessage[] {
  return raw.map((m) => {
    const r = m as Record<string, unknown>;
    const role = r.role as string;
    if (role === "system" || role === "user") {
      return { role: role as "system" | "user", content: (r.content as string) ?? "" };
    }
    if (role === "assistant") {
      const content = r.content as string | null;
      const toolCalls = r.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
      if (toolCalls?.length) {
        return {
          role: "assistant",
          content,
          tool_calls: toolCalls.map((t) => ({
            id: t.id,
            type: "function" as const,
            function: { name: t.function.name, arguments: t.function.arguments },
          })),
        };
      }
      return { role: "assistant", content: content ?? "" };
    }
    if (role === "tool") {
      return {
        role: "tool",
        tool_call_id: r.tool_call_id as string,
        content: r.content as string,
      };
    }
    return { role: "user", content: String(r.content ?? "") };
  });
}

const BODY_SCHEMA = z.object({
  continuation: z.string().min(1, "continuation is required"),
  approved_tool_call_ids: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const key = rateLimitKey(ip, "agent");

  if (!check(key)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: z.infer<typeof BODY_SCHEMA>;
  try {
    const raw = await req.json();
    body = BODY_SCHEMA.parse(raw);
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const apiKey = getOpenAIApiKey();
  const model = getOpenAIModel("gpt-4o");

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: OpenAI API key not configured." },
      { status: 500 }
    );
  }

  record(key);

  let payload: { messages: unknown[]; params: AgentParams };
  try {
    const decoded = Buffer.from(body.continuation, "base64").toString("utf-8");
    payload = JSON.parse(decoded) as { messages: unknown[]; params: AgentParams };
  } catch {
    return NextResponse.json({ error: "Invalid continuation payload." }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey });
  const params = payload.params ?? {};
  const approvedSet = new Set(body.approved_tool_call_ids);

  let messages = parseSerializedMessages(payload.messages);
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.role !== "assistant" || !("tool_calls" in lastMsg) || !lastMsg.tool_calls?.length) {
    return NextResponse.json({ error: "Continuation has no pending tool calls." }, { status: 400 });
  }

  for (const tc of lastMsg.tool_calls) {
    const name = tc.function?.name ?? "";
    if (!toolRequiresApproval(name)) continue;
    const args = (() => {
      try {
        return JSON.parse(tc.function?.arguments ?? "{}") as Record<string, unknown>;
      } catch {
        return {};
      }
    })();
    const content = approvedSet.has(tc.id!)
      ? await executeTool(name, args, { openai, jobTitle: params.job_title, location: params.location })
      : JSON.stringify({ message: "User declined to run this tool." });
    messages.push({
      role: "tool",
      tool_call_id: tc.id!,
      content,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      let sentFinal = false;
      const sendDone = (text: string) => {
        if (sentFinal) return;
        sentFinal = true;
        ctrl.enqueue(encoder.encode(streamLine({ type: "done", text: text.trim() || "Done." })));
      };
      const sendError = (error: string) => {
        if (sentFinal) return;
        sentFinal = true;
        ctrl.enqueue(encoder.encode(streamLine({ type: "error", error })));
      };

      try {
        const response = await openai.chat.completions.create({
          model,
          messages,
          tools: AGENT_TOOLS,
          max_completion_tokens: 1024,
        });

        const choice = response.choices?.[0];
        if (!choice?.message) {
          sendError("No message in response.");
          ctrl.close();
          return;
        }

        const msg = choice.message;
        const lastContent = typeof msg.content === "string" ? msg.content : "";

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
          const approvalCalls: PendingCall[] = [];
          const autoCalls = msg.tool_calls;

          for (const tc of autoCalls) {
            const name = tc.function?.name ?? "";
            const args = (() => {
              try {
                return JSON.parse(tc.function?.arguments ?? "{}") as Record<string, unknown>;
              } catch {
                return {};
              }
            })();
            if (toolRequiresApproval(name)) {
              approvalCalls.push({ id: tc.id!, name, args });
            } else {
              ctrl.enqueue(encoder.encode(streamLine({ type: "step", id: name, label: `Running ${name}…`, status: "active" })));
              const result = await executeTool(name, args, { openai, jobTitle: params.job_title, location: params.location });
              messages.push({ role: "tool", tool_call_id: tc.id!, content: result });
              ctrl.enqueue(encoder.encode(streamLine({ type: "step", id: name, label: name, status: "done" })));
            }
          }

          if (approvalCalls.length > 0) {
            const serializableMessages: unknown[] = messages.map((m) => {
              if (m.role === "assistant" && "tool_calls" in m && m.tool_calls) {
                return {
                  role: m.role,
                  content: m.content,
                  tool_calls: m.tool_calls.map((t) => ({
                    id: t.id,
                    type: "function" as const,
                    function: { name: t.function?.name ?? "", arguments: t.function?.arguments ?? "{}" },
                  })),
                };
              }
              if (m.role === "tool" && "tool_call_id" in m) {
                return { role: m.role, tool_call_id: m.tool_call_id, content: m.content };
              }
              return { role: m.role, content: (m as { content?: string }).content ?? "" };
            });
            const continuation = Buffer.from(
              JSON.stringify({ messages: serializableMessages, params }),
              "utf-8"
            ).toString("base64");
            ctrl.enqueue(
              encoder.encode(streamLine({ type: "pending_tool_calls", calls: approvalCalls, continuation }))
            );
            sentFinal = true;
            ctrl.close();
            return;
          }

          sendDone(lastContent);
          ctrl.close();
          return;
        }

        sendDone(lastContent);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        console.error("[api/agent/stream/continue]", message, err);
        ctrl.enqueue(encoder.encode(streamLine({ type: "error", error: message })));
      } finally {
        ctrl.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
