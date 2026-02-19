import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { getSystemPrompt, type Jurisdiction } from "@/lib/prompts";
import { check, record, rateLimitKey } from "@/lib/rateLimit";

const HISTORY_ITEM = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
});

const BODY_SCHEMA = z.object({
  message: z.string().min(1, "Message is required").max(8000, "Message too long"),
  jurisdiction: z.enum(["NA", "CA", "US"]),
  history: z.array(HISTORY_ITEM).max(20).optional(),
  file_ids: z.array(z.string()).max(10).optional(),
  file_filenames: z.array(z.string()).max(10).optional(),
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

const DISCLAIMER = "Not legal advice.";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const key = rateLimitKey(ip, "hr");

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

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "Server configuration error: OpenAI API key not configured." },
      { status: 500 }
    );
  }

  record(key);

  const systemPrompt = getSystemPrompt(body.jurisdiction as Jurisdiction);
  const userMessage = body.message;
  const fileIds = body.file_ids ?? [];
  const fileFilenames = body.file_filenames ?? [];
  const hasFiles = fileIds.length > 0;

  const currentUserContent: Array<{ type: "input_file"; file_id: string; filename?: string } | { type: "input_text"; text: string }> = hasFiles
    ? [
        ...fileIds.map((file_id, i) => ({ type: "input_file" as const, file_id, filename: fileFilenames[i] })),
        { type: "input_text" as const, text: userMessage },
      ]
    : [{ type: "input_text" as const, text: userMessage }];

  const currentUserMessage = { role: "user" as const, content: currentUserContent };
  const hasHistory = (body.history?.length ?? 0) > 0;
  const input = hasHistory
    ? [
        ...body.history!.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        currentUserMessage,
      ]
    : hasFiles
      ? [currentUserMessage]
      : userMessage;

  const encoder = new TextEncoder();
  let accumulatedText = "";

  const stream = new ReadableStream({
    async start(controller) {
      let sentFinal = false;
      const sendDone = (text: string) => {
        if (sentFinal) return;
        sentFinal = true;
        const finalText = text.trim() ? (text.endsWith(DISCLAIMER) ? text.trim() : `${text.trim()}\n\n${DISCLAIMER}`) : "No response.";
        controller.enqueue(encoder.encode(streamLine({ type: "done", text: finalText })));
      };
      const sendError = (error: string) => {
        if (sentFinal) return;
        sentFinal = true;
        controller.enqueue(encoder.encode(streamLine({ type: "error", error })));
      };
      try {
        const openai = new OpenAI({ apiKey });
        const responseStream = await openai.responses.create({
          model,
          instructions: systemPrompt,
          input,
          max_output_tokens: 1024,
          tools: [{ type: "web_search_preview" }],
          stream: true,
        });

        for await (const event of responseStream as AsyncIterable<{ type: string; delta?: string; text?: string }>) {
          const ev = event as { type: string; delta?: string; text?: string };
          switch (ev.type) {
            case "response.web_search_call.searching":
              controller.enqueue(encoder.encode(streamLine({ type: "step", id: "web_search", label: "Searching the web for current compliance information…", status: "active" })));
              break;
            case "response.web_search_call.in_progress":
              controller.enqueue(encoder.encode(streamLine({ type: "step", id: "web_search", label: "Reading sources…", status: "active" })));
              break;
            case "response.web_search_call.completed":
              controller.enqueue(encoder.encode(streamLine({ type: "step", id: "web_search", label: "Found relevant sources", status: "done" })));
              break;
            case "response.output_text.delta":
              if (typeof ev.delta === "string") {
                accumulatedText += ev.delta;
                controller.enqueue(encoder.encode(streamLine({ type: "text", delta: ev.delta })));
              }
              break;
            case "response.output_text.done":
              if (typeof ev.text === "string") accumulatedText += ev.text;
              break;
            case "response.completed":
            case "response.done":
              break;
            default:
              break;
          }
        }

        const text = accumulatedText.trim();
        sendDone(text ? text : "No response.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        console.error("[api/hr/stream]", message, err);
        sendError(message);
      } finally {
        if (!sentFinal) sendDone(accumulatedText);
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
