// Curated in-body image library for generated blog posts. The generator is
// only allowed to reference these exact paths (lib/blogger.ts includes this
// list in its prompt), so posts can never hotlink or hallucinate an image URL.
//
// All photos are free-license Pexels images downloaded into
// public/assets/blog/ — sources:
// - house-keys.jpg            #101808  by PhotoMIX Company
// - sold-sign.jpg             #7578916 by Kindel Media
// - packing-boxes.jpg         #4246120 by Karolina Grabowska
// - family-moving-in.jpg      #4569340 by cottonbro studio
// - new-construction-home.jpg #1396122 by Binyamin Mellish
// - craftsman-home.jpg        #5502227 by Curtis Adams
// - budgeting-desk.jpg        #4386366 by Karolina Grabowska
// - modern-townhomes.jpg      #323780  by Expect Best
// - white-house-lawn.jpg      #280222  by Pixabay
// - autumn-cottage.jpg        #1029599 by Scott Webb
// - beige-house-dusk.jpg      #1396132 by Binyamin Mellish
// - stone-estate.jpg          #259588  by Pixabay
// - white-kitchen.jpg         #2724749 by Mark McCammon
// - kitchen-hardwood.jpg      #3935350 by Curtis Adams
// - sold-sign-handshake.jpg   #7578901 by Kindel Media
// - for-sale-sign.jpg         #8482523 by Thirdman
// - condo-buildings.jpg       #2119714 by Tobias Bjørkli
// - aerial-neighborhood.jpg   #1546168 by David McBee
// - modern-luxury-winter.jpg  #7031406 by Max Vakhtbovych
// - suburban-house.jpg        #209296  by Pixabay
// - dollar-bills.jpg          #164527  by Pixabay
// - signing-documents.jpg     #3760067 by Andrea Piacquadio
// - moving-day-car.jpg        #4246266 by Ketut Subiyanto
// - family-new-home.jpg       #7415122 by MART PRODUCTION
// - keys-handoff.jpg          #8293778 by RDNE Stock project
// - cabin-sunset.jpg          #1876045 by Rodolfo Quirós

export interface BlogImage {
  path: string;
  alt: string;
  use: string; // hint shown to the generator for choosing an appropriate spot
}

export const BLOG_IMAGES: BlogImage[] = [
  {
    path: "/assets/blog/house-keys.jpg",
    alt: "House keys hanging in the lock of an open front door",
    use: "closing, getting the keys, buying a first home"
  },
  {
    path: "/assets/blog/sold-sign.jpg",
    alt: "A happy couple in front of their new home by a For Sale sign marked Sold",
    use: "winning an offer, sellers, purchase success stories"
  },
  {
    path: "/assets/blog/packing-boxes.jpg",
    alt: "A person sealing a moving box with a tape dispenser",
    use: "moving, relocation, preparing to sell or buy"
  },
  {
    path: "/assets/blog/family-moving-in.jpg",
    alt: "A family unpacking moving boxes together in their new kitchen",
    use: "first-time buyers, families upsizing, moving in"
  },
  {
    path: "/assets/blog/new-construction-home.jpg",
    alt: "A newly built two-story home at sunset",
    use: "new construction, builders, single-family homes"
  },
  {
    path: "/assets/blog/craftsman-home.jpg",
    alt: "A craftsman-style home with a covered front porch on a sunny day",
    use: "suburban markets, home shopping, general real estate"
  },
  {
    path: "/assets/blog/budgeting-desk.jpg",
    alt: "A calculator and notepad resting on a spread of dollar bills",
    use: "payments, budgeting, qualifying, loan math, closing costs"
  },
  {
    path: "/assets/blog/modern-townhomes.jpg",
    alt: "Modern townhomes with glass balconies on a sunny day",
    use: "modern construction, townhomes, luxury markets"
  },
  {
    path: "/assets/blog/white-house-lawn.jpg",
    alt: "A classic white and gray two-story home with a large green lawn",
    use: "curb appeal, listing prep, general real estate"
  },
  {
    path: "/assets/blog/autumn-cottage.jpg",
    alt: "A white cottage with a picket fence surrounded by fall foliage",
    use: "starter homes, older homes, fall market"
  },
  {
    path: "/assets/blog/beige-house-dusk.jpg",
    alt: "A warmly lit single-story home at dusk",
    use: "new listings, model homes, evening showings"
  },
  {
    path: "/assets/blog/stone-estate.jpg",
    alt: "A large stone and brick home with a landscaped yard at dusk",
    use: "move-up buyers, larger homes, jumbo loans"
  },
  {
    path: "/assets/blog/white-kitchen.jpg",
    alt: "A renovated white kitchen with an island and stainless appliances",
    use: "renovation loans, staging, interiors, home value"
  },
  {
    path: "/assets/blog/kitchen-hardwood.jpg",
    alt: "A kitchen with granite counters and hardwood floors",
    use: "appraisals, home value, renovation"
  },
  {
    path: "/assets/blog/sold-sign-handshake.jpg",
    alt: "Two men shaking hands in front of a For Sale sign marked Sold",
    use: "winning an offer, sellers, working with an agent"
  },
  {
    path: "/assets/blog/for-sale-sign.jpg",
    alt: "A red Home For Sale sign with the seller standing behind it",
    use: "listing a home, pricing, selling"
  },
  {
    path: "/assets/blog/condo-buildings.jpg",
    alt: "Modern condo buildings with wood-accented balconies",
    use: "condos, first-time buyers, urban markets"
  },
  {
    path: "/assets/blog/aerial-neighborhood.jpg",
    alt: "An aerial view of a suburban neighborhood",
    use: "market trends, neighborhoods, comps, inventory"
  },
  {
    path: "/assets/blog/modern-luxury-winter.jpg",
    alt: "A modern luxury home glowing warmly at dusk in winter",
    use: "luxury homes, jumbo loans, winter buying"
  },
  {
    path: "/assets/blog/suburban-house.jpg",
    alt: "A suburban family house with a large front lawn and driveway",
    use: "general real estate, resale homes, curb appeal"
  },
  {
    path: "/assets/blog/dollar-bills.jpg",
    alt: "Rolled U.S. dollar bills of various denominations",
    use: "down payments, closing costs, savings, loan math"
  },
  {
    path: "/assets/blog/signing-documents.jpg",
    alt: "A lender handing a pen across loan paperwork",
    use: "applications, preapproval, closing paperwork"
  },
  {
    path: "/assets/blog/moving-day-car.jpg",
    alt: "A couple unloading moving boxes from a car trunk",
    use: "moving day, relocation, first home"
  },
  {
    path: "/assets/blog/family-new-home.jpg",
    alt: "A family laughing together on a couch among moving boxes",
    use: "families, moving in, first-time buyers"
  },
  {
    path: "/assets/blog/keys-handoff.jpg",
    alt: "An agent handing house keys to a new homeowner",
    use: "closing day, getting the keys"
  },
  {
    path: "/assets/blog/cabin-sunset.jpg",
    alt: "An A-frame cabin overlooking mountains at sunset",
    use: "vacation homes, second homes, investment properties"
  }
];

// Shuffled subset shown to the generator, so each post sees different options
// and the same few photos stop dominating. The model still picks the 2 that
// fit the topic; the pool just changes per run.
export function imageChoices(count = 6): BlogImage[] {
  const pool = [...BLOG_IMAGES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// Landscape exterior shots that hold up under the post hero's full-width crop
// and dark text-overlay gradient. Portrait and interior photos stay out.
export const HERO_IMAGES: string[] = [
  "/assets/blog-hero-default.jpg", // Pexels #106399 by Binyamin Mellish
  "/assets/blog/new-construction-home.jpg",
  "/assets/blog/craftsman-home.jpg",
  "/assets/blog/modern-townhomes.jpg",
  "/assets/blog/white-house-lawn.jpg",
  "/assets/blog/autumn-cottage.jpg",
  "/assets/blog/beige-house-dusk.jpg",
  "/assets/blog/stone-estate.jpg",
  "/assets/blog/aerial-neighborhood.jpg",
  "/assets/blog/modern-luxury-winter.jpg",
  "/assets/blog/suburban-house.jpg"
];

// Deterministic pick: a post keeps the same hero on every render (so the OG
// image and JSON-LD stay consistent with the page), but different slugs land
// on different heroes.
export function heroForSlug(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return HERO_IMAGES[h % HERO_IMAGES.length];
}
