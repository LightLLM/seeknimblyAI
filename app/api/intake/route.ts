/**
 * POST /api/intake — structured forms that call the same agent tools as chat.
 * Body: { kind: "hire"|"role"|"client", fields: {...} }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { getAgent } from "@/lib/agents/registry";
import { toolByName } from "@/lib/agents/types";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY = z.object({
  kind: z.enum(["hire", "role", "client"]),
  fields: z.record(z.unknown()),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof BODY>;
  try {
    body = BODY.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return withOrgScope(auth.org.orgId, async () => {
    const map = {
      hire: { agent: "onboarding", tool: "create_hire" },
      role: { agent: "recruiting", tool: "create_job" },
      client: { agent: "client_onboarding", tool: "create_client" },
    } as const;
    const { agent: agentId, tool: toolName } = map[body.kind];
    const agent = getAgent(agentId);
    const tool = agent ? toolByName(agent, toolName) : undefined;
    if (!tool) {
      return NextResponse.json({ error: `Tool ${toolName} unavailable` }, { status: 500 });
    }

    // create_client requires approval in chat; for structured intake we execute
    // directly (human already filled the form) and audit as approved form entry.
    const resultRaw = await tool.handler(body.fields, {
      userEmail: auth.email,
      orgId: auth.org.orgId,
      jurisdiction: "CA",
    });
    let result: unknown;
    try {
      result = JSON.parse(resultRaw);
    } catch {
      result = { ok: true, raw: resultRaw };
    }
    await logAudit({
      agent: agentId,
      action: `intake_form:${body.kind}`,
      actor: auth.email,
      status: "approved",
      detail: JSON.stringify(body.fields).slice(0, 500),
    });
    return NextResponse.json({ ok: true, kind: body.kind, result });
  });
}
