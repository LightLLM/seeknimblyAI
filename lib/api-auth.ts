/**
 * Shared auth + org scope for app API routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { resolveOrgForEmail, type OrgContext } from "@/lib/org";
import { runWithStoreContext } from "@/lib/store";

export async function requireUser(req: NextRequest): Promise<
  | { email: string; org: OrgContext }
  | { error: NextResponse }
> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return { error: NextResponse.json({ error: "Auth not configured." }, { status: 500 }) };
  }
  const token = await getToken({ req, secret });
  const email = typeof token?.email === "string" ? token.email : null;
  if (!email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const org = await resolveOrgForEmail(email);
  return { email, org };
}

/** Run an org-scoped handler; stamps/filters all store reads/writes by org_id. */
export async function withOrgScope<T>(
  orgId: string,
  fn: () => Promise<T>
): Promise<T> {
  return runWithStoreContext({ orgId }, fn);
}
