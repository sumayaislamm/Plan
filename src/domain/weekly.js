// ═══════════════════════════════════════════════════════
// WEEKLY — targets derived from mission frequency; progress derives from
// CANONICAL sources only (time entries for time-type, job records for
// job-apps, count events in logs for other count-type missions).
// Never a per-day pass/fail — just "remaining this week".
// ═══════════════════════════════════════════════════════
const FREQ_SESSIONS_PER_WEEK = { daily: 7, '5x/week': 5, '3x/week': 3, weekly: 1 };

function weeklySessionTarget(mission) {
  if (mission.type === 'count' && mission.weeklyTarget != null) return mission.weeklyTarget;
  return FREQ_SESSIONS_PER_WEEK[mission.frequency] ?? 7;
}

async function loadWeekLogs(weekStart) {
  const days = [];
  for (let i = 0; i < 7; i++) days.push(await loadLog(addDays(weekStart, i)));
  return days;
}

// mission, weekStart, weekLogs, timeEntries, jobs — all canonical inputs, no side effects.
function weeklyProgress(mission, weekStart, weekLogs, timeEntries, jobs) {
  const weekEnd = addDays(weekStart, 7);
  const target = weeklySessionTarget(mission);

  if (mission.id === 'job-apps') {
    const completed = (jobs || []).filter((j) =>
      j.dateApplied && j.dateApplied >= weekStart && j.dateApplied < weekEnd &&
      j.status !== 'Saved' && j.status !== 'Preparing'
    ).length;
    return { target, completed, remaining: Math.max(0, target - completed) };
  }

  if (mission.type === 'time') {
    const minThreshold = mission.levels.minimum;
    let sessionDays = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const mins = missionActualMinutesRange(timeEntries || [], mission.id, day, addDays(day, 1));
      if (minThreshold > 0 ? mins >= minThreshold : mins > 0) sessionDays++;
    }
    return { target, completed: sessionDays, remaining: Math.max(0, target - sessionDays) };
  }

  // Other count-type missions (e.g. food/hydration taps) — real logged events.
  const completed = (weekLogs || []).reduce((sum, l) => sum + (l.progress[mission.id] || 0), 0);
  return { target, completed, remaining: Math.max(0, target - completed) };
}

function weeklySummaryLine(mission, wp) {
  if (!wp || !isFinite(wp.target) || wp.target <= 0) return 'No weekly target set';
  if (wp.remaining <= 0) return `${wp.completed}/${wp.target} — week's target met ✓`;
  return `${wp.remaining} remaining this week`;
}
