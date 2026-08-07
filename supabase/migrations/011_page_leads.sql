-- 011_page_leads.sql — public landing-page lead capture.
-- Run once in Supabase SQL Editor (after 010_social_links.sql).
--
-- page_leads backs the "Get Started Today" form on /blog/2-1-buydown (and any
-- future public landing pages — source_page records which one). Rows are
-- written by the service-role client in /api/lead-capture as a backup for the
-- Resend email alert, so a lead survives even if the email fails.
--
-- RLS is enabled with NO policies on purpose: anon and authenticated get no
-- read or write access at all. Only the service-role key (which bypasses RLS)
-- touches this table. Read leads in the Supabase dashboard, or add an owner
-- policy later if they should surface in the app.

create table if not exists public.page_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  source_page text not null,
  created_at timestamptz not null default now()
);

create index if not exists page_leads_created_idx on public.page_leads (created_at desc);

alter table public.page_leads enable row level security;
