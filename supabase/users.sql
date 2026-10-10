-- App users for email/password + OAuth (NextAuth). Run in Supabase SQL editor.

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  name text,
  providers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_users_email on public.app_users (email);

alter table public.app_users enable row level security;
