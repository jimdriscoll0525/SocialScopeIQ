-- 004_drafting_profiles.sql — multi-user drafting support.
-- Run once in Supabase SQL Editor (after 003_realtor_feed.sql).
--
-- 1. profiles.website: used in the loan-officer signature block.
-- 2. leads.post_body: the captured post text. Needed so a realtor lead can be
--    drafted at CLAIM time (the old pipeline drafted at scrape time, while the
--    body was still in memory, and never persisted it).
-- 3. Seeds Jim's profile signature/persona fields so drafts built from the
--    profiles table match the previously hardcoded prompt (coalesce = only
--    fills what onboarding left empty; email is set outright because the
--    signature email is jim@meploans.com, not the login email).

alter table public.profiles add column if not exists website text;
alter table public.leads add column if not exists post_body text;

update public.profiles set
  company      = coalesce(company, 'Mortgage Equity Partners'),
  nmls         = coalesce(nmls, '21420'),
  phone        = coalesce(phone, '617-529-9007'),
  website      = coalesce(website, 'https://mortgageequitypartners.com/james-driscoll/'),
  email        = 'jim@meploans.com',
  niche        = coalesce(niche, 'First-time home buyers, down payment assistance, investment properties, DSCR loans, bank statement loans, refinancing, FHA, 203K'),
  voice_sample = coalesce(voice_sample, 'A mortgage loan officer with 31 years in the mortgage business, very low fallout rate, detail-oriented underwriting. Based in Massachusetts / New England.'),
  case_studies = coalesce(case_studies, '1. First-time buyer with no down payment, secured $75K in down payment assistance ($25K MassHousing + $50K City of Boston program).
2. Investor seeking cash flow, carefully analyzed the deal up front; the client now has steady rental income.
3. Refinance client saved $1,000+/month, modeled the savings carefully before executing.')
where id = (
  select id from public.profiles
  where email in ('jim@financewithjim.com', 'jim@meploans.com')
    and role = 'loan_officer'
  limit 1
);
