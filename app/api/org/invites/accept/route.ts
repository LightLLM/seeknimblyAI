/** POST /api/org/invites/accept — { token } accept invite for signed-in user. */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getToken } from "next-auth/jwt";
import { acceptInvite } from "@/lib/org";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY = z.object({ token: z.string().min(10) });

export async function POST(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "Auth not configured." }, { status: 500 });
  const tokenJwt = await getToken({ req, secret });
  const email = typeof tokenJwt?.email === "string" ? tokenJwt.email : null;
  if (!email) return NextResponse.json({ error: "Unauthorized — sign in first." }, { status: 401 });

  let body: z.infer<typeof BODY>;
  try {
    body = BODY.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const org = await acceptInvite(body.token, email);
    await logAudit({
      agent: "system",
      action: "org_invite_accepted",
      actor: email,
      entity_type: "org",
      entity_id: org.orgId,
      detail: org.orgName,
    });
    return NextResponse.json({ ok: true, org });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Accept failed" }, { status: 400 });
  }
}
