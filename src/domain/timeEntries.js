// ═══════════════════════════════════════════════════════
// TIME ENTRIES — canonical, appendable log of real worked time.
// This is the ONLY source of truth for time-type mission progress.
// Focus sessions and manual entries both write here with a `source` tag,
// so nothing is ever double-counted and everything is editable/deletable.
// ═══════════════════════════════════════════════════════
const TIME_ENTRY_MAX_MINUTES = 720; // 12h per single entry — sensible upper bound, not a mission cap
const TIME_ENTRY_CATEGORIES = [
  'ielts', 'programming', 'portfolio', 'career-prep', 'quran', 'family',
  'exercise', 'walking', 'yoga', 'reading', 'hobby', 'social', 'rest', 'sleep', 'other',
];

function genEntryId() {
  if (window.crypto && crypto.randomUUID) return 'te_' + crypto.randomUUID();
  return 'te_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

// Returns a finite, positive, sanely-bounded minute value, or null if invalid.
// Never silently coerces bad input to 0 — caller must treat null as a rejected entry.
function validateMinutes(raw) {
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (typeof n !== 'number' || !isFinite(n) || isNaN(n)) return null;
  if (n <= 0) return null;
  if (n > TIME_ENTRY_MAX_MINUTES) return null;
  return Math.round(n * 10) / 10; // keep 1 decimal, avoid float drift
}

async function loadAllTimeEntries() {
  const raw = await storeGet('time_entries', []);
  return Array.isArray(raw) ? raw.filter((e) => e && e.id && e.date && e.category && typeof e.minutes === 'number' && isFinite(e.minutes) && e.minutes > 0) : [];
}
async function saveAllTimeEntries(list) { await storeSet('time_entries', list); }

function addTimeEntry(list, { date, category, activityId, minutes, source, note, startTime }) {
  const mins = validateMinutes(minutes);
  if (mins === null) return { list, entry: null, error: 'Invalid duration' };
  if (!TIME_ENTRY_CATEGORIES.includes(category)) return { list, entry: null, error: 'Invalid category' };
  const now = new Date().toISOString();
  const entry = {
    id: genEntryId(), date, category, activityId: activityId || null,
    minutes: mins, source: source || 'manual', note: sanitizeNote(note),
    startTime: sanitizeStartTime(startTime), // optional "HH:MM" — when in the day the session happened, distinct from createdAt (when it was logged)
    createdAt: now, updatedAt: now,
  };
  return { list: [...list, entry], entry, error: null };
}

function updateTimeEntry(list, id, { minutes, note, startTime }) {
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return { list, error: 'Entry not found' };
  const mins = validateMinutes(minutes);
  if (mins === null) return { list, error: 'Invalid duration' };
  const updated = { ...list[idx], minutes: mins, note: sanitizeNote(note), updatedAt: new Date().toISOString() };
  if (startTime !== undefined) updated.startTime = sanitizeStartTime(startTime);
  const next = [...list]; next[idx] = updated;
  return { list: next, error: null };
}

function deleteTimeEntry(list, id) {
  return list.filter((e) => e.id !== id);
}

function sanitizeNote(note) {
  if (typeof note !== 'string') return '';
  return note.slice(0, 200); // display escaping happens at render time; this just bounds length
}
// "HH:MM" 24-hour, from a native <input type="time">. Optional on every entry
// (every existing category keeps working with no startTime at all); only the
// Quran session form actually collects it.
function sanitizeStartTime(t) {
  if (typeof t !== 'string') return null;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t) ? t : null;
}
function fmtStartTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return fmt$(h, m); // reuses the existing 12-hour AM/PM formatter from time.js
}

// ── DERIVATION HELPERS (canonical source for mission progress) ─────────
function entriesForDate(list, date) { return list.filter((e) => e.date === date); }
function entriesForMissionDate(list, missionId, date) { return list.filter((e) => e.date === date && e.category === missionId); }

function missionActualMinutes(list, missionId, date) {
  return entriesForMissionDate(list, missionId, date).reduce((s, e) => s + e.minutes, 0);
}
function missionActualMinutesRange(list, missionId, startDate, endDateExclusive) {
  return list.filter((e) => e.category === missionId && e.date >= startDate && e.date < endDateExclusive)
    .reduce((s, e) => s + e.minutes, 0);
}
// Grouped breakdown for the "View Today's Time" screen — { missionId: [{...entry}] }
function breakdownForDate(list, date) {
  const out = {};
  entriesForDate(list, date).forEach((e) => { (out[e.category] ||= []).push(e); });
  return out;
}
function sourceLabel(source) { return source === 'focus' ? 'Focus' : source === 'manual' ? 'Manual' : 'Imported'; }

// ── QURAN SESSIONS — a pure view over category='quran' entries. Zero new
// storage: every session IS a normal timeEntries row (source of truth stays
// singular), sorted by clock time when available so multiple same-day
// sessions display in the order they actually happened.
function quranSessionsForDate(list, date) {
  return entriesForMissionDate(list, 'quran', date)
    .slice()
    .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99') || a.createdAt.localeCompare(b.createdAt));
}
// Dates with at least one Quran session — derived from the already-loaded
// in-memory array, no async call, no cap.
function allQuranSessionDates(list) {
  return [...new Set((list || []).filter((e) => e.category === 'quran').map((e) => e.date))].sort((a, b) => b.localeCompare(a));
}

// Progress line text per the exact spec examples — never clamps actual to the stretch cap.
function progressLine(mission, actualMinutes) {
  const min = mission.levels.minimum, max = mission.levels.stretch;
  if (actualMinutes <= 0) return `0 / ${min}${min?' min':''} minimum`;
  if (actualMinutes < min) return `${fmtMin(actualMinutes)} / ${fmtMin(min)} · ${fmtMin(min - actualMinutes)} remaining to minimum`;
  if (actualMinutes < max) return `${fmtMin(actualMinutes)} · Minimum ✓ · ${fmtMin(max - actualMinutes)} to stretch`;
  if (actualMinutes === max) return `${fmtMin(actualMinutes)} · Minimum + Stretch achieved`;
  return `${fmtMin(actualMinutes)} · Stretch exceeded by ${fmtMin(actualMinutes - max)}`;
}
function fmtMin(n) { return `${Math.round(n * 10) / 10}m`; }
