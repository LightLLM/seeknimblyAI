# Seeknimbly AI — Agentic HR Platform

Seven autonomous HR agents behind one chat: Recruiting, Onboarding, Training, Compliance, plus lifecycle agents (Lead Gen, Sales, Client Onboarding). Humans approve every outbound draft and consequential state change.

## Tech stack

- Next.js 14 (App Router), React, TypeScript, Tailwind
- NextAuth (credentials + magic-link trial)
- OpenAI (server-side only) — chat completions tool loop + Responses API web search
- Supabase (ATS, CRM, outbox, audit, memory, conversations, orgs) with in-memory demo fallback
- Stripe (15-day trial) · Resend (trial emails + approved draft send) · Vercel Cron

## Run locally

```bash
npm install
cp .env.example .env.local   # set OPENAI_*, NEXTAUTH_*, AUTH_EMAIL/PASSWORD
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Landing → trial/sign-in → `/app`.

**Supabase:** run `supabase/trial_signups.sql`, `supabase/subscriptions.sql`, then **`supabase/agents_schema.sql`** (includes org_id columns, memories, conversations, automations). Without Supabase the app runs in demo mode (in-memory).

**Stripe / Resend / Cron:** see `.env.example`. Set `CRON_SECRET` for scheduled automations.

## What’s in `/app`

| Route | Purpose |
|-------|---------|
| `/app` | Unified chat — LLM router → agent with approval card |
| `/app/intake` | Structured hire / job / client forms |
| `/app/partners` | Channel-partner firms → linked SMB clients |
| `/app/pipeline` | ATS pipeline (applications by status) |
| `/app/crm` | Lead/CRM stages |
| `/app/compliance` | Compliance calendar + open events |
| `/app/metrics` | Headline metrics (events caught, time-to-shortlist, approval turnaround, 90-day retention) |
| `/app/approvals` | Draft outbox — approve/reject; email sends via Resend |
| `/app/audit` | Append-only audit trail |
| `/app/automations` | Enable / run-now cron jobs |
| `/app/memory` | Agent learnings (outcomes, objections, catches) |
| `/app/projects` | Client workspaces |
| `/app/loop` | Loop status (automations, skills, connectors, memory) |
| `/app/capabilities` | Toggle agents / inspect tools |
| `/app/messaging` | Connector status + channel setup |
| `/app/artifacts` | All drafts by channel |
| `/app/onboarding` | Hire checklists + task status (F5) |
| `/app/training` | Learning paths + item progress |
| `/app/settings` | Team invites, legal/CASL checklist, billing |
| `/app/checklist` | Personal onboarding checklist (token link) |
| `/auth/invite` | Accept org invite |
| `/demo` | Public Day-1 Compliance Snapshot (no signup) |

## Agents & safety

- **Draft, never send** — outbound email/posting/proposal → `outbox_drafts`; email transmits only after human approve + Resend
- **HITL gates** — mutating tools pause with HMAC-signed continuation tokens
- **Org isolation** — each user gets an org; store stamps/filters `org_id` on business tables
- **Compliance web search** — `web_search` tool (Responses API) required before `draft_change_brief`; official https government URLs enforced
- **Audit** — every tool/approval logged

## API (selected)

- `POST /api/agents/[agentId]/stream` (+ `/continue`) — NDJSON agent loop
- `POST /api/chat` — suggest agent (`llm` | `keyword`)
- `GET/POST /api/approvals` · `GET /api/audit` · `GET /api/metrics`
- `GET /api/pipeline` · `GET /api/crm` · `GET /api/compliance/calendar`
- `GET /api/cron?task=…` — Bearer `CRON_SECRET`; runs once per org
- Legacy: `/api/hr`, `/api/hr/stream`, `/api/agent/stream`

## Tests & deploy

```bash
npm test && npm run build
# Compliance golden questions only:
npm run test:eval
```

Deploy on Vercel with the same env vars. Cron schedules live in `vercel.json`.

See `REQUIREMENTS.md` for the full functional spec and `IMPROVEMENTS.md` for the roadmap.
