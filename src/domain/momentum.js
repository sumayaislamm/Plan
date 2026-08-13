// ═══════════════════════════════════════════════════════
// MOMENTUM SCORE
// EMA of daily completion (weighted toward primary missions), plus slow
// passive decay on days with no log at all. Never resets to zero on a miss.
// ═══════════════════════════════════════════════════════
const MOMENTUM_ALPHA = 0.18;      // how much today's score moves momentum
const MOMENTUM_PASSIVE_DECAY = 0.985; // per skipped day

function dailyCompletionScore(log, missions) {
  if (!log) return 0;
  let weightedDone = 0, weightedTotal = 0;
  missions.forEach((m) => {
    const w = m.weight === 'primary' ? 2 : 1;
    weightedTotal += w;
    const level = log.levelUsed?.[m.id] || 'standard';
    const target = levelValue(m, level);
    const done = log.progress?.[m.id] || 0;
    const ratio = target > 0 ? Math.min(1, done / target) : (done > 0 ? 1 : 0);
    weightedDone += w * ratio;
  });
  const prayerRatio = (log.prayers ? Object.values(log.prayers).filter(Boolean).length : 0) / 5;
  weightedTotal += 2; weightedDone += 2 * prayerRatio;
  return weightedTotal > 0 ? Math.round((weightedDone / weightedTotal) * 100) : 0;
}

async function loadMomentumSeries() { return await storeGet('momentum', []); }
async function saveMomentumSeries(series) { await storeSet('momentum', series); }

async function updateMomentum(dateKey, log, missions) {
  const series = await loadMomentumSeries();
  let last = series.length ? series[series.length - 1] : { date: dateKey, score: 50 };

  // passive decay for any fully-skipped days between last entry and today
  const gapDays = Math.max(0, daysBetween(last.date, dateKey) - 1);
  let score = last.score;
  for (let i = 0; i < gapDays; i++) score *= MOMENTUM_PASSIVE_DECAY;

  const today = dailyCompletionScore(log, missions);
  score = score * (1 - MOMENTUM_ALPHA) + today * MOMENTUM_ALPHA;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const existingIdx = series.findIndex((s) => s.date === dateKey);
  const point = { date: dateKey, score };
  if (existingIdx >= 0) series[existingIdx] = point; else series.push(point);
  await saveMomentumSeries(series);
  return score;
}

function currentMomentum(series) { return series.length ? series[series.length - 1].score : 50; }
function momentumTrend(series) {
  if (series.length < 2) return 'steady';
  const diff = series[series.length - 1].score - series[series.length - 2].score;
  if (diff > 1) return 'rising'; if (diff < -1) return 'recovering-or-dipping'; return 'steady';
}
