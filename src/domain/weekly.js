// ═══════════════════════════════════════════════════════
// WEEKLY — targets derived from mission frequency; progress is a simple
// "remaining this week" number, never a per-day pass/fail.
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

function weeklyProgress(mission, weekLogs) {
  if (mission.type === 'count' && mission.weeklyTarget != null) {
    const completed = weekLogs.reduce((sum, l) => sum + (l.progress[mission.id] || 0), 0);
    return { target: weeklySessionTarget(mission), completed, remaining: Math.max(0, weeklySessionTarget(mission) - completed) };
  }
  // "session" counts as a day where the minimum threshold was met
  const minThreshold = mission.levels.minimum;
  const completed = weekLogs.filter((l) => (l.progress[mission.id] || 0) >= minThreshold && minThreshold > 0
    || (minThreshold === 0 && (l.progress[mission.id] || 0) > 0)).length;
  const target = weeklySessionTarget(mission);
  return { target, completed, remaining: Math.max(0, target - completed) };
}

function weeklySummaryLine(mission, wp) {
  if (wp.remaining <= 0) return `${wp.completed}/${wp.target} — week's target met ✓`;
  return `${wp.remaining} remaining this week`;
}
