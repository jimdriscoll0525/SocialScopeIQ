-- Migration: add detected_state to leads
-- Run once in Supabase SQL Editor.

alter table public.leads
  add column if not exists detected_state text;

create index if not exists leads_detected_state_idx on public.leads (detected_state);

-- Best-effort backfill of existing rows (TS detector isn't available inside Postgres).

-- Mark known-licensed rows. Pass 1: explicit MA mentions in notes/source/key_question/title.
update public.leads set detected_state = 'MA'
  where detected_state is null
    and (
      key_question ilike '%massachusetts%' or key_question ilike '%boston%' or key_question ilike '% MA %'
      or post_title ilike '%massachusetts%' or post_title ilike '%boston%'
      or notes ilike '%massachusetts%' or notes ilike '%MA-local%' or notes ilike '%(MA)%'
      or source ilike '%Massachusetts%' or source ilike '%Boston%'
    );

-- Mark Florida.
update public.leads set detected_state = 'FL'
  where detected_state is null
    and (
      key_question ilike '%florida%' or post_title ilike '%florida%'
      or notes ilike '%florida%' or notes ilike '% FL %'
    );

-- Mark known out-of-state rows. Backfill leans on the manual notes you/Jim wrote
-- ("OH out of MA, ...", "WI out of state, ...", "AZ.", etc.).
update public.leads set detected_state = 'OUT_OF_STATE'
  where detected_state is null
    and (
      notes ilike '%out of MA%' or notes ilike '%out of state%' or notes ilike '%OOS%'
      or notes ilike '%Ohio%' or notes ilike '%Arizona%' or notes ilike '%Wisconsin%'
      or notes ilike '%Pennsylvania%' or notes ilike '%Tennessee%' or notes ilike '%California%'
      or notes ilike '%Texas%' or notes ilike '%Cleveland%' or notes ilike '%Milwaukee%'
      or notes ilike '%Philadelphia%' or notes ilike '%Phoenix%'
      or notes ~* '\b(OH|AZ|WI|NC|PA|TN|CA|TX|GA|VA|MD|CO|MI|IN|IL|MO|MN|NY|SC|KY|AL|LA|OK|OR|WA|NV|UT|KS|AR|IA|MS|NE|NM|ID|HI|MT|ND|SD|VT|WV|WY|DE|AK)\b'
    );

-- Anything still null is genuinely ambiguous.
update public.leads set detected_state = 'UNKNOWN'
  where detected_state is null;
