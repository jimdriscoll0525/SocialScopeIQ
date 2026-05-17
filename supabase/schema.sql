-- SocialScopeIQ schema
-- Run this once in Supabase: SQL Editor -> New Query -> paste -> Run.

create extension if not exists "uuid-ossp";

-- Leads table
create table if not exists public.leads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid,                                -- nullable for v1 single-user mode
  date_found date not null default current_date,
  time_found text,
  community text,                              -- Reddit, BiggerPockets, Facebook, NextDoor, Quora, LinkedIn, etc.
  source text,                                 -- specific sub/forum/group name
  post_title text,
  author text,
  post_url text unique,                        -- unique URL prevents duplicate scrapes
  intent_tier text check (intent_tier in ('TIER 1','TIER 2','TIER 3')),
  primary_intent text,
  key_question text,
  reason_selected text,
  drafted_response text,
  response_status text default 'DRAFT'
    check (response_status in ('DRAFT','POSTED','REPLIED','ENGAGED','IGNORED')),
  response_link text,
  followup_status text default 'NOT STARTED'
    check (followup_status in ('NOT STARTED','IN PROGRESS','DONE')),
  notes text,
  detected_state text,                         -- 'MA','NH','RI','NJ','ME','CT','FL','UNKNOWN','OUT_OF_STATE'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_date_found_idx on public.leads (date_found desc);
create index if not exists leads_tier_idx on public.leads (intent_tier);
create index if not exists leads_status_idx on public.leads (response_status);
create index if not exists leads_community_idx on public.leads (community);
create index if not exists leads_detected_state_idx on public.leads (detected_state);

-- Updated-at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- For v1 (no auth) we'll leave RLS off so the anon key can read for the dashboard.
-- When we add auth, turn this on and add per-user policies.
alter table public.leads disable row level security;
