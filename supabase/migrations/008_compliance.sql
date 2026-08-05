-- 008_compliance.sql — Reddit compliance hardening.
-- Run once in Supabase SQL Editor (after 007_products_capabilities.sql).
--
-- Context: a drafted reply carrying a promotional profile line led to a
-- permanent ban from r/personalfinance (Rule 2). Changes:
-- 1. leads.draft_blocked_reason: set by the deterministic post-generation
--    sanitizer when a draft contains contact info, credentials, or
--    solicitation language. Non-null = BLOCKED in the dashboard; the draft
--    must be rewritten manually, never posted as-is.
-- 2. Purge of r/personalfinance data (idempotent; also executed live on
--    2026-08-05: 9 leads + 1 scout_sources row).

alter table public.leads add column if not exists draft_blocked_reason text;

delete from public.leads where source ilike '%personalfinance%';
delete from public.scout_sources where platform = 'reddit' and identifier ilike '%personalfinance%';
