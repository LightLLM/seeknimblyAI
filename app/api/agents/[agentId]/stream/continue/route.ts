/**
 * POST /api/agents/[agentId]/stream/continue — resume a paused agent run
 * after the human approves or rejects the pending tool calls.
 * Body: { continuation, decisions: [{ id, name, args, approved }] }
 * Approved calls execute (audit-logged as approved); rejected calls return a
 * rejection message to the model so it can adjust.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { allowRequest, rateLimitKey } from "@/lib/rateLimit";
import { getAgent } from "@/lib/agents/registry";
import { toolByName } from "@/lib/agents/types";
import { logAudit } from "@/lib/audit";
import {
  runAgentLoop,
  decodeContinuation,
  type ChatMessage,
  type StreamEvent,
} from "@/lib/agents/runtime";
import { resolveOrgForEmail } from "@/lib/org";
import { runWithStoreContext } from "@/lib/store";
import { isChatModelId } from "@/lib/models";
import { resolveChatLlm } from "@/lib/llm";

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
  modelId: z.string().max(80).optional(),
});

function streamLine(ev: StreamEvent): string {
  return JSON.stringify(ev) + "\n";
}

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: `Unknown agent: ${params.agentId}` }, { status: 404 });

  const authSecret = process.env.NEXTAUTH_SECRET;
  const token = authSecret ? await getToken({ req, secret: authSecret }) : null;
  if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = rateLimitKey(ip, `agents:${agent.id}:continue`);
  if (!(await allowRequest(key))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  let body: z.infer<typeof BODY_SCHEMA>;
  try {
    body = BODY_SCHEMA.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const decoded = decodeContinuation(body.continuation);
  if (!decoded || decoded.agentId !== agent.id) {
    return NextResponse.json({ error: "Invalid or tampered continuation token." }, { status: 400 });
  }

  const modelId = body.modelId && isChatModelId(body.modelId) ? body.modelId : "auto";
  let llm;
  try {
    llm = resolveChatLlm(modelId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Model not available" },
      { status: 400 }
    );
  }

  const { client: openai, model } = llm;
  const email = String(token.email);
  const org = await resolveOrgForEmail(email);
  const messages: ChatMessage[] = decoded.messages;
  const toolCtx = {
    openai,
    model,
    jurisdiction: body.jurisdiction,
    userEmail: email,
    orgId: org.orgId,
  };

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
          // Tool name + args come from the SIGNED continuation, never from the
          // client: the client only supplies approve/reject per tool-call id.
          const lastAssistant = [...messages]
            .reverse()
            .find((m) => m.role === "assistant" && "tool_calls" in m && m.tool_calls);
          const signedCalls = new Map<string, { name: string; args: Record<string, unknown> }>();
          if (lastAssistant && "tool_calls" in lastAssistant && lastAssistant.tool_calls) {
            for (const tc of lastAssistant.tool_calls) {
              if (tc.type !== "function") continue;
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(tc.function.arguments ?? "{}") as Record<string, unknown>;
              } catch {
                args = {};
              }
              signedCalls.set(tc.id, { name: tc.function.name, args });
            }
          }

          for (const decision of body.decisions) {
            const signed = signedCalls.get(decision.id);
            const name = signed?.name ?? decision.name;
            const tool = signed ? toolByName(agent, signed.name) : undefined;
            let result: string;
            if (!signed) {
              result = JSON.stringify({ error: "Unknown tool call id for this continuation." });
            } else if (!decision.approved) {
              result = JSON.stringify({
                rejected: true,
                message: "The user rejected this action. Do not retry it; ask what they want instead.",
              });
              await logAudit({ agent: agent.id, action: `approval_rejected:${name}`, actor: email, status: "rejected" });
            } else if (!tool) {
              result = JSON.stringify({ error: `Unknown tool: ${name}` });
            } else {
              emit({ type: "step", id: name, label: `Running ${name}…`, status: "active" });
              try {
                result = await tool.handler(signed.args, toolCtx);
                await logAudit({ agent: agent.id, action: `approval_granted:${name}`, actor: email, status: "approved" });
              } catch (e) {
                const message = e instanceof Error ? e.message : "Tool failed";
                result = JSON.stringify({ error: message });
                await logAudit({ agent: agent.id, action: `tool_error:${name}`, status: "error", detail: message });
              }
              emit({ type: "step", id: name, label: name, status: "done" });
            }
            messages.push({ role: "tool", tool_call_id: decision.id, content: result });
          }

          await runAgentLoop({ agent, openai, model, messages, ctx: toolCtx, emit });
        });
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
