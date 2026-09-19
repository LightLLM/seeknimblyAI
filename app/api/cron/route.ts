/**
 * GET /api/cron?task=<automation-id|data-retention>
 * Secured with CRON_SECRET. Automations run per org; data-retention is global.
 */

import { NextRequest, NextResponse } from "next/server";
import { runAutomationForAllOrgs } from "@/lib/automations-runner";
import { runDataRetention } from "@/lib/retention";

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

  if (task === "data-retention") {
    const result = await runDataRetention();
    return NextResponse.json(result);
  }

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
