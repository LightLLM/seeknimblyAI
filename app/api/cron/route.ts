/**
 * GET /api/cron?task=<automation-id|data-retention|cert-expiry|retention-sweep>
 * Secured with CRON_SECRET. Automations run per org; sweeps are per-org too.
 */

import { NextRequest, NextResponse } from "next/server";
import { runAutomationForAllOrgs } from "@/lib/automations-runner";
import { runDataRetention } from "@/lib/retention";
import { runCertExpirySweep } from "@/lib/cert-expiry";
import { runRetentionSweep } from "@/lib/retention-sweep";
import { listRows, runWithStoreContext } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function runPerOrg<T>(fn: () => Promise<T>): Promise<{ org_id: string; result: T }[]> {
  const orgs = await listRows("orgs", { limit: 500, skipOrgScope: true });
  if (orgs.length === 0) {
    // Demo mode with no orgs — run once unscoped
    return [{ org_id: "demo", result: await fn() }];
  }
  const out: { org_id: string; result: T }[] = [];
  for (const org of orgs) {
    const orgId = String(org.id);
    const result = await runWithStoreContext({ orgId }, fn);
    out.push({ org_id: orgId, result });
  }
  return out;
}

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

  if (task === "cert-expiry") {
    const results = await runPerOrg(() => runCertExpirySweep());
    return NextResponse.json({ task, orgs: results.length, results });
  }

  if (task === "retention-sweep") {
    const results = await runPerOrg(() => runRetentionSweep());
    return NextResponse.json({ task, orgs: results.length, results });
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
