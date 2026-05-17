// State detection for routing leads to licensed markets only.
// Licensed states for Jim: MA, NH, RI, NJ, ME, CT, FL.
// Approach: scan post text for state names, abbreviations (with location context to avoid false positives),
// and well-known cities. Reject leads whose ONLY detected state is non-licensed. Keep leads where:
//   - a licensed state is detected (even if other states also mentioned)
//   - no state is detected at all (mark as "unknown" — Jim decides)

export const LICENSED_STATES = ["MA", "NH", "RI", "NJ", "ME", "CT", "FL"] as const;
export type LicensedState = (typeof LICENSED_STATES)[number];
export type DetectedState = LicensedState | "UNKNOWN" | "OUT_OF_STATE";

// Full-name + common variants. Case-insensitive match.
const LICENSED_NAMES: Record<LicensedState, string[]> = {
  MA: ["massachusetts", "mass."],
  NH: ["new hampshire"],
  RI: ["rhode island"],
  NJ: ["new jersey"],
  ME: ["maine"],
  CT: ["connecticut"],
  FL: ["florida"]
};

// Cities and regions strongly associated with each licensed state.
const LICENSED_CITIES: Record<LicensedState, string[]> = {
  MA: [
    "boston", "cambridge", "worcester", "springfield", "lowell", "lynn", "lynnfield",
    "methuen", "haverhill", "lawrence", "andover", "north shore", "merrimack valley",
    "cape cod", "newton", "quincy", "somerville", "brookline", "framingham"
  ],
  NH: ["manchester nh", "nashua", "concord nh", "portsmouth nh", "dover nh", "salem nh", "merrimack nh"],
  RI: ["providence", "warwick", "cranston", "pawtucket", "newport ri", "woonsocket"],
  NJ: [
    "newark", "jersey city", "trenton", "paterson", "elizabeth nj", "hoboken", "edison nj",
    "morristown", "princeton", "atlantic city", "cherry hill"
  ],
  ME: ["portland me", "lewiston", "bangor", "augusta me", "biddeford", "south portland"],
  CT: [
    "hartford", "new haven", "stamford", "bridgeport", "waterbury", "norwalk", "danbury",
    "greenwich ct", "fairfield ct"
  ],
  FL: [
    "miami", "orlando", "tampa", "jacksonville", "fort lauderdale", "ft lauderdale", "st petersburg",
    "st. petersburg", "tallahassee", "naples fl", "sarasota", "gainesville fl", "boca raton",
    "west palm beach", "key west", "fort myers", "ft myers"
  ]
};

// Full-name list of all 43 non-licensed US states. Mentioning one is a strong OOS signal.
const NON_LICENSED_STATE_NAMES = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "delaware",
  "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky",
  "louisiana", "maryland", "michigan", "minnesota", "mississippi", "missouri", "montana",
  "nebraska", "nevada", "new mexico", "new york", "north carolina", "north dakota", "ohio",
  "oklahoma", "oregon", "pennsylvania", "south carolina", "south dakota", "tennessee",
  "texas", "utah", "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming"
];

// Two-letter abbreviations for all 43 non-licensed states.
const NON_LICENSED_ABBRS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "DE", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY",
  "LA", "MD", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

// Reddit subs that strongly map to a state. r/Mortgages/etc. don't appear here — they're national.
const SUBREDDIT_TO_STATE: Record<string, LicensedState | "UNKNOWN"> = {
  "r/boston": "MA",
  "r/massachusetts": "MA",
  "r/CambridgeMA": "MA",
  "r/newhampshire": "NH",
  "r/rhodeisland": "RI",
  "r/newjersey": "NJ",
  "r/maine": "ME",
  "r/connecticut": "CT",
  "r/florida": "FL"
};

// BiggerPockets forum names that map to states (from our scout configuration).
const FORUM_TO_STATE: Record<string, LicensedState> = {
  "Massachusetts Real Estate": "MA",
  "Boston Real Estate": "MA"
};

const WORD_BOUNDARY_AROUND = (s: string) => new RegExp(`(?:^|[^a-zA-Z])${s}(?:[^a-zA-Z]|$)`, "i");

// Abbreviations need location-context to avoid false positives (e.g. "ME" meaning "myself").
// Accept patterns like "in MA", "from FL", "MA-based", "MA real estate", "in the MA area".
const ABBR_CONTEXT_RE = (abbr: string) =>
  new RegExp(
    // before:  ", " | " in " | " from " | " near " | " of " | "based in "
    `(?:^|,\\s|\\b(?:in|from|near|of|located in|based in|moving to|relocating to)\\s)${abbr}\\b` +
    // OR after: " real estate" | " area" | "-area" | "-based" | ", USA"
    `|\\b${abbr}(?=\\s*(?:real estate|area|[-–]area|[-–]based|state|market|,\\s*usa|,\\s*united states)\\b)`,
    "i"
  );

export interface StateDetectionResult {
  state: DetectedState;
  detected: LicensedState[];        // licensed states mentioned
  oos: string[];                    // non-licensed states/abbrs mentioned
  reason: string;
}

export function detectState(opts: {
  text: string;
  community?: string;     // "Reddit" | "BiggerPockets" | ...
  source?: string;        // e.g. "r/boston" or "Massachusetts Real Estate"
}): StateDetectionResult {
  const text = opts.text || "";

  // 1. Strong signal: source/forum tells us the state directly.
  if (opts.community === "Reddit" && opts.source) {
    const subState = SUBREDDIT_TO_STATE[opts.source];
    if (subState && subState !== "UNKNOWN") {
      return { state: subState, detected: [subState], oos: [], reason: `posted in ${opts.source}` };
    }
  }
  if (opts.community === "BiggerPockets" && opts.source) {
    const forumState = FORUM_TO_STATE[opts.source];
    if (forumState) {
      return { state: forumState, detected: [forumState], oos: [], reason: `posted in ${opts.source}` };
    }
  }

  // 2. Scan text for licensed state markers.
  const detected = new Set<LicensedState>();
  for (const st of LICENSED_STATES) {
    const names = LICENSED_NAMES[st];
    const cities = LICENSED_CITIES[st];
    const hitName = names.some((n) => text.toLowerCase().includes(n));
    const hitCity = cities.some((c) => text.toLowerCase().includes(c));
    const hitAbbr = ABBR_CONTEXT_RE(st).test(text);
    if (hitName || hitCity || hitAbbr) detected.add(st);
  }

  // 3. Scan text for non-licensed state markers (full names + abbreviations with context).
  const oos: string[] = [];
  for (const name of NON_LICENSED_STATE_NAMES) {
    if (WORD_BOUNDARY_AROUND(name).test(text)) oos.push(name);
  }
  for (const abbr of NON_LICENSED_ABBRS) {
    if (ABBR_CONTEXT_RE(abbr).test(text)) oos.push(abbr);
  }

  // 4. Decide.
  if (detected.size > 0) {
    // Licensed state mentioned wins, even if OOS state also mentioned (could be a comparison/relocating).
    const pick = detected.values().next().value as LicensedState;
    return {
      state: pick,
      detected: [...detected],
      oos,
      reason: oos.length > 0
        ? `licensed state ${pick} mentioned (also references ${oos.join(", ")})`
        : `licensed state ${pick} mentioned`
    };
  }
  if (oos.length > 0) {
    return { state: "OUT_OF_STATE", detected: [], oos, reason: `only out-of-state mentions: ${oos.join(", ")}` };
  }
  return { state: "UNKNOWN", detected: [], oos: [], reason: "no state references found" };
}

// Final go/no-go gate for the scout.
// Returns false ONLY for clear OOS leads. Licensed and unknown both pass.
export function shouldKeepLead(result: StateDetectionResult): boolean {
  return result.state !== "OUT_OF_STATE";
}
