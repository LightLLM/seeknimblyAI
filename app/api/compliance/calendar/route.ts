/** GET /api/compliance/calendar — recurring calendar + logged events. */

import { NextRequest, NextResponse } from "next/server";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { listRows } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECURRING = [
  { when: "15th of each month", what: "CRA payroll remittance (regular remitters)", who: "All employers with payroll" },
  { when: "Last day of February", what: "T4/T4A slips to employees and CRA", who: "All employers" },
  { when: "Mar 31 (ON)", what: "WSIB annual reconciliation", who: "Ontario employers" },
  { when: "Feb 28 / Mar (BC)", what: "WorkSafeBC annual payroll report", who: "BC employers" },
  { when: "Jun 1", what: "Ontario minimum wage change announcements (effective Oct 1)", who: "ON employers" },
  { when: "Oct 1", what: "Ontario minimum wage adjustment takes effect", who: "ON employers" },
  { when: "Jan 1", what: "Federal + provincial minimum wage / ESA changes commonly take effect", who: "All" },
  { when: "Within 5 calendar days of interruption of earnings", what: "Issue ROE", who: "All employers" },
];

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  return withOrgScope(auth.org.orgId, async () => {
    const events = await listRows("compliance_events", { limit: 200 });
    return NextResponse.json({
      recurring: RECURRING,
      events,
      open: events.filter((e) => e.status === "open"),
    });
  });
}
