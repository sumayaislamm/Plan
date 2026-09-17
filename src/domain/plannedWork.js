// ═══════════════════════════════════════════════════════
// PLANNED WORK — new, isolated feature. "I need to do X on date Y" — a
// planning/reminder layer, NOT a mission, NOT a Daily Commitment, NOT a
// time entry, NOT Focus, NOT IELTS/Programming/Job progress. Completing an
// item here never touches any of those systems. One flat array under one
// canonical key, mirroring cooking.js's exact pattern — no per-date keys,
// no second storage system.
// ═══════════════════════════════════════════════════════
const PLANNED_WORK_KEY = 'planned_work';

function genPlannedWorkId() {
  if (window.crypto && crypto.randomUUID) return 'pw_' + crypto.randomUUID();
  return 'pw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

async function loadPlannedWork() { return normalizePlannedWork(await storeGet(PLANNED_WORK_KEY, [])); }
async function savePlannedWork(list) { await storeSet(PLANNED_WORK_KEY, list); }

function normalizePlannedWork(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && e.id && e.date && e.title).map((e) => ({
    id: e.id, date: e.date, title: e.title,
    notes: typeof e.notes === 'string' ? e.notes : '',
    completed: e.completed === true,
    createdAt: e.createdAt || new Date().toISOString(),
    updatedAt: e.updatedAt || new Date().toISOString(),
  }));
}

// Minimum required: date + title. Notes optional.
function addPlannedWorkItem(list, data) {
  if (!data.date || !data.title || !data.title.trim()) return { list, entry: null, error: 'Date and task title are required' };
  const now = new Date().toISOString();
  const entry = {
    id: genPlannedWorkId(), date: data.date, title: data.title.trim(),
    notes: (data.notes || '').trim(), completed: false,
    createdAt: now, updatedAt: now,
  };
  return { list: [...list, entry], entry, error: null };
}
function updatePlannedWorkItem(list, id, data) {
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return { list, error: 'Item not found' };
  if (!data.date || !data.title || !data.title.trim()) return { list, error: 'Date and task title are required' };
  const updated = { ...list[idx], date: data.date, title: data.title.trim(), notes: (data.notes || '').trim(), updatedAt: new Date().toISOString() };
  const next = [...list]; next[idx] = updated;
  return { list: next, error: null };
}
function deletePlannedWorkItem(list, id) { return list.filter((e) => e.id !== id); }
function togglePlannedWorkItem(list, id) {
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return list;
  const next = [...list];
  next[idx] = { ...next[idx], completed: !next[idx].completed, updatedAt: new Date().toISOString() };
  return next;
}

function plannedWorkForDate(list, date) { return (list || []).filter((e) => e.date === date); }
// Strictly AFTER the given date, nearest first — "Upcoming", never includes today's own items (those show separately as "Planned for Today").
function upcomingPlannedWork(list, afterDate) {
  return (list || []).filter((e) => e.date > afterDate).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}
// Dates derived from the already-loaded in-memory array — no extra storage calls, no cap, no artificial date limit.
function allPlannedWorkDates(list) { return [...new Set((list || []).map((e) => e.date))].sort((a, b) => b.localeCompare(a)); }
