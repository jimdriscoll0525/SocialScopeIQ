import type { Metadata } from "next";
import Image from "next/image";
import LeadCaptureForm from "@/components/LeadCaptureForm";
// Photo sources (free license, downloaded to public/assets — do not hotlink):
// - 2-1-buydown-hero.jpg: Pexels #106399 by Binyamin Mellish
//   https://www.pexels.com/photo/blue-and-gray-concrete-house-with-attic-during-twilight-106399/
// - 2-1-buydown-calculator.jpg: Pexels #4386366 by Karolina Grabowska
//   https://www.pexels.com/photo/crop-unrecognizable-person-with-calculator-and-money-4386366/
import heroImg from "@/public/assets/2-1-buydown-hero.jpg";
import calcImg from "@/public/assets/2-1-buydown-calculator.jpg";

const PAGE_PATH = "/blog/2-1-buydown";
const TITLE = "What You Need to Know About How a 2-1 Buydown Works";
const DESCRIPTION =
  "A loan officer with 31 years in the business explains 2-1 buydowns: how the temporary rate reduction works, who it fits, real payment math on a $500,000 loan, and how you qualify.";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    url: PAGE_PATH,
    images: [{ url: "/assets/2-1-buydown-hero.jpg", width: 1600, height: 1067, alt: "A home at dusk with warm lights on" }]
  }
};

// ---------------------------------------------------------------------------
// Example payment math — $500,000 loan, 30-year fixed, 7.00% note rate.
// Computed, not hand-typed, so the table, chart, and copy can't drift apart.

const LOAN_AMOUNT = 500_000;
const TERM_MONTHS = 360;
const NOTE_RATE = 7.0;

function pAndI(annualRatePct: number): number {
  const r = annualRatePct / 100 / 12;
  return (LOAN_AMOUNT * r) / (1 - Math.pow(1 + r, -TERM_MONTHS));
}

const PAY_NOTE = pAndI(NOTE_RATE); // 3,326.51
const PAY_Y1 = pAndI(NOTE_RATE - 2); // 2,684.11
const PAY_Y2 = pAndI(NOTE_RATE - 1); // 2,997.75
const SAVE_Y1 = PAY_NOTE - PAY_Y1;
const SAVE_Y2 = PAY_NOTE - PAY_Y2;
const BUYDOWN_COST = (SAVE_Y1 + SAVE_Y2) * 12;

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCents = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// Inline SVG bar chart: monthly P&I by period, with the note-rate payment as a
// dashed reference line and the savings shown as dashed outline segments.

function BuydownChart() {
  const W = 640;
  const H = 380;
  const M = { top: 48, right: 20, bottom: 52, left: 64 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const yMax = 3500;
  const y = (v: number) => Math.round((M.top + plotH - (v / yMax) * plotH) * 10) / 10;

  const bars = [
    { label: "Year 1", rate: "5.00%", value: PAY_Y1, save: SAVE_Y1 },
    { label: "Year 2", rate: "6.00%", value: PAY_Y2, save: SAVE_Y2 },
    { label: "Years 3–30", rate: "7.00%", value: PAY_NOTE, save: 0 }
  ];
  const barW = 96;
  const slot = plotW / bars.length;

  // Bar with rounded top corners only, anchored flat on the baseline.
  const barPath = (x: number, top: number) => {
    const r = 4;
    const bottom = y(0);
    return `M ${x} ${bottom} V ${top + r} Q ${x} ${top} ${x + r} ${top} H ${x + barW - r} Q ${x + barW} ${top} ${x + barW} ${top + r} V ${bottom} Z`;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby="buydown-chart-title buydown-chart-desc"
      className="w-full"
    >
      <title id="buydown-chart-title">Monthly principal and interest by year with a 2-1 buydown</title>
      <desc id="buydown-chart-desc">
        {`Bar chart of the example $500,000 loan. Year 1 at 5%: ${usdCents(PAY_Y1)}. Year 2 at 6%: ${usdCents(
          PAY_Y2
        )}. Years 3 through 30 at the 7% note rate: ${usdCents(PAY_NOTE)}. The dashed line marks the full note-rate payment; the dashed boxes show the monthly savings in years 1 and 2.`}
      </desc>

      {/* Gridlines + y-axis labels */}
      {[0, 1000, 2000, 3000].map((v) => (
        <g key={v}>
          <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={M.left - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="#6b7280">
            {v === 0 ? "$0" : `$${v / 1000}k`}
          </text>
        </g>
      ))}

      {/* Note-rate reference line */}
      <line
        x1={M.left}
        x2={W - M.right}
        y1={y(PAY_NOTE)}
        y2={y(PAY_NOTE)}
        stroke="#1e40af"
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />
      <text x={W - M.right} y={y(PAY_NOTE) - 8} textAnchor="end" fontSize={12} fill="#374151">
        Full note-rate payment · {usd(PAY_NOTE)}/mo
      </text>

      {bars.map((b, i) => {
        const x = M.left + slot * i + (slot - barW) / 2;
        const top = y(b.value);
        return (
          <g key={b.label}>
            {/* Savings zone: bar top up to the reference line */}
            {b.save > 0 ? (
              <>
                <rect
                  x={x}
                  y={y(PAY_NOTE)}
                  width={barW}
                  height={top - y(PAY_NOTE)}
                  fill="none"
                  stroke="#1e40af"
                  strokeWidth={1.25}
                  strokeDasharray="4 3"
                />
                <text x={x + barW / 2} y={y(PAY_NOTE) - 8} textAnchor="middle" fontSize={13} fontWeight={600} fill="#374151">
                  −{usd(b.save)}/mo
                </text>
              </>
            ) : null}
            <path d={barPath(x, top)} fill="#1e40af" />
            <text x={x + barW / 2} y={top + 22} textAnchor="middle" fontSize={13.5} fontWeight={600} fill="#ffffff">
              {usd(b.value)}
            </text>
            <text x={x + barW / 2} y={y(0) + 20} textAnchor="middle" fontSize={13} fill="#374151">
              {b.label}
            </text>
            <text x={x + barW / 2} y={y(0) + 38} textAnchor="middle" fontSize={12} fill="#6b7280">
              {b.rate}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PaymentTable() {
  const rows = [
    { period: "Year 1", rate: "5.00%", payment: PAY_Y1, savings: SAVE_Y1 },
    { period: "Year 2", rate: "6.00%", payment: PAY_Y2, savings: SAVE_Y2 },
    { period: "Years 3–30", rate: "7.00% (note rate)", payment: PAY_NOTE, savings: 0 }
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Example monthly principal and interest on a $500,000 30-year fixed loan with a 2-1 buydown
        </caption>
        <thead>
          <tr className="border-b-2 border-blue-900 text-left">
            <th scope="col" className="py-2.5 pr-4 font-semibold text-blue-950">Period</th>
            <th scope="col" className="py-2.5 pr-4 font-semibold text-blue-950">Rate</th>
            <th scope="col" className="py-2.5 pr-4 font-semibold text-blue-950">Monthly P&amp;I</th>
            <th scope="col" className="py-2.5 font-semibold text-blue-950">Monthly savings</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.period} className="border-b border-neutral-200 odd:bg-neutral-50">
              <td className="py-2.5 pr-4 font-medium">{r.period}</td>
              <td className="py-2.5 pr-4">{r.rate}</td>
              <td className="py-2.5 pr-4">{usdCents(r.payment)}</td>
              <td className="py-2.5">{r.savings > 0 ? usdCents(r.savings) : "—"}</td>
            </tr>
          ))}
          <tr className="border-b-2 border-blue-900 bg-blue-50 font-semibold text-blue-950">
            <td className="py-3 pr-4">You save</td>
            <td className="py-3 pr-4" />
            <td className="py-3 pr-4">{usdCents(SAVE_Y1 * 12 + SAVE_Y2 * 12)} total</td>
            <td className="py-3">
              {usdCents(SAVE_Y1 * 12)} yr 1 + {usdCents(SAVE_Y2 * 12)} yr 2
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ArticleJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: TITLE,
    description: DESCRIPTION,
    image: `${siteUrl()}/assets/2-1-buydown-hero.jpg`,
    mainEntityOfPage: `${siteUrl()}${PAGE_PATH}`,
    author: {
      "@type": "Person",
      name: "Jim Driscoll",
      jobTitle: "Mortgage Loan Officer",
      worksFor: { "@type": "Organization", name: "Mortgage Equity Partners" }
    }
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

const h2Cls = "font-serif text-2xl font-bold tracking-tight text-blue-950 mt-12 mb-4";

export default function BuydownPage() {
  return (
    <div className="bg-white text-neutral-800">
      <ArticleJsonLd />

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-serif text-lg font-bold text-blue-950">Jim Driscoll</p>
            <p className="text-xs text-neutral-500">Mortgage Loan Officer · Mortgage Equity Partners · NMLS #21420</p>
          </div>
          <a
            href="#get-started"
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
          >
            Get Started
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="relative h-[320px] w-full sm:h-[420px]">
        <Image
          src={heroImg}
          alt="A two-story home at dusk with warm interior lights on"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-950/85 via-blue-950/40 to-blue-950/20" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-6 pb-10">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-200">Homebuyer education</p>
            <h1 className="mt-2 max-w-3xl font-serif text-3xl font-bold leading-tight text-white sm:text-4xl">
              {TITLE}
            </h1>
            <p className="mt-3 text-sm text-blue-100">
              By Jim Driscoll · Mortgage Loan Officer, 31 years in the business
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div id="get-started" className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          {/* Article */}
          <article className="max-w-none">
            <p className="text-lg leading-relaxed text-neutral-700">
              Rates move, markets shift, and every few years a financing tool that&rsquo;s been
              around for decades suddenly becomes the most talked-about option at the closing
              table. Right now, that tool is the 2-1 buydown. I&rsquo;ve been putting loans
              together for 31 years, and I&rsquo;ve seen buydowns work beautifully — and
              I&rsquo;ve seen them misunderstood. Here&rsquo;s the straight version.
            </p>

            {/* Mobile-only lead form so visitors see it without scrolling to the sidebar */}
            <div className="mt-8 lg:hidden">
              <LeadCaptureForm sourcePage={PAGE_PATH} />
            </div>

            <h2 className={h2Cls}>What is a 2-1 buydown?</h2>
            <p className="leading-relaxed">
              A 2-1 buydown is a <strong>temporary</strong> interest rate reduction on a fixed-rate
              mortgage. Your loan closes at its permanent note rate — say 7.00% — but for the
              first year you make payments as if the rate were <strong>2% lower</strong> (5.00%),
              and in the second year as if it were <strong>1% lower</strong> (6.00%). From year
              three through the end of the loan, you pay the full note rate.
            </p>
            <p className="mt-4 leading-relaxed">
              Here&rsquo;s the part people miss: the discount isn&rsquo;t free money appearing out
              of thin air, and it isn&rsquo;t a teaser rate that can spring on you later. The full
              cost of those reduced payments is funded up front — typically by a
              <strong> seller, builder, or lender credit at closing</strong> — and deposited into
              an escrow account. Each month during the buydown period, that account quietly pays
              the difference between your discounted payment and the real note-rate payment. The
              lender receives the full amount either way; you just write a smaller check.
            </p>

            <blockquote className="my-8 border-l-4 border-blue-900 bg-blue-50 px-6 py-5">
              <p className="font-serif text-xl font-semibold leading-snug text-blue-950">
                &ldquo;A 2-1 buydown doesn&rsquo;t change what you qualify for — it changes what
                the first two years feel like. You earn the approval at the full rate and keep
                the breathing room.&rdquo;
              </p>
            </blockquote>

            <h2 className={h2Cls}>Who a 2-1 buydown is right for</h2>
            <p className="leading-relaxed">
              After three decades of watching these play out, I&rsquo;d say a 2-1 buydown tends to
              fit four kinds of buyers:
            </p>
            <ul className="mt-4 list-disc space-y-3 pl-6 leading-relaxed">
              <li>
                <strong>Buyers who expect their income to grow.</strong> Early-career
                professionals, a household about to go from one income back to two, business
                owners in a growth year — the lower payment bridges you to where your income is
                heading.
              </li>
              <li>
                <strong>Buyers negotiating in a slower market.</strong> When homes sit longer,
                sellers offer concessions. A seller-paid buydown often does more for your monthly
                budget than the same dollars taken as a price cut — and it costs the seller the
                same.
              </li>
              <li>
                <strong>Buyers who want to ease into the payment.</strong> New homeowners face
                furniture, moving costs, and the surprises every house hides in year one. Two
                years of reduced payments is real margin at exactly the right time.
              </li>
              <li>
                <strong>Buyers planning to refinance if rates drop.</strong> If you refinance or
                pay off the loan during the buydown period, the unused funds in the escrow
                account don&rsquo;t vanish — they&rsquo;re typically credited back at payoff. You
                got the cheaper payments while they lasted and the remainder comes back to the
                loan balance.
              </li>
            </ul>

            <figure className="my-10">
              <Image
                src={calcImg}
                alt="A calculator and notepad resting on a spread of dollar bills"
                className="w-full rounded-lg object-cover"
                sizes="(min-width: 1024px) 60vw, 100vw"
              />
              <figcaption className="mt-2 text-sm text-neutral-500">
                The buydown funds sit in escrow and subsidize each payment — the math is set at
                closing, not left to chance.
              </figcaption>
            </figure>

            <h2 className={h2Cls}>What the payments actually look like</h2>
            <p className="leading-relaxed">
              Numbers make this concrete. Take a <strong>$500,000 loan</strong> on a 30-year
              fixed at a <strong>7.00% note rate</strong>. With a 2-1 buydown, your first year is
              paid at 5.00% and your second at 6.00%. Here is the real principal-and-interest
              math:
            </p>

            <div className="my-6 rounded-lg border border-neutral-200 p-4 sm:p-6">
              <PaymentTable />
            </div>

            <div className="my-6 rounded-lg border border-neutral-200 p-4 sm:p-6">
              <BuydownChart />
            </div>

            <p className="leading-relaxed">
              That&rsquo;s <strong>{usd(SAVE_Y1)} a month back in your pocket in year one</strong>{" "}
              and {usd(SAVE_Y2)} a month in year two — {usdCents(BUYDOWN_COST)} in total, which
              is exactly what the buydown costs whoever funds it. In a negotiation, that&rsquo;s
              the number you&rsquo;re asking the seller or builder to cover.
            </p>
            <p className="mt-4 text-sm italic text-neutral-500">
              Example for illustration only — not a quote or an offer of credit. Taxes,
              insurance, and mortgage insurance are not included, and your rate and terms will
              depend on your scenario.
            </p>

            <h2 className={h2Cls}>How you qualify</h2>
            <p className="leading-relaxed">
              This is the question I get most, and the answer protects you:{" "}
              <strong>you must qualify at the full note rate</strong>, not the bought-down rate.
              On our example, the lender approves you as if you&rsquo;ll pay {usd(PAY_NOTE)} a
              month from day one. That&rsquo;s deliberate — it means the year-three payment is
              never a surprise you can&rsquo;t afford, only a number you&rsquo;ve already been
              approved for.
            </p>
            <p className="mt-4 leading-relaxed">A few more ground rules:</p>
            <ul className="mt-4 list-disc space-y-3 pl-6 leading-relaxed">
              <li>
                2-1 buydowns are generally available on <strong>conforming, FHA, and VA purchase
                loans</strong> — and typically <em>not</em> on adjustable-rate mortgages or
                cash-out refinances.
              </li>
              <li>
                When the seller funds it, the credit counts toward{" "}
                <strong>seller concession limits</strong>, which vary by loan type and down
                payment. Part of my job is making sure the buydown fits inside those caps
                alongside any other credits you&rsquo;ve negotiated.
              </li>
              <li>
                The buydown agreement is documented at closing, and the escrow account is held
                and administered by the servicer — nothing about it depends on anyone&rsquo;s
                goodwill later.
              </li>
            </ul>

            <h2 className={h2Cls}>Is it right for you?</h2>
            <p className="leading-relaxed">
              Sometimes it is, and sometimes a permanent buydown of the rate — or simply a lower
              price — beats it. It depends on how long you&rsquo;ll keep the loan, what the
              seller will actually agree to, and where your income is headed. That&rsquo;s a
              fifteen-minute conversation with real numbers, not a guess. After 31 years,
              I&rsquo;ve learned the best mortgage is the one built around your situation — so
              let&rsquo;s run yours.
            </p>

            {/* ============================================================
                ⚠️ COMPLIANCE BLOCK — placeholders below MUST be reviewed and
                confirmed by compliance before this page goes live. Items to
                verify: legal name, company name, company NMLS #, licensing
                states, Equal Housing logo requirements, disclaimer wording.
                ============================================================ */}
            <aside
              aria-label="Licensing and disclosures"
              className="mt-14 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50/60 p-6 text-sm leading-relaxed text-neutral-700"
            >
              <p className="mb-2 font-semibold uppercase tracking-wide text-amber-700">
                Draft — pending compliance review
              </p>
              <p>
                <strong>Jim Driscoll</strong>, Mortgage Loan Officer, NMLS #21420 ·{" "}
                <strong>Mortgage Equity Partners</strong>, Company NMLS #[COMPANY NMLS # — CONFIRM]
              </p>
              <p className="mt-3">
                The payment figures on this page are examples for illustration only and are not
                an offer of credit, a rate quote, or a commitment to lend. Rates, payments, and
                program availability are subject to change without notice and depend on your
                individual scenario. Borrowers must qualify at the full note rate. All loans
                subject to credit approval and property appraisal. Temporary buydown programs
                are subject to investor and program guidelines.
              </p>
              <p className="mt-3 font-medium">Equal Housing Opportunity.</p>
            </aside>
          </article>

          {/* Sidebar */}
          <aside className="lg:pt-2">
            <div className="space-y-6 lg:sticky lg:top-6">
              <div className="hidden lg:block">
                <LeadCaptureForm sourcePage={PAGE_PATH} />
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6">
                <p className="font-serif text-lg font-bold text-blue-950">About Jim</p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  I&rsquo;ve spent 31 years helping buyers structure the right mortgage — not the
                  flashiest one. If a 2-1 buydown fits your situation, I&rsquo;ll show you the
                  math. If it doesn&rsquo;t, I&rsquo;ll tell you that too.
                </p>
                <p className="mt-3 text-xs text-neutral-500">
                  Mortgage Loan Officer · Mortgage Equity Partners · NMLS #21420
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-6 bg-blue-950 text-blue-100">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm">
          <p className="font-serif text-base font-bold text-white">Jim Driscoll · Mortgage Equity Partners</p>
          <p className="mt-2 text-blue-200">
            NMLS #21420 · Company NMLS #[COMPANY NMLS # — CONFIRM] · Equal Housing Opportunity
          </p>
          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-blue-300">
            This page is for educational purposes and does not constitute an offer of credit or a
            rate quote. Payment examples are illustrations only. Borrowers must qualify at the
            note rate. All loans subject to credit approval.
          </p>
        </div>
      </footer>
    </div>
  );
}
