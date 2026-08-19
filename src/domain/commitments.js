// ═══════════════════════════════════════════════════════
// DAILY COMMITMENTS — new, isolated feature. Count/completion-based daily
// targets that are explicitly NOT missions and NOT time entries:
//   Walking (steps), Istighfar, Dua Qunut, Durood Sharif, LeetCode, GitHub pushes.
//
// Deliberately kept separate from missions.js/momentum.js: these targets
// have no natural "minutes" representation, and folding them into the
// mission/momentum system would risk corrupting an already-working,
// carefully-tuned scoring model for no real benefit. One canonical
// date-keyed record per day, stored via the existing generic KV storage
// (same mechanism as `log_{date}`), synced the same way.
// ═══════════════════════════════════════════════════════
const COMMITMENTS_PREFIX = 'commitments_';
const COMMITMENT_TARGETS = { walkingSteps: 10000, istighfar: 500, duaQunut: 100, durood: 100, leetcode: 1, githubPushes: 5 };

function emptyCommitments(date) {
  return {
    date, walkingSteps: 0, istighfar: 0, duaQunut: 0, durood: 0,
    leetcode: { completed: false, problemName: '', url: '', note: '' },
    githubPushes: 0,
  };
}

// Malformed/partial data never crashes the app and never wipes the rest of the record.
function normalizeCommitments(raw, date) {
  const base = emptyCommitments(date);
  if (!raw || typeof raw !== 'object') return base;
  const num = (v) => (typeof v === 'number' && isFinite(v) && v >= 0) ? v : 0;
  const lc = (raw.leetcode && typeof raw.leetcode === 'object') ? raw.leetcode : {};
  return {
    date,
    walkingSteps: num(raw.walkingSteps),
    istighfar: num(raw.istighfar),
    duaQunut: num(raw.duaQunut),
    durood: num(raw.durood),
    leetcode: {
      completed: !!lc.completed,
      problemName: typeof lc.problemName === 'string' ? lc.problemName : '',
      url: (typeof validateUrl === 'function' ? (validateUrl(lc.url) || '') : (typeof lc.url === 'string' ? lc.url : '')),
      note: typeof lc.note === 'string' ? lc.note : '',
    },
    githubPushes: num(raw.githubPushes),
  };
}

async function loadCommitments(date) { return normalizeCommitments(await storeGet(COMMITMENTS_PREFIX + date, null), date); }
async function saveCommitments(date, data) { await storeSet(COMMITMENTS_PREFIX + date, data); }

function commitmentDone(data, key) {
  if (key === 'leetcode') return !!data.leetcode.completed;
  return data[key] >= COMMITMENT_TARGETS[key];
}
function commitmentsHasActivity(data) {
  if (!data) return false;
  return data.walkingSteps > 0 || data.istighfar > 0 || data.duaQunut > 0 || data.durood > 0 || data.leetcode.completed || data.githubPushes > 0;
}

// Mirrors allLogKeys()'s exact local+remote merge pattern, scoped to this feature's own prefix.
async function allCommitmentDates() {
  const local = lsKeys(COMMITMENTS_PREFIX).map((k) => k.slice(COMMITMENTS_PREFIX.length));
  const remote = (await remoteKeysWithPrefix(COMMITMENTS_PREFIX)).map((k) => k.slice(COMMITMENTS_PREFIX.length));
  return [...new Set([...local, ...remote])];
}

async function weeklyCommitmentTotals(weekStart) {
  const totals = { walkingSteps: 0, istighfar: 0, duaQunut: 0, durood: 0, leetcodeDays: 0, githubPushes: 0 };
  for (let i = 0; i < 7; i++) {
    const d = await loadCommitments(addDays(weekStart, i));
    totals.walkingSteps += d.walkingSteps;
    totals.istighfar += d.istighfar;
    totals.duaQunut += d.duaQunut;
    totals.durood += d.durood;
    if (d.leetcode.completed) totals.leetcodeDays++;
    totals.githubPushes += d.githubPushes;
  }
  return totals;
}
const COMMITMENT_WEEKLY_TARGETS = { walkingSteps: 70000, istighfar: 3500, duaQunut: 700, durood: 700, leetcodeDays: 7, githubPushes: 35 };
