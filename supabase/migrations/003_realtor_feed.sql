-- 003_realtor_feed.sql — lead claiming, realtor RLS, DB-driven scout sources.
-- Run once in Supabase SQL Editor (after 002_auth_profiles.sql).
--
-- This migration also finishes the two post-signup steps from 002 (Jim's
-- admin flag + lead backfill) — it assumes Jim signed up with
-- jim@financewithjim.com. Adjust the email below if not.

-- ── claiming ────────────────────────────────────────────────────────────────
-- claimed_draft: the AI draft generated for the claiming realtor (their voice).
-- drafted_response stays the loan-officer-facing draft, so a dual-feed lead
-- can carry both without either role overwriting the other.

alter table public.leads
  add column claimed_by uuid references public.profiles(id),
  add column claimed_at timestamptz,
  add column claimed_draft text;

create index leads_claimed_by_idx on public.leads (claimed_by);

-- ── realtor feed policies ───────────────────────────────────────────────────
-- Realtors see realtor-feed leads that are unclaimed or their own claim.
-- with check stops a realtor from assigning a claim to anyone but themselves.

create policy "realtor feed select" on public.leads
  for select using (
    public.current_user_role() = 'realtor'
    and 'realtor' = any(feeds)
    and (claimed_by is null or claimed_by = auth.uid())
  );

create policy "realtor feed update" on public.leads
  for update using (
    public.current_user_role() = 'realtor'
    and 'realtor' = any(feeds)
    and (claimed_by is null or claimed_by = auth.uid())
  )
  with check (
    public.current_user_role() = 'realtor'
    and 'realtor' = any(feeds)
    and (claimed_by is null or claimed_by = auth.uid())
  );

create policy "realtor delete claimed" on public.leads
  for delete using (
    public.current_user_role() = 'realtor' and claimed_by = auth.uid()
  );

-- ── scout sources (was hardcoded in lib/scouts/*.ts) ────────────────────────
-- Adding a subreddit or BP forum is now a SQL insert, no deploy. The scouts
-- read enabled rows (service role) and fall back to the old hardcoded lists
-- if this table is empty or unreachable. priority = crawl order for
-- BiggerPockets (lower first — the crawler is breadth-first under a page cap).

create table public.scout_sources (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('reddit','biggerpockets')),
  identifier text not null, -- subreddit name (no r/) or BP forum id
  label text,               -- display/source label; BP labels must match lib/state-filter.ts FORUM_TO_STATE
  pipeline text not null check (pipeline in ('lo','realtor','both')),
  priority int not null default 100,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (platform, identifier)
);

alter table public.scout_sources enable row level security;

create policy "authed read sources" on public.scout_sources
  for select using (auth.uid() is not null);
create policy "admin manage sources" on public.scout_sources
  for all
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

insert into public.scout_sources (platform, identifier, label, pipeline, priority) values
  -- Reddit — existing loan-officer list
  ('reddit', 'FirstTimeHomeBuyer',  'r/FirstTimeHomeBuyer',  'both',    10),
  ('reddit', 'FirstTimeHomeBuyers', 'r/FirstTimeHomeBuyers', 'lo',      20),
  ('reddit', 'NewbHomebuyer',       'r/NewbHomebuyer',       'lo',      30),
  ('reddit', 'Mortgages',           'r/Mortgages',           'lo',      40),
  ('reddit', 'HomeLoans',           'r/HomeLoans',           'lo',      50),
  ('reddit', 'HELOC',               'r/HELOC',               'lo',      60),
  ('reddit', 'RealEstate',          'r/RealEstate',          'both',    70),
  ('reddit', 'RealEstateInvesting', 'r/RealEstateInvesting', 'lo',      80),
  ('reddit', 'Homeowners',          'r/Homeowners',          'both',    90),
  ('reddit', 'HomeBuying',          'r/HomeBuying',          'both',   100),
  ('reddit', 'personalfinance',     'r/personalfinance',     'lo',     110),
  -- Reddit — realtor additions (local subs re-enter the scrape here; the
  -- classifier keeps them out of the LO feed, which is why they were dropped)
  ('reddit', 'SameGrassButGreener', 'r/SameGrassButGreener', 'realtor', 120),
  ('reddit', 'boston',              'r/boston',              'realtor', 130),
  ('reddit', 'massachusetts',       'r/massachusetts',       'realtor', 140),
  ('reddit', 'newhampshire',        'r/newhampshire',        'realtor', 150),
  -- BiggerPockets (identifier = forum id; priority = crawl order, MA/NH first)
  ('biggerpockets', '564', 'Massachusetts Real Estate',      'both',    10),
  ('biggerpockets', '571', 'New Hampshire Real Estate',      'realtor', 15),
  ('biggerpockets', '693', 'Boston Real Estate',             'both',    20),
  ('biggerpockets', '22',  'Mortgage Brokers & Lenders',     'lo',      30),
  ('biggerpockets', '49',  'Private & Conventional Lending', 'lo',      40),
  ('biggerpockets', '50',  'Creative Real Estate Financing', 'lo',      50),
  ('biggerpockets', '311', 'Buying & Selling Real Estate',   'both',    60),
  ('biggerpockets', '517', 'Rental Property Investing',      'lo',      70),
  ('biggerpockets', '12',  'Starting Out',                   'lo',      80);

-- ── post-signup steps from 002 ──────────────────────────────────────────────

update public.profiles
  set is_admin = true
  where email = 'jim@financewithjim.com';

update public.leads
  set user_id = (select id from public.profiles where email = 'jim@financewithjim.com')
  where user_id is null;
