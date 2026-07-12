import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { routeMessage } from "@/lib/agents/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_SCHEMA = z.object({
  message: z.string().min(1, "Message is required").max(8000),
  history: z
    .array(z.object({ role: z.string(), content: z.string().max(8000) }))
    .max(20)
    .optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BODY_SCHEMA>;
  try {
    const raw = await req.json();
    body = BODY_SCHEMA.parse(raw);
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await routeMessage(body.message, body.history ?? []);
  return NextResponse.json({
    suggestedAgent: result.suggestedAgent,
    reason: result.reason,
    method: result.method,
  });
}
