"use client";

import { useEffect, useRef } from "react";

// React refuses javascript: URLs passed as an href prop (renders a "blocked for
// security" stub), so the draggable bookmarklet href has to be set imperatively
// after mount.
export default function BookmarkletLink({ packed }: { packed: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", packed);
  }, [packed]);
  return (
    <a ref={ref} className="inline-block rounded-md bg-black px-4 py-2 font-medium text-white" onClick={(e) => e.preventDefault()}>
      + Capture to SocialScopeIQ
    </a>
  );
}
