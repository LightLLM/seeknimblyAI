/** POST /api/demo/snapshot — public Day-1 Compliance Snapshot (no auth). */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildDay1Snapshot } from "@/lib/demo-snapshot";
import { allowRequest, rateLimitKey } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY = z.object({
  province: z.enum(["ON", "BC", "AB", "QC"]),
  employee_count: z.number().int().min(1).max(500),
  industry: z.string().min(1).max(80),
  has_handbook: z.boolean().optional(),
  uses_contractors: z.boolean().optional(),
});

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  const key = rateLimitKey(clientIp(req), "demo-snapshot");
  if (!(await allowRequest(key))) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }
  try {
    const body = BODY.parse(await req.json());
    const snapshot = buildDay1Snapshot(body);
    return NextResponse.json({ snapshot });
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
