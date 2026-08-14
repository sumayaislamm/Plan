// ═══════════════════════════════════════════════════════
// "WHAT SHOULD I DO NOW?" — single recommendation, derived from canonical data.
// Priority order: Prayer > IELTS > Programming > Career/Job > Body > Quran/other habits > Optional
// ═══════════════════════════════════════════════════════
function nextBestAction({ missions, log, energy, recoveryActive, prayerTimes, weeklyRemaining, timeEntries, jobs }) {
  const now = new Date();
  const nowA = a$(now.getHours(), now.getMinutes());

  // 1. Upcoming/unchecked prayer within the next 15 minutes, or already-due and unchecked → always wins.
  const prayerOrder = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const prayerNames = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
  if (prayerTimes) {
    for (const p of prayerOrder) {
      if (log.prayers[p]) continue;
      const pt = prayerTimes[p];
      if (!pt || typeof pt.h !== 'number' || typeof pt.m !== 'number') continue; // malformed API data — skip, don't crash
      const pa = a$(pt.h, pt.m);
      if (nowA >= pa - 15) {
        return { kind: 'prayer', missionId: 'prayer', name: prayerNames[p] + ' Prayer', meta: 'Anchor · a few minutes', category: 'foundation' };
      }
    }
  }

  const pool = recoveryActive ? recoveryMissionSet(missions) : missions;
  const ranked = [...pool].sort((a, b) => a.priorityRank - b.priorityRank || (a.weight === 'primary' ? -1 : 1));

  for (const m of ranked) {
    if (m.id === 'prayer' || m.id === 'sleep') continue; // handled separately / not a suggestible "action"
    const level = levelForMission(m, energy, recoveryActive);
    const target = levelValue(m, level);
    if (!isFinite(target) || target <= 0) continue;

    // For weekly-frequency missions, skip once this week's target is already met.
    if (m.frequency === 'weekly' && weeklyRemaining && weeklyRemaining[m.id] != null && weeklyRemaining[m.id] <= 0) continue;

    let done;
    if (m.id === 'job-apps') {
      done = (jobs || []).filter((j) => j.dateApplied === log.date && isApplicationStatus(j.status)).length;
    } else if (m.type === 'time') {
      done = missionActualMinutes(timeEntries || [], m.id, log.date);
    } else {
      done = log.progress?.[m.id] || 0;
    }
    if (done >= target) continue;

    if (m.type === 'time') {
      const remaining = target - done;
      return {
        kind: 'mission', missionId: m.id, name: missionActionLabel(m),
        meta: `${level[0].toUpperCase() + level.slice(1)} · ${dur$(remaining)}`,
        category: m.category, minutes: remaining, level
      };
    } else {
      return {
        kind: 'mission', missionId: m.id, name: missionActionLabel(m),
        meta: `${level[0].toUpperCase() + level.slice(1)} · ${target - done} to go`,
        category: m.category, count: target - done, level
      };
    }
  }
  return null; // everything for today is covered — the UI shows a "you're done" state
}

function missionActionLabel(m) {
  const labels = {
    ielts: 'IELTS Practice', programming: 'Programming Session', 'job-apps': 'Job Application',
    portfolio: 'Portfolio Work', 'career-prep': 'Career Prep', quran: 'Quran',
    family: 'Family Time', food: 'Food / Hydration Check', exercise: 'Exercise',
    walking: 'Walk', yoga: 'Yoga / Stretching', reading: 'Reading', hobby: 'Hobby Time',
    social: 'Social / Family Time', rest: 'Rest / Entertainment',
  };
  return labels[m.id] || m.name;
}
