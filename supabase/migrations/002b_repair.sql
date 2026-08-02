-- 002b_repair.sql — recreates every piece of 002 that migration 003 depends
-- on. Fully idempotent: safe to run any number of times, whether or not the
-- original 002 applied completely. Run this, then run 003_realtor_feed.sql.

-- The role helper 003's policies call (this was the missing function).
create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

-- Feed membership column + index on leads.
alter table public.leads add column if not exists feeds text[] not null default '{lo}';
create index if not exists leads_feeds_idx on public.leads using gin (feeds);

-- RLS on leads with the three LO policies (drop-then-create so re-runs work).
alter table public.leads enable row level security;

drop policy if exists "lo feed select" on public.leads;
drop policy if exists "lo feed update" on public.leads;
drop policy if exists "lo feed delete" on public.leads;

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

-- Bookmarklet tokens (needed by Phase 3) — created here too in case 002
-- stopped before reaching it.
create table if not exists public.bookmarklet_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.bookmarklet_tokens enable row level security;

drop policy if exists "tokens own select" on public.bookmarklet_tokens;
drop policy if exists "tokens own insert" on public.bookmarklet_tokens;

create policy "tokens own select" on public.bookmarklet_tokens
  for select using (auth.uid() = user_id);
create policy "tokens own insert" on public.bookmarklet_tokens
  for insert with check (auth.uid() = user_id);

-- Public profile view for the blog pages (Phase 5).
drop view if exists public.public_profiles;
create view public.public_profiles as
  select id, slug, role, first_name, last_name, company, brokerage,
         niche, states_served, towns_served, nmls
  from public.profiles
  where onboarding_complete;

grant select on public.public_profiles to anon, authenticated;

-- Verification: every row should show 'OK'.
select 'current_user_role() exists' as check_item,
       case when count(*) > 0 then 'OK' else 'MISSING' end as status
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'current_user_role'
union all
select 'leads.feeds column',
       case when count(*) > 0 then 'OK' else 'MISSING' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'leads' and column_name = 'feeds'
union all
select 'profiles table',
       case when to_regclass('public.profiles') is not null then 'OK' else 'MISSING' end
union all
select 'bookmarklet_tokens table',
       case when to_regclass('public.bookmarklet_tokens') is not null then 'OK' else 'MISSING' end
union all
select 'leads RLS enabled',
       case when (select relrowsecurity from pg_class where oid = 'public.leads'::regclass) then 'OK' else 'MISSING' end;
