/** POST /api/automations/run — { id } run one automation now (force) for this org. */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAutomation } from "@/lib/automations-runner";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  let id: string;
  try {
    id = z.object({ id: z.string().min(1) }).parse(await req.json()).id;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const result = await runAutomation(id, { force: true, orgId: auth.org.orgId });
  return NextResponse.json(result, { status: result.status === "error" ? 500 : 200 });
}
