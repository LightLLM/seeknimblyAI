# SeeknimblyAI — Improvement Recommendations

**July 2026 · Based on:** the repo, the live product direction, your data room (especially the a16z-style investor critique), and the hermes agent design.

## What was just built (baseline)

Seven tool-using agents behind one chat (LLM-routed), Supabase persistence with demo-mode fallback, a code-enforced draft-never-send outbox with an Approvals page, in-chat approval gates for state-mutating actions, and an append-only audit trail. Tests (89) and production build are green.

## Priority 1 — ship the loop end-to-end

1. **Wire real transmission behind approvals.** Approved drafts currently stop at "approved." Add Resend (already a dependency) so approving an email draft actually sends it, and log the send to the audit trail. This completes draft → approve → send → audit, which is the product's core promise.
2. **Multi-tenancy.** Every table needs an `org_id` and Supabase RLS policies keyed to the authenticated user's org. Right now all data lives in one pool behind the service role — fine for a single-founder pilot, a blocker for the second client. This is also SOC2 groundwork your data room commits to.
3. **Scheduled autonomy.** The compliance agent's value is proactive: add Vercel Cron hitting `/api/cron/*` routes for the weekly law-change monitor, monthly calendar sweep, daily lead-gen cadence, and day-7/30/60/90 check-ins. Without cron, the "autonomous" agents only act when spoken to.
4. **Persist conversations server-side.** Transcripts are still localStorage; move to Supabase so agent context survives devices and feeds the outcome-data moat your AGENTS.md calls the company's primary asset.

## Priority 2 — product quality

5. **Real web search for compliance.** The compliance agent asserts law changes from model memory. Give it the web-search tool (already used in `/api/hr/stream`) inside the agent loop, and require an official source URL before `draft_change_brief` accepts the call — the tool contract already asks for it; enforce it.
6. **Streaming text in the agent loop.** The generic runtime uses non-streaming completions between tool calls; users see steps but the final answer arrives in one block. Stream the last turn for perceived speed.
7. **Structured intake forms.** Chat is a poor way to enter a new hire or a job req. Add small forms (hire intake, role intake, client intake) that call the same tools — chat for judgment, forms for data entry.
8. **Evaluation harness.** You have prompts making legal-adjacent claims. Build a golden-question test set per province (min wage, overtime, ROE timing) and run it on every model/prompt change. One wrong compliance answer to a paying client is the "AI liability bomb" from your investor critique.
9. **Error-correction SLA in-product.** Add a "report an error" button on compliance outputs that files a compliance_event and notifies you. Your critique names a documented correction process as both product feature and legal shield.

## Priority 3 — architecture & security

10. **Continuation tokens are unsigned.** The base64 continuation for approval resumes can be tampered with client-side (change tool args between pause and approve). HMAC-sign it (NEXTAUTH_SECRET) or persist pending calls server-side keyed by id.
11. **Auth on agent routes.** `/api/agents/*` currently relies on rate limiting only; add the same `getToken` check used by approvals/audit so anonymous visitors can't burn your OpenAI budget or write to your DB.
12. **Rate limiting is in-memory** — resets per serverless instance on Vercel. Move to Upstash Redis or a Supabase counter for real protection.
13. **Model strategy.** Router uses gpt-4o-mini-class calls, agents gpt-4o via one env var. Split `OPENAI_ROUTER_MODEL` and `OPENAI_AGENT_MODEL`; consider a provider-agnostic layer later (you chose OpenAI for now — the runtime is small enough to swap).
14. **PII hygiene.** Resume text and employee data flow through prompts and audit detail fields. Truncate/omit PII in audit `detail`, add a data-retention job, and document PIPEDA/Law 25 handling — your privacy rule #5 needs code behind it.

## Priority 4 — business alignment (from your own data room)

15. **Instrument the headline metrics now:** compliance events caught, time-to-shortlist, client edits per draft, approval turnaround, 90-day retention. The schema supports all of them; add a `/app/metrics` page. Your critique says 20 customers with 6 months of retention data beats any projection.
16. **Annual contracts in Stripe** (second price ID + discount) — the churn-survival lever the critique calls "survival."
17. **Day-1 Compliance Snapshot as the demo.** It's the wow moment in the hermes design. Make it a public, no-signup demo with canned data: paste your province + headcount, get a snapshot with one real gap. That's your WebSummit booth demo and your top-of-funnel.
18. **Channel-partner surface.** The ICP says accounting firms are the highest-leverage channel; the lead_gen agent knows it, but the product has no partner view (many clients, one login). Ties into multi-tenancy (#2).
19. **Legal architecture before scale** (from your own checklist): engagement letter from employment counsel, CASL review of outreach templates, E&O/professional liability quotes (Embroker/Coalition). The human-approval model you now have in code is the primary legal protection — keep it non-negotiable.

## Suggested sequence

Weeks 1–2: #1, #11, #10 (close the loop safely) → Weeks 3–4: #2, #4 (tenancy + persistence) → Weeks 5–6: #3, #5, #15 (autonomy + metrics) → then the rest as pilots demand.
