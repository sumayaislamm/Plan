# Life OS — Phase 1 Code Audit & Fix Report

Scope: stabilize the existing app, add real actual-time logging, fix every confirmed bug. No redesign — same UI, same navigation, same vanilla JS architecture, same feature set plus the required time-logging capability.

---

## A. Every changed file

### `src/domain/momentum.js` — rewritten
**Wrong:** Incremental EMA applied on top of `series[series.length-1]`. Editing the *same* day twice compounded the EMA against itself (re-applying the update using today's already-updated score as the "previous" baseline). Rounding happened at every step, so the series could get stuck (e.g. 99.18 → rounds to 99 forever, never reaching 100). No true chronological ordering guarantee.
**Fixed:** `rebuildMomentumSeries()` deterministically rebuilds the *entire* series from the sorted, canonical set of daily logs every time it's called — same inputs always produce the same output, regardless of edit order or how many times it runs. Raw scores are kept as unrounded floats internally; only the displayed value is rounded, which lets a sustained 100 actually show as 100. Days with no log score 0, which produces passive decay naturally with no separate decay pass.

### `src/domain/log.js` — rewritten
**Wrong:** `addProgress()` was the only progress pathway and was reused for quick-minimum, which meant `quickLogMinimum` could **zero out real logged time** (see main.js below). `progress` was the source of truth even for time-type missions, creating a second, conflicting source of truth once real time entries existed. `allLogKeys()` was localStorage-only, so a fresh device never saw synced history.
**Fixed:** Added `normalizeLog()` (defensive against corrupted data), split into `addCountProgress()` (count-type missions only — a real event) and `toggleQuickMin()` (acknowledgement flag, never fabricates minutes). `progress` is now documented and used strictly for count-type missions; time-type progress is derived from `timeEntries`. `allLogKeys()` now merges local + remote keys.

### `src/domain/timeEntries.js` — **new file** (the core requested feature)
Canonical, appendable time-entry model: `{id, date, category, activityId, minutes, source, note, createdAt, updatedAt}`. Validated duration (finite, >0, ≤12h, never silently coerced to 0). Add/update/delete operate on one entry without touching others. Derivation helpers (`missionActualMinutes`, `missionActualMinutesRange`, `breakdownForDate`) are the single source of truth used everywhere mission time-progress is computed — Today, Missions, Weekly, IELTS, Programming, Monthly Review.

### `src/domain/weekly.js` — rewritten
**Wrong:** Weekly progress summed `log.progress[missionId]`, which time entries and job applications never wrote to — so weekly IELTS/Programming time and job-application counts were silently always zero once time-logging existed.
**Fixed:** Time-type missions derive weekly totals/sessions from `timeEntries`. `job-apps` derives its weekly count directly from canonical job records (`dateApplied` within the week + status past Saved/Preparing) — no manual double-logging needed.

### `src/domain/jobs.js` — rewritten
**Wrong:** No canonical link between a job's status/date and any mission progress. URL field was unvalidated (`javascript:`/`data:` schemes could be stored).
**Fixed:** `isApplicationStatus()` is the single canonical definition of "this counts as an application" (used identically by weekly progress, next-action, and monthly review). `validateUrl()` allows only `http://`/`https://`, rejects everything else. `normalizeJobs()` guards against corrupted data.

### `src/domain/programming.js` — rewritten
**Wrong:** `toggleProjectTask()` in main.js called `addProgress(APP.log, 'programming', 0, 'standard')` — a literal zero-minute "contribution" that did nothing but was misleading in the code and the audit trail.
**Fixed:** Task completion now sets `completedAt` on the task itself; `tasksCompletedInRange()` derives a weekly "tasks done" count directly from project data. Programming *time* comes only from Focus/manual time entries — task completion never touches it. Unchecking a task clears `completedAt` and reverses only that task's contribution.

### `src/domain/nextAction.js` — rewritten
**Wrong:** `done` for every mission read `log.progress[m.id]`, which is never populated for time-type missions or job-apps anymore — the recommendation engine would keep re-suggesting completed work. Prayer-time lookup could crash on a malformed API response.
**Fixed:** Derives `done` from `timeEntries` for time-type missions and from canonical job records for `job-apps`. Guards against malformed `prayerTimes` entries instead of crashing.

### `src/domain/recovery.js`
**Wrong:** `shouldSuggestRecovery()` required `log.recoveryReason` to already be set to trigger the *suggestion* to turn on recovery — circular, so the auto-suggestion could never actually fire.
**Fixed:** Suggests recovery on `energy === 'low'` or `energyScore <= 3`, independent of whether a reason has been picked yet.

### `src/domain/energy.js`
**Wrong:** `energyScore` was declared in the data model but nothing ever set it, so anything depending on it (recovery suggestion, future analytics) was dead code.
**Fixed:** `defaultEnergyScore()` maps the tapped Low/Normal/High button to a sensible 1-10 value so the field is always populated consistently; still overridable later if you want a numeric-only input added.

### `src/domain/ielts.js` — rewritten
**Wrong:** No score validation (NaN, out-of-range, or non-numeric input could be stored). No task-type/skill validation. Weekly analytics used `log.progress`, orphaned by real time entries.
**Fixed:** `validScore()` enforces 0–9, finite, rounds to the nearest 0.5. `normalizeIelts()` guards against corrupted data. `ieltsWeeklyAnalytics()` now derives time from `timeEntries` and adds a separate `completedTasks` count — time and task-output are explicitly two different numbers, never converted into each other.

### `src/domain/review.js` — rewritten
**Wrong:** Monthly notes were saved but **never loaded back** — reopening Monthly Review always showed blank fields. Totals used `log.progress`, orphaned by time entries/job records.
**Fixed:** `monthlyReview()` now loads and returns the saved notes; totals derive from canonical time entries and job records.

### `src/domain/balance.js`
**Wrong:** Signature depended on the old `weeklyProgress(mission, weekLogs)`.
**Fixed:** Updated to the new canonical signature (`mission, weekStart, weekLogs, timeEntries, jobs`).

### `src/domain/missions.js`
**Added:** `normalizeMissions()` — corrupted/partial mission data falls back to safe defaults per-field instead of crashing or silently losing the rest of the array.

### `src/core/storage.js` — rewritten
**Wrong:** `sbReq()` never checked `response.ok` — a 401/404/500 with a JSON error body was parsed and treated as if it were valid data. `testSupabaseConnection()` could report "connected" on a genuine auth failure. `storeGet`/`storeSet` could report `synced` after a failed write.
**Fixed:** Any non-2xx response, network error, or unparsable body now returns `null` uniformly, which every caller already treats as failure → local fallback. Added `remoteKeysWithPrefix()` and `hydrateLocalCacheForPrefix()` for merge-safe history/time-entry discovery on a fresh device. No service-role key or secret is ever used or logged — only the public anon key.

### `src/core/prayerTimes.js` — rewritten
**Wrong:** Cache key omitted the calculation method, so changing method could silently reuse a stale calculation. No `response.ok` check. Fallback times were returned indistinguishably from live data (never marked, though also never cached — the "not cached" part was already correct). Malformed `"04:12 (+06)"`-style timing strings would produce `NaN` instead of being caught.
**Fixed:** Cache key now includes date + lat + lng + method. `parseHM()` strips timezone suffixes and validates the result; a malformed or missing prayer field triggers the fallback path instead of storing `NaN`. Fallback response is explicitly tagged `__source: 'fallback'` and the UI surfaces a small "using estimated times" note when active. Location setter validates lat/lng ranges before storing.

### `src/core/safe.js` — **new file**
`esc()`/`escAttr()` — HTML-escaping used everywhere user-controlled text (project/feature/task names, company/position/notes, IELTS notes, reflections, monthly notes, recovery reasons) is placed into `innerHTML`.

### `src/ui/render.js` — rewritten
- Prayer strip markup restructured (`.pc-check`, `.pc-name`, `.pc-time`) to support the new checked-state CSS.
- Every interpolated user string now passes through `esc()`.
- Added the actual-time UI: "Actual Time Today" summary card + "+ Add Time" / "View entries" on Today; time breakdown display grouped by mission with source (Focus/Manual) shown per entry.
- Mission cards show `progressLine()` output (exact non-clamping display per your spec) instead of a generic ratio.
- Missions view fixed: the Prayer mission card now correctly shows `X / 5` from `log.prayers` instead of always reading `0` from `log.progress`.
- Programming/IELTS views show weekly time *and* weekly task-output as two distinct stats, with an explicit note that one never converts into the other.

### `src/main.js` — rewritten
See sections C–D below for the behavioral fixes; structurally this file gained the time-entry modals, focus-timer rewrite, midnight rollover, and job-date-clearing fix.

### `styles/components.css`
Added `.pc`, `.pc-check`, `.pc-name`, `.pc-time`, `.pc.checked` (prayer checked state — previously the class was applied in markup but no CSS rule existed for it, so completion was invisible). Added `.habit-grid`, `.hc`, `.hc.checked` (foundations quick-check, same issue). Added `.time-entry-row` and related classes for the new Add-Time UI.

---

## B. Every additional bug discovered (beyond your list, fixed anyway)

1. **Prayer-time cache never invalidated by calculation-method changes** (only lat/lng were in the cache key) — fixed.
2. **Prayer API timing strings with a timezone suffix** (e.g. `"04:12 (+06)"`, which Aladhan sometimes returns) would parse to `NaN` instead of triggering the fallback — fixed via `parseHM()`.
3. **Monthly review notes never loaded on open** — pure bug, not on your numbered list explicitly but implied by #10 — fixed.
4. **Momentum rebuild would be extremely slow (and, with Supabase enabled, expensive) over a long history** if it re-fetched every day from the network. Fixed by walking local cache during rebuild, with a one-time bulk hydration pass (`hydrateLocalCacheForPrefix`) so a fresh device is still correct on first load without N network round-trips.
5. **`getLocation()`/`setLocation()` didn't validate coordinate ranges**, so a corrupted `localStorage` entry could produce `NaN` prayer times — fixed.
6. **Rapid double-tap on Save buttons** (Add Time, new job/project/feature/task/IELTS task) could create duplicate entries before the modal closed — added a lightweight `withSaveLock()` guard on all "add" actions.

---

## C. Data-model changes

- **New canonical collection: `timeEntries`** (stored under key `time_entries`, synced like everything else via the generic `los_kv` table). This is now the *only* source of truth for time-type mission progress. `log.progress` is no longer used for time-type missions — only for count-type ones (e.g. food/hydration taps).
- **New `log.quickMin` field**: `{missionId: true}` — a pure acknowledgement flag for time-type foundation missions, structurally separate from `log.progress` and from `timeEntries`, so it can never masquerade as real worked time.
- **`job-apps` mission progress** is no longer stored anywhere in the log at all — it's derived live from job records (`dateApplied` + status).
- **Programming task `completedAt`** added to tasks, used to derive weekly task-output counts without ever touching time.
- **`ielts.tasks`** unchanged in shape but now validated on load (`normalizeIelts`).

## D. Actual-time logging — how it works

- **Where it appears:** Today view has an "Actual Time Today" card with **+ Add Time** and **View entries**. Mission cards (Missions tab) show the exact progress line from your spec (`47 / 60 min · 13 remaining to minimum`, `92m · Minimum ✓ · 28m to stretch`, `150m · Stretch exceeded by 30m` — never clamped).
- **Manual entries:** Add Time → pick a category (generic mission list, no personal project names hardcoded), enter minutes (validated: finite, >0, ≤12h — invalid input is rejected with a visible message, never silently zeroed), optional note, Save. Multiple entries per day are fully supported.
- **Focus entries:** Completing a Focus session writes one canonical entry with `source: 'focus'`, using the *actual elapsed* time (capped at the target, since it's a countdown) rather than always crediting the full planned duration.
- **No double-counting:** Focus and manual entries are both rows in the same `timeEntries` list, distinguished only by `source`. Mission progress is always `sum of matching entries` — there is no separate counter that could drift out of sync.
- **Editing/deleting:** View entries → ✎ edits minutes/note on that one entry (revalidated); ✕ deletes with a confirmation step. Both recompute derived progress, weekly stats, and momentum automatically on the next render (nothing is cached stale).
- **Historical days:** Add/Edit/Delete are disabled once you navigate to a past day (consistent with the existing read-only History design) — a toast explains why if you try.
- **Quick Minimum vs. real time:** the Foundations quick-check tiles now use `quickMin` (a checkbox-style acknowledgement) for time-type missions like Quran/Family — tapping it can never zero out or fabricate real logged minutes. Count-type foundations (food/hydration) still use a real +1 tap, since that tap *is* the real event.

## E. Migration performed

None of your existing data is touched or deleted. Nothing needed active migration because the previous build (this app's Phase 0) never had real historical data yet — `normalizeLog`/`normalizeIelts`/`normalizeProjects`/`normalizeJobs`/`normalizeMissions` all fall back to safe defaults on any malformed/missing field rather than wiping the rest of a record, so future upgrades won't lose data either.

## F. Remaining known limitations

- **Offline multi-device conflicts:** sync is last-write-wins per key (whole-record replace). Editing the same day on two devices while both are offline, then syncing both, will let the second sync win — no field-level merge. Fine for single-primary-device use; worth a real conflict-resolution pass if you'll use two devices simultaneously.
- **`quickMin` is currently only wired into the Foundations quick-check tiles** (Quran, Family) — it's available generically in the data model for any time-type mission if you want it surfaced elsewhere later.
- **No UI yet to pick a specific `activityId`** within a category when adding time (e.g. "IELTS → Writing Task 2" as a structured link back to an IELTS task) — the `note` field covers this today as free text; `activityId` exists in the data model for a future structured link.
- **Long-history momentum rebuild** is O(days since first log) on every refresh. Fast for local-only or a few years of daily use; if this ever becomes noticeable, it can be optimized to an incremental rebuild-from-last-checkpoint instead of full replay.

## G. Testing performed

- Full `node --check` syntax pass on every `.js` file (see H).
- Static cross-reference: every `onclick="fn(...)"` in `index.html`/`render.js`/`main.js` matched against an actual function definition — zero missing.
- Static cross-reference: every function called across module boundaries (e.g. `render.js` calling a `domain/*.js` helper) matched against its definition, accounting for script load order — zero missing, zero duplicates.
- Manual trace-through of the specific bug scenarios you listed: quick-minimum-destroys-actual (now impossible — `quickMin` and `progress`/`timeEntries` are structurally separate), programming-task-adds-zero-minutes (now removed entirely — task completion never touches time), job-date-clear-keeps-old-value (fixed — empty string is now a legitimate clear), monthly-notes-never-load (fixed), momentum-compounds-on-repeat-edit (fixed by full deterministic rebuild).
- I do **not** have network/browser access in this environment to run a live Playwright click-through — I could not execute the 47 numbered test cases end-to-end against a real DOM. Everything above is verified by static analysis and manual code trace, not a live run. Please click through the core flows (especially rapid double-taps, background/resume on Focus, and a real Supabase round-trip if you use sync) and report anything that doesn't match — I'll fix it immediately without hand-waving.

## H. JS syntax-check results

```
node --check src/core/safe.js         OK
node --check src/core/time.js         OK
node --check src/core/prayerTimes.js  OK
node --check src/core/storage.js      OK
node --check src/domain/missions.js   OK
node --check src/domain/energy.js     OK
node --check src/domain/recovery.js   OK
node --check src/domain/log.js        OK
node --check src/domain/timeEntries.js OK
node --check src/domain/momentum.js   OK
node --check src/domain/nextAction.js OK
node --check src/domain/weekly.js     OK
node --check src/domain/ielts.js      OK
node --check src/domain/programming.js OK
node --check src/domain/jobs.js       OK
node --check src/domain/review.js     OK
node --check src/domain/balance.js    OK
node --check src/domain/backlog.js    OK
node --check src/ui/render.js         OK
node --check src/main.js              OK
```
All 20 files pass. No undefined onclick targets, no duplicate top-level declarations, script load order verified against `index.html`.

## I. Phase 2 compatibility

Nothing here forecloses the adaptive Life OS work: Energy Mode, Recovery Mode, weekly goals, `nextBestAction`, IELTS/Programming domains, Life Balance, and the min/standard/stretch model are all still separate, swappable modules with the same public shape they had before — they just now read from canonical, deterministic data instead of scattered counters. If anything, Phase 2 gets easier: adaptive scheduling and personalized workload logic can now trust `timeEntries` and `momentum` as ground truth instead of having to work around the double-counting and non-determinism this audit removed.
