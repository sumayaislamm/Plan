// ═══════════════════════════════════════════════════════
// ANALYTICS — pure derived views over the canonical timeEntries array.
// Owns no storage key of its own. Every number here is recomputed on demand
// for exactly the requested date range from the same timeEntries list used
// everywhere else (Today's Work Log, mission progress, weekly targets).
// Never invents, estimates, or infers time from anything other than a
// real logged entry.
// ═══════════════════════════════════════════════════════

function dayRange(dateKey) { return [dateKey, addDays(dateKey, 1)]; }
function weekRangeFor(weekStart) { return [weekStart, addDays(weekStart, 7)]; }
function monthRangeFor(dateKey) {
  const [y, m] = dateKey.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  return [start, addDays(start, daysInMonth)];
}
// period: 'today' | 'week' | 'month'
function rangeForPeriod(period, viewingKey, weekStart) {
  if (period === 'today') return dayRange(viewingKey);
  if (period === 'month') return monthRangeFor(viewingKey);
  return weekRangeFor(weekStart);
}

// Validates a single entry defensively — malformed minutes/category never
// crash the chart and never get silently counted as 0 or fabricated.
function safeEntryMinutes(e) {
  if (!e || typeof e.minutes !== 'number' || !isFinite(e.minutes) || e.minutes <= 0) return null;
  return e.minutes;
}
function safeEntryCategory(e) {
  return (typeof e.category === 'string' && e.category.trim()) ? e.category : 'other';
}

// { category: totalMinutes }, unsorted (caller sorts for display).
// Only entries fully within [startDate, endDateExclusive) count.
function distributionForRange(timeEntries, startDate, endDateExclusive) {
  const totals = {};
  (timeEntries || []).forEach((e) => {
    if (!e || typeof e.date !== 'string' || e.date < startDate || e.date >= endDateExclusive) return;
    const mins = safeEntryMinutes(e);
    if (mins === null) return; // invalid entry — skipped, not fabricated as 0, not double counted
    const cat = safeEntryCategory(e);
    totals[cat] = (totals[cat] || 0) + mins;
  });
  return totals;
}

// Day-by-day totals (all categories combined) across a date range — for the trend chart.
function dailyTotalsForRange(timeEntries, startDate, endDateExclusive) {
  const byDate = {};
  (timeEntries || []).forEach((e) => {
    if (!e || typeof e.date !== 'string' || e.date < startDate || e.date >= endDateExclusive) return;
    const mins = safeEntryMinutes(e);
    if (mins === null) return;
    byDate[e.date] = (byDate[e.date] || 0) + mins;
  });
  const days = [];
  let cursor = startDate;
  while (cursor < endDateExclusive) { days.push({ date: cursor, minutes: byDate[cursor] || 0 }); cursor = addDays(cursor, 1); }
  return days;
}

function distributionTotal(distribution) { return Object.values(distribution).reduce((s, v) => s + v, 0); }
function sortedDistributionEntries(distribution) { return Object.entries(distribution).sort((a, b) => b[1] - a[1]); }
