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
  }
];
