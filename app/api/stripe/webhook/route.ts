import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured" },
      { status: 503 }
    );
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid signature" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;
    const email = (session.customer_email || session.customer_details?.email) as string;
    if (!email) return NextResponse.json({ received: true });

    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

    await supabase.from("subscriptions").upsert(
      {
        email: email.toLowerCase(),
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: sub.status,
        trial_end: trialEnd?.toISOString() ?? null,
        current_period_end: periodEnd?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
    return NextResponse.json({ received: true });
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;
    const customer = await getStripe().customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) {
      return NextResponse.json({ received: true });
    }
    const email = (customer as Stripe.Customer).email?.toLowerCase() ?? null;
    if (!email) return NextResponse.json({ received: true });

    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

    await supabase
      .from("subscriptions")
      .update({
        status: sub.status,
        trial_end: trialEnd?.toISOString() ?? null,
        current_period_end: periodEnd?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", sub.id);

    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
