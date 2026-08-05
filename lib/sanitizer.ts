// Deterministic post-generation draft sanitizer — defense in depth behind the
// prompt rules, which have failed in production (permanent r/personalfinance
// ban). Runs on every Reddit draft; contact + solicitation checks also run on
// BiggerPockets. A hit BLOCKS the draft (flagged for manual rewrite in the
// dashboard) — we never silently strip and post.
//
// Bias: false positives are cheap (a manual review), false negatives got us
// banned. When in doubt, block.

export interface SanitizerProfile {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  nmls?: string | null;
}

export interface SanitizeOptions {
  // reddit: full rule set. biggerpockets: contact + solicitation rules.
  platform: "reddit" | "biggerpockets";
  // strict adds the no-credentials-at-all rules (STRICT_NO_PROMO subs).
  strict: boolean;
  profile?: SanitizerProfile;
}

export interface SanitizeResult {
  blocked: boolean;
  reasons: string[];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Rule {
  reason: string;
  test: (text: string, p: SanitizerProfile) => boolean;
}

// ── Contact info (Reddit + BiggerPockets) ───────────────────────────────────

const CONTACT_RULES: Rule[] = [
  {
    reason: "NMLS reference",
    // NMLS, N.M.L.S., N M L S, nmls#21420 — any form.
    test: (t) => /\bN\s*\.?\s*M\s*\.?\s*L\s*\.?\s*S\b/i.test(t)
  },
  {
    reason: "phone number",
    // 617-529-9007 / (617) 529 9007 / 617.529.9007
    test: (t) => /\(?\b\d{3}\)?[\s.\-]{0,2}\d{3}[\s.\-]{0,2}\d{4}\b/.test(t)
  },
  {
    reason: "phone number (spaced/obfuscated digits)",
    // "6 1 7 5 2 9 9 0 0 7" — ten digits separated by spaces/dashes/dots.
    test: (t) => /\b(?:\d[\s\-.]+){9}\d\b/.test(t)
  },
  {
    reason: "email address",
    test: (t) => /\b[\w.+-]+@[\w-]+\.\w{2,}\b/.test(t)
  },
  {
    reason: "email address (obfuscated)",
    // "jim at meploans dot com", "jim [at] meploans [dot] com"
    test: (t) =>
      /\b[\w.+-]+\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\bat\b)\s*[\w-]+\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\bdot\b)\s*\w{2,}\b/i.test(t)
  },
  {
    reason: "URL",
    test: (t) => /https?:\/\/|www\./i.test(t)
  },
  {
    reason: "URL (bare or obfuscated domain)",
    // "meploans.com", "financewithjim dot com"
    test: (t) =>
      /\b[a-z0-9][a-z0-9-]*\s*(?:\.|\bdot\b|\[\s*dot\s*\]|\(\s*dot\s*\))\s*(com|net|org|io|biz|info)\b/i.test(t)
  },
  {
    reason: "company/brand mention",
    test: (t, p) => {
      const brands = [
        "mortgage equity partners",
        "socialscopeiq",
        "financewithjim",
        "meploans",
        "whyrefimyhome"
      ];
      if (p.company?.trim()) brands.push(p.company.trim().toLowerCase());
      const lower = t.toLowerCase();
      if (brands.some((b) => lower.includes(b))) return true;
      // "MEP" as a standalone brand abbreviation (case-sensitive, word-bound).
      return /\bMEP\b/.test(t);
    }
  }
];

// ── Solicitation / call-to-action (Reddit + BiggerPockets) ──────────────────

const SOLICITATION_RULES: Rule[] = [
  {
    reason: "DM/contact invitation",
    test: (t) =>
      /\b(dm|pm|message|msg)\s+me\b|\bshoot\s+me\s+a\b|\bsend\s+me\s+a\s+(dm|pm|message)\b|\bcontact\s+me\b|\bget\s+in\s+touch\b|\bmy\s+inbox\b|\bdms?\s+(are\s+)?open\b/i.test(
        t
      )
  },
  {
    reason: "solicitation language ('reach out' / 'feel free to contact')",
    // "reach out to a HUD counselor / to your lender" is a generic referral
    // and allowed; anything else ("reach out", "reach out to me") blocks.
    test: (t) => {
      const feelFree = /\bfeel\s+free\s+to\s+(contact|reach|dm|pm|message|call)\b/i.test(t);
      const reachOut = /\breach\s+out\b(?!\s+to\s+(a|an|your|their|the)\b)/i.test(t);
      return feelFree || reachOut;
    }
  },
  {
    reason: "offer of service ('I can help' / 'happy to run numbers')",
    test: (t) =>
      /\bi\s+can\s+help\b|\bi('|’)?d\s+be\s+(glad|happy)\s+to\s+(help|run|walk|talk)\b|\bhappy\s+to\s+(help|chat|talk|run|walk|take\s+a\s+look|model|compare)\b|\bi\s+(work|can\s+work)\s+with\s+(borrowers|buyers|clients|investors)\s+like\s+you\b|\blet('|’)?s\s+(talk|chat|connect)\b/i.test(
        t
      )
  }
];

// ── Credential claims (Reddit; strict mode widens them) ─────────────────────

function nameTitleRule(): Rule {
  return {
    reason: "name paired with professional title",
    test: (t, p) => {
      const titles = "(mortgage\\s+loan\\s+officer|loan\\s+officer|branch\\s+manager|\\bMLO\\b|\\bL\\.?O\\.?\\b)";
      const names = [p.firstName, p.lastName, "jim", "james", "driscoll"].filter(
        (n): n is string => !!n?.trim()
      );
      if (names.length === 0) return false;
      const namePat = `(${names.map((n) => esc(n.trim())).join("|")})`;
      // Name within ~60 chars of a title, either order.
      const near = new RegExp(`${namePat}[\\s\\S]{0,60}${titles}|${titles}[\\s\\S]{0,60}${namePat}`, "i");
      return near.test(t);
    }
  };
}

const CREDENTIAL_RULES: Rule[] = [
  {
    reason: "licensed-state list",
    test: (t) => /\blicensed\s+(in|across|throughout)\b/i.test(t) || /\blicense[sd]?\s*(#|number)/i.test(t)
  },
  {
    reason: "years-of-experience pitch",
    // "31 years in the business", "31 yrs", "31+ years originating".
    // Careful NOT to hit loan terms ("30 yr fixed", "15-year mortgage"):
    // the context rule needs a credential word nearby, and the bare
    // shorthand rule matches plural "yrs" only (credential shorthand),
    // never "yr"/"year" (how loan terms are written).
    test: (t) =>
      /\b\d{1,2}\+?\s*(years?|yrs?)\b[\s\S]{0,40}\b(business|experience|originat|lending|industry)\b/i.test(t) ||
      /\b\d{1,2}\+?\s*yrs\b/i.test(t)
  }
];

// Strict-mode extras: no professional self-identification of any kind.
const STRICT_RULES: Rule[] = [
  {
    reason: "professional self-identification (strict sub)",
    test: (t) =>
      /\b(i('|’)?m|i\s+am|as)\s+a\s+(mortgage\s+)?(loan\s+officer|lender|broker|mortgage\s+(professional|guy|pro)|mlo|realtor|real\s+estate\s+agent)\b/i.test(t) ||
      /\bin\s+my\s+(lending|mortgage|origination)\s+(career|work|practice)\b/i.test(t) ||
      /\bmy\s+(clients|borrowers)\b/i.test(t) ||
      /\bi('|’)?ve\s+(been\s+)?(originat\w*|closed|done|helped|written|funded)\b[\s\S]{0,50}\b(loans?|mortgages?|borrowers|buyers|clients)\b/i.test(t)
  }
];

export function sanitizeDraft(text: string, opts: SanitizeOptions): SanitizeResult {
  const p = opts.profile ?? {};
  const reasons: string[] = [];
  if (!text?.trim()) return { blocked: false, reasons };

  const rules: Rule[] = [...CONTACT_RULES, ...SOLICITATION_RULES];
  if (opts.platform === "reddit") {
    rules.push(nameTitleRule(), ...CREDENTIAL_RULES);
    if (opts.strict) rules.push(...STRICT_RULES);
  }

  for (const rule of rules) {
    try {
      if (rule.test(text, p)) reasons.push(rule.reason);
    } catch {
      // A broken rule must never let a draft through unchecked.
      reasons.push(`${rule.reason} (rule error — blocked defensively)`);
    }
  }

  return { blocked: reasons.length > 0, reasons };
}
