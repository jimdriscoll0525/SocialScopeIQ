"use client";

export default function BookmarkletLink({ packed }: { packed: string }) {
  return (
    <a href={packed} className="inline-block rounded-md bg-black px-4 py-2 font-medium text-white" onClick={(e) => e.preventDefault()}>
      + Capture to SocialScopeIQ
    </a>
  );
}
