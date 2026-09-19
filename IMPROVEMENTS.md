# SeeknimblyAI — Improvement Recommendations

All coded roadmap items from the data-room critique are shipped.

## Done

1–18 product/engineering items (loop, tenancy, dashboards, web search, metrics, streaming, intake, eval, error report, rate limits, model split, PII audit, annual Stripe, Day-1 demo, partners).

**Remaining app surfaces (this pass):**
- Team invites + Settings (`/app/settings`)
- Legal / CASL / E&O checklist + engagement-letter skeleton (#19 in-product)
- Onboarding hire/task dashboard + personal checklist route
- Training / L&D paths dashboard
- Quarterly compliance audit automation + cron
- Stripe `plan` on subscriptions + portal return to Settings

## Still human / process (not code)

- Counsel completes engagement letter and CASL review
- Bind E&O policy
- Configure Stripe Customer Portal products for monthly↔annual switching in the Stripe Dashboard

## Ops reminder

Re-run `supabase/agents_schema.sql` and `supabase/subscriptions.sql` after pull (org_invites, plan column, channel_partner_lead_id).
