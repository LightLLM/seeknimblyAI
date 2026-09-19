/** GET /api/agents — agent catalog with tools (Loop: Sub-agents + Skills). */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { AGENTS } from "@/lib/agents/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? await getToken({ req, secret }) : null;
  if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    agents: AGENTS.map((a) => ({
      id: a.id,
      label: a.label,
      description: a.description,
      sample: a.sample,
      tools: a.tools.map((t) => ({
        name: t.definition.function.name,
        description: t.definition.function.description ?? "",
        requiresApproval: Boolean(t.requiresApproval),
      })),
    })),
  });
}
