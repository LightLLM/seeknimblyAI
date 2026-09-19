# SeeknimblyAI — Improvement Recommendations

**July 2026 · Based on:** the repo, the live product direction, your data room (especially the a16z-style investor critique), and the hermes agent design.

## Priority 1–3 — done

Loop engineering, org tenancy, dashboards, web search, metrics, streaming, intake forms, eval harness, error reporting, durable rate limits, model split, audit PII redaction.

## Priority 4 — business alignment

15. **~~Headline metrics.~~** Done.
16. **~~Annual contracts in Stripe.~~** Done — checkout `{ plan: "monthly" | "annual" }` + `STRIPE_PRICE_ID_ANNUAL`; trial gate shows both when configured.
17. **~~Day-1 Compliance Snapshot demo.~~** Done — `/demo`.
18. **~~Channel-partner surface.~~** Done — `/app/partners` + link API; clients carry `channel_partner_lead_id`.
19. **Legal architecture before scale** — counsel / CASL / E&O (process, not code). Keep human-approval non-negotiable.

## Also shipped

- **Data retention cron** — `?task=data-retention` (Sundays 03:00): clear expired rate keys, trim chats >180d, soft-purge memories >365d. Audit log remains append-only.
- **GitHub Actions CI** — `npm test` + `test:eval` + `build` on push/PR.

## Suggested sequence

Next (optional): wire Stripe Customer Portal plan switching, invite flow for org members, live model eval in CI (needs `OPENAI_API_KEY` secret), engagement letter / CASL review (#19).
