import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import crypto from "crypto";

const BODY_SCHEMA = z.object({
  email: z.string().email("Invalid email address"),
  company_name: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BODY_SCHEMA>;
  try {
    const raw = await req.json();
    body = BODY_SCHEMA.parse(raw);
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.SITE_URL ?? "http://localhost:3000";

  if (!resendKey) {
    return NextResponse.json(
      { error: "Server configuration error: email not configured." },
      { status: 500 }
    );
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase.from("trial_signups").insert({
      email: body.email.trim().toLowerCase(),
      company_name: body.company_name?.trim() || null,
      token,
      token_expires_at: tokenExpiresAt.toISOString(),
    });

    if (insertError) {
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    const magicLink = `${baseUrl}/auth/verify?token=${token}`;
    const resend = new Resend(resendKey);
    const { error: sendError } = await resend.emails.send({
      from,
      to: body.email.trim(),
      subject: "Start your Seeknimbly trial",
      html: `
        <p>Hi,</p>
        <p>Click the link below to start your free trial of Seeknimbly HR:</p>
        <p><a href="${magicLink}" style="color: #0a84ff;">${magicLink}</a></p>
        <p>This link expires in 24 hours and can only be used once.</p>
        <p>If you didn’t request this, you can ignore this email.</p>
        <p>— Seeknimbly</p>
      `,
    });

    if (sendError) {
      return NextResponse.json(
        { error: "Something went wrong sending the email. Please try again." },
        { status: 500 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
