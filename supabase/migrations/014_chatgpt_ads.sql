-- 014_chatgpt_ads.sql — ChatGPT Ads campaign builder + tracker.
-- Run once in Supabase SQL Editor (after 013_discussion_drafting.sql).
--
-- OpenAI's ChatGPT Ads is bought through the self-serve Ads Manager at
-- ads.openai.com; there is no public campaign API yet. SocialScopeIQ builds
-- the campaign package with AI, the user pastes it into the Ads Manager, then
-- logs results back here. The external_* / synced_at columns are reserved so a
-- future "push to ChatGPT Ads" sync can land without a schema rewrite.
--
-- 1. ad_campaigns: one row per campaign, per user.
-- 2. ad_groups: 4-6 per campaign, each a distinct customer need with its own
--    prompt-based targeting instructions, copy, image prompt, and UTM'd URL.
-- 3. ad_campaign_metrics: one row per campaign per day, entered by hand for
--    now (source = 'manual'); the Conversions API / pixel ingestion will write
--    source = 'conversions_api' rows later.
-- 4. ad_resources: pasted reference material (product sheets, "37 reasons
--    people refinance", etc.) the builder can include as generation context.

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted_to_chatgpt', 'active', 'paused', 'ended')),
  objective text not null,
  target_market text not null,
  daily_budget numeric(10,2) not null default 0,
  bid_type text not null default 'cpc' check (bid_type in ('cpc', 'cpm')),
  landing_page_url text not null,
  notes text,
  -- Reserved for a future ads API: the platform's campaign id, its last-seen
  -- status there, and when we last synced.
  external_campaign_id text,
  external_status text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_campaigns_user_idx on public.ad_campaigns (user_id, created_at desc);

drop trigger if exists ad_campaigns_set_updated_at on public.ad_campaigns;
create trigger ad_campaigns_set_updated_at
  before update on public.ad_campaigns
  for each row execute function public.set_updated_at();

alter table public.ad_campaigns enable row level security;

drop policy if exists "ad_campaigns own all" on public.ad_campaigns;
create policy "ad_campaigns own all" on public.ad_campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


create table if not exists public.ad_groups (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  position int not null default 0,
  name text not null,
  audience_theme text not null default '',
  -- Prompt-based targeting: the user intents / conversation topics this ad
  -- should appear against (ChatGPT Ads targets what the person is asking
  -- about, not demographics).
  targeting_instructions text not null default '',
  ad_headline text not null default '',
  ad_body text not null default '',
  ad_image_prompt text not null default '',
  ad_image_url text,
  -- Final URL incl. UTM params (utm_campaign = campaign slug,
  -- utm_content = ad group slug). Overrides the campaign default.
  landing_page_url text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'ended')),
  external_ad_group_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_groups_campaign_idx on public.ad_groups (campaign_id, position);

drop trigger if exists ad_groups_set_updated_at on public.ad_groups;
create trigger ad_groups_set_updated_at
  before update on public.ad_groups
  for each row execute function public.set_updated_at();

alter table public.ad_groups enable row level security;

-- Ownership flows through the parent campaign.
drop policy if exists "ad_groups own via campaign" on public.ad_groups;
create policy "ad_groups own via campaign" on public.ad_groups
  for all
  using (exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid()));


create table if not exists public.ad_campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  date date not null,
  impressions int not null default 0,
  clicks int not null default 0,
  leads int not null default 0,
  spend numeric(10,2) not null default 0,
  source text not null default 'manual' check (source in ('manual', 'conversions_api')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, date)
);

drop trigger if exists ad_campaign_metrics_set_updated_at on public.ad_campaign_metrics;
create trigger ad_campaign_metrics_set_updated_at
  before update on public.ad_campaign_metrics
  for each row execute function public.set_updated_at();

alter table public.ad_campaign_metrics enable row level security;

drop policy if exists "ad_campaign_metrics own via campaign" on public.ad_campaign_metrics;
create policy "ad_campaign_metrics own via campaign" on public.ad_campaign_metrics
  for all
  using (exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid()));


create table if not exists public.ad_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_resources_user_idx on public.ad_resources (user_id, created_at);

drop trigger if exists ad_resources_set_updated_at on public.ad_resources;
create trigger ad_resources_set_updated_at
  before update on public.ad_resources
  for each row execute function public.set_updated_at();

alter table public.ad_resources enable row level security;

drop policy if exists "ad_resources own all" on public.ad_resources;
create policy "ad_resources own all" on public.ad_resources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
