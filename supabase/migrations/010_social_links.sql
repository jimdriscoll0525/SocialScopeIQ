-- 010_social_links.sql — profile URLs for entity SEO (schema.org sameAs).
-- Run once in Supabase SQL Editor (after 009_deleted_status.sql).
--
-- profiles.social_links: public profile URLs (Reddit, BiggerPockets,
-- LinkedIn, company bio page, ...). Rendered on the public /lo|/agents page
-- as visible links AND emitted as Person "sameAs" JSON-LD so Google can
-- connect those identities to this person.

alter table public.profiles add column if not exists social_links text[] not null default '{}';

drop view if exists public.public_profiles;
create view public.public_profiles as
  select id, slug, role, first_name, last_name, company, brokerage,
         niche, states_served, towns_served, nmls, website, social_links
  from public.profiles
  where onboarding_complete;

grant select on public.public_profiles to anon, authenticated;
