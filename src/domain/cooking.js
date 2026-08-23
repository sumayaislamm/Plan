// ═══════════════════════════════════════════════════════
// COOKING JOURNAL — new, fully isolated feature. A record of what was
// cooked, not a mission and not a time-tracking system. Stored as one
// flat array (same shape/pattern as timeEntries.js), synced via the
// existing generic KV storage. Deliberately never touches missions,
// momentum, or timeEntries — cooking "time" here is a free-text/optional
// field, never fed into the canonical actual-time system.
// ═══════════════════════════════════════════════════════
const COOKING_KEY = 'cooking_entries';

function genCookingId() {
  if (window.crypto && crypto.randomUUID) return 'ck_' + crypto.randomUUID();
  return 'ck_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

function validateRating(v) {
  const n = typeof v === 'string' ? parseInt(v, 10) : v;
  if (typeof n !== 'number' || !isFinite(n) || isNaN(n)) return null;
  if (n < 1 || n > 5) return null;
  return Math.round(n);
}

async function loadCookingEntries() { return normalizeCookingEntries(await storeGet(COOKING_KEY, [])); }
async function saveCookingEntries(list) { await storeSet(COOKING_KEY, list); }

function normalizeCookingEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && e.id && e.date && e.dish).map((e) => ({
    id: e.id, date: e.date, dish: e.dish,
    source: typeof e.source === 'string' ? e.source : '',
    sourceUrl: (typeof validateUrl === 'function' ? (validateUrl(e.sourceUrl) || '') : ''),
    cookingTime: (typeof e.cookingTime === 'number' && isFinite(e.cookingTime) && e.cookingTime > 0) ? e.cookingTime : null,
    result: typeof e.result === 'string' ? e.result : '',
    rating: validateRating(e.rating),
    tips: typeof e.tips === 'string' ? e.tips : '',
    nextTimeChanges: typeof e.nextTimeChanges === 'string' ? e.nextTimeChanges : '',
    wouldCookAgain: e.wouldCookAgain === true ? true : e.wouldCookAgain === false ? false : null,
    createdAt: e.createdAt || new Date().toISOString(),
    updatedAt: e.updatedAt || new Date().toISOString(),
  }));
}

// Minimum required: date, dish, result, tips. Everything else optional.
function addCookingEntry(list, data) {
  if (!data.date || !data.dish || !data.dish.trim()) return { list, entry: null, error: 'Date and dish name are required' };
  const now = new Date().toISOString();
  const entry = {
    id: genCookingId(), date: data.date, dish: data.dish.trim(),
    source: (data.source || '').trim(), sourceUrl: validateUrl(data.sourceUrl || '') || '',
    cookingTime: (typeof data.cookingTime === 'number' && data.cookingTime > 0) ? data.cookingTime : null,
    result: (data.result || '').trim(), rating: validateRating(data.rating),
    tips: (data.tips || '').trim(), nextTimeChanges: (data.nextTimeChanges || '').trim(),
    wouldCookAgain: data.wouldCookAgain === true ? true : data.wouldCookAgain === false ? false : null,
    createdAt: now, updatedAt: now,
  };
  return { list: [...list, entry], entry, error: null };
}
function updateCookingEntry(list, id, data) {
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return { list, error: 'Entry not found' };
  if (!data.date || !data.dish || !data.dish.trim()) return { list, error: 'Date and dish name are required' };
  const updated = {
    ...list[idx], date: data.date, dish: data.dish.trim(),
    source: (data.source || '').trim(), sourceUrl: validateUrl(data.sourceUrl || '') || '',
    cookingTime: (typeof data.cookingTime === 'number' && data.cookingTime > 0) ? data.cookingTime : null,
    result: (data.result || '').trim(), rating: validateRating(data.rating),
    tips: (data.tips || '').trim(), nextTimeChanges: (data.nextTimeChanges || '').trim(),
    wouldCookAgain: data.wouldCookAgain === true ? true : data.wouldCookAgain === false ? false : null,
    updatedAt: new Date().toISOString(),
  };
  const next = [...list]; next[idx] = updated;
  return { list: next, error: null };
}
function deleteCookingEntry(list, id) { return list.filter((e) => e.id !== id); }

function cookingEntriesForDate(list, date) { return (list || []).filter((e) => e.date === date); }
// Dates derived from the already-loaded in-memory array — no extra storage calls, no cap needed.
function allCookingDates(list) { return [...new Set((list || []).map((e) => e.date))].sort((a, b) => b.localeCompare(a)); }
function sortedCookingEntries(list) { return [...(list || [])].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)); }

function searchCookingEntries(list, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return sortedCookingEntries(list);
  return sortedCookingEntries(list).filter((e) =>
    e.dish.toLowerCase().includes(q) || e.tips.toLowerCase().includes(q) || e.result.toLowerCase().includes(q) || e.source.toLowerCase().includes(q)
  );
}
