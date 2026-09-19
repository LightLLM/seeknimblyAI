import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Missing STRIPE_SECRET_KEY");
    _stripe = new Stripe(secret);
  }
  return _stripe;
}

export type CheckoutPlan = "monthly" | "annual";

/** Resolve Stripe Price ID for monthly vs annual (annual = churn-survival lever). */
export function getStripePriceId(plan: CheckoutPlan = "monthly"): string | null {
  if (plan === "annual") {
    return process.env.STRIPE_PRICE_ID_ANNUAL?.trim() || null;
  }
  return process.env.STRIPE_PRICE_ID?.trim() || null;
}

export function annualPlanAvailable(): boolean {
  return Boolean(process.env.STRIPE_PRICE_ID_ANNUAL?.trim());
}
