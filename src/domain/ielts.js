// ═══════════════════════════════════════════════════════
// IELTS — real progress tracking, not just "IELTS — 2 hours"
// ═══════════════════════════════════════════════════════
const IELTS_SKILLS = ['reading', 'listening', 'writing', 'speaking'];
const IELTS_TASK_TYPES = [
  'Reading Passage 1', 'Reading Passage 2', 'Reading Passage 3', 'True/False/Not Given drill',
  'Listening Section 1', 'Listening Section 2', 'Listening Section 3', 'Listening Section 4',
  'Writing Task 1', 'Writing Task 2', 'Speaking Part 1', 'Speaking Part 2', 'Speaking Part 3',
  'Vocabulary Review', 'Grammar Correction', 'Full Mock Test', 'Mistake Review',
];

function emptyIelts() {
  const skills = {};
  IELTS_SKILLS.forEach((s) => { skills[s] = { current: null, target: 8, history: [], weaknesses: [] }; });
  return { targetBand: 8, skills, tasks: [] };
}

async function loadIelts() { const d = await storeGet('ielts', null); return normalizeIelts(d); }
async function saveIelts(d) { await storeSet('ielts', d); }

function addIeltsTask(data, { type, skill, notes, date }) {
  if (!IELTS_TASK_TYPES.includes(type) || !IELTS_SKILLS.includes(skill)) return false;
  data.tasks.unshift({ id: 'it_' + Date.now(), type, skill, notes: sanitizeNote(notes), date: date || getDateKey(new Date()), status: 'planned' });
  return true;
}
function completeIeltsTask(data, taskId) { const t = data.tasks.find((x) => x.id === taskId); if (t) t.status = 'done'; }
// Returns false (and leaves data untouched) on an invalid score — caller must surface the rejection.
function recordScore(data, skill, score, testLabel) {
  if (!IELTS_SKILLS.includes(skill)) return false;
  const v = validScore(score);
  if (v === null) return false;
  data.skills[skill].current = v;
  data.skills[skill].history.unshift({ date: getDateKey(new Date()), score: v, source: sanitizeNote(testLabel) || 'Practice' });
  return true;
}
function ieltsWeeklyAnalytics(data, weekStart, timeEntries) {
  const weekEnd = addDays(weekStart, 7);
  const totalMinutes = missionActualMinutesRange(timeEntries || [], 'ielts', weekStart, weekEnd);
  let sessions = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    if (missionActualMinutesRange(timeEntries || [], 'ielts', day, addDays(day, 1)) > 0) sessions++;
  }
  const completedTasks = data.tasks.filter((t) => t.status === 'done').length;
  let weakest = null, weakestScore = 10;
  IELTS_SKILLS.forEach((s) => { const c = data.skills[s].current; if (c != null && c < weakestScore) { weakestScore = c; weakest = s; } });
  return { totalMinutes, sessions, weakest, completedTasks };
}

// Score validation — 0-9, finite, valid skill id. Malformed input never crashes the app.
function validScore(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (typeof n !== 'number' || !isFinite(n) || isNaN(n)) return null;
  if (n < 0 || n > 9) return null;
  return Math.round(n * 2) / 2; // nearest 0.5, matches how IELTS actually scores
}
function normalizeIelts(raw) {
  const base = emptyIelts();
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base, ...raw };
  out.skills = {};
  IELTS_SKILLS.forEach((s) => {
    const src = (raw.skills && raw.skills[s]) || {};
    out.skills[s] = {
      current: validScore(src.current),
      target: validScore(src.target) ?? 8,
      history: Array.isArray(src.history) ? src.history.filter((h) => h && validScore(h.score) !== null) : [],
      weaknesses: Array.isArray(src.weaknesses) ? src.weaknesses : [],
    };
  });
  out.tasks = Array.isArray(raw.tasks) ? raw.tasks.filter((t) => t && t.id && t.type) : [];
  return out;
}
