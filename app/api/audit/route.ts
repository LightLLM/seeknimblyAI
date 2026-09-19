/** GET /api/audit — JSON trail, or CSV with ?format=csv */

import { NextRequest, NextResponse } from "next/server";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { listAudit, exportAuditCsv } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const format = (req.nextUrl.searchParams.get("format") ?? "json").toLowerCase();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || (format === "csv" ? 1000 : 200), 5000);

  return withOrgScope(auth.org.orgId, async () => {
    if (format === "csv") {
      const csv = await exportAuditCsv(limit);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="seeknimbly-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }
    const entries = await listAudit(Math.min(limit, 500));
    return NextResponse.json({ entries });
  });
}
