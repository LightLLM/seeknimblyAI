/**
 * GET /api/connectors — configuration status of core services (Loop:
 * Connectors node). Booleans only; never exposes secret values.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAIApiKey } from "@/lib/openai";
import { isSupabaseConfigured } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? await getToken({ req, secret }) : null;
  if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    connectors: {
      openai: Boolean(getOpenAIApiKey()),
      supabase: isSupabaseConfigured(),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      resend: Boolean(process.env.RESEND_API_KEY),
      cron: Boolean(process.env.CRON_SECRET),
      stackone: Boolean(process.env.STACKONE_API_KEY?.trim()),
    },
  });
}
