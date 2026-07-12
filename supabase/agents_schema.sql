-- SeeknimblyAI agentic platform schema. Run in the Supabase SQL editor.
-- All access is server-side via the service role key; RLS is enabled with no
-- public policies so anon/authenticated clients cannot read these tables.

-- ===== Recruiting (ATS) =====
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  location text,
  experience_level text,
  skills text,
  resume_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid,
  province text,
  salary_range text,
  must_haves text,
  nice_to_haves text,
  work_model text,
  status text not null default 'open', -- open | on_hold | filled | closed
  rubric text,                          -- approved screening rubric (bias-audit record)
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id),
  job_id uuid references public.jobs(id),
  candidate_email text,
  candidate_name text,
  job_title text,
  status text not null default 'new', -- new | screened | contacted | scheduled | offer | hired | rejected
  score int,
  score_rationale text,               -- 2-line rationale / reason code (bias-audit record)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Onboarding =====
create table if not exists public.hires (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  name text not null,
  role text,
  province text,
  start_date date,
  employment_type text,
  status text not null default 'pre_start', -- pre_start | week_1 | ramping | retained_90d | exited
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  hire_id uuid references public.hires(id),
  title text not null,
  category text not null default 'general', -- statutory | equipment | training | checkin | general
  due_date date,
  status text not null default 'pending',   -- pending | done | blocked
  detail text,
  created_at timestamptz not null default now()
);

-- ===== Training / L&D =====
create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  hire_id uuid,
  client_id uuid,
  person_name text,
  role text,
  goal text,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_items (
  id uuid primary key default gen_random_uuid(),
  path_id uuid references public.learning_paths(id),
  title text not null,
  kind text not null default 'course',  -- course | certification | mandatory | mentoring | workshop
  mandatory boolean not null default false,
  due_date date,
  expiry_date date,                     -- for certifications
  status text not null default 'assigned', -- assigned | in_progress | complete | expired
  created_at timestamptz not null default now()
);

-- ===== Compliance =====
create table if not exists public.compliance_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  kind text not null,          -- law_change | deadline | audit_finding | reminder
  jurisdiction text,           -- e.g. ON, BC, CA-federal, US-CA
  title text not null,
  detail text,
  effective_date date,
  deadline date,
  source_url text,
  source_checked_at timestamptz,
  status text not null default 'open', -- open | actioned | dismissed
  created_at timestamptz not null default now()
);

-- ===== Lifecycle: CRM =====
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text,
  contact_email text,
  province text,
  vertical text,
  employee_count int,
  score int,
  score_breakdown text,
  stage text not null default 'new', -- new | contacted | replied | call_booked | proposal | negotiating | closed_won | closed_lost | dormant
  won_lost_reason text,
  last_touch_at timestamptz,
  touch_count int not null default 0,
  is_channel_partner boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  provinces text,               -- comma-separated provinces of operation
  employee_count int,
  industry text,
  payroll_provider text,
  key_contact text,
  key_contact_email text,
  tier text,
  renewal_date date,
  status text not null default 'onboarding', -- onboarding | live | paused | churned
  created_at timestamptz not null default now()
);

create table if not exists public.client_modules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  module text not null,          -- recruiting | onboarding | training | compliance
  scope text,
  approval_contact text,
  cadence text,
  created_at timestamptz not null default now()
);

-- ===== Approvals / outbox (draft-never-send is enforced here) =====
create table if not exists public.outbox_drafts (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  channel text not null default 'email',  -- email | linkedin | posting | proposal | document
  recipient text,
  subject text,
  body text not null,
  entity_type text,
  entity_id text,
  status text not null default 'pending', -- pending | approved | rejected | sent
  decided_by text,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ===== Audit log (append-only) =====
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  agent text not null,
  action text not null,
  entity_type text,
  entity_id text,
  actor text not null default 'agent',
  status text not null default 'ok',      -- ok | pending_approval | approved | rejected | error
  detail text
);

create index if not exists idx_applications_status on public.applications (status);
create index if not exists idx_onboarding_tasks_hire on public.onboarding_tasks (hire_id);
create index if not exists idx_compliance_events_status on public.compliance_events (status);
create index if not exists idx_leads_stage on public.leads (stage);
create index if not exists idx_outbox_status on public.outbox_drafts (status);
create index if not exists idx_audit_ts on public.audit_log (ts desc);

-- Lock down: server-only access via service role.
do $$
declare t text;
begin
  foreach t in array array['candidates','jobs','applications','hires','onboarding_tasks',
    'learning_paths','learning_items','compliance_events','leads','clients','client_modules',
    'outbox_drafts','audit_log']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Append-only audit log: no updates or deletes even via triggers from app bugs.
create or replace function public.prevent_audit_mutation() returns trigger as $$
begin
  raise exception 'audit_log is append-only';
end; $$ language plpgsql;

drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.prevent_audit_mutation();
