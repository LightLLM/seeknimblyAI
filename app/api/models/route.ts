/** GET /api/models — chat model catalog + which providers are configured. */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { listModelsForClient } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? await getToken({ req, secret }) : null;
  if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ models: listModelsForClient() });
}
