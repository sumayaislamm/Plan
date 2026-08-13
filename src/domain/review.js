// ═══════════════════════════════════════════════════════
// REVIEW — 3 quick questions nightly; monthly roll-up
// ═══════════════════════════════════════════════════════
async function monthlyReview(yearMonth /* 'YYYY-MM' */, missions) {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const logs = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const l = await storeGet('log_' + key, null);
    if (l) logs.push(l);
  }
  const avgEnergy = logs.filter((l) => l.energyScore != null).reduce((s, l, _, arr) => s + l.energyScore / arr.length, 0);
  const totals = {};
  missions.forEach((mn) => { totals[mn.id] = logs.reduce((s, l) => s + (l.progress[mn.id] || 0), 0); });
  const prayerTotal = logs.reduce((s, l) => s + Object.values(l.prayers).filter(Boolean).length, 0);
  const momentum = await loadMomentumSeries();
  const monthMomentum = momentum.filter((p) => p.date.startsWith(yearMonth));
  return {
    daysLogged: logs.length, avgEnergy: Math.round(avgEnergy * 10) / 10, totals, prayerTotal,
    momentumStart: monthMomentum[0]?.score, momentumEnd: monthMomentum[monthMomentum.length - 1]?.score,
  };
}
