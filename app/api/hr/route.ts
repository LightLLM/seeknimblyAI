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

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5";

  if (!apiKey?.trim()) {
    log("error", { ip, event: "missing_openai_key", route: "hr" });
    return NextResponse.json(
      { error: "Server configuration error: OpenAI API key not configured." },
      { status: 500 }
    );
  }

  record(key);

  const systemPrompt = getSystemPrompt(body.jurisdiction as Jurisdiction);
  const userMessage = body.message;

  // Build input: optional conversation history + current user message
  const hasHistory = (body.history?.length ?? 0) > 0;
  const input = hasHistory
    ? [
        ...body.history!.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: userMessage },
      ]
    : userMessage;

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model,
      instructions: systemPrompt,
      input,
      max_output_tokens: 1024,
      tools: [{ type: "web_search_preview" }],
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
