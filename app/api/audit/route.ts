/** GET /api/audit — the append-only audit trail (most recent first). */

import { NextRequest, NextResponse } from "next/server";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { listAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 200, 500);
  return withOrgScope(auth.org.orgId, async () => {
    const entries = await listAudit(limit);
    return NextResponse.json({ entries });
  });
}
