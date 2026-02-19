import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import {
  getSystemPrompt,
  getComplianceAgentPrompt,
  getPolicyDocAgentPrompt,
  getRiskControlsAgentPrompt,
  COMPLIANCE_CHECK_QUESTION_INSTRUCTION,
  type Jurisdiction,
} from "@/lib/prompts";
import { getOpenAIApiKey, getOpenAIModel } from "@/lib/openai";
import { check, record, rateLimitKey } from "@/lib/rateLimit";
import { chooseAgent, type AgentId } from "@/lib/agentRouter";

export const runtime = "nodejs";
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

function log(level: "info" | "error", data: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...data });
  console[level](line);
  // Optional: in dev, append to /logs (could write to a file under project root)
  if (process.env.NODE_ENV === "development" && process.env.LOG_TO_FILE === "1") {
    const fs = require("fs");
    const path = require("path");
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, "hr-api.log"), line + "\n");
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const key = rateLimitKey(ip, "hr");

  if (!check(key)) {
    log("info", { ip, event: "rate_limit_exceeded", route: "hr" });
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
    log("info", { ip, event: "validation_error", message });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const apiKey = getOpenAIApiKey();
  const model = getOpenAIModel("gpt-5");

  if (!apiKey) {
    log("error", { ip, event: "missing_openai_key", route: "hr" });
    return NextResponse.json(
      { error: "Server configuration error: OpenAI API key not configured." },
      { status: 500 }
    );
  }

  record(key);

  const docSummary = (body.document_text ?? "").trim().slice(0, 8000);
  const hasDocument = docSummary.length > 0;

  const routerResult = await chooseAgent({
    message: body.message,
    history: body.history ?? [],
    hasDocument,
  });
  const agent: AgentId = routerResult.agent;
  const jurisdiction = body.jurisdiction as Jurisdiction;
  let systemPrompt: string;
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

  log("info", { ip, chosen_agent: agent, has_document: hasDocument, route: "hr" });

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

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model,
      instructions: systemPrompt,
      input,
      max_output_tokens: 1536,
      ...(useWebSearch ? { tools: [{ type: "web_search_preview" as const }] } : {}),
    });

    const text = response.output_text?.trim() ?? "";

    // Ensure disclaimer is present
    const disclaimer = "Not legal advice.";
    const finalText = text.endsWith(disclaimer) ? text : `${text}\n\n${disclaimer}`;

    log("info", {
      ip,
      jurisdiction: body.jurisdiction,
      messageLength: userMessage.length,
      success: true,
      route: "hr",
    });

    return NextResponse.json({ text: finalText });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI API error";
    log("error", {
      ip,
      jurisdiction: body.jurisdiction,
      messageLength: userMessage.length,
      success: false,
      error: message,
      route: "hr",
    });
    return NextResponse.json(
      { error: "The assistant is temporarily unavailable. Please try again later." },
      { status: 502 }
    );
  }
}
