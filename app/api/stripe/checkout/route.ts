import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getStripe } from "@/lib/stripe";

const secret = process.env.NEXTAUTH_SECRET;
const priceId = process.env.STRIPE_PRICE_ID;
const baseUrl = process.env.NEXTAUTH_URL ?? process.env.SITE_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  if (!secret) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (!priceId) {
    return NextResponse.json(
      { error: "Server misconfiguration: STRIPE_PRICE_ID not set" },
      { status: 500 }
    );
  }

  const token = await getToken({ req, secret });
  if (!token?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = (token.email as string).trim().toLowerCase();

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 15,
      },
      success_url: `${baseUrl}/app?checkout=success`,
      cancel_url: `${baseUrl}/app?checkout=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe/checkout]", e);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
