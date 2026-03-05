import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error("NEXTAUTH_SECRET is required");
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret });
  if (!token?.email) {
    return NextResponse.json({ subscription: null }, { status: 200 });
  }

  const { getSupabaseAdmin } = await import("@/lib/supabase");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, trial_end, current_period_end, stripe_customer_id")
    .eq("email", (token.email as string).toLowerCase())
    .single();

  if (error || !data) {
    return NextResponse.json(
      { subscription: null, canAccess: false },
      { status: 200 }
    );
  }

  const now = new Date();
  const trialEnd = data.trial_end ? new Date(data.trial_end) : null;
  const periodEnd = data.current_period_end ? new Date(data.current_period_end) : null;
  const isTrialing = data.status === "trialing" && trialEnd && trialEnd > now;
  const isActive = data.status === "active" && periodEnd && periodEnd > now;
  const canAccess = isTrialing || isActive;

  return NextResponse.json({
    subscription: {
      status: data.status,
      trial_end: data.trial_end,
      current_period_end: data.current_period_end,
      has_customer: !!data.stripe_customer_id,
    },
    canAccess,
  });
}
