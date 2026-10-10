/**
 * POST /api/auth/signup — create email/password account (then client signs in).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordUser } from "@/lib/users";
import { validatePasswordStrength } from "@/lib/password";
import { resolveOrgForEmail } from "@/lib/org";
import { updateRow } from "@/lib/store";
import { allowRequest, rateLimitKey } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1),
  name: z.string().max(200).optional(),
  company_name: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await allowRequest(rateLimitKey(ip, "signup")))) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: z.infer<typeof BODY>;
  try {
    body = BODY.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const strength = validatePasswordStrength(body.password);
  if (strength) {
    return NextResponse.json({ error: strength }, { status: 400 });
  }

  try {
    const user = await createPasswordUser({
      email: body.email,
      password: body.password,
      name: body.name,
    });

    const org = await resolveOrgForEmail(user.email);
    if (body.company_name?.trim()) {
      await updateRow("orgs", org.orgId, { name: body.company_name.trim() });
    }

    return NextResponse.json({
      ok: true,
      email: user.email,
      name: user.name,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create account";
    const status = /already exists/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
