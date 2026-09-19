# SeeknimblyAI — Improvement Recommendations

Coded roadmap from the data-room critique is shipped, including hardening stages below.

## Done

1–18 product/engineering items (loop, tenancy, dashboards, web search, metrics, streaming, intake, eval, error report, rate limits, model split, PII audit, annual Stripe, Day-1 demo, partners).

**Product surfaces:** team invites + Settings, legal/CASL checklist, onboarding/training dashboards, quarterly audit, Stripe `plan`.

**Hardening (next stage):**
- Invite revoke + member remove
- Membership-aware RLS policies (`is_org_member`) for future client login
- Certification expiry cron + 90-day retention sweep
- `update_hire_status` tool; offer-accept + draft-reject metric proxies
- Audit CSV export
- Versioned skill-pack metadata on `/api/agents`

## Still human / process (not code)

- Counsel completes engagement letter and CASL review
- Bind E&O policy
- Configure Stripe Customer Portal products for monthly↔annual switching

## Ops reminder

Re-run `supabase/agents_schema.sql` and `supabase/subscriptions.sql` after pull (org_invites, RLS policies, plan column).
