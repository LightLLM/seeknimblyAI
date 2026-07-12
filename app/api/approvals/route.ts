/**
 * GET  /api/approvals            — list outbox drafts (default: pending)
 * POST /api/approvals            — { id, decision: "approve"|"reject", note? }
 * Approving marks the draft approved and audit-logs the decision. Actual
 * transmission (email provider, job board) is a later integration; approved
 * drafts are ready to copy/send.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { listRows, updateRow, getRow } from "@/lib/store";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserEmail(req: NextRequest): Promise<string | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const token = await getToken({ req, secret });
  return typeof token?.email === "string" ? token.email : null;
}

export async function GET(req: NextRequest) {
  const email = await getUserEmail(req);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const drafts = await listRows("outbox_drafts", {
    filters: status === "all" ? {} : { status },
    limit: 100,
  });
  return NextResponse.json({ drafts });
}

const POST_SCHEMA = z.object({
  id: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const email = await getUserEmail(req);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof POST_SCHEMA>;
  try {
    body = POST_SCHEMA.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const draft = await getRow("outbox_drafts", body.id);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (draft.status !== "pending") {
    return NextResponse.json({ error: `Draft already ${draft.status}` }, { status: 409 });
  }

  const status = body.decision === "approve" ? "approved" : "rejected";
  const updated = await updateRow("outbox_drafts", body.id, {
    status,
    decided_by: email,
    decision_note: body.note ?? null,
    decided_at: new Date().toISOString(),
  });

  await logAudit({
    agent: String(draft.agent ?? "unknown"),
    action: `draft_${status}:${draft.channel}`,
    entity_type: "outbox_draft",
    entity_id: body.id,
    actor: email,
    status: status as "approved" | "rejected",
    detail: body.note ?? String(draft.subject ?? ""),
  });

  return NextResponse.json({ ok: true, draft: updated });
}
