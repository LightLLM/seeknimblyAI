/** GET /api/memory — the agents' persistent memory (Loop: Memory node). */

import { NextRequest, NextResponse } from "next/server";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { listRows } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const kind = req.nextUrl.searchParams.get("kind");
  return withOrgScope(auth.org.orgId, async () => {
    const memories = await listRows("memories", { filters: kind ? { kind } : {}, limit: 200 });
    return NextResponse.json({ memories });
  });
}
