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

async function loadIelts() { const d = await storeGet('ielts', null); return d ? { ...emptyIelts(), ...d } : emptyIelts(); }
async function saveIelts(d) { await storeSet('ielts', d); }

function addIeltsTask(data, { type, skill, notes, date }) {
  data.tasks.unshift({ id: 'it_' + Date.now(), type, skill, notes: notes || '', date: date || getDateKey(new Date()), status: 'planned' });
}
function completeIeltsTask(data, taskId) { const t = data.tasks.find((x) => x.id === taskId); if (t) t.status = 'done'; }
function recordScore(data, skill, score, testLabel) {
  data.skills[skill].current = score;
  data.skills[skill].history.unshift({ date: getDateKey(new Date()), score, source: testLabel || 'Practice' });
}
function ieltsWeeklyAnalytics(data, weekLogs) {
  const totalMinutes = weekLogs.reduce((s, l) => s + (l.progress['ielts'] || 0), 0);
  const sessions = weekLogs.filter((l) => (l.progress['ielts'] || 0) > 0).length;
  let weakest = null, weakestScore = 10;
  IELTS_SKILLS.forEach((s) => { const c = data.skills[s].current; if (c != null && c < weakestScore) { weakestScore = c; weakest = s; } });
  return { totalMinutes, sessions, weakest };
}
