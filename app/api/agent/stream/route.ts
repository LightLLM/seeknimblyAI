import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIApiKey, getOpenAIModel } from "@/lib/openai";
import { check, record, rateLimitKey } from "@/lib/rateLimit";
import { getAgentSystemPrompt, type AgentParams } from "@/lib/agent-prompts";
import { AGENT_TOOLS, executeTool } from "@/lib/agent-tools";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const HISTORY_ITEM = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
});

const PARAMS_SCHEMA = z.object({
  job_title: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  experience_level: z.string().max(100).optional(),
  max_candidates: z.number().min(1).max(50).optional(),
  jurisdiction: z.enum(["NA", "CA", "US"]).optional(),
});

const BODY_SCHEMA = z.object({
  message: z.string().min(1, "Message is required").max(8000),
  history: z.array(HISTORY_ITEM).max(20).optional(),
  params: PARAMS_SCHEMA.optional(),
});

type Body = z.infer<typeof BODY_SCHEMA>;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

type StreamEvent =
  | { type: "step"; id: string; label: string; status: "active" | "done" }
  | { type: "text"; delta: string }
  | { type: "done"; text: string }
  | { type: "error"; error: string };

function streamLine(ev: StreamEvent): string {
  return JSON.stringify(ev) + "\n";
}

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const key = rateLimitKey(ip, "agent");

  if (!check(key)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: Body;
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

  const params: AgentParams = body.params ?? {};
  const systemPrompt = getAgentSystemPrompt(params);
  const openai = new OpenAI({ apiKey });

  const encoder = new TextEncoder();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...(body.history ?? []).map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: "user", content: body.message },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      let sentFinal = false;
      const sendDone = (text: string) => {
        if (sentFinal) return;
        sentFinal = true;
        controller.enqueue(encoder.encode(streamLine({ type: "done", text: text.trim() || "Done." })));
      };
      const sendError = (error: string) => {
        if (sentFinal) return;
        sentFinal = true;
        controller.enqueue(encoder.encode(streamLine({ type: "error", error })));
      };

      try {
        controller.enqueue(encoder.encode(streamLine({ type: "step", id: "agent", label: "Thinking…", status: "active" })));
        const maxToolRounds = 10;
        let round = 0;
        let lastContent = "";

        while (round < maxToolRounds) {
          const response = await openai.chat.completions.create({
            model,
            messages,
            tools: AGENT_TOOLS,
            max_completion_tokens: 1024,
          });

          const choice = response.choices?.[0];
          if (!choice?.message) {
            sendError("No message in response.");
            break;
          }

          const msg = choice.message;
          lastContent = typeof msg.content === "string" ? msg.content : "";

          if (msg.tool_calls && msg.tool_calls.length > 0) {
            messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
            for (const tc of msg.tool_calls) {
              const name = tc.function?.name ?? "";
              const args = (() => {
                try {
                  return JSON.parse(tc.function?.arguments ?? "{}") as Record<string, unknown>;
                } catch {
                  return {};
                }
              })();
              controller.enqueue(encoder.encode(streamLine({ type: "step", id: name, label: `Running ${name}…`, status: "active" })));
              const result = await executeTool(name, args, { openai, jobTitle: params.job_title, location: params.location });
              messages.push({
                role: "tool",
                tool_call_id: tc.id!,
                content: result,
              });
              controller.enqueue(encoder.encode(streamLine({ type: "step", id: name, label: name, status: "done" })));
            }
            round++;
            continue;
          }

          sendDone(lastContent);
          break;
        }

        if (!sentFinal) sendDone(lastContent);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        console.error("[api/agent/stream]", message, err);
        sendError(message);
      } finally {
        controller.close();
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
