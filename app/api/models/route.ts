/** GET /api/models — chat model catalog + which providers are configured. */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { listModelsForClient } from "@/lib/llm";
import { getOrgAllowedProviders } from "@/lib/org-llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const allowedProviders = await getOrgAllowedProviders(auth.org.orgId);
  return NextResponse.json({
    models: listModelsForClient(allowedProviders),
    allowedProviders,
  });
}
