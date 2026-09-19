/** GET /api/plugins/stackone — StackOne connector status (no secrets). */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isStackOneConfigured, STACKONE_VENDORS, getStackOneMcpUrl } from "@/lib/stackone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? await getToken({ req, secret }) : null;
  if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accountId = (req.nextUrl.searchParams.get("account_id") ?? "").trim();
  return NextResponse.json({
    plugin: "stackone",
    configured: isStackOneConfigured(),
    vendors: STACKONE_VENDORS,
    mcp_url: accountId ? getStackOneMcpUrl(accountId) : null,
    docs: "https://www.stackone.com/",
    hint: isStackOneConfigured()
      ? "STACKONE_API_KEY is set. Paste your StackOne account id below to link a customer HCM."
      : "Set STACKONE_API_KEY in the server environment (.env.local / Vercel), then connect an account.",
  });
}
