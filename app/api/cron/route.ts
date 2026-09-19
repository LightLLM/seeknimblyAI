/**
 * GET /api/cron?task=<automation-id> — scheduler entrypoint.
 * Secured with CRON_SECRET (Vercel Cron sends Authorization: Bearer <secret>).
 * Only ENABLED automations run via cron; use the Automations page to enable.
 * Runs once per org so tenants stay isolated.
 */

import { NextRequest, NextResponse } from "next/server";
import { runAutomationForAllOrgs } from "@/lib/automations-runner";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const task = req.nextUrl.searchParams.get("task");
  if (!task) return NextResponse.json({ error: "Missing ?task=" }, { status: 400 });
  const { results } = await runAutomationForAllOrgs(task);
  return NextResponse.json({
    task,
    orgs: results.length,
    results: results.map((r) => ({
      org_id: r.org_id ?? null,
      status: r.status,
      summary: r.summary.slice(0, 300),
    })),
  });
}
