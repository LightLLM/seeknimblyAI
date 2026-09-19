/**
 * Multi-tenancy: every authenticated user belongs to an org. Agent writes and
 * dashboard reads are scoped to that org_id so a second client cannot see the
 * first client's ATS/CRM/compliance data.
 *
 * Schema: public.orgs + public.org_members (see supabase/agents_schema.sql).
 * Until a real invite flow exists, the first request for an email creates a
 * personal org ("{email}'s workspace") and an owner membership.
 */

import { insertRow, listRows, isSupabaseConfigured } from "@/lib/store";

export type OrgContext = {
  orgId: string;
  email: string;
  role: string;
};

/** Resolve (or create) the org for a signed-in user. */
export async function resolveOrgForEmail(email: string): Promise<OrgContext> {
  const normalized = email.trim().toLowerCase();
  const memberships = await listRows("org_members", {
    filters: { email: normalized },
    limit: 1,
    orderBy: "created_at",
    ascending: true,
  });
  if (memberships[0]?.org_id) {
    return {
      orgId: String(memberships[0].org_id),
      email: normalized,
      role: String(memberships[0].role ?? "owner"),
    };
  }

  const org = await insertRow("orgs", {
    name: `${normalized}'s workspace`,
  });
  await insertRow("org_members", {
    org_id: org.id,
    email: normalized,
    role: "owner",
  });
  return { orgId: String(org.id), email: normalized, role: "owner" };
}

export function orgConfiguredNote(): string | undefined {
  if (!isSupabaseConfigured()) {
    return "demo mode: org scoping is in-memory only";
  }
  return undefined;
}
