import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getToken } from "next-auth/jwt";
import { getStripe, getStripePriceId, type CheckoutPlan } from "@/lib/stripe";

const secret = process.env.NEXTAUTH_SECRET;
const baseUrl = process.env.NEXTAUTH_URL ?? process.env.SITE_URL ?? "http://localhost:3000";

const BODY = z.object({
  plan: z.enum(["monthly", "annual"]).optional().default("monthly"),
});

export async function POST(req: NextRequest) {
  if (!secret) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const token = await getToken({ req, secret });
  if (!token?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let plan: CheckoutPlan = "monthly";
  try {
    const raw = await req.json().catch(() => ({}));
    plan = BODY.parse(raw).plan;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const priceId = getStripePriceId(plan);
  if (!priceId) {
    return NextResponse.json(
      {
        error:
          plan === "annual"
            ? "Annual plan not configured (set STRIPE_PRICE_ID_ANNUAL)."
            : "Server misconfiguration: STRIPE_PRICE_ID not set",
      },
      { status: 500 }
    );
  }

  const email = (token.email as string).trim().toLowerCase();

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 15,
        metadata: { plan },
      },
      metadata: { plan, email },
      success_url: `${baseUrl}/app?checkout=success&plan=${plan}`,
      cancel_url: `${baseUrl}/app?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url, plan });
  } catch (e) {
    console.error("[stripe/checkout]", e);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
