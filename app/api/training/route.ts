/** GET /api/training — learning paths + items for the org. */

import { NextRequest, NextResponse } from "next/server";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { listRows } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  return withOrgScope(auth.org.orgId, async () => {
    const [paths, items] = await Promise.all([
      listRows("learning_paths", { limit: 100 }),
      listRows("learning_items", { limit: 500 }),
    ]);
    return NextResponse.json({
      paths: paths.map((p) => ({
        ...p,
        items: items.filter((i) => String(i.path_id ?? i.learning_path_id) === String(p.id)),
      })),
    });
  });
}
