/** GET /api/audit — the append-only audit trail (most recent first). */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { listAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? await getToken({ req, secret }) : null;
  if (!token?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 200, 500);
  const entries = await listAudit(limit);
  return NextResponse.json({ entries });
}
