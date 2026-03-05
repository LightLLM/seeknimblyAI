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
