-- 009_deleted_status.sql — adds DELETED to response_status.
-- Run once in Supabase SQL Editor (after 008_compliance.sql).
--
-- For posts that were removed by the author/mods before a response went out:
-- marking them DELETED keeps the funnel honest instead of leaving them
-- parked in DRAFT or mislabeled IGNORED.

alter table public.leads drop constraint if exists leads_response_status_check;
alter table public.leads add constraint leads_response_status_check
  check (response_status in ('DRAFT', 'POSTED', 'REPLIED', 'ENGAGED', 'IGNORED', 'DELETED'));
