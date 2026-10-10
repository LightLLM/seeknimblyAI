/** GET /api/auth/methods — which signup/sign-in methods are configured. */

import { NextResponse } from "next/server";
import { googleAuthConfigured, microsoftAuthConfigured } from "@/lib/auth-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    google: googleAuthConfigured(),
    microsoft: microsoftAuthConfigured(),
    credentials: true,
    magicLink: Boolean(process.env.RESEND_API_KEY?.trim()),
  });
}
