// ═══════════════════════════════════════════════════════
// REVIEW — 3 quick questions nightly; monthly roll-up.
// Uses canonical time entries / job records, not UI counters.
// ═══════════════════════════════════════════════════════
async function monthlyReview(yearMonth /* 'YYYY-MM' */, missions) {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
  const monthEnd = addDays(monthStart, daysInMonth); // exclusive

  const logs = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const raw = await storeGet('log_' + key, null);
    if (raw) logs.push(normalizeLog(raw, key));
  }
  const timeEntries = await loadAllTimeEntries();
  const jobs = await loadJobs();

  const avgEnergy = (() => {
    const scored = logs.filter((l) => l.energyScore != null);
    if (!scored.length) return null;
    return Math.round((scored.reduce((s, l) => s + l.energyScore, 0) / scored.length) * 10) / 10;
  })();

  const totals = {};
  missions.forEach((mn) => {
    if (mn.type === 'time') totals[mn.id] = missionActualMinutesRange(timeEntries, mn.id, monthStart, monthEnd);
    else if (mn.id === 'job-apps') totals[mn.id] = jobs.filter((j) => j.dateApplied && j.dateApplied >= monthStart && j.dateApplied < monthEnd && isApplicationStatus(j.status)).length;
    else totals[mn.id] = logs.reduce((s, l) => s + (l.progress[mn.id] || 0), 0);
  });
  const prayerTotal = logs.reduce((s, l) => s + Object.values(l.prayers).filter(Boolean).length, 0);

  const momentum = await loadMomentumSeries();
  const monthMomentum = momentum.filter((p) => p.date.startsWith(yearMonth));
  const notes = await storeGet('monthlynotes_' + yearMonth, null);

  return {
    daysLogged: logs.length, avgEnergy, totals, prayerTotal,
    momentumStart: monthMomentum.length ? displayScore(monthMomentum[0].score) : null,
    momentumEnd: monthMomentum.length ? displayScore(monthMomentum[monthMomentum.length - 1].score) : null,
    notes: notes || { improved: '', stuck: '', change: '' },
  };
}
