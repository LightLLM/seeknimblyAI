# SeeknimblyAI — Improvement Recommendations

**July 2026 · Based on:** the repo, the live product direction, your data room (especially the a16z-style investor critique), and the hermes agent design.

## What was just built (baseline)

Seven tool-using agents behind one chat (LLM-routed), Supabase persistence with demo-mode fallback, a code-enforced draft-never-send outbox with an Approvals page, in-chat approval gates for state-mutating actions, and an append-only audit trail. Tests (89) and production build are green.

## Priority 1 — ship the loop end-to-end

1. **~~Wire real transmission behind approvals.~~** Done — approving an email draft sends via Resend when `RESEND_API_KEY` is set.
2. **~~Multi-tenancy.~~** Done — `orgs` / `org_members`, `org_id` on business tables, AsyncLocalStorage store scoping, cron runs per org. (Invite flow / client-login RLS policies still future work.)
3. **~~Scheduled autonomy.~~** Done — Vercel Cron → `/api/cron` for law-change, calendar, lead-gen, check-ins, sales follow-ups.
4. **~~Persist conversations server-side.~~** Done — `/api/conversations` + client sync; localStorage remains cache.

## Priority 2 — product quality

5. **~~Real web search for compliance.~~** Done — compliance `web_search` tool (Responses API) + official-URL enforcement on `draft_change_brief`.
6. **Streaming text in the agent loop.** The generic runtime uses non-streaming completions between tool calls; users see steps but the final answer arrives in one block. Stream the last turn for perceived speed.
7. **Structured intake forms.** Chat is a poor way to enter a new hire or a job req. Add small forms (hire intake, role intake, client intake) that call the same tools — chat for judgment, forms for data entry.
8. **Evaluation harness.** You have prompts making legal-adjacent claims. Build a golden-question test set per province (min wage, overtime, ROE timing) and run it on every model/prompt change. One wrong compliance answer to a paying client is the "AI liability bomb" from your investor critique.
9. **Error-correction SLA in-product.** Add a "report an error" button on compliance outputs that files a compliance_event and notifies you. Your critique names a documented correction process as both product feature and legal shield.

## Priority 3 — architecture & security

10. **~~Continuation tokens are unsigned.~~** Done — HMAC-signed with `NEXTAUTH_SECRET`.
11. **~~Auth on agent routes.~~** Done — `getToken` on `/api/agents/*` and related surfaces.
12. **Rate limiting is in-memory** — resets per serverless instance on Vercel. Move to Upstash Redis or a Supabase counter for real protection.
13. **Model strategy.** Router uses gpt-4o-mini-class calls, agents gpt-4o via one env var. Split `OPENAI_ROUTER_MODEL` and `OPENAI_AGENT_MODEL`; consider a provider-agnostic layer later (you chose OpenAI for now — the runtime is small enough to swap).
14. **PII hygiene.** Resume text and employee data flow through prompts and audit detail fields. Truncate/omit PII in audit `detail`, add a data-retention job, and document PIPEDA/Law 25 handling — your privacy rule #5 needs code behind it.

## Priority 4 — business alignment (from your own data room)

15. **~~Instrument the headline metrics now.~~** Done — `/app/metrics` + `/api/metrics` (events caught, time-to-shortlist, approval turnaround, 90-day retention). Also shipped ATS/CRM/compliance calendar dashboards.
16. **Annual contracts in Stripe** (second price ID + discount) — the churn-survival lever the critique calls "survival."
17. **Day-1 Compliance Snapshot as the demo.** It's the wow moment in the hermes design. Make it a public, no-signup demo with canned data: paste your province + headcount, get a snapshot with one real gap. That's your WebSummit booth demo and your top-of-funnel.
18. **Channel-partner surface.** The ICP says accounting firms are the highest-leverage channel; the lead_gen agent knows it, but the product has no partner view (many clients, one login). Ties into multi-tenancy (#2).
19. **Legal architecture before scale** (from your own checklist): engagement letter from employment counsel, CASL review of outreach templates, E&O/professional liability quotes (Embroker/Coalition). The human-approval model you now have in code is the primary legal protection — keep it non-negotiable.

## Suggested sequence

Next: #6 (stream last turn), #12 (Redis rate limits), #7 (intake forms), #17 (public Day-1 snapshot), then #8 eval harness.
