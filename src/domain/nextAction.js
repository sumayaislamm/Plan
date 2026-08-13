// ═══════════════════════════════════════════════════════
// "WHAT SHOULD I DO NOW?" — single recommendation.
// Priority order: Prayer > IELTS > Programming > Career/Job > Body > Quran/other habits > Optional
// Considers: recovery mode, energy level, today's progress, nearest prayer, weekly remaining.
// ═══════════════════════════════════════════════════════
function nextBestAction({ missions, log, energy, recoveryActive, prayerTimes, weeklyRemaining }) {
  const now = new Date();
  const nowA = a$(now.getHours(), now.getMinutes());

  // 1. Upcoming/unchecked prayer within the next 40 minutes, or already-due and unchecked → always wins.
  const prayerOrder = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const prayerNames = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
  for (const p of prayerOrder) {
    if (log.prayers[p]) continue;
    const pa = a$(prayerTimes[p].h, prayerTimes[p].m);
    if (nowA >= pa - 15) {
      return { kind: 'prayer', missionId: 'prayer', name: prayerNames[p] + ' Prayer', meta: 'Anchor · a few minutes', category: 'foundation' };
    }
  }

  const pool = recoveryActive ? recoveryMissionSet(missions) : missions;
  const ranked = [...pool].sort((a, b) => a.priorityRank - b.priorityRank || (a.weight === 'primary' ? -1 : 1));

  for (const m of ranked) {
    if (m.id === 'prayer' || m.id === 'sleep') continue; // handled separately / not an "action"
    const level = levelForMission(m, energy, recoveryActive);
    const target = levelValue(m, level);
    const done = log.progress?.[m.id] || 0;
    if (done >= target) continue;

    // For weekly-frequency missions, skip if weekly target already met
    if (m.frequency === 'weekly' && weeklyRemaining && weeklyRemaining[m.id] != null && weeklyRemaining[m.id] <= 0) continue;

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
