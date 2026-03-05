-- Run this in the Supabase SQL editor to create the trial_signups table for magic-link signups.

create table if not exists public.trial_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  company_name text,
  token text not null unique,
  token_expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_trial_signups_token on public.trial_signups (token);
create index if not exists idx_trial_signups_token_expires on public.trial_signups (token_expires_at) where used_at is null;
