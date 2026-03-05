import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";

const secret = process.env.NEXTAUTH_SECRET;
const baseUrl = process.env.NEXTAUTH_URL ?? process.env.SITE_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  if (!secret) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const token = await getToken({ req, secret });
  if (!token?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = (token.email as string).trim().toLowerCase();
  const supabase = getSupabaseAdmin();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("email", email)
    .single();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found. Complete checkout first." },
      { status: 400 }
    );
  }

  try {
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${baseUrl}/app`,
    });

    if (!portalSession.url) {
      return NextResponse.json(
        { error: "Failed to create portal session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: portalSession.url });
  } catch (e) {
    console.error("[stripe/portal]", e);
    return NextResponse.json(
      { error: "Failed to open billing portal" },
      { status: 500 }
    );
  }
}
