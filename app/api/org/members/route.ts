/** GET/POST/DELETE /api/org/members — list; invite; revoke invite or remove member */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import {
  createInvite,
  listOrgMembers,
  listPendingInvites,
  revokeInvite,
  removeOrgMember,
} from "@/lib/org";
import { getRow } from "@/lib/store";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  return withOrgScope(auth.org.orgId, async () => {
    const [members, invites, org] = await Promise.all([
      listOrgMembers(auth.org.orgId),
      listPendingInvites(auth.org.orgId),
      getRow("orgs", auth.org.orgId),
    ]);
    return NextResponse.json({
      org: { id: auth.org.orgId, name: org?.name ?? auth.org.orgName, role: auth.org.role },
      members,
      invites,
    });
  });
}

const INVITE = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  if (auth.org.role !== "owner" && auth.org.role !== "admin") {
    return NextResponse.json({ error: "Only owners/admins can invite." }, { status: 403 });
  }

  let body: z.infer<typeof INVITE>;
  try {
    body = INVITE.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const { token, id } = await createInvite({
      orgId: auth.org.orgId,
      email: body.email,
      role: body.role,
      invitedBy: auth.email,
    });
    const base = process.env.NEXTAUTH_URL ?? process.env.SITE_URL ?? "http://localhost:3000";
    const acceptUrl = `${base}/auth/invite?token=${token}`;

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.RESEND_FROM ?? "Seeknimbly <onboarding@resend.dev>",
          to: [body.email],
          subject: `Join ${auth.org.orgName} on Seeknimbly`,
          text: `${auth.email} invited you to the Seeknimbly workspace "${auth.org.orgName}" as ${body.role}.\n\nAccept: ${acceptUrl}\n\nThis link expires in 7 days.`,
        });
      } catch (e) {
        console.warn("[org/invite] email failed", e);
      }
    }

    await logAudit({
      agent: "system",
      action: "org_invite_created",
      actor: auth.email,
      entity_type: "org_invite",
      entity_id: id,
      detail: body.email,
    });

    return NextResponse.json({
      ok: true,
      invite_id: id,
      accept_url: acceptUrl,
      emailed: Boolean(process.env.RESEND_API_KEY),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invite failed" }, { status: 400 });
  }
}

const DELETE_BODY = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revoke_invite"), invite_id: z.string().min(1) }),
  z.object({ action: z.literal("remove_member"), member_id: z.string().min(1) }),
]);

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  if (auth.org.role !== "owner" && auth.org.role !== "admin") {
    return NextResponse.json({ error: "Only owners/admins can manage the team." }, { status: 403 });
  }

  let body: z.infer<typeof DELETE_BODY>;
  try {
    body = DELETE_BODY.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (body.action === "revoke_invite") {
      await revokeInvite(auth.org.orgId, body.invite_id);
      await logAudit({
        agent: "system",
        action: "org_invite_revoked",
        actor: auth.email,
        entity_type: "org_invite",
        entity_id: body.invite_id,
      });
      return NextResponse.json({ ok: true });
    }

    await removeOrgMember({
      orgId: auth.org.orgId,
      memberId: body.member_id,
      actorEmail: auth.email,
      actorRole: auth.org.role,
    });
    await logAudit({
      agent: "system",
      action: "org_member_removed",
      actor: auth.email,
      entity_type: "org_member",
      entity_id: body.member_id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
