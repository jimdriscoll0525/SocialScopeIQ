-- 006_group_map.sql — Phase 4: Facebook Group Map.
-- Run once in Supabase SQL Editor (after 005_blog.sql).
--
-- 1. fb_groups: per-user tracker of Facebook groups. Rows arrive three ways:
--    - capture: bookmarklet capture inside a group auto-marks it "joined"
--      (you can't capture from a group you're not in)
--    - suggested: AI candidate list built from towns_served + niche
--    - manual: typed in on the /groups page
-- 2. leads.group_url: lets the Group Map count leads per group.

create table if not exists public.fb_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_name text not null,
  group_url text,
  status text not null default 'candidate' check (status in ('joined', 'candidate', 'ignored')),
  source text not null default 'manual' check (source in ('capture', 'suggested', 'manual')),
  why text, -- suggester's one-line rationale
  last_capture_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, group_name)
);

create index if not exists fb_groups_user_status_idx on public.fb_groups (user_id, status);

drop trigger if exists fb_groups_set_updated_at on public.fb_groups;
create trigger fb_groups_set_updated_at
  before update on public.fb_groups
  for each row execute function public.set_updated_at();

alter table public.fb_groups enable row level security;

drop policy if exists "fb_groups own all" on public.fb_groups;
create policy "fb_groups own all" on public.fb_groups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.leads add column if not exists group_url text;
