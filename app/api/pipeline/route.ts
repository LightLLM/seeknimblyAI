/** GET /api/pipeline — ATS applications + jobs for the signed-in org. */

import { NextRequest, NextResponse } from "next/server";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { listRows } from "@/lib/store";
import { ATS_STATUSES, countBy } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  return withOrgScope(auth.org.orgId, async () => {
    const [applications, jobs] = await Promise.all([
      listRows("applications", { limit: 200 }),
      listRows("jobs", { limit: 100 }),
    ]);
    return NextResponse.json({
      applications,
      jobs,
      by_status: countBy(applications, "status", ATS_STATUSES),
    });
  });
}
