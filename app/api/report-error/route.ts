/**
 * POST /api/report-error — error-correction SLA: user flags a bad compliance
 * answer → compliance_event + audit + optional email to admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { insertRow } from "@/lib/store";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY = z.object({
  message_excerpt: z.string().min(1).max(4000),
  note: z.string().max(1000).optional(),
  agent: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof BODY>;
  try {
    body = BODY.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return withOrgScope(auth.org.orgId, async () => {
    const title = `User-reported error (${body.agent ?? "compliance"})`;
    const detail = [body.note, "—", body.message_excerpt].filter(Boolean).join("\n").slice(0, 2000);
    const ev = await insertRow("compliance_events", {
      kind: "audit_finding",
      title,
      detail,
      status: "open",
      jurisdiction: null,
    });
    await logAudit({
      agent: body.agent ?? "compliance",
      action: "error_reported",
      entity_type: "compliance_event",
      entity_id: String(ev.id),
      actor: auth.email,
      status: "ok",
      detail: body.note ?? "User reported an error on an agent answer",
    });

    const notify = process.env.ADMIN_EMAIL || process.env.AUTH_EMAIL;
    if (notify && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.RESEND_FROM ?? "Seeknimbly <onboarding@resend.dev>",
          to: [notify],
          subject: `[Seeknimbly] Error report from ${auth.email}`,
          text: `${title}\n\nFrom: ${auth.email}\nNote: ${body.note ?? "(none)"}\n\nExcerpt:\n${body.message_excerpt}`,
        });
      } catch (e) {
        console.warn("[report-error] notify failed", e);
      }
    }

    return NextResponse.json({
      ok: true,
      event_id: ev.id,
      message: "Thanks — logged for correction. This feeds our error-correction SLA.",
    });
  });
}
