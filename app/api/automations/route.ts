/**
 * GET  /api/automations — list automations with enabled state + last run
 * POST /api/automations — { id, enabled } toggle
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { AUTOMATIONS, getAutomation } from "@/lib/automations";
import { isAutomationEnabled, setAutomationEnabled } from "@/lib/automations-runner";
import { listRows } from "@/lib/store";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authed(req: NextRequest): Promise<string | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? await getToken({ req, secret }) : null;
  return typeof token?.email === "string" ? token.email : null;
}

export async function GET(req: NextRequest) {
  const email = await authed(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const runs = await listRows("automation_runs", { limit: 200 });
  const automations = await Promise.all(
    AUTOMATIONS.map(async (a) => ({
      ...a,
      enabled: await isAutomationEnabled(a.id),
      last_run: runs.find((r) => r.automation_id === a.id) ?? null,
    }))
  );
  return NextResponse.json({ automations });
}

const POST_SCHEMA = z.object({ id: z.string().min(1), enabled: z.boolean() });

export async function POST(req: NextRequest) {
  const email = await authed(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: z.infer<typeof POST_SCHEMA>;
  try {
    body = POST_SCHEMA.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!getAutomation(body.id)) return NextResponse.json({ error: "Unknown automation" }, { status: 404 });
  await setAutomationEnabled(body.id, body.enabled);
  await logAudit({
    agent: "automations",
    action: `automation_${body.enabled ? "enabled" : "disabled"}:${body.id}`,
    entity_type: "automation",
    entity_id: body.id,
    actor: email,
  });
  return NextResponse.json({ ok: true, id: body.id, enabled: body.enabled });
}
