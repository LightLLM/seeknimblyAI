/**
 * POST /api/partners/link — { client_id, partner_lead_id | null }
 * Attach a client workspace to a channel-partner firm (or unlink).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { getRow, updateRow } from "@/lib/store";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY = z.object({
  client_id: z.string().min(1),
  partner_lead_id: z.string().nullable(),
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
    const client = await getRow("clients", body.client_id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    if (body.partner_lead_id) {
      const lead = await getRow("leads", body.partner_lead_id);
      if (!lead) return NextResponse.json({ error: "Partner lead not found" }, { status: 404 });
      if (!lead.is_channel_partner) {
        return NextResponse.json(
          { error: "Lead is not marked as a channel partner. Flag is_channel_partner on the lead first." },
          { status: 400 }
        );
      }
    }

    const updated = await updateRow("clients", body.client_id, {
      channel_partner_lead_id: body.partner_lead_id,
    });
    await logAudit({
      agent: "client_onboarding",
      action: body.partner_lead_id ? "partner_linked" : "partner_unlinked",
      entity_type: "client",
      entity_id: body.client_id,
      actor: auth.email,
      detail: body.partner_lead_id ?? "unlinked",
    });
    return NextResponse.json({ ok: true, client: updated });
  });
}
