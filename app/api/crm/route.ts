/** GET /api/crm — sales/lead pipeline for the signed-in org. */

import { NextRequest, NextResponse } from "next/server";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { listRows } from "@/lib/store";
import { CRM_STAGES, countBy } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  return withOrgScope(auth.org.orgId, async () => {
    const leads = await listRows("leads", { limit: 200 });
    return NextResponse.json({
      leads,
      by_stage: countBy(leads, "stage", CRM_STAGES),
    });
  });
}
