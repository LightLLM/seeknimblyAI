/**
 * POST /api/agents/[agentId]/stream — run any registered agent.
 * NDJSON stream: step | text | done | error | pending_tool_calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { getOpenAIApiKey } from "@/lib/openai";
import { allowRequest, rateLimitKey } from "@/lib/rateLimit";
import { getAgent } from "@/lib/agents/registry";
import { runAgentLoop, type ChatMessage, type StreamEvent } from "@/lib/agents/runtime";
import { resolveOrgForEmail } from "@/lib/org";
import { runWithStoreContext } from "@/lib/store";
import { isChatModelId } from "@/lib/models";
import { resolveChatLlm } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BODY_SCHEMA = z.object({
  message: z.string().min(1).max(8000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(20)
    .optional(),
  jurisdiction: z.enum(["NA", "CA", "US"]).optional(),
  modelId: z.string().max(80).optional(),
});

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function streamLine(ev: StreamEvent): string {
  return JSON.stringify(ev) + "\n";
}

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) {
    return NextResponse.json({ error: `Unknown agent: ${params.agentId}` }, { status: 404 });
  }

  const authSecret = process.env.NEXTAUTH_SECRET;
  const token = authSecret ? await getToken({ req, secret: authSecret }) : null;
  if (!token?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = rateLimitKey(getClientIp(req), `agents:${agent.id}`);
  if (!(await allowRequest(key))) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: z.infer<typeof BODY_SCHEMA>;
  try {
    body = BODY_SCHEMA.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const apiKey = getOpenAIApiKey();
  // OpenAI key still preferred for Auto; other providers validated in resolveChatLlm
  const modelId = body.modelId && isChatModelId(body.modelId) ? body.modelId : "auto";
  let llm;
  try {
    llm = resolveChatLlm(modelId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Model not available";
    // If only OpenAI missing and they asked auto with no keys at all:
    if (!apiKey && modelId === "auto") {
      return NextResponse.json({ error: "Server configuration error: no LLM API key configured." }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { client: openai, model, option } = llm;
  const email = String(token.email);
  const org = await resolveOrgForEmail(email);
  const messages: ChatMessage[] = [
    { role: "system", content: agent.getSystemPrompt({ jurisdiction: body.jurisdiction }) },
    ...(body.history ?? []).map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: "user", content: body.message },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (ev: StreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(streamLine(ev)));
        if (ev.type === "done" || ev.type === "error" || ev.type === "pending_tool_calls") closed = true;
      };
      try {
        await runWithStoreContext({ orgId: org.orgId }, async () => {
          emit({
            type: "step",
            id: "agent",
            label: `${agent.label} · ${option.label}`,
            status: "active",
          });
          await runAgentLoop({
            agent,
            openai,
            model,
            messages,
            ctx: {
              openai,
              model,
              jurisdiction: body.jurisdiction,
              userEmail: email,
              orgId: org.orgId,
            },
            emit,
          });
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        console.error(`[api/agents/${agent.id}/stream]`, message, err);
        emit({ type: "error", error: message });
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
