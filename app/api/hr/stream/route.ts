import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import {
  getSystemPrompt,
  getComplianceAgentPrompt,
  getPolicyDocAgentPrompt,
  getRiskControlsAgentPrompt,
  getOnboardingAgentPrompt,
  COMPLIANCE_CHECK_QUESTION_INSTRUCTION,
  type Jurisdiction,
} from "@/lib/prompts";
import { getOpenAIApiKey, getOpenAIModel } from "@/lib/openai";
import { check, record, rateLimitKey } from "@/lib/rateLimit";
import { chooseAgent, type AgentId } from "@/lib/agentRouter";

// Node runtime: more reliable for OpenAI streaming than Edge (avoids timeout/parsing issues)
export const runtime = "nodejs";
// Allow stream to run long enough for OpenAI (Vercel: 60s on Pro; Hobby may need smaller)
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
  document_text: z.string().max(12000).optional(),
  mode: z.enum(["default", "onboarding"]).optional(),
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

  const apiKey = getOpenAIApiKey();
  const model = getOpenAIModel("gpt-4o");

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: OpenAI API key not configured." },
      { status: 500 }
    );
  }

  record(key);

  const docSummary = (body.document_text ?? "").trim().slice(0, 8000);
  const hasDocument = docSummary.length > 0;
  const isOnboarding = body.mode === "onboarding";
  const startTime = Date.now();

  const encoder = new TextEncoder();
  let accumulatedText = "";

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(streamLine({ type: "step", id: "router", label: isOnboarding ? "Onboarding…" : "Connecting…", status: "active" })));
      let sentFinal = false;
      const sendDone = (text: string) => {
        if (sentFinal) return;
        sentFinal = true;
        let finalText: string;
        if (text.trim()) {
          finalText = text.endsWith(DISCLAIMER) ? text.trim() : `${text.trim()}\n\n${DISCLAIMER}`;
        } else {
          finalText = "No text received from OpenAI stream. Check OPENAI_API_KEY, OPENAI_MODEL, and Vercel function duration (Settings → Functions).\n\n" + DISCLAIMER;
        }
        controller.enqueue(encoder.encode(streamLine({ type: "done", text: finalText })));
      };
      const sendError = (error: string) => {
        if (sentFinal) return;
        sentFinal = true;
        controller.enqueue(encoder.encode(streamLine({ type: "error", error })));
      };
      try {
        const jurisdiction = body.jurisdiction as Jurisdiction;
        let systemPrompt: string;
        let agent: AgentId = "general_hr_assistant";

        if (isOnboarding) {
          systemPrompt = getOnboardingAgentPrompt(jurisdiction);
          console.info("[api/hr/stream]", { mode: "onboarding", duration_ms: Date.now() - startTime });
        } else {
          const routerResult = await chooseAgent({
            message: body.message,
            history: body.history ?? [],
            hasDocument,
          });
          agent = routerResult.agent;
          switch (agent) {
            case "compliance_agent":
              systemPrompt = getComplianceAgentPrompt(jurisdiction);
              if (hasDocument && (body.history?.length ?? 0) === 0) {
                systemPrompt += "\n\n" + COMPLIANCE_CHECK_QUESTION_INSTRUCTION;
              }
              break;
            case "policy_doc_agent":
              systemPrompt = getPolicyDocAgentPrompt(jurisdiction);
              break;
            case "risk_controls_agent":
              systemPrompt = getRiskControlsAgentPrompt(jurisdiction);
              break;
            default:
              systemPrompt = getSystemPrompt(jurisdiction);
          }
          console.info("[api/hr/stream]", { chosen_agent: agent, has_document: hasDocument, duration_ms: Date.now() - startTime });
        }

        const userMessage = body.message;
        const fileIds = body.file_ids ?? [];
        const hasFiles = fileIds.length > 0;
        const textForThisTurn = hasDocument
          ? "Document context (for compliance check):\n" + docSummary + "\n\nUser message:\n" + userMessage
          : userMessage;

        const currentUserContent: Array<{ type: "input_file"; file_id: string } | { type: "input_text"; text: string }> = hasFiles && !hasDocument
          ? [
              ...fileIds.map((file_id) => ({ type: "input_file" as const, file_id })),
              { type: "input_text" as const, text: userMessage },
            ]
          : [{ type: "input_text" as const, text: textForThisTurn }];

        const currentUserMessage = { role: "user" as const, content: currentUserContent };
        const hasHistory = (body.history?.length ?? 0) > 0;
        const input = hasHistory
          ? [
              ...body.history!.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
              currentUserMessage,
            ]
          : [currentUserMessage];

        const useWebSearch = agent === "general_hr_assistant";
        const openai = new OpenAI({ apiKey });
        const responseStream = await openai.responses.create({
          model,
          instructions: systemPrompt,
          input,
          max_output_tokens: 1536,
          ...(useWebSearch ? { tools: [{ type: "web_search_preview" as const }] } : {}),
          stream: true,
        });

        for await (const event of responseStream as AsyncIterable<{ type: string; delta?: string; text?: string; response?: { output_text?: string }; error?: { message?: string } }>) {
          const ev = event as { type: string; delta?: string; text?: string; response?: { output_text?: string }; error?: { message?: string } };
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
              // Use full response text when present (handles buffered/reordered streams, e.g. on Vercel)
              if (ev.response?.output_text != null && typeof ev.response.output_text === "string" && ev.response.output_text.trim()) {
                accumulatedText = ev.response.output_text.trim();
              }
              break;
            case "response.done":
              break;
            case "response.failed":
              const failMsg = ev.error?.message ?? "Model request failed.";
              sendError(failMsg);
              return;
            default:
              break;
          }
        }

        let text = accumulatedText.trim();
        if (!text) {
          console.warn("[api/hr/stream] No text received from OpenAI stream. Trying non-streaming fallback.");
          controller.enqueue(encoder.encode(streamLine({ type: "step", id: "fallback", label: "Getting response…", status: "active" })));
          try {
            const fallback = await openai.responses.create({
              model,
              instructions: systemPrompt,
              input,
              max_output_tokens: 1536,
              ...(useWebSearch ? { tools: [{ type: "web_search_preview" as const }] } : {}),
              stream: false,
            });
            const fallbackText = (fallback as { output_text?: string }).output_text?.trim();
            if (fallbackText) {
              text = fallbackText;
              console.warn("[api/hr/stream] Fallback (non-streaming) succeeded; stream had returned no text.");
            } else {
              console.warn("[api/hr/stream] Fallback response had no output_text.");
            }
          } catch (fallbackErr) {
            const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            console.warn("[api/hr/stream] Fallback request failed:", msg, fallbackErr);
          }
        }
        sendDone(text || "No response.");
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
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}