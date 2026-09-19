/** GET /api/clients — client list with modules (Loop: Worktrees/Projects). */

import { NextRequest, NextResponse } from "next/server";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { listRows } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  return withOrgScope(auth.org.orgId, async () => {
    const [clients, modules] = await Promise.all([
      listRows("clients", { limit: 50 }),
      listRows("client_modules", { limit: 200 }),
    ]);
    return NextResponse.json({
      org_id: auth.org.orgId,
      clients: clients.map((c) => ({
        ...c,
        modules: modules.filter((m) => m.client_id === c.id).map((m) => m.module),
      })),
    });
  });
}
