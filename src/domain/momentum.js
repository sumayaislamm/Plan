// ═══════════════════════════════════════════════════════
// MOMENTUM SCORE — fully deterministic rebuild from canonical daily data.
//
// Rationale for the rewrite: an incremental "EMA-on-top-of-last-point"
// update is order- and repeat-dependent (editing the same day twice, or
// editing history after today, silently compounds or corrupts the series).
// Instead we rebuild the whole series from the sorted, canonical set of
// daily logs every time it's needed. Same inputs -> same output, always,
// regardless of how many times the app is opened or a day is re-edited.
// ═══════════════════════════════════════════════════════
const MOMENTUM_ALPHA = 0.18;         // how much a day's score moves momentum
const MOMENTUM_BASELINE = 50;        // starting point before any logged day
const MOMENTUM_SNAP_TO_100 = 99.5;   // display rounding lets a sustained 100 actually show as 100

function dailyCompletionScore(log, missions, timeEntries) {
  if (!log) return 0;
  let weightedDone = 0, weightedTotal = 0;
  missions.forEach((m) => {
    if (m.id === 'prayer' || m.id === 'sleep') return; // scored separately / not a worked-time metric
    const w = m.weight === 'primary' ? 2 : 1;
    weightedTotal += w;
    const level = log.levelUsed?.[m.id] || 'standard';
    const target = levelValue(m, level) || 0;
    let done;
    if (m.type === 'time') {
      done = timeEntries ? missionActualMinutes(timeEntries, m.id, log.date) : (log.progress?.[m.id] || 0);
    } else {
      done = log.progress?.[m.id] || 0;
    }
    const ratio = target > 0 ? Math.min(1, done / target) : (done > 0 ? 1 : 0);
    weightedDone += w * ratio;
  });
  const prayerRatio = (log.prayers ? Object.values(log.prayers).filter(Boolean).length : 0) / 5;
  weightedTotal += 2; weightedDone += 2 * prayerRatio;
  return weightedTotal > 0 ? (weightedDone / weightedTotal) * 100 : 0;
}

async function loadMomentumSeries() {
  const s = await storeGet('momentum', []);
  return Array.isArray(s) ? s : [];
}
async function saveMomentumSeries(series) { await storeSet('momentum', series); }

// Rebuilds the full momentum series from the first logged day through `todayKey`,
// inclusive. Days with no log at all score 0, which produces the passive-decay
// effect naturally — no separate decay pass needed, no special-casing "gaps".
// Uses local cache for the day-by-day walk (fast, no network round trip per day);
// the per-day local cache itself stays correct because loadLog's normal remote
// sync path (used whenever a day is actually viewed/edited) keeps it fresh.
async function rebuildMomentumSeries(missions, todayKey) {
  const keys = await allLogKeys(); // merges local + remote keys, sorted desc
  const timeEntries = await loadAllTimeEntries();
  if (!keys.length) { await saveMomentumSeries([]); return []; }

  const earliest = keys[keys.length - 1];
  const series = [];
  let running = null; // raw float, unrounded, until display time

  let cursor = earliest;
  while (cursor <= todayKey) {
    const log = normalizeLog(lsGet('log_' + cursor, null), cursor); // local-only: fast for long histories
    const dayScore = dailyCompletionScore(log, missions, timeEntries);
    if (running === null) {
      running = dayScore; // first day anchors the series to its own score, not an arbitrary baseline
    } else {
      running = running * (1 - MOMENTUM_ALPHA) + dayScore * MOMENTUM_ALPHA;
    }
    running = Math.max(0, Math.min(100, running));
    series.push({ date: cursor, score: running, rawScore: Math.round(dayScore * 10) / 10 });
    cursor = addDays(cursor, 1);
  }
  await saveMomentumSeries(series);
  return series;
}

function displayScore(rawFloat) {
  const v = rawFloat >= MOMENTUM_SNAP_TO_100 ? 100 : rawFloat;
  return Math.round(v);
}
function currentMomentum(series) { return series.length ? displayScore(series[series.length - 1].score) : MOMENTUM_BASELINE; }
function momentumTrend(series) {
  if (series.length < 2) return 'steady';
  const diff = series[series.length - 1].score - series[series.length - 2].score;
  if (diff > 1) return 'rising'; if (diff < -1) return 'recovering-or-dipping'; return 'steady';
}
