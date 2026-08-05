// Sanitizer unit tests. Run with: npx tsx scripts/test-sanitizer.ts
// Exit code 0 = all pass. No API calls, no DB — pure function tests.
import { sanitizeDraft, type SanitizeOptions } from "../lib/sanitizer";
import { isBlockedSubreddit, subredditPolicy } from "../lib/compliance";

const PROFILE = {
  firstName: "James",
  lastName: "Driscoll",
  company: "Mortgage Equity Partners",
  nmls: "21420"
};

const redditStrict: SanitizeOptions = { platform: "reddit", strict: true, profile: PROFILE };
const redditStd: SanitizeOptions = { platform: "reddit", strict: false, profile: PROFILE };
const bp: SanitizeOptions = { platform: "biggerpockets", strict: false, profile: PROFILE };

interface Case {
  name: string;
  text: string;
  opts: SanitizeOptions;
  expectBlocked: boolean;
}

const CLEAN_ANSWER = `A HELOC on an investment property is harder to find than on a primary residence because most retail banks only offer them on owner-occupied homes. Credit unions and portfolio lenders are the usual sources. Expect a lower max LTV, usually 70 to 75 percent, and slightly higher rates than a primary-home line. If the numbers matter to your decision, it is worth sitting down with a local loan officer or a HUD housing counselor to compare a line of credit against a cash-out refinance for your situation.`;

const BANNED_SIG = `Mortgage Loan Officer | 31 yrs | NMLS #21420 | Licensed MA, NH, ME, CT, RI, NJ, FL, NC | FHA, conventional, VA, MassHousing, jumbo, self-employed | DM for state-specific guidance`;

const CASES: Case[] = [
  // ── The exact block that caused the ban, and variants ──
  { name: "banned signature block verbatim", text: `${CLEAN_ANSWER}\n\n${BANNED_SIG}`, opts: redditStrict, expectBlocked: true },
  { name: "banned signature alone", text: BANNED_SIG, opts: redditStrict, expectBlocked: true },
  { name: "banned signature on standard sub", text: `${CLEAN_ANSWER}\n\n${BANNED_SIG}`, opts: redditStd, expectBlocked: true },
  { name: "NMLS spelled with periods", text: `Good question. I hold N.M.L.S. number 21420 so I deal with this daily.`, opts: redditStrict, expectBlocked: true },
  { name: "NMLS spaced letters", text: `My N M L S is 21420 if you want to look me up.`, opts: redditStrict, expectBlocked: true },
  { name: "years shorthand", text: `After 31 yrs doing this, trust me: rate shop.`, opts: redditStrict, expectBlocked: true },
  { name: "years pitch longform", text: `I've got 31 years in the business and this comes up constantly.`, opts: redditStrict, expectBlocked: true },
  { name: "licensed states list", text: `Licensed in MA, NH, ME and CT by the way.`, opts: redditStrict, expectBlocked: true },
  { name: "name + title pairing", text: `James Driscoll here, Mortgage Loan Officer, and this is my take.`, opts: redditStrict, expectBlocked: true },

  // ── Contact info, plain and obfuscated ──
  { name: "phone number", text: `Call me at 617-529-9007 and we'll sort it out.`, opts: redditStrict, expectBlocked: true },
  { name: "phone spaced digits", text: `You can reach my desk on 6 1 7 5 2 9 9 0 0 7 anytime.`, opts: redditStrict, expectBlocked: true },
  { name: "email address", text: `Email jim@meploans.com for a quote.`, opts: redditStrict, expectBlocked: true },
  { name: "email obfuscated at/dot", text: `Write to jim at meploans dot com and I'll run your numbers.`, opts: redditStrict, expectBlocked: true },
  { name: "URL http", text: `Full breakdown here: https://mortgageequitypartners.com/james-driscoll/`, opts: redditStrict, expectBlocked: true },
  { name: "URL dot-com obfuscated", text: `Just search financewithjim dot com for the calculator.`, opts: redditStrict, expectBlocked: true },
  { name: "bare domain", text: `The calculator on whyrefimyhome.com models this exact trade-off.`, opts: redditStrict, expectBlocked: true },
  { name: "company name", text: `We see this all the time at Mortgage Equity Partners.`, opts: redditStrict, expectBlocked: true },
  { name: "brand abbreviation MEP", text: `At MEP we structure these as standalone seconds.`, opts: redditStrict, expectBlocked: true },

  // ── Solicitation / CTA ──
  { name: "DM me", text: `${CLEAN_ANSWER} DM me if you want specifics for your state.`, opts: redditStrict, expectBlocked: true },
  { name: "message me variant", text: `Happy to explain more — just message me.`, opts: redditStrict, expectBlocked: true },
  { name: "reach out (self)", text: `If this is confusing, reach out and I'll walk you through it.`, opts: redditStrict, expectBlocked: true },
  { name: "feel free to contact", text: `Feel free to contact me with your scenario.`, opts: redditStrict, expectBlocked: true },
  { name: "offer of service", text: `I can help you with your loan if the current lender falls through.`, opts: redditStrict, expectBlocked: true },
  { name: "happy to run numbers", text: `Happy to run numbers for you if you share the purchase price.`, opts: redditStrict, expectBlocked: true },

  // ── Strict-mode credential claims ──
  { name: "strict: self-identification", text: `As a loan officer, I see DSCR files like yours weekly.`, opts: redditStrict, expectBlocked: true },
  { name: "strict: my clients anecdote", text: `My clients usually pick the 30-year for flexibility.`, opts: redditStrict, expectBlocked: true },
  { name: "strict: I've originated", text: `I've originated hundreds of these loans and the seasoning rule is real.`, opts: redditStrict, expectBlocked: true },

  // ── BiggerPockets: contact + solicitation apply ──
  { name: "BP solicitation", text: `${CLEAN_ANSWER}\n\nHappy to run numbers for you.\n\nJames Driscoll`, opts: bp, expectBlocked: true },
  { name: "BP phone", text: `${CLEAN_ANSWER}\n\nCall 617-529-9007.\n\nJames Driscoll`, opts: bp, expectBlocked: true },

  // ── Clean drafts must pass ──
  { name: "clean informational draft (strict reddit)", text: CLEAN_ANSWER, opts: redditStrict, expectBlocked: false },
  { name: "clean informational draft (standard reddit)", text: CLEAN_ANSWER, opts: redditStd, expectBlocked: false },
  { name: "clean draft with loan terms (30 yr fixed not a credential)", text: `A 30 yr fixed at today's pricing beats the 5/1 ARM unless you're moving within 5 years. Over 15 years the amortization difference is large.`, opts: redditStrict, expectBlocked: false },
  { name: "clean BP draft with name-only signature", text: `${CLEAN_ANSWER}\n\nJames Driscoll`, opts: bp, expectBlocked: false },
  { name: "generic professional referral allowed", text: `For DPA program specifics, reach out to a HUD housing counselor — they're free and they know every local program.`, opts: redditStrict, expectBlocked: false }
];

let pass = 0;
let fail = 0;
for (const c of CASES) {
  const res = sanitizeDraft(c.text, c.opts);
  const ok = res.blocked === c.expectBlocked;
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${c.name}` +
      (res.blocked ? `  [blocked: ${res.reasons.join("; ")}]` : "  [clean]") +
      (ok ? "" : `  <-- expected ${c.expectBlocked ? "BLOCKED" : "clean"}`)
  );
}

// ── Blocklist + policy map sanity ──
const gateChecks: Array<[string, boolean]> = [
  ["isBlockedSubreddit('Reddit','r/personalfinance')", isBlockedSubreddit("Reddit", "r/personalfinance") === true],
  ["isBlockedSubreddit('Reddit','r/PersonalFinance') case-insensitive", isBlockedSubreddit("Reddit", "r/PersonalFinance") === true],
  ["isBlockedSubreddit('Reddit','personalfinance') no prefix", isBlockedSubreddit("Reddit", "personalfinance") === true],
  ["isBlockedSubreddit('BiggerPockets','Starting Out') non-reddit false", isBlockedSubreddit("BiggerPockets", "Starting Out") === false],
  ["policy('r/Mortgages') is STRICT_NO_PROMO", subredditPolicy("r/Mortgages") === "STRICT_NO_PROMO"],
  ["policy('r/SomeBrandNewSub') defaults STRICT_NO_PROMO", subredditPolicy("r/SomeBrandNewSub") === "STRICT_NO_PROMO"],
  ["policy('r/boston') is STANDARD", subredditPolicy("r/boston") === "STANDARD"]
];
for (const [name, ok] of gateChecks) {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
