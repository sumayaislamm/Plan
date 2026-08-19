// ═══════════════════════════════════════════════════════
// RENDER — Daily Commitments (isolated; reuses existing .card/.hc/pill CSS,
// no new component classes needed).
// ═══════════════════════════════════════════════════════
const COMMITMENT_META = {
  walkingSteps: { icon: '🚶', label: 'Walking', unit: 'steps' },
  istighfar: { icon: '🤲', label: 'Istighfar', unit: '' },
  duaQunut: { icon: '🕌', label: 'Dua Qunut', unit: '' },
  durood: { icon: '🤍', label: 'Durood Sharif', unit: '' },
  githubPushes: { icon: '🐙', label: 'GitHub', unit: 'pushes' },
};
function fmtCount(n) { return n.toLocaleString(); }

// ── TODAY: "Daily Commitments" section ──────────────────
function renderDailyCommitmentsSection(commitments, readonly) {
  if (!commitments) return '';
  let html = `<div class="sec-hdr"><span class="sec-title">Daily Commitments</span></div>`;
  html += `<div class="card">`;
  ['walkingSteps', 'istighfar', 'duaQunut', 'durood'].forEach((key) => {
    html += renderCommitmentCounterRow(key, commitments[key], readonly);
  });
  html += renderLeetcodeRow(commitments.leetcode, readonly);
  html += renderCommitmentCounterRow('githubPushes', commitments.githubPushes, readonly);
  html += `</div>`;
  return html;
}

function renderCommitmentCounterRow(key, value, readonly) {
  const meta = COMMITMENT_META[key];
  const target = COMMITMENT_TARGETS[key];
  const done = value >= target;
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  let row = `<div style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;margin-bottom:4px">
      <span>${meta.icon} ${esc(meta.label)}</span>
      <span style="color:${done ? 'var(--green)' : 'var(--gold)'};font-weight:600">${fmtCount(value)} / ${fmtCount(target)}${meta.unit ? ' ' + meta.unit : ''}${done ? ' ✓' : ''}</span>
    </div>
    <div class="mc-track"><div class="mc-fill" style="width:${pct}%;${done ? 'background:var(--green)' : ''}"></div></div>`;
  if (!readonly) {
    row += `<div class="pill-row" style="margin-top:6px">
      <button class="pill" onclick="commitmentIncrement('${key}',1)">+1</button>
      <button class="pill" onclick="commitmentIncrement('${key}',10)">+10</button>
      <button class="pill" onclick="commitmentIncrement('${key}',50)">+50</button>
      <button class="pill" onclick="commitmentIncrement('${key}',100)">+100</button>
      <button class="pill" onclick="openCommitmentEdit('${key}')">Edit</button>
    </div>`;
  }
  row += `</div>`;
  return row;
}

function renderLeetcodeRow(lc, readonly) {
  const done = !!lc.completed;
  let row = `<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem">
      <span>💻 LeetCode${lc.problemName ? ' — ' + esc(lc.problemName) : ''}</span>
      <span style="color:${done ? 'var(--green)' : 'var(--gold)'};font-weight:600">${done ? '1 / 1 ✓' : '0 / 1'}</span>
    </div>`;
  if (!readonly) {
    row += `<div class="pill-row" style="margin-top:6px">
      <button class="pill${done ? ' active' : ''}" onclick="toggleLeetcodeToday()">${done ? 'Completed ✓' : 'Mark Complete'}</button>
      <button class="pill" onclick="openLeetcodeEdit()">Details</button>
    </div>`;
  } else if (lc.note) {
    row += `<div style="font-size:0.65rem;color:var(--text3);margin-top:4px">${esc(lc.note)}</div>`;
  }
  row += `</div>`;
  return row;
}

// ── HISTORY: read-only recap block ───────────────────────
function renderCommitmentsHistoryBlock(commitments) {
  if (!commitments || !commitmentsHasActivity(commitments)) return '';
  let html = `<div class="sec-hdr"><span class="sec-title">Daily Commitments</span></div><div class="card">`;
  ['walkingSteps', 'istighfar', 'duaQunut', 'durood', 'githubPushes'].forEach((key) => {
    const meta = COMMITMENT_META[key];
    const value = commitments[key];
    if (value <= 0) return;
    const target = COMMITMENT_TARGETS[key];
    const done = value >= target;
    html += `<div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:5px 0"><span>${meta.icon} ${esc(meta.label)}</span><span style="color:var(--text2)">${fmtCount(value)} / ${fmtCount(target)}${meta.unit ? ' ' + meta.unit : ''}${done ? ' ✓' : ''}</span></div>`;
  });
  if (commitments.leetcode.completed) {
    html += `<div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:5px 0"><span>💻 LeetCode${commitments.leetcode.problemName ? ' — ' + esc(commitments.leetcode.problemName) : ''}</span><span style="color:var(--green)">1 / 1 ✓</span></div>`;
  }
  html += `</div>`;
  return html;
}

// ── WEEKLY: lightweight summary card ─────────────────────
function renderCommitmentsWeeklySection(totals) {
  let html = `<div class="sec-hdr"><span class="sec-title">Daily Commitments — This Week</span></div><div class="card">`;
  const rows = [
    ['walkingSteps', totals.walkingSteps, COMMITMENT_WEEKLY_TARGETS.walkingSteps, 'steps'],
    ['istighfar', totals.istighfar, COMMITMENT_WEEKLY_TARGETS.istighfar, ''],
    ['duaQunut', totals.duaQunut, COMMITMENT_WEEKLY_TARGETS.duaQunut, ''],
    ['durood', totals.durood, COMMITMENT_WEEKLY_TARGETS.durood, ''],
    ['githubPushes', totals.githubPushes, COMMITMENT_WEEKLY_TARGETS.githubPushes, 'pushes'],
  ];
  rows.forEach(([key, val, target, unit]) => {
    const meta = COMMITMENT_META[key];
    html += `<div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:4px 0"><span>${meta.icon} ${esc(meta.label)}</span><span style="color:var(--text2)">${fmtCount(val)} / ${fmtCount(target)}${unit ? ' ' + unit : ''}</span></div>`;
  });
  html += `<div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:4px 0"><span>💻 LeetCode</span><span style="color:var(--text2)">${totals.leetcodeDays} / ${COMMITMENT_WEEKLY_TARGETS.leetcodeDays} days</span></div>`;
  html += `</div>`;
  return html;
}
