// Backfills the 8 leads from the May 16, 2026 Daily Lead Scout run into Supabase.
// Run with: npm run backfill
// Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local.

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local manually (no dotenv dep).
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const leads = [
  {
    date_found: "2026-05-16",
    time_found: "16:00 EDT",
    community: "BiggerPockets",
    source: "Rental Property Investing forum",
    post_title: "Need an 80% LTV Cash Out DSCR Refi as a First-Time Investor in Ohio",
    author: "Griffen Kempskie",
    post_url:
      "https://www.biggerpockets.com/forums/517/topics/1288450-need-an-80-ltv-cash-out-dscr-refi-as-a-first-time-investor-in-ohio",
    intent_tier: "TIER 1",
    primary_intent: "DSCR lender referral",
    key_question:
      "First-time BRRRR investor in Ohio looking for a DSCR lender that can hit 80% LTV on a cash-out refi. Duplexes, unseasoned or short seasoning, LLC borrower.",
    reason_selected:
      "Direct lender ask, exact DSCR specialty match, posted May 15. LLC vesting + seasoning nuance is where Jim's experience differentiates.",
    drafted_response: `Griffen — 80% LTV cash-out on a duplex as a first-time BRRRR with unseasoned/short-seasoned property is doable, but the box gets thin fast. A few things to know before you pull the trigger with anyone:

- **Seasoning vs. LTV trade-off:** Lenders that go to 80% on cash-out usually want 6+ months seasoning and value off appraised, not cost basis. A handful will do "delayed financing" before 6 months but rates tick up.
- **DSCR ratio:** With duplexes you usually need a DSCR ≥ 1.0 to hit the best pricing at 80%. Below 1.0 is doable on no-ratio programs but expect 70–75% LTV or rate hits.
- **LLC vesting:** Almost every DSCR lender will let you close in the LLC — just make sure the operating agreement is buttoned up before underwriting starts. That's where a lot of first-timers get tripped up at the closing table.
- **Prepay penalty:** A 5/4/3/2/1 step-down is standard. If you plan to sell or refi within 3 years, ask for a buydown — usually 50–75 bps of points to remove or shorten.
- **Reserves:** Even DSCR programs want 3–6 months PITIA. Confirm that lines up before you submit.

I've been originating mortgages for 31 years with a very low fallout rate, and run DSCR/non-QM regularly. I work with a network of investor lenders nationally and can usually tell within one call whether your file fits at 80% or whether 75% is the realistic ceiling. Happy to run your numbers and give you a straight answer either way.

If you want to compare term sheets or stress-test the DSCR math on the duplex: https://mortgageequitypartners.com/james-driscoll/

To your success,
Jim Driscoll
Mortgage Equity Partners — Methuen & Lynnfield, MA
617-529-9007`,
    notes: "OH out of MA, but DSCR is national. Mention seasoning vs LTV trade and prepay buydown options."
  },
  {
    date_found: "2026-05-16",
    time_found: "16:00 EDT",
    community: "BiggerPockets",
    source: "Creative Real Estate Financing",
    post_title: "How can I buy my dad's $800k house with only a small down payment?",
    author: "Derek Malone",
    post_url:
      "https://www.biggerpockets.com/forums/50/topics/1288399-how-can-i-buy-my-dad-s-800k-house-with-only-a-small-down-payment",
    intent_tier: "TIER 1",
    primary_intent: "Creative financing / gift of equity",
    key_question:
      "$800K house, dad owns outright, $30-75K savings, plans to convert to 2-3 rental units. How do I structure?",
    reason_selected:
      "High-engagement thread (8 comments), gift-of-equity is a textbook play, multi-unit conversion adds investment angle. Posted May 15.",
    drafted_response: `Derek — this is a great setup because you have something most buyers don't: a motivated, related seller. Before settling on owner financing, a few angles worth running:

1. **Gift of equity + low-down conventional.** Your dad can gift you up to 20% of the appraised value as your "down payment." On an $800K home that's potentially $160K in gifted equity. You bring 3–5% cash to closing, your dad walks with ~$640K, and your $75K stays as reserves. Often beats pure owner financing because he gets liquidity now and you lock in today's 30-yr amortization.
2. **Installment-sale owner financing.** If your dad doesn't need the full $640K up front, an installment sale spreads his capital gains across years (§453) and can outperform money-market returns. Loop in a CPA.
3. **House hack a 2-3 unit conversion.** If the property genuinely zones for 2–4 units and you'll live in one, 5% down conventional or FHA on a 2–4 unit is on the table — but confirm zoning, septic, and water capacity first, otherwise the appraisal kills the financing.
4. **Combo:** Gift of equity ~15–20% + small seller second for closing costs. Clean and lender-friendly.

The cottage being retained complicates appraisal — work with a lender who's done split-parcel or "subject-to" lot adjustments before. After 31 years and a low fallout rate, the structural deals like this are won or lost in underwriting, not at the rate desk.

Happy to model a few scenarios so you and your dad can compare side-by-side: https://mortgageequitypartners.com/james-driscoll/

To your success,
Jim Driscoll
Mortgage Equity Partners — Methuen & Lynnfield, MA
617-529-9007`,
    notes: "Location not stated; if MA, double credibility hit. Push gift-of-equity over owner finance as cleaner path."
  },
  {
    date_found: "2026-05-16",
    time_found: "16:00 EDT",
    community: "BiggerPockets",
    source: "Mortgage Brokers & Lenders",
    post_title: "Investment property HELOCs",
    author: "Seth McGathey",
    post_url: "https://www.biggerpockets.com/forums/22/topics/1288266-investment-property-helocs",
    intent_tier: "TIER 1",
    primary_intent: "Investor HELOC referral",
    key_question: "Does anyone know of a specific lender that does do investment property HELOCs?",
    reason_selected:
      "Specialty ask, high-intent, posted May 14. Jim can compare HELOC vs cash-out DSCR — both in wheelhouse.",
    drafted_response: `Seth — they do exist, just not where most people look. Big-bank retail desks usually say no. Where you'll actually find investment-property HELOCs:

- **Local credit unions and community banks** — many keep them on their own balance sheet, so they can underwrite to their own box. Typically 70–75% CLTV cap on non-owner-occupied, terms like 10/20 or 5/15.
- **Specialty non-QM lenders** running investor HELOC programs (Spring EQ, Figure, Lima One have all run them at points). Read the fine print — some are true revolving, some are closed-end second liens dressed up as a HELOC.
- **Cash-out DSCR refi as a HELOC alternative** — usually 75% LTV, fixed rate, no variable risk. Often cheaper over a 5-year hold than a HELOC at prime + 2–3%.

Things to ask before falling in love with a quote: true revolving or one-time draw, index + margin, non-use fee, prepay penalty, and CLTV cap by property type (SFR vs 2–4 unit vs 5+).

31 years originating mortgages — I work with several investor-friendly lenders running these programs and can tell you in 10 minutes which ones are actually funding HELOCs on investment property right now vs. just keeping the program page on the website.

Happy to compare a HELOC vs cash-out DSCR side by side for your numbers: https://mortgageequitypartners.com/james-driscoll/

To your success,
Jim Driscoll
Mortgage Equity Partners — Methuen & Lynnfield, MA
617-529-9007`,
    notes: "WI out of state; specialty trumps geography. Lead with credit unions + non-QM alternatives."
  },
  {
    date_found: "2026-05-16",
    time_found: "16:00 EDT",
    community: "BiggerPockets",
    source: "Buying & Selling Real Estate",
    post_title: "I'm a first time buyer and I want help",
    author: "Keith Betts",
    post_url:
      "https://www.biggerpockets.com/forums/311/topics/1288475-i-m-a-first-time-buyer-and-i-want-help",
    intent_tier: "TIER 1",
    primary_intent: "First-time buyer prep roadmap",
    key_question:
      "Low debt, stable job, ~620 credit with high revolving, small savings, 6-month prep window — who do I talk to and what do I do?",
    reason_selected:
      "Coachable profile, 6-month runway is exactly Jim's strength, mirrors case study #1. Posted May 15.",
    drafted_response: `Keith — the good news is you already have most of the foundation (stable job, low overall debt, savings habit started). The 620 score and revolving balances are very fixable in 6 months. Clean roadmap:

**Credit (biggest lever — this alone can move 40–80 points):**
- Pay each card down below 30% of its limit, ideally below 10%. Utilization is the #2 score factor behind payment history.
- Don't close old cards. Length of credit history matters.
- Don't open new credit in the 6 months before applying. Each hard pull dings you.
- Pull your reports at annualcreditreport.com and dispute any errors — small medical collections often shouldn't be reporting at all.

**Savings target:**
- FHA: 3.5% down + 2–3% closing costs. On a $200K house that's ~$11–13K total cash to close.
- Conventional 3% down is sometimes cheaper depending on credit (lower MI cost).
- Most states have first-time-buyer down payment assistance programs — worth checking yours, often $5–25K toward down payment under income limits.

**What to ask a lender now:**
- A *soft-pull* pre-qual (no credit hit) so you can see where you'd land at 620, 680, and 720. Knowing the rate/MI delta at each tier shows you exactly what each credit point is worth — usually a powerful motivator.

The biggest mistake first-time buyers make is shopping for a house before they shop for a lender. Get pre-approved first so you actually know what an underwriter will agree to, not what an online calculator says.

After 31 years and a very low fallout rate, much of which comes from prepping buyers 6–12 months in advance, I'd say you're in great shape to be ready by fall. Happy to do a no-pressure call, look at your credit report with you, and map out the 6 months.

https://mortgageequitypartners.com/james-driscoll/

To your success,
Jim Driscoll
Mortgage Equity Partners — Methuen & Lynnfield, MA
617-529-9007`,
    notes: "Likely Arkansas. Don't mention MassHousing — give a generic FHA + DPA + utilization-reduction roadmap."
  },
  {
    date_found: "2026-05-16",
    time_found: "16:00 EDT",
    community: "BiggerPockets",
    source: "Buying & Selling Real Estate",
    post_title: "Curious how people are thinking about multifamily underwriting right now",
    author: "Ying Tang",
    post_url:
      "https://www.biggerpockets.com/forums/311/topics/1288494-curious-how-people-are-thinking-about-multifamily-underwriting-right-now",
    intent_tier: "TIER 2",
    primary_intent: "Buy-now-refi-later strategy validation",
    key_question: "Is it worth buying at today's rates with the plan to refi 1-2 years out at 1%+ lower?",
    reason_selected:
      "Refinance specialty, perfect WhyRefiMyHome.com fit, thoughtful poster who'll engage with technical reply. Posted May 15.",
    drafted_response: `Ying — this question splits into two things: is the "buy now, refi later" mental model sound, and how should you stress-test the entry.

**On the strategy itself:**
- Buying at high rates with the plan to refi later isn't inherently risky — it's just sensitive to one assumption: rates actually drop. Build the underwriting on three rate paths (stay flat, drop 100 bps, drop 200 bps) and only buy if the deal still works in the "stay flat" scenario at the 5-year mark. If it only works under the refi, you're investing in a rate forecast, not a property.
- "Marry the property, date the rate" is true *only* if the property cash flows or you have non-deal income/liquidity to carry it. You said carry isn't the issue, so you've taken away the #1 risk. What's left is refi access risk — meaning, can you actually qualify and is the appraisal there in 12–24 months?

**On the math people often miss:**
- A 1% rate drop on a $1M loan ≈ ~$600/month in P&I savings on a 30-yr. Real, but won't fix a fundamentally weak deal.
- Refi closing costs are 1.5–3% of loan amount. If you refi every 18 months chasing rates, those costs eat the savings. Model break-even on every refi scenario.
- DSCR products generally have prepay penalties (5/4/3/2/1 or 3-year stepdown). Bake the prepay into your refi math — many deals look great until the prepay kills the IRR.

I built WhyRefiMyHome.com partly for this question — it models long-term cost of waiting vs. acting now at various rate scenarios. Worth running your numbers through it: https://WhyRefiMyHome.com

After 31 years of originating, I've watched a lot of investors get bailed out by refis and a few get stuck when the appraisal didn't come back. The deals that worked best either cash flowed at entry rates OR had the operator with deep enough liquidity to weather an extended hold — sounds like you're in the second camp, which is a much safer place to underwrite "refi later."

To your success,
Jim Driscoll
Mortgage Equity Partners — Methuen & Lynnfield, MA
617-529-9007`,
    notes: "Phoenix, AZ. Push 3-rate-scenario stress test + prepay penalty drag. Resource = WhyRefiMyHome.com."
  },
  {
    date_found: "2026-05-16",
    time_found: "16:00 EDT",
    community: "BiggerPockets",
    source: "Buying & Selling Real Estate",
    post_title: "Funding First or Deal First?",
    author: "Paul Zimmermann",
    post_url: "https://www.biggerpockets.com/forums/311/topics/1288290-funding-first-or-deal-first",
    intent_tier: "TIER 2",
    primary_intent: "Investor financing strategy",
    key_question: "Do you line up funding first or find the deal first?",
    reason_selected:
      "Quick, broad question — easy spot to drop 31-year credibility hook + clear opinion. Posted May 14.",
    drafted_response: `Paul — funding first, every time. Two reasons:

1. **Speed kills competition.** Pre-approval (or DSCR term sheet for non-owner-occ) means you can write a clean offer with proof of funds in 24 hours. Sellers, listing agents, and wholesalers all sort offers by certainty of close. A buyer without funding lined up loses to one who has it, even at a lower price.

2. **You set the deal's max numbers based on the funding box, not the other way around.** If you find a great property at 75% ARV but your DSCR lender only goes 70%, you've either got to bring more cash or walk. Knowing the lender's max LTV, DSCR floor, and seasoning rules ahead of time tells you what an actually-fundable deal looks like.

Caveat: "funding lined up" doesn't mean a single approval letter. It means knowing which lender fits which deal type — DSCR for stabilized rentals, fix-and-flip/bridge for rehab, conventional for owner-occ. Different products, different boxes.

After 31 years of originating mortgages, the deals that close clean are almost always the ones where the financing strategy was set before the offer.

To your success,
Jim Driscoll
Mortgage Equity Partners — Methuen & Lynnfield, MA
617-529-9007`,
    notes: "AZ. Short reply, no booking link — credibility play only."
  },
  {
    date_found: "2026-05-16",
    time_found: "16:00 EDT",
    community: "BiggerPockets",
    source: "Starting Out",
    post_title: "How did you learn underwriting?",
    author: "Juan Guzman",
    post_url: "https://www.biggerpockets.com/forums/12/topics/1288402",
    intent_tier: "TIER 3",
    primary_intent: "Educational — underwriting fundamentals",
    key_question: "Discussion about educational paths and resources for learning property underwriting skills",
    reason_selected: "Educational lift, easy 31-year credibility moment, no CTA. Posted May 15.",
    drafted_response: `Juan — picking up underwriting is part shadowing, part doing reps. A few things that accelerated it most for the investors I work with:

1. Pull 10 real DSCR/conventional approval term sheets and 10 declines. The pattern in why a file passed or failed is much clearer in real cases than in textbooks.
2. Learn the four pillars: income, assets, credit, collateral. Every loan decision is some weighting of those four — once you can put any borrower's file in those buckets, you can roughly predict the lender's answer before they give it.
3. For investment deals specifically, learn DSCR math (rent / PITIA) and stress-test at higher vacancy and a 10–15% rate cushion. That's roughly what underwriting will do anyway.
4. Read FNMA's Selling Guide for conventional and the FHA Handbook 4000.1 for FHA. Free, authoritative, and most "guideline questions" people ask online are answered there.

The fastest version: find a mortgage broker willing to walk you through a few approved files. Most of us are happy to teach the box because it makes you a better borrower or referral partner.

Jim Driscoll, Mortgage Equity Partners`,
    notes: "Pure value play. No booking link, no resource pitch."
  },
  {
    date_found: "2026-05-16",
    time_found: "16:00 EDT",
    community: "BiggerPockets",
    source: "Starting Out",
    post_title: "When to begin building your team",
    author: "Jose Mendez",
    post_url: "https://www.biggerpockets.com/forums/12/topics/1288394",
    intent_tier: "TIER 3",
    primary_intent: "Educational — investor team-building",
    key_question: "Guidance on timing and process for assembling a real estate investment support team",
    reason_selected:
      "Quick educational reply that legitimately places lender first in the build order. Posted May 14.",
    drafted_response: `Jose — start building before you find the deal, not after. A pre-built team buys you speed and confidence to write offers. Order I'd suggest:

1. **Lender first** — knowing your financing box defines what deal type you can even chase. Get pre-approved or get a DSCR term sheet for investment.
2. **Agent who's worked with investors** — different skill set from primary residence agents.
3. **Local property manager** — even if you'll self-manage, get their rent estimates and tenant pool feedback before you buy.
4. **CPA who knows real estate** — depreciation, cost seg, 1031s — they pay for themselves.
5. **Insurance agent and attorney** as you get closer to closing.

Lender first matters most. Without it, every deal evaluation is theoretical.

Jim Driscoll, Mortgage Equity Partners`,
    notes: "NC. Short reply, no CTA, no link."
  }
];

async function main() {
  console.log(`Backfilling ${leads.length} leads...`);
  const { error, count } = await supabase
    .from("leads")
    .upsert(leads, { onConflict: "post_url", count: "exact" });
  if (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
  console.log(`OK. Upserted ${count ?? leads.length} rows.`);
}

main();
