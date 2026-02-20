import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { suggestChatAgent } from "@/lib/chatRouter";

export const dynamic = "force-dynamic";

const BODY_SCHEMA = z.object({
  message: z.string().min(1, "Message is required").max(8000),
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

  const result = suggestChatAgent(body.message);
  return NextResponse.json(result);
}
