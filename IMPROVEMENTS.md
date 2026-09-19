# SeeknimblyAI — Improvement Recommendations

**July 2026 · Based on:** the repo, the live product direction, your data room (especially the a16z-style investor critique), and the hermes agent design.

## What was just built (baseline)

Seven tool-using agents behind one chat (LLM-routed), Supabase persistence with demo-mode fallback, a code-enforced draft-never-send outbox with an Approvals page, in-chat approval gates for state-mutating actions, and an append-only audit trail.

## Priority 1 — ship the loop end-to-end

1. **~~Wire real transmission behind approvals.~~** Done.
2. **~~Multi-tenancy.~~** Done — org scoping (invite / client-login RLS still future).
3. **~~Scheduled autonomy.~~** Done.
4. **~~Persist conversations server-side.~~** Done.

## Priority 2 — product quality

5. **~~Real web search for compliance.~~** Done.
6. **~~Streaming text in the agent loop.~~** Done — runtime streams final-answer token deltas.
7. **~~Structured intake forms.~~** Done — `/app/intake` + `/api/intake` (hire / job / client).
8. **~~Evaluation harness.~~** Done — `lib/eval/golden.ts` + `npm run test:eval`.
9. **~~Error-correction SLA in-product.~~** Done — "Report an error" on compliance answers → event + admin email.

## Priority 3 — architecture & security

10. **~~Continuation tokens HMAC-signed.~~** Done.
11. **~~Auth on agent routes.~~** Done.
12. **~~Durable rate limiting.~~** Done — Supabase `rate_limits` when configured; in-memory fallback.
13. **~~Model strategy.~~** Done — `OPENAI_ROUTER_MODEL` / `OPENAI_AGENT_MODEL` (fallback `OPENAI_MODEL`).
14. **~~PII hygiene (audit).~~** Done — email/phone redaction + shorter audit detail. Retention job still future.

## Priority 4 — business alignment

15. **~~Headline metrics.~~** Done — `/app/metrics` + ATS/CRM/compliance dashboards.
16. **Annual contracts in Stripe** — second price ID + discount (`STRIPE_PRICE_ID_ANNUAL` stubbed in `.env.example`).
17. **~~Day-1 Compliance Snapshot demo.~~** Done — public `/demo` (no signup).
18. **Channel-partner surface** — many clients, one login (depends on deeper multi-tenancy).
19. **Legal architecture before scale** — counsel / CASL / E&O (process, not code).

## Suggested sequence

Next: annual Stripe price wiring (#16), partner view (#18), data-retention job, then live eval runs against the model on CI.
