# SocialScopeIQ

Lead-scouting dashboard for Mortgage Equity Partners.
Replaces the Google Sheet workflow with a Next.js + Supabase app deployed on Vercel.

---

## What it does

- **Auto-scouts** Reddit (~10 subs), BiggerPockets (8 forums), and Stack Exchange (money/mortgage tag) once a day. New posts that match Jim's specialty keywords are pulled in, classified (TIER 1 / 2 / 3), and Claude drafts a reply tailored to Jim's voice. All leads land in Supabase.
- **Bookmarklet** — drag a button to your bookmarks bar. When you spot a lead on Facebook, NextDoor, Quora, LinkedIn, or anywhere automation can't reach, click the bookmark. The post drops into the dashboard with an AI-drafted response, ~10 sec/lead.
- **Dashboard at `/`** — filter by tier / status / community, expand any row to see the full draft, edit it, copy it with one click, and mark `POSTED` / `REPLIED` / `IGNORED` as you go.

---

## First-time setup (~30 min)

### 1. Install dependencies

```powershell
cd C:\Users\jim\socialscopeiq
npm install
```

### 2. Create the Supabase database

1. Go to your Supabase project → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql`, copy the whole file, paste it in, click **Run**.
3. Go to **Settings → API** and copy three values:
   - `Project URL`
   - `anon public` key
   - `service_role` key (click "Reveal" — this is secret)

### 3. Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com), create an API key.
2. Add ~$5 of credit (drafting 30 leads/week with Sonnet costs ~$0.50/mo).

### 4. Create `.env.local`

```powershell
copy .env.local.example .env.local
notepad .env.local
```

Fill in the four values from steps 2 and 3 plus a random `CRON_SECRET`.

### 5. Run locally

```powershell
npm run dev
```

Open <http://localhost:3000>. You'll see an empty dashboard.

### 6. Backfill today's 8 leads

```powershell
npm run backfill
```

Refresh the dashboard — you should see all 8 from the May 16, 2026 run.

### 7. Test the scout (one-off)

```powershell
curl http://localhost:3000/api/scout
```

That kicks off Reddit + BiggerPockets + Stack Exchange + drafting. Takes 1–3 min. Refresh the dashboard to see new leads.

---

## Deploying to Vercel

### 1. Push to GitHub

```powershell
cd C:\Users\jim\socialscopeiq
git init
git add .
git commit -m "Initial SocialScopeIQ build"
```

Then on github.com:
- Create a new private repo named `socialscopeiq`
- Don't initialize with anything (no README, no .gitignore)
- Copy the two commands GitHub shows you (`git remote add origin …` and `git push -u origin main`)
- Paste them into PowerShell

### 2. Connect Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import the `socialscopeiq` repo.
3. Framework preset: **Next.js** (auto-detected).
4. Before clicking Deploy, expand **Environment Variables** and paste the four from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `CRON_SECRET`
5. Click **Deploy**. Wait 2 min.

### 3. Point socialscopeiq.com at Vercel

1. In Vercel: project → Settings → Domains → Add `socialscopeiq.com` and `www.socialscopeiq.com`.
2. Vercel shows you DNS records to set at your registrar:
   - Apex (`socialscopeiq.com`) → `A` record pointing to `76.76.21.21`
   - `www` → `CNAME` to `cname.vercel-dns.com`
3. Add those at your registrar. DNS takes 5 min – 1 hr to propagate.

### 4. The cron will start auto-scouting

The `vercel.json` file sets a daily 13:00 UTC cron (9am EDT). Vercel runs it automatically once the project is deployed — no extra setup. You can verify in Vercel → Project → Settings → Cron Jobs.

---

## The bookmarklet

After deploy:

1. Visit `https://socialscopeiq.com/bookmarklet`
2. Drag the **+ Capture to SocialScopeIQ** button to your browser bookmarks bar.
3. On Facebook / NextDoor / Quora / LinkedIn, when you see a real question:
   - Select some text from the post (optional — helps autodetect).
   - Click the bookmark.
   - A few prompts confirm the post title, author, body, and group/source.
   - Click OK. Lead lands in the dashboard with an AI draft ready.

---

## File map

```
socialscopeiq/
├── app/
│   ├── page.tsx                  Dashboard
│   ├── bookmarklet/page.tsx      Drag-to-bookmark page
│   ├── api/
│   │   ├── scout/route.ts        Daily cron — Reddit + BP + Stack Exchange
│   │   ├── bookmarklet/route.ts  Receives bookmarklet POSTs
│   │   └── leads/route.ts        PATCH / DELETE for the dashboard
│   ├── layout.tsx, globals.css
├── components/
│   └── LeadsTable.tsx            Interactive client-side table
├── lib/
│   ├── supabase.ts               DB clients (anon + admin)
│   ├── types.ts                  Lead, ScoutResult types
│   ├── drafter.ts                Jim's profile + Claude API + tier classifier
│   └── scouts/
│       ├── reddit.ts
│       ├── biggerpockets.ts
│       └── stackexchange.ts
├── public/bookmarklet.js         The actual bookmarklet source
├── supabase/schema.sql           Run once in SQL Editor
├── scripts/backfill.ts           Loads today's 8 leads
├── vercel.json                   Daily cron schedule
└── .env.local.example
```

---

## Editing Jim's voice / specialty rules

All the prompt content lives in `lib/drafter.ts` — the `JIM_PROFILE` constant. Edit there, redeploy, all future drafts use the new voice.

The tier-matching keywords live in the same file (`TIER1_PATTERNS`, `TIER2_PATTERNS`, `TIER3_PATTERNS`). Add or remove patterns as the focus shifts.

The subreddit list lives in `lib/scouts/reddit.ts` (`SUBS` constant). The BiggerPockets forum list lives in `lib/scouts/biggerpockets.ts` (`FORUMS` constant).

---

## Costs

- **Supabase free tier:** 500 MB DB + 50 K monthly active users. Plenty for v1.
- **Vercel Hobby:** free. Cron job included.
- **Anthropic API:** ~$0.50 / month at 30 leads/week using Sonnet. Switch to Haiku in `lib/drafter.ts` to drop to $0.05/mo if you want.
- **Domain:** ~$12/yr.

Total: **~$1/mo** until you onboard other LOs.

---

## v2 ideas (not built yet)

- Auth — Supabase magic-link login, multi-LO support
- Per-LO profile customization (replace JIM_PROFILE with a per-user record)
- Browser extension (auto-highlights leads as you scroll Facebook)
- Auto-followup detection (notice when the OP replied to your comment)
- Daily email digest of new TIER 1 leads
- Slack notifications
