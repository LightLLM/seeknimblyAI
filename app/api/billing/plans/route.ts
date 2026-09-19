/** GET /api/billing/plans — which checkout plans are configured. */

import { NextResponse } from "next/server";
import { annualPlanAvailable } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    monthly: Boolean(process.env.STRIPE_PRICE_ID?.trim()),
    annual: annualPlanAvailable(),
    annual_discount_hint: "Pay annually and lock in the churn-survival rate (typically ~2 months free).",
  });
}
