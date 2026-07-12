# SeeknimblyAI — Agentic HR Platform Requirements

**Version 1.0 · July 2026 · Derived from:** the `LightLLM/seeknimblyAI` repo, the DataRoom (roadmap, product overview, investor critique, SOC2 plan), and the `seeknimbly-hermes` agent workspace design.

## 1. Product vision

Seeknimbly is a full-stack agentic HR platform for SMBs (10–150 employees): autonomous agents that *complete* HR work — recruiting, onboarding, training, compliance — with the client approving at defined gates. Primary market: Canadian SMBs (ON, BC, AB, QC first); US expansion supported. The company also runs its own growth on the same agent runtime (lead-gen, sales, client onboarding).

## 2. Agents

### 2.1 HR service agents (what clients pay for)

**A1 Recruiting Agent**
- Intake role requirements (title, must-haves, salary range, province, work model).
- Draft job descriptions and per-channel posting plans (client approves before posting).
- Screen resumes against the approved rubric only; produce a ranked shortlist with rationale and a rejected list with reason codes; persist the rubric + scores as the bias-audit record.
- Draft candidate outreach and interview invitations (draft-only → approval outbox).
- Maintain the ATS pipeline in the database (statuses: new → screened → contacted → scheduled → offer → hired/rejected).
- Provide a sourcing workflow (boolean strings, X-ray, scorecard) when no candidate database is connected.
- Never score or filter on prohibited grounds (Canadian human rights law); record the rubric used.

**A2 Onboarding Agent**
- Draft offer letters from province-aware templates; termination/probation clauses must meet the province's ESA minimums; flag custom clauses for counsel.
- Generate the statutory paperwork checklist (Canada: federal + provincial TD1, SIN collection/expiry tracking, work authorization, payroll enrollment, workers' comp, benefits).
- Generate first-week plan and 30/60/90 plan; persist as a checklist with owners and due dates.
- Schedule day 7/30/60/90 check-ins; track 90-day retention per hire (feeds recruiting quality loop).

**A3 Training / L&D Agent**
- Recommend training incl. province-mandated items (e.g., Ontario H&S awareness, harassment training where required).
- Build role-based learning paths with milestones; persist and track completion.
- Track certifications and expiry dates; remind before lapse.

**A4 Compliance Agent**
- Jurisdiction scope: CRA payroll, EI/CPP, PIPEDA/CASL federally; provincial ESA, workers' comp, privacy (Quebec Law 25, BC/AB PIPA), BC Pay Transparency, Quebec Bill 96 flags.
- Weekly law-change monitor → Change Brief (what changed, effective date, affected clients, required action, draft edit, official source + date checked).
- Monthly compliance-calendar sweep: reminders 10 business days before applicable deadlines.
- Quarterly audit: 12-point checklist (payroll, classification, wage floor, overtime, vacation/stat pay, contracts, workers' comp, handbook, training, privacy, ROE, postings) with scored report.
- Log every compliance event caught — headline product metric and premium pricing lever.
- Document Q&A: answer only from supplied documents; SOC2/ISO 9001 controls mapping.

### 2.2 Lifecycle agents (running Seeknimbly itself)

**A5 Lead-Gen & Outreach Agent** — source and score prospects (0–100 ICP rubric), record in CRM (no duplicates), draft personalized outreach to the approval outbox. CASL-aware: prefer LinkedIn/referral for cold contact; 3 touches max then dormant.

**A6 Sales Pipeline Agent** — stage management (new → … → closed_won/lost), same-day reply drafts, discovery-call one-pagers, proposals from template (modules, tier, per-hire fee, annual-prepay discount, 30-day pilot), objection playbook, mandatory won/lost reason.

**A7 Client Onboarding Agent** — signed client → live in ≤5 business days: client profile, intake questionnaire draft, Day-1 Compliance Snapshot (must catch at least one real gap), module provisioning, kickoff draft, recurring work scheduled. Pause and escalate if intake reveals an active legal dispute.

## 3. Hard rules (non-negotiable, enforced in the runtime)

1. **Draft, never send.** All external communications (email, LinkedIn, filings, postings) are drafts in the approval outbox until a human approves. Enforced at the tool layer, not the prompt layer.
2. **Guidance, not legal advice.** Disclaimer on all compliance output. Never file with a government body.
3. **Human-in-the-loop on consequential actions.** Policy changes, filings, offers, terminations, anything with a deadline/fine → client approval, logged with timestamp and approver.
4. **Audit log everything.** Every tool execution and approval decision writes an immutable audit row (timestamp, agent, action, entity, approver, status).
5. **Escalate live disputes.** Active termination, complaint, or government inquiry → stop and flag a human.
6. **Privacy.** PIPEDA / Quebec Law 25: minimum collection, employee data stays in the client's record, no cross-client leakage.
7. **Bias-safe screening.** Job-related criteria only; rubric persisted per screening run.

## 4. Functional requirements — platform

- **F1 Unified chat** with LLM-based intent routing across all agents; suggestion + user approval/override before dispatch (existing approval-card UX retained). Keyword fallback when no API key.
- **F2 Agent runtime**: one generic tool-loop runner (streamed NDJSON: steps, text deltas, pending approvals, done/error), max tool rounds, per-agent tool registry, approval-required tool list, continuation token to resume after approval.
- **F3 Persistence (Supabase)**: candidates, jobs, applications (ATS), hires + onboarding tasks, learning paths + items, compliance events, leads (CRM), clients + provisioned modules, outbox drafts, approvals, audit log. Graceful degradation to in-memory stores when Supabase is not configured (dev/demo mode, clearly labeled).
- **F4 Approvals surface**: list pending drafts/tool calls, view content, approve/reject with note; approval resumes the agent run; decision audit-logged.
- **F5 Dashboards**: ATS pipeline, onboarding checklists, compliance calendar/events, CRM stages, audit trail.
- **F6 Scheduled work** (cron-ready endpoints): weekly law-change monitor, monthly calendar sweep, quarterly audits, daily lead-gen cadence, onboarding check-ins.
- **F7 Auth & billing**: retain NextAuth (credentials + magic link), Stripe 15-day trial, admin bypass.
- **F8 Existing API compatibility**: `/api/chat`, `/api/hr`, `/api/hr/stream`, `/api/agent/stream(+continue)` keep working.

## 5. Non-functional requirements

- **Security**: OpenAI key server-side only; Zod validation on all routes; rate limiting per IP+route; no PII in logs; RLS-ready schema (service-role access from server only).
- **Reliability**: streaming with non-streaming fallback; tool errors surfaced, never silently dropped; 60s function budget on Vercel.
- **Testability**: Jest unit tests for router, runtime approval gating, tool handlers (fallback mode), prompts; `npm test && npm run build` green.
- **Auditability**: SOC2 trajectory per DataRoom — audit log append-only, approvals recorded with actor and timestamp.
- **Cost**: model configurable via `OPENAI_MODEL`; router uses small/cheap calls; tool loops capped.

## 6. Data model (Supabase)

`candidates`, `jobs`, `applications` (candidate×job, status, score, rubric, notes) · `hires`, `onboarding_tasks` (category: statutory/equipment/training/checkin; due dates) · `learning_paths`, `learning_items` · `compliance_events` (type, jurisdiction, client, deadline, source URL, status) · `leads` (score, stage, province, vertical, won/lost reason) · `clients`, `client_modules` · `outbox_drafts` (channel, recipient, subject, body, agent, status: pending/approved/rejected/sent) · `approvals` (entity, decision, approver, note) · `audit_log` (append-only) · plus existing `subscriptions`, `trial_signups`.

## 7. Out of scope (this build)

Real email/calendar/job-board/payroll integrations (drafts + booking-link placeholders instead); multi-tenant org model with RLS per client login; performance-review agent (roadmap); mobile apps; SOC2 certification itself (schema and audit trail lay the groundwork).

## 8. Success metrics (instrument from day one)

Compliance events caught per client · time-to-shortlist · client edits per shortlist/draft (quality proxy) · offer-accept rate · 90-day retention per hire · approval turnaround time · agent task completion without human correction.
