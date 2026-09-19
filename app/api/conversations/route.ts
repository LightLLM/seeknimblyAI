/**
 * GET  /api/conversations — the signed-in user's chats (most recent first)
 * POST /api/conversations — upsert one chat { id, title, messages, pinned, createdAt, updatedAt }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { listConversations, upsertConversation } from "@/lib/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authedEmail(req: NextRequest): Promise<string | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? await getToken({ req, secret }) : null;
  return typeof token?.email === "string" ? token.email : null;
}

export async function GET(req: NextRequest) {
  const email = await authedEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversations = await listConversations(email);
  return NextResponse.json({ conversations });
}

const POST_SCHEMA = z.object({
  id: z.string().min(1).max(80),
  title: z.string().max(200).default("New session"),
  messages: z.array(z.unknown()).max(400),
  pinned: z.boolean().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const email = await authedEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: z.infer<typeof POST_SCHEMA>;
  try {
    body = POST_SCHEMA.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  try {
    const saved = await upsertConversation(email, body);
    return NextResponse.json({ ok: true, id: saved.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed";
    const status = message.includes("another user") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
