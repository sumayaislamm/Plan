// ═══════════════════════════════════════════════════════
// DAILY LOG — one small record per day. Progress persists as raw units
// (minutes or counts) per mission so history/weekly math is simple.
// ═══════════════════════════════════════════════════════
function emptyLog(dateKey) {
  return {
    date: dateKey,
    energy: null,           // 'low' | 'normal' | 'high'
    energyScore: null,      // 1-10 optional
    recoveryActive: false,
    recoveryReason: null,
    prayers: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
    progress: {},           // { missionId: number (minutes or count) }
    levelUsed: {},          // { missionId: 'minimum'|'standard'|'stretch' } — snapshot of level chosen that day
    completedActions: [],   // [{missionId, level, amount, timestamp}]
    reflection: { accomplished: '', blocker: '', tomorrowFocus: '', mood: '' },
  };
}

async function loadLog(dateKey) {
  const l = await storeGet('log_' + dateKey, null);
  return l ? { ...emptyLog(dateKey), ...l } : emptyLog(dateKey);
}
async function saveLog(dateKey, log) { await storeSet('log_' + dateKey, log); }

function addProgress(log, missionId, amount, level) {
  log.progress[missionId] = (log.progress[missionId] || 0) + amount;
  log.levelUsed[missionId] = level;
  log.completedActions.push({ missionId, level, amount, timestamp: new Date().toISOString() });
}

function togglePrayer(log, prayerKey) { log.prayers[prayerKey] = !log.prayers[prayerKey]; }

async function allLogKeys() { return lsKeys('log_').map((k) => k.slice(4)).sort((a, b) => b.localeCompare(a)); }
