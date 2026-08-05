import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// PATCH /api/leads?id=<uuid> — update status, link, notes, or drafted response.
// Runs as the signed-in user; RLS decides which leads they can touch.
export async function PATCH(req: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const body = await req.json();
  const allowed = ["response_status", "followup_status", "response_link", "notes", "drafted_response", "claimed_draft"];
  const update: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) update[k] = body[k];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no valid fields" }, { status: 400 });
  }

  // .select() makes a silent no-op visible: an update RLS filters out matches
  // zero rows WITHOUT an error, which used to be reported as success — the
  // dashboard kept the optimistic value and the change never persisted
  // (classic cause: the tab's session belongs to a different account than the
  // one the feed was rendered for, or the session expired).
  const { data, error } = await supabase.from("leads").update(update).eq("id", id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "lead not found or not editable by this account" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/leads?id=<uuid>
export async function DELETE(req: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data, error } = await supabase.from("leads").delete().eq("id", id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "lead not found or not deletable by this account" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
