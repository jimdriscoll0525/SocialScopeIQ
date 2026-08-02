-- 002_auth_profiles.sql — profiles, roles, bookmarklet tokens, leads RLS.
-- Run once in Supabase SQL Editor: SQL Editor -> New Query -> paste -> Run.
--
-- Also required (Supabase dashboard, one-time):
--   1. Authentication -> Providers -> Email: enabled (email + password —
--      the DealScopeIQ-style flow; on by default in new projects).
--   2. Authentication -> URL Configuration: add your site URL and
--      <site>/auth/confirm to the redirect allow-list (used by the
--      account-confirmation email after sign-up).
--
-- After Jim signs up and completes onboarding, run (fill in the email):
--   update public.profiles set is_admin = true where email = 'jim@financewithjim.com';
--   update public.leads set user_id = (select id from public.profiles where email = 'jim@financewithjim.com') where user_id is null;
-- and set OWNER_USER_ID to that profile id in Vercel env + .env.local.

-- ── profiles ────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('loan_officer','realtor')),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  slug text not null unique,
  states_served text[] not null default '{}',
  towns_served text[] not null default '{}',
  niche text,
  voice_sample text,
  -- loan officer extras
  company text,
  nmls text,
  license_states text[],
  -- realtor extras
  brokerage text,
  license_numbers text[],
  -- drafting extras (seeded for Jim; prompt section omitted when null)
  case_studies text,
  is_admin boolean not null default false,
  -- future billing tier; everyone is 'free' for now
  plan text not null default 'free',
  custom_blog_limit int not null default 10,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles own select" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles own insert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles own update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Safe public projection for the public blog/profile pages. Views run with
-- the owner's privileges (bypassing profiles RLS), so expose only
-- non-sensitive columns, and only for completed profiles. phone/email are
-- deliberately absent.
create view public.public_profiles as
  select id, slug, role, first_name, last_name, company, brokerage,
         niche, states_served, towns_served, nmls
  from public.profiles
  where onboarding_complete;

grant select on public.public_profiles to anon, authenticated;

-- ── bookmarklet tokens ──────────────────────────────────────────────────────
-- The bookmarklet POSTs cross-origin from facebook.com etc., where session
-- cookies don't ride along, so each user gets a capture token baked into
-- their generated bookmarklet. Own-row RLS only; never granted to anon.

create table public.bookmarklet_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.bookmarklet_tokens enable row level security;

create policy "tokens own select" on public.bookmarklet_tokens
  for select using (auth.uid() = user_id);
create policy "tokens own insert" on public.bookmarklet_tokens
  for insert with check (auth.uid() = user_id);

-- ── leads: feed membership + RLS ────────────────────────────────────────────

-- Which feed(s) a lead belongs to: 'lo', 'realtor', or both. Every existing
-- row is a loan-officer lead.
alter table public.leads add column feeds text[] not null default '{lo}';
create index leads_feeds_idx on public.leads using gin (feeds);

-- The calling user's role. security definer so leads policies can read
-- profiles without tripping profiles RLS.
create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

-- RLS on: the dashboard and /api/leads now use the signed-in user's client.
-- The scout cron and bookmarklet endpoint use the service-role key, which
-- bypasses RLS. Realtor policies (claiming rules) land in migration 003.
alter table public.leads enable row level security;

create policy "lo feed select" on public.leads
  for select using (
    public.current_user_role() = 'loan_officer' and 'lo' = any(feeds)
  );
create policy "lo feed update" on public.leads
  for update using (
    public.current_user_role() = 'loan_officer' and 'lo' = any(feeds)
  );
create policy "lo feed delete" on public.leads
  for delete using (
    public.current_user_role() = 'loan_officer' and 'lo' = any(feeds)
  );
