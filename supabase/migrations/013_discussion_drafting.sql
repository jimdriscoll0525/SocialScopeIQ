-- 013_discussion_drafting.sql — thread comments + posted-at pacing.
-- Run once in Supabase SQL Editor (after 012_video_posts.sql).
--
-- post_comments: top scraped comments on the source thread (Reddit scout),
-- used by the discussion-style drafter to react to the existing conversation
-- instead of answering the OP cold.
-- posted_at: stamped by the leads API the first time response_status moves to
-- POSTED/REPLIED/ENGAGED; powers the dashboard's burst-posting pacing warning.
-- The code tolerates both columns being absent, so deploys don't race this
-- migration — but comments won't be stored and pacing won't warn until it runs.

alter table public.leads add column if not exists post_comments text[];
alter table public.leads add column if not exists posted_at timestamptz;
