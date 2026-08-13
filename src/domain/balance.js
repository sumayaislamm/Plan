// ═══════════════════════════════════════════════════════
// LIFE BALANCE — protects rest, family, hobbies from being optimized away
// ═══════════════════════════════════════════════════════
function lifeBalance(missions, weekLogs) {
  const out = {};
  Object.entries(BALANCE_CATEGORIES).forEach(([cat, ids]) => {
    let ratioSum = 0, count = 0;
    ids.forEach((id) => {
      const m = missionById(missions, id);
      if (!m) return;
      const wp = weeklyProgress(m, weekLogs);
      ratioSum += wp.target > 0 ? wp.completed / wp.target : 0;
      count++;
    });
    const avgRatio = count > 0 ? ratioSum / count : 0;
    let status = 'balanced';
    if (avgRatio < 0.4) status = 'under';
    else if (avgRatio > 1.3) status = 'over';
    out[cat] = { ratio: avgRatio, status };
  });
  return out;
}
