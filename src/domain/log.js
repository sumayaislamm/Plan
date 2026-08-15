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
    progress: {},           // { missionId: number } — COUNT-type missions only (real events, e.g. food/water taps).
                             // Time-type mission progress is NEVER stored here — it's derived from timeEntries.
    quickMin: {},            // { missionId: true } — "minimum acknowledged" for time-type foundation missions.
                             // Purely a completion marker; never contributes fake minutes to actual time.
    levelUsed: {},          // { missionId: 'minimum'|'standard'|'stretch' } — snapshot of level chosen that day
    completedActions: [],   // [{missionId, level, amount, timestamp}] — audit trail for count-type actions
    reflection: { accomplished: '', blocker: '', tomorrowFocus: '', mood: '' },
  };
}

// Defends against corrupted/partial localStorage data — never lets one bad
// field crash the app or wipe the rest of a day's valid data.
function normalizeLog(raw, dateKey) {
  const base = emptyLog(dateKey);
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base, ...raw };
  out.date = dateKey;
  out.prayers = (raw.prayers && typeof raw.prayers === 'object') ? { ...base.prayers, ...raw.prayers } : base.prayers;
  Object.keys(out.prayers).forEach((k) => { out.prayers[k] = !!out.prayers[k]; });
  out.progress = (raw.progress && typeof raw.progress === 'object' && !Array.isArray(raw.progress)) ? raw.progress : {};
  Object.keys(out.progress).forEach((k) => { const v = Number(out.progress[k]); out.progress[k] = isFinite(v) && v >= 0 ? v : 0; });
  out.quickMin = (raw.quickMin && typeof raw.quickMin === 'object') ? raw.quickMin : {};
  out.levelUsed = (raw.levelUsed && typeof raw.levelUsed === 'object') ? raw.levelUsed : {};
  out.completedActions = Array.isArray(raw.completedActions) ? raw.completedActions : [];
  out.reflection = (raw.reflection && typeof raw.reflection === 'object') ? { ...base.reflection, ...raw.reflection } : base.reflection;
  out.energy = ['low', 'normal', 'high'].includes(raw.energy) ? raw.energy : null;
  out.energyScore = (typeof raw.energyScore === 'number' && isFinite(raw.energyScore) && raw.energyScore >= 1 && raw.energyScore <= 10) ? raw.energyScore : null;
  out.recoveryActive = !!raw.recoveryActive;
  out.recoveryReason = typeof raw.recoveryReason === 'string' ? raw.recoveryReason : null;
  return out;
}

async function loadLog(dateKey) {
  const l = await storeGet('log_' + dateKey, null);
  return normalizeLog(l, dateKey);
}
async function saveLog(dateKey, log) { await storeSet('log_' + dateKey, log); }

// COUNT-type missions only (e.g. food/water taps) — a real event, not a time value.
function addCountProgress(log, missionId, amount, level) {
  log.progress[missionId] = Math.max(0, (log.progress[missionId] || 0) + amount);
  log.levelUsed[missionId] = level;
  log.completedActions.push({ missionId, level, amount, timestamp: new Date().toISOString() });
}

// Acknowledgement only — never converts into worked minutes. Toggleable.
function toggleQuickMin(log, missionId) { log.quickMin[missionId] = !log.quickMin[missionId]; }

function togglePrayer(log, prayerKey) { log.prayers[prayerKey] = !log.prayers[prayerKey]; }

async function allLogKeys() {
  const local = lsKeys('log_').map((k) => k.slice(4));
  const remote = (await remoteKeysWithPrefix('log_')).map((k) => k.slice(4));
  return [...new Set([...local, ...remote])].sort((a, b) => b.localeCompare(a));
}

// A day is "discoverable" in History if ANY canonical source has data for it
// — not just a daily log. timeEntries/jobs/projects/ielts are each stored as
// one whole-array blob that already syncs in full via storeGet, so scanning
// the already-loaded in-memory arrays here needs no extra network calls.
function mergeActivityDates(logKeys, timeEntries, jobs, projects, ielts) {
  const set = new Set(logKeys);
  (timeEntries || []).forEach((e) => { if (e && typeof e.date === 'string') set.add(e.date); });
  (jobs || []).forEach((j) => { if (j && j.dateApplied) set.add(j.dateApplied); });
  (projects || []).forEach((p) => (p.features || []).forEach((f) => (f.tasks || []).forEach((t) => { if (t.completedAt) set.add(t.completedAt); })));
  (ielts?.tasks || []).forEach((t) => { if (t) { if (t.date) set.add(t.date); if (t.completedAt) set.add(t.completedAt); } });
  return [...set].sort((a, b) => b.localeCompare(a));
}

// Any recorded activity at all for one date — used for History's empty state.
function dayHasActivity(log, timeEntries, date, projects, jobs) {
  if (log.prayers && Object.values(log.prayers).some(Boolean)) return true;
  if (entriesForDate(timeEntries, date).length) return true;
  if (log.progress && Object.values(log.progress).some((v) => v > 0)) return true;
  if (log.reflection && (log.reflection.accomplished || log.reflection.blocker || log.reflection.tomorrowFocus)) return true;
  if (tasksCompletedOnDate(projects, date).length) return true;
  if (jobsAppliedOnDate(jobs, date).length) return true;
  return false;
}
