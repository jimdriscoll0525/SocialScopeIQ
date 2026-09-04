import type { Role } from "@/lib/types";

// Campaign objectives offered in the builder, per role. The `key` is what's
// stored in ad_campaigns.objective; `segments` seeds the generator with the
// distinct customer needs it should split ad groups across.

export interface AdObjective {
  key: string;
  label: string;
  segments: string[];
}

export const LO_OBJECTIVES: AdObjective[] = [
  {
    key: "refinance",
    label: "Refinance",
    segments: [
      "debt consolidation (credit cards, auto loans, personal loans)",
      "home improvement / renovation funding",
      "dropping PMI or mortgage insurance",
      "rate/term savings and shortening the loan term",
      "cash-out for an investment opportunity or business",
      "divorce or life-event buyout of a co-owner"
    ]
  },
  {
    key: "purchase",
    label: "Purchase",
    segments: [
      "getting ready to buy and wondering what they can afford",
      "comparing loan programs (conventional vs FHA vs VA)",
      "buying with a small down payment / down payment assistance",
      "buying in a competitive market and needing a strong offer",
      "moving up or relocating and coordinating a sale + purchase"
    ]
  },
  {
    key: "heloc",
    label: "Equity lines / HELOC",
    segments: [
      "tapping equity without touching a low first-mortgage rate",
      "HELOC on a rental or investment property",
      "self-employed borrowers who can't document income traditionally",
      "funding a renovation or addition with a line of credit",
      "consolidating high-interest debt with home equity",
      "HELOC vs cash-out refinance decision"
    ]
  },
  {
    key: "investor",
    label: "Investment property & DSCR",
    segments: [
      "buying a first rental property",
      "qualifying on rental income instead of personal income (DSCR)",
      "pulling equity from an existing rental to buy the next one",
      "financing a 2-4 unit property / house hacking",
      "portfolio investors hitting conventional loan limits"
    ]
  },
  {
    key: "self_employed",
    label: "Self-employed / bank statement",
    segments: [
      "self-employed and told 'no' by a bank because of tax write-offs",
      "qualifying with 12-24 months of bank statements",
      "1099 contractors and gig workers buying a home",
      "business owners tapping home equity without tax returns",
      "asset-based qualifying for retirees or high-net-worth borrowers"
    ]
  },
  {
    key: "first_time_buyer",
    label: "First-time buyer",
    segments: [
      "understanding the buying process step by step",
      "how much down payment is really needed",
      "state and local down payment assistance programs",
      "credit score questions and getting mortgage-ready",
      "renting vs buying in this market"
    ]
  }
];

export const REALTOR_OBJECTIVES: AdObjective[] = [
  {
    key: "listing_promotion",
    label: "Listing promotion",
    segments: [
      "buyers researching the neighborhood or town",
      "buyers comparing this property type (condo, single-family, multi-family)",
      "relocating buyers looking for homes in this area",
      "move-up buyers in nearby towns",
      "investors evaluating the local rental market"
    ]
  },
  {
    key: "buyer_leads",
    label: "Buyer leads",
    segments: [
      "first-time buyers figuring out where to start",
      "buyers asking what they can get for their budget in this area",
      "buyers who keep losing in multiple-offer situations",
      "buyers comparing towns and neighborhoods",
      "buyers wondering whether to wait for the market to change"
    ]
  },
  {
    key: "seller_leads",
    label: "Seller leads",
    segments: [
      "homeowners wondering what their home is worth",
      "owners deciding whether to sell now or wait",
      "downsizers and empty nesters",
      "owners prepping a home for sale (repairs, staging, timing)",
      "inherited or estate property sales"
    ]
  },
  {
    key: "new_to_area",
    label: "New to area / relocation",
    segments: [
      "people relocating for a job and researching the area",
      "families comparing towns for commute and lifestyle",
      "buyers asking about cost of living and housing prices here",
      "out-of-state buyers who need a local guide",
      "renters new to the area considering buying"
    ]
  }
];

export function objectivesForRole(role: Role): AdObjective[] {
  return role === "realtor" ? REALTOR_OBJECTIVES : LO_OBJECTIVES;
}

export function objectiveLabel(role: Role, key: string): string {
  return objectivesForRole(role).find((o) => o.key === key)?.label ?? key;
}
