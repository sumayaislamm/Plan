# Life OS — how to run it

**Simplest way:** open `index.html` directly in your browser (double-click it, or drag into a tab).

**If prayer-time fetching doesn't load from `file://`:** serve it locally instead —
```
cd life-os
python3 -m http.server 8000
```
then visit `http://localhost:8000`.

**Hosting it for real (so it works on your phone):** upload the whole folder to any static host — GitHub Pages, Netlify, Vercel, Cloudflare Pages all work with zero config since there's no build step. Just make sure the folder structure (`index.html`, `styles/`, `src/`) stays intact.

## What's new vs. the old app
Everything from your brief's Phase 1–4: Mission Dashboard, Min/Standard/Stretch, Energy check-in, Recovery Mode, "What should I do now?", Focus Mode, Momentum score, IELTS/Programming/Job systems, Weekly Dashboard, Life Balance, Daily + Monthly Review, and no-backlog-anxiety prompting for stale tasks.

## Supabase table (updated for this Phase 1 audit)
```sql
create table los_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table los_kv enable row level security;
create policy "anon read/write" on los_kv for all using (true) with check (true);
```
Only the public anon key is ever used client-side — never a service-role key.

## What I deliberately left out of this pass
- **Your old daily-schedule data** (`sumu_YYYY-MM-DD` entries in the original app's localStorage) isn't auto-imported — the data model changed shape enough that a converter needs your sign-off on mapping choices first. Nothing lost, just untouched.
- The old timed, minute-by-minute daily timeline view stays gone by design.
- No conflict resolution beyond last-write-wins per key if you edit the same day offline on two devices before syncing — acceptable for personal single-primary-device use, worth flagging if you'll use it on two phones simultaneously.

## Try it in this order
1. Open the app → set today's energy → look at "What should I do now?"
2. Tap **Start Focus** → complete it → watch Momentum move
3. Check **Missions** tab to adjust any Min/Standard/Stretch numbers to fit you better
4. Add one real IELTS task, one programming project, one job — so those tabs aren't empty
5. End the day with the **Daily Review** button on Today
