/**
 * POST /api/agents/[agentId]/stream/continue — resume a paused agent run
 * after the human approves or rejects the pending tool calls.
 * Body: { continuation, decisions: [{ id, name, args, approved }] }
 * Approved calls execute (audit-logged as approved); rejected calls return a
 * rejection message to the model so it can adjust.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIApiKey, getOpenAIModel } from "@/lib/openai";
import { check, record, rateLimitKey } from "@/lib/rateLimit";
import { getAgent } from "@/lib/agents/registry";
import { toolByName } from "@/lib/agents/types";
import { logAudit } from "@/lib/audit";
import {
  runAgentLoop,
  decodeContinuation,
  type ChatMessage,
  type StreamEvent,
} from "@/lib/agents/runtime";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BODY_SCHEMA = z.object({
  continuation: z.string().min(1),
  decisions: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        args: z.record(z.unknown()).default({}),
        approved: z.boolean(),
      })
    )
    .min(1),
  jurisdiction: z.enum(["NA", "CA", "US"]).optional(),
});

function streamLine(ev: StreamEvent): string {
  return JSON.stringify(ev) + "\n";
}

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: `Unknown agent: ${params.agentId}` }, { status: 404 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = rateLimitKey(ip, `agents:${agent.id}:continue`);
  if (!check(key)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  let body: z.infer<typeof BODY_SCHEMA>;
  try {
    body = BODY_SCHEMA.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const decoded = decodeContinuation(body.continuation);
  if (!decoded || decoded.agentId !== agent.id) {
    return NextResponse.json({ error: "Invalid continuation token." }, { status: 400 });
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
  record(key);

  const model = getOpenAIModel("gpt-4o");
  const openai = new OpenAI({ apiKey });
  const messages: ChatMessage[] = decoded.messages;

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
        for (const decision of body.decisions) {
          const tool = toolByName(agent, decision.name);
          let result: string;
          if (!decision.approved) {
            result = JSON.stringify({
              rejected: true,
              message: "The user rejected this action. Do not retry it; ask what they want instead.",
            });
            await logAudit({ agent: agent.id, action: `approval_rejected:${decision.name}`, actor: "user", status: "rejected" });
          } else if (!tool) {
            result = JSON.stringify({ error: `Unknown tool: ${decision.name}` });
          } else {
            emit({ type: "step", id: decision.name, label: `Running ${decision.name}…`, status: "active" });
            try {
              result = await tool.handler(decision.args, { openai, model, jurisdiction: body.jurisdiction });
              await logAudit({ agent: agent.id, action: `approval_granted:${decision.name}`, actor: "user", status: "approved" });
            } catch (e) {
              const message = e instanceof Error ? e.message : "Tool failed";
              result = JSON.stringify({ error: message });
              await logAudit({ agent: agent.id, action: `tool_error:${decision.name}`, status: "error", detail: message });
            }
            emit({ type: "step", id: decision.name, label: decision.name, status: "done" });
          }
          messages.push({ role: "tool", tool_call_id: decision.id, content: result });
        }

        await runAgentLoop({ agent, openai, model, messages, ctx: { openai, model, jurisdiction: body.jurisdiction }, emit });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        console.error(`[api/agents/${agent.id}/continue]`, message, err);
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
