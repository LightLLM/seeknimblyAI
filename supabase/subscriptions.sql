-- Run in Supabase SQL editor. Tracks Stripe subscription for 15-day trial and cancel-anytime.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none',
  trial_end timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_email on public.subscriptions (email);
create index if not exists idx_subscriptions_stripe_customer on public.subscriptions (stripe_customer_id);
create index if not exists idx_subscriptions_stripe_subscription on public.subscriptions (stripe_subscription_id);
