// ═══════════════════════════════════════════════════════
// RELIGIOUS JOURNAL — new, fully isolated feature. Records WHAT was
// actually read/done religiously on a date (any Surah, dhikr, or other
// activity, freely named) — distinct from:
//   - the existing Prayer system (Fajr..Isha checked state) — untouched
//   - the existing Daily Commitments (Istighfar/Dua Qunut/Durood targets) — untouched
//
// One canonical dated record per day (mirrors commitments.js's exact
// `commitments_{date}` pattern), containing a flexible activities array —
// never a fixed Yasin/Mulk/Istighfar/Durood/Dua-Qunut hardcoded list.
// ═══════════════════════════════════════════════════════
const RELIGIOUS_JOURNAL_PREFIX = 'religious_journal_';

function genActivityId() {
  if (window.crypto && crypto.randomUUID) return 'ra_' + crypto.randomUUID();
  return 'ra_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

function emptyReligiousDay(date) { return { date, activities: [], notes: '' }; }

function normalizeReligiousDay(raw, date) {
  const base = emptyReligiousDay(date);
  if (!raw || typeof raw !== 'object') return base;
  const activities = Array.isArray(raw.activities) ? raw.activities.filter((a) => a && typeof a.name === 'string' && a.name.trim()).map((a) => ({
    id: a.id || genActivityId(),
    name: a.name.trim(),
    count: (typeof a.count === 'number' && isFinite(a.count) && a.count >= 0) ? a.count : null,
    unit: typeof a.unit === 'string' ? a.unit : '',
    notes: typeof a.notes === 'string' ? a.notes : '',
  })) : [];
  return { date, activities, notes: typeof raw.notes === 'string' ? raw.notes : '' };
}

async function loadReligiousDay(date) { return normalizeReligiousDay(await storeGet(RELIGIOUS_JOURNAL_PREFIX + date, null), date); }
async function saveReligiousDay(date, data) { await storeSet(RELIGIOUS_JOURNAL_PREFIX + date, data); }

// Mutates the passed-in day object's activities array — caller saves afterward.
// Each activity keeps its own stable id, so editing/removing one never
// disturbs the others.
function addActivityToDay(day, { name, count, unit, notes }) {
  if (!name || !name.trim()) return false;
  day.activities.push({
    id: genActivityId(), name: name.trim(),
    count: (typeof count === 'number' && isFinite(count) && count >= 0) ? count : null,
    unit: (unit || '').trim(), notes: (notes || '').trim(),
  });
  return true;
}
function updateActivityInDay(day, activityId, { name, count, unit, notes }) {
  const a = day.activities.find((x) => x.id === activityId);
  if (!a || !name || !name.trim()) return false;
  a.name = name.trim();
  a.count = (typeof count === 'number' && isFinite(count) && count >= 0) ? count : null;
  a.unit = (unit || '').trim();
  a.notes = (notes || '').trim();
  return true;
}
function removeActivityFromDay(day, activityId) { day.activities = day.activities.filter((a) => a.id !== activityId); }

function religiousDayHasActivity(day) { return !!day && (day.activities.length > 0 || !!day.notes); }

// Mirrors allCommitmentDates()'s exact local+remote merge pattern.
async function allReligiousJournalDates() {
  const local = lsKeys(RELIGIOUS_JOURNAL_PREFIX).map((k) => k.slice(RELIGIOUS_JOURNAL_PREFIX.length));
  const remote = (await remoteKeysWithPrefix(RELIGIOUS_JOURNAL_PREFIX)).map((k) => k.slice(RELIGIOUS_JOURNAL_PREFIX.length));
  return [...new Set([...local, ...remote])];
}
