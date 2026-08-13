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

## What I deliberately left out of this first pass
- **Your old daily-schedule data** (`sumu_YYYY-MM-DD` entries in your old app's localStorage) isn't auto-imported yet — the data model changed enough (schedule-as-data → missions+logs) that a converter needs your confirmation on a few mapping choices first. Nothing is lost; it's just sitting in your browser's old storage untouched.
- **Supabase sync** now uses one generic table (`los_kv`, columns: `key text primary key, value jsonb, updated_at timestamptz`) instead of the old `planner_days` table — you'll need to create this table in Supabase if you want cross-device sync (or tell me and I'll write the exact SQL).
- The old timed, minute-by-minute daily timeline view is gone by design (that was the rigid-schedule problem). If you want an optional "rough shape of today" view back as a *non-mandatory* reference, I can add it as a quiet secondary screen.

## Try it in this order
1. Open the app → set today's energy → look at "What should I do now?"
2. Tap **Start Focus** → complete it → watch Momentum move
3. Check **Missions** tab to adjust any Min/Standard/Stretch numbers to fit you better
4. Add one real IELTS task, one programming project, one job — so those tabs aren't empty
5. End the day with the **Daily Review** button on Today
