-- 012_video_posts.sql — YouTube video blog posts.
-- Adds video columns to blog_posts. A post is a video post when video_id is
-- set; regular text posts leave all three columns null and are unaffected.
-- Run once in Supabase SQL Editor (after 011_page_leads.sql).

alter table public.blog_posts add column if not exists video_provider text;
alter table public.blog_posts add column if not exists video_id text;
alter table public.blog_posts add column if not exists transcript text;

alter table public.blog_posts drop constraint if exists blog_posts_video_provider_check;
alter table public.blog_posts add constraint blog_posts_video_provider_check
  check (video_provider is null or video_provider in ('youtube'));

-- video_id is rendered into an iframe src and JSON-LD; constrain it to the
-- 11-char YouTube ID alphabet so a raw URL or embed markup can never be stored.
alter table public.blog_posts drop constraint if exists blog_posts_video_id_format;
alter table public.blog_posts add constraint blog_posts_video_id_format
  check (video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$');

alter table public.blog_posts drop constraint if exists blog_posts_video_consistency;
alter table public.blog_posts add constraint blog_posts_video_consistency
  check ((video_id is null) = (video_provider is null));
