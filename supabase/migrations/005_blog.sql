-- 005_blog.sql — Phase 5: blog posts.
-- Run once in Supabase SQL Editor (after 004_drafting_profiles.sql).
--
-- 1. blog_posts: AI-generated long-form posts. Always born as drafts; the
--    author reviews and publishes from the app. Published posts are publicly
--    readable (the /lo/<slug> and /agents/<slug> pages).
-- 2. public_profiles view gains `website` so public pages can link out to the
--    author's marketing site. Email and phone stay excluded on purpose.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  title text not null,
  meta_description text,
  topic text not null,
  content_md text not null,
  is_custom boolean not null default false, -- user-supplied topic (counted against custom_blog_limit)
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, slug)
);

create index if not exists blog_posts_author_status_idx on public.blog_posts (author_id, status);
create index if not exists blog_posts_published_idx on public.blog_posts (status, published_at desc);

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

alter table public.blog_posts enable row level security;

drop policy if exists "blog own all" on public.blog_posts;
drop policy if exists "blog public read published" on public.blog_posts;

create policy "blog own all" on public.blog_posts
  for all using (auth.uid() = author_id) with check (auth.uid() = author_id);

create policy "blog public read published" on public.blog_posts
  for select using (status = 'published');

-- Public view: add website (safe marketing URL). Recreated wholesale because
-- `create or replace view` can't add columns in place on all PG versions.
drop view if exists public.public_profiles;
create view public.public_profiles as
  select id, slug, role, first_name, last_name, company, brokerage,
         niche, states_served, towns_served, nmls, website
  from public.profiles
  where onboarding_complete;

grant select on public.public_profiles to anon, authenticated;
