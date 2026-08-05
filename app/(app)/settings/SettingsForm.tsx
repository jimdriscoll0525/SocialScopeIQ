"use client";

import { useState, useTransition } from "react";
import { saveProductsCapabilities, saveSocialLinks } from "./actions";
import type { Role } from "@/lib/types";

// Example list shown as the textarea's empty-state placeholder.
const EXAMPLE_PLACEHOLDER = `- Equity lines (HELOCs) on investment properties up to 4 units
- Bank statement equity lines (self-employed, no tax returns needed)
- DSCR equity lines and DSCR purchase/refinance loans (qualify on rental income, not personal income)
- Non-QM: bank statement loans, asset depletion, recent credit events
- Conventional, FHA, VA, USDA, jumbo
- MassHousing and Chenoa Fund down payment assistance
- Land loans through a partner lender
- Cash offer / no-contingency program for buyers
- 31 years in the business, licensed in multiple states`;

export default function SettingsForm({
  initialProducts,
  initialLinks,
  role
}: {
  initialProducts: string;
  initialLinks: string[];
  role: Role;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [links, setLinks] = useState(initialLinks.join("\n"));
  const [linksNotice, setLinksNotice] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const helper =
    role === "realtor"
      ? "List the services you offer and the markets you cover. Your drafted responses will mention these when a post asks about something you can do. Plain sentences or bullets are fine."
      : "List the loan products and services you offer. Your drafted responses will mention these when a post asks about something you can do. Plain sentences or bullets are fine.";

  function save() {
    setNotice(null);
    startSave(async () => {
      const res = await saveProductsCapabilities(products);
      setNotice(res.ok ? "Saved. New drafts will use this immediately." : res.error);
    });
  }

  function saveLinks() {
    setLinksNotice(null);
    startSave(async () => {
      const res = await saveSocialLinks(links);
      setLinksNotice(
        res.ok
          ? "Saved. Your public page now lists these and tells Google they're all you."
          : res.error
      );
    });
  }

  return (
    <>
    <section className="rounded-md border border-neutral-200 bg-white p-5">
      <label className="mb-1 block text-sm font-medium">My Products &amp; Capabilities</label>
      <p className="mb-2 text-xs text-neutral-500">{helper}</p>
      <textarea
        value={products}
        onChange={(e) => setProducts(e.target.value)}
        placeholder={EXAMPLE_PLACEHOLDER}
        rows={12}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-black"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {notice && <span className="text-sm text-neutral-600">{notice}</span>}
      </div>
    </section>

    <section className="mt-6 rounded-md border border-neutral-200 bg-white p-5">
      <label className="mb-1 block text-sm font-medium">My profiles on other sites</label>
      <p className="mb-2 text-xs text-neutral-500">
        One URL per line: your Reddit profile, BiggerPockets profile, LinkedIn, company bio page,
        etc. They appear on your public page and are marked up so Google knows those accounts and
        this page are the same person.
      </p>
      <textarea
        value={links}
        onChange={(e) => setLinks(e.target.value)}
        placeholder={"https://www.reddit.com/user/YourUsername/\nhttps://www.biggerpockets.com/users/YourUsername\nhttps://www.linkedin.com/in/yourname/"}
        rows={5}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs outline-none focus:border-black"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={saveLinks}
          disabled={saving}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {linksNotice && <span className="text-sm text-neutral-600">{linksNotice}</span>}
      </div>
    </section>
    </>
  );
}
