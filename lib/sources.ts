import { supabaseAdmin } from "@/lib/supabase";

export type SourcePipeline = "lo" | "realtor" | "both";

export interface ScoutSourceRow {
  identifier: string; // subreddit name (no r/) or BP forum id as a string
  label: string | null;
  pipeline: SourcePipeline;
}

// Fallbacks mirroring the scout_sources seed in migration 003. Used when the
// table is empty or unreachable so a wiped table can never silence the scouts.
export const DEFAULT_REDDIT_SOURCES: ScoutSourceRow[] = [
  { identifier: "FirstTimeHomeBuyer", label: "r/FirstTimeHomeBuyer", pipeline: "both" },
  { identifier: "FirstTimeHomeBuyers", label: "r/FirstTimeHomeBuyers", pipeline: "lo" },
  { identifier: "NewbHomebuyer", label: "r/NewbHomebuyer", pipeline: "lo" },
  { identifier: "Mortgages", label: "r/Mortgages", pipeline: "lo" },
  { identifier: "HomeLoans", label: "r/HomeLoans", pipeline: "lo" },
  { identifier: "HELOC", label: "r/HELOC", pipeline: "lo" },
  { identifier: "RealEstate", label: "r/RealEstate", pipeline: "both" },
  { identifier: "RealEstateInvesting", label: "r/RealEstateInvesting", pipeline: "lo" },
  { identifier: "Homeowners", label: "r/Homeowners", pipeline: "both" },
  { identifier: "HomeBuying", label: "r/HomeBuying", pipeline: "both" },
  { identifier: "personalfinance", label: "r/personalfinance", pipeline: "lo" },
  { identifier: "SameGrassButGreener", label: "r/SameGrassButGreener", pipeline: "realtor" },
  { identifier: "boston", label: "r/boston", pipeline: "realtor" },
  { identifier: "massachusetts", label: "r/massachusetts", pipeline: "realtor" },
  { identifier: "newhampshire", label: "r/newhampshire", pipeline: "realtor" }
];

export const DEFAULT_BP_SOURCES: ScoutSourceRow[] = [
  { identifier: "564", label: "Massachusetts Real Estate", pipeline: "both" },
  { identifier: "571", label: "New Hampshire Real Estate", pipeline: "realtor" },
  { identifier: "693", label: "Boston Real Estate", pipeline: "both" },
  { identifier: "22", label: "Mortgage Brokers & Lenders", pipeline: "lo" },
  { identifier: "49", label: "Private & Conventional Lending", pipeline: "lo" },
  { identifier: "50", label: "Creative Real Estate Financing", pipeline: "lo" },
  { identifier: "311", label: "Buying & Selling Real Estate", pipeline: "both" },
  { identifier: "517", label: "Rental Property Investing", pipeline: "lo" },
  { identifier: "12", label: "Starting Out", pipeline: "lo" }
];

// Enabled sources for a platform, in priority order (BP crawl order depends
// on it). Service-role read — the scouts run without a user session.
export async function getSources(
  platform: "reddit" | "biggerpockets"
): Promise<ScoutSourceRow[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("scout_sources")
      .select("identifier, label, pipeline")
      .eq("platform", platform)
      .eq("enabled", true)
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("no enabled rows");
    return data as ScoutSourceRow[];
  } catch (err) {
    console.warn(`[sources] falling back to hardcoded ${platform} list:`, err);
    return platform === "reddit" ? DEFAULT_REDDIT_SOURCES : DEFAULT_BP_SOURCES;
  }
}
