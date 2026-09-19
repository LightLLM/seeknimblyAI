/**
 * GET  /api/approvals            — list outbox drafts (default: pending)
 * POST /api/approvals            — { id, decision: "approve"|"reject", note? }
 * Approving marks the draft approved and audit-logs the decision. If the
 * draft is an email and RESEND_API_KEY is configured, the approved draft is
 * transmitted via Resend and the status advances to "sent". Other channels
 * (postings, proposals, LinkedIn) remain copy/send after approval.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listRows, updateRow, getRow } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { requireUser, withOrgScope } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  return withOrgScope(auth.org.orgId, async () => {
    const drafts = await listRows("outbox_drafts", {
      filters: status === "all" ? {} : { status },
      limit: 100,
    });
    return NextResponse.json({ drafts });
  });
}

const POST_SCHEMA = z.object({
  id: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const email = auth.email;

  let body: z.infer<typeof POST_SCHEMA>;
  try {
    body = POST_SCHEMA.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return withOrgScope(auth.org.orgId, async () => {
    const draft = await getRow("outbox_drafts", body.id);
    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    if (draft.status !== "pending") {
      return NextResponse.json({ error: `Draft already ${draft.status}` }, { status: 409 });
    }

    const status = body.decision === "approve" ? "approved" : "rejected";
    let updated = await updateRow("outbox_drafts", body.id, {
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

    let transmitted = false;
    let note: string | undefined;
    const recipient = typeof draft.recipient === "string" ? draft.recipient.trim() : "";
    if (status === "approved" && draft.channel === "email") {
      if (!recipient.includes("@")) {
        note = "Approved. No valid recipient email on the draft — send manually.";
      } else if (!process.env.RESEND_API_KEY) {
        note = "Approved. RESEND_API_KEY not configured — copy and send manually.";
      } else {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          const { error } = await resend.emails.send({
            from: process.env.RESEND_FROM ?? "Seeknimbly <onboarding@resend.dev>",
            to: [recipient],
            subject: String(draft.subject ?? "(no subject)"),
            text: String(draft.body),
          });
          if (error) {
            note = `Approved, but sending failed: ${error.message ?? "unknown error"}. Send manually or retry.`;
            await logAudit({
              agent: String(draft.agent ?? "unknown"),
              action: "draft_send_failed:email",
              entity_type: "outbox_draft",
              entity_id: body.id,
              actor: email,
              status: "error",
              detail: note,
            });
          } else {
            transmitted = true;
            updated = await updateRow("outbox_drafts", body.id, { status: "sent" });
            await logAudit({
              agent: String(draft.agent ?? "unknown"),
              action: "draft_sent:email",
              entity_type: "outbox_draft",
              entity_id: body.id,
              actor: email,
              status: "approved",
              detail: `Sent to ${recipient}: ${String(draft.subject ?? "")}`,
            });
          }
        } catch (e) {
          note = `Approved, but sending failed: ${e instanceof Error ? e.message : "unknown error"}.`;
        }
      }
    }

    return NextResponse.json({ ok: true, draft: updated, transmitted, note });
  });
}
