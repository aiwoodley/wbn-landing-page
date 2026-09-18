-- Woodley Solutions landing page schema
-- Run in the Supabase SQL editor (or via `supabase db push` once linked).

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  engagement_snapshot jsonb,
  submitted_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  engagement_snapshot jsonb,
  submitted_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  interest text not null default 'unspecified',
  details text,
  engagement_snapshot jsonb,
  submitted_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product text not null,                 -- e.g. 'premium_guide'
  amount_cents integer not null,
  currency text not null default 'usd',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  status text not null default 'pending', -- pending | paid | failed | refunded
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.leads enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.bookings enable row level security;
alter table public.orders enable row level security;

-- Netlify Functions use the SERVICE ROLE key (bypasses RLS) for all writes.
-- No anon-key policies are defined on purpose: the public site never talks
-- to Supabase directly, only through the functions. This keeps the anon key
-- out of the browser entirely and leads/bookings unreadable by anyone but
-- the service role / Supabase dashboard.
