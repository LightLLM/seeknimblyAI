/** GET /api/partners — channel-partner portfolio for the signed-in org. */

import { NextRequest, NextResponse } from "next/server";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { listPartnerPortfolio } from "@/lib/partners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  return withOrgScope(auth.org.orgId, async () => {
    const portfolio = await listPartnerPortfolio();
    return NextResponse.json(portfolio);
  });
}
