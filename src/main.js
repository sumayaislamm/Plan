// ═══════════════════════════════════════════════════════
// MAIN — app state, init, wiring
// ═══════════════════════════════════════════════════════
const APP = {
  missions: [], log: null, prayerTimes: null, momentumSeries: [],
  ielts: null, projects: [], jobs: [], timeEntries: [],
  todayKey: getDateKey(new Date()), viewingKey: getDateKey(new Date()),
  currentView: 'today', weekStart: null, weekLogs: [], weekProgress: {}, balance: {},
  lastNextAction: null,
  focusAction: null, focusTimer: null, focusTargetSeconds: 0, focusStartedAt: 0,
  focusPausedAccumMs: 0, focusPausedAt: null,
  currentProjectId: null, reviewYearMonth: null,
  editingEntryId: null, saving: false,
};

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function toggleTheme() {
  const html = document.documentElement, isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-btn').textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
}
// Prevents duplicate submissions from rapid double-taps on Add/Save buttons.
async function withSaveLock(fn) {
  if (APP.saving) return;
  APP.saving = true;
  try { await fn(); } finally { APP.saving = false; }
}

// ── DATA REFRESH ───────────────────────────────────────
async function refreshCore() {
  APP.missions = await loadMissions();
  APP.log = await loadLog(APP.viewingKey);
  APP.prayerTimes = await fetchPrayerTimes(APP.viewingKey);
  APP.timeEntries = await loadAllTimeEntries();
  APP.jobs = await loadJobs();
  APP.weekStart = weekStartKey(new Date(APP.viewingKey + 'T00:00:00'));
  APP.weekLogs = await loadWeekLogs(APP.weekStart);
  APP.weekProgress = {};
  APP.missions.forEach((m) => { APP.weekProgress[m.id] = weeklyProgress(m, APP.weekStart, APP.weekLogs, APP.timeEntries, APP.jobs); });
  APP.balance = lifeBalance(APP.missions, APP.weekStart, APP.weekLogs, APP.timeEntries, APP.jobs);
  // Deterministic full rebuild — same canonical logs always produce the same series,
  // regardless of how many times this runs or in what order days were edited.
  APP.momentumSeries = await rebuildMomentumSeries(APP.missions, APP.todayKey);
}
async function refreshIelts() { APP.ielts = await loadIelts(); }
async function refreshProjects() { APP.projects = await loadProjects(); }

function currentState() {
  const isToday = APP.viewingKey === APP.todayKey;
  const weeklyRemaining = {}; Object.entries(APP.weekProgress).forEach(([k, v]) => weeklyRemaining[k] = v.remaining);
  const nextAction = isToday ? nextBestAction({
    missions: APP.missions, log: APP.log, energy: APP.log.energy || 'normal',
    recoveryActive: APP.log.recoveryActive, prayerTimes: APP.prayerTimes, weeklyRemaining,
    timeEntries: APP.timeEntries, jobs: APP.jobs,
  }) : null;
  APP.lastNextAction = isToday ? nextAction : null;
  return {
    missions: APP.missions, log: APP.log, prayerTimes: APP.prayerTimes,
    momentum: { score: currentMomentum(APP.momentumSeries), trend: momentumTrend(APP.momentumSeries) },
    nextAction: isToday ? nextAction : null, weeklyRemaining, balance: APP.balance,
    viewingKey: APP.viewingKey, isPast: APP.viewingKey < APP.todayKey,
    weekProgress: APP.weekProgress, weekStart: APP.weekStart, timeEntries: APP.timeEntries,
  };
}

// ── VIEW SWITCHING ──────────────────────────────────────
async function switchView(view, btn) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.tabbtn').forEach((t) => t.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  if (btn) btn.classList.add('active'); else { const b = document.querySelector(`.tabbtn[data-view="${view}"]`); if (b) b.classList.add('active'); }
  APP.currentView = view;
  document.getElementById('nav-title').textContent = { today:'Today', missions:'Missions', ielts:'IELTS', programming:'Programming', jobs:'Jobs', weekly:'This Week', history:'History', review:'Monthly Review' }[view] || 'Life OS';
  await renderCurrentView();
}
function switchViewByName(view) { switchView(view, document.querySelector(`.tabbtn[data-view="${view}"]`)); }

async function renderCurrentView() {
  const view = APP.currentView;
  if (view === 'today') {
    document.getElementById('view-today').innerHTML = renderToday(currentState());
  } else if (view === 'missions') {
    document.getElementById('view-missions').innerHTML = renderMissions(currentState());
  } else if (view === 'ielts') {
    if (!APP.ielts) await refreshIelts();
    const wa = ieltsWeeklyAnalytics(APP.ielts, APP.weekStart, APP.timeEntries);
    document.getElementById('view-ielts').innerHTML = renderIelts({ ielts: APP.ielts, weeklyAnalytics: wa });
  } else if (view === 'programming') {
    if (!APP.projects.length) await refreshProjects();
    document.getElementById('view-programming').innerHTML = renderProgramming({ projects: APP.projects, weekStart: APP.weekStart, timeEntries: APP.timeEntries });
  } else if (view === 'jobs') {
    document.getElementById('view-jobs').innerHTML = renderJobs({ jobs: APP.jobs, weekStart: APP.weekStart });
  } else if (view === 'weekly') {
    document.getElementById('view-weekly').innerHTML = renderWeekly(currentState());
  } else if (view === 'history') {
    document.getElementById('view-history').innerHTML = renderHistory(currentState());
    const keys = await allLogKeys();
    const logsById = {}; for (const k of keys) logsById[k] = await loadLog(k);
    document.getElementById('hist-list').innerHTML = renderHistoryList(keys, logsById, APP.missions, APP.timeEntries);
  } else if (view === 'review') {
    APP.reviewYearMonth = APP.reviewYearMonth || APP.todayKey.slice(0, 7);
    const monthly = await monthlyReview(APP.reviewYearMonth, APP.missions);
    document.getElementById('view-review').innerHTML = renderReview({ monthly, yearMonth: APP.reviewYearMonth });
  }
}

// ── TODAY ACTIONS ───────────────────────────────────────
async function setEnergy(level) {
  APP.log.energy = level;
  if (APP.log.energyScore == null) APP.log.energyScore = defaultEnergyScore(level);
  if (level !== 'low') { APP.log.recoveryActive = false; }
  await saveLog(APP.viewingKey, APP.log);
  await afterLogChange();
}
async function toggleRecovery(on) {
  if (on) { openRecoveryPicker(); return; }
  APP.log.recoveryActive = false; APP.log.recoveryReason = null;
  await saveLog(APP.viewingKey, APP.log); await afterLogChange();
}
function openRecoveryPicker() {
  const options = RECOVERY_REASONS.map((r) => `<button class="pill" onclick="confirmRecovery('${escAttr(r)}')">${esc(r)}</button>`).join('');
  openModal(`<div class="modal-handle"></div><div class="modal-title">What's going on today?</div>
    <div class="pill-row">${options}</div>
    <div style="font-size:0.65rem;color:var(--text3);margin-top:12px;line-height:1.5">This just switches today to essentials-only. Nothing missed becomes debt.</div>`);
}
async function confirmRecovery(reason) {
  APP.log.recoveryActive = true; APP.log.recoveryReason = reason; APP.log.energy = 'low';
  APP.log.energyScore = defaultEnergyScore('low');
  await saveLog(APP.viewingKey, APP.log); closeModal(); await afterLogChange();
  showToast('🌊 Recovery Mode on — essentials only today');
}
async function togglePrayerToday(k) {
  togglePrayer(APP.log, k);
  await saveLog(APP.viewingKey, APP.log);
  await afterLogChange();
  showToast(APP.log.prayers[k] ? `🕌 Alhamdulillah` : 'Unchecked');
}
// Quick action: COUNT-type missions get a real +1; TIME-type missions get a
// pure "minimum acknowledged" flag that never fabricates worked minutes.
async function quickAction(missionId) {
  const m = missionById(APP.missions, missionId);
  if (m.type === 'count') {
    const already = APP.log.progress[missionId] || 0;
    if (already >= m.levels.minimum) { APP.log.progress[missionId] = 0; }
    else addCountProgress(APP.log, missionId, 1, 'minimum');
  } else {
    toggleQuickMin(APP.log, missionId); // never touches progress/time entries
  }
  await saveLog(APP.viewingKey, APP.log);
  await afterLogChange();
}
async function afterLogChange() {
  await refreshCore();
  await renderCurrentView();
}
function goToday() { APP.viewingKey = APP.todayKey; refreshCore().then(renderCurrentView); }

// ── MIDNIGHT / DATE ROLLOVER ────────────────────────────
function checkDateRollover() {
  const nowKey = getDateKey(new Date());
  if (nowKey !== APP.todayKey) {
    const wasViewingToday = APP.viewingKey === APP.todayKey;
    APP.todayKey = nowKey;
    if (wasViewingToday) APP.viewingKey = nowKey; // only follow if they were on "today", never yank them off a history view
    refreshCore().then(renderCurrentView);
  }
}
setInterval(checkDateRollover, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDateRollover(); });

// ── FOCUS MODE (absolute-timestamp based — accurate through backgrounding) ─
function startFocusFromAction() { if (APP.lastNextAction) startFocus(APP.lastNextAction); }
function startFocus(action) {
  APP.focusAction = action;
  const overlay = document.getElementById('focus-overlay');
  overlay.classList.add('open');
  clearInterval(APP.focusTimer);
  APP.focusPausedAccumMs = 0; APP.focusPausedAt = null;
  const body = document.getElementById('focus-body');
  if (action.minutes) {
    APP.focusTargetSeconds = Math.round(action.minutes * 60);
    APP.focusStartedAt = Date.now();
    body.innerHTML = `
      <div class="focus-mission">${esc(action.category || '')}</div>
      <div class="focus-task">${esc(action.name)}</div>
      <div class="focus-obj">${esc(action.meta)}</div>
      <div class="focus-timer" id="focus-clock">${fmtClock(APP.focusTargetSeconds)}</div>
      <div class="focus-btns">
        <button class="btn block" id="focus-pause" onclick="togglePauseFocus()">Pause</button>
        <button class="btn primary block" onclick="completeFocus()">Complete</button>
      </div>`;
    APP.focusTimer = setInterval(tickFocusClock, 250);
    tickFocusClock();
  } else {
    body.innerHTML = `
      <div class="focus-mission">${esc(action.category || '')}</div>
      <div class="focus-task">${esc(action.name)}</div>
      <div class="focus-obj">${esc(action.meta)}</div>
      <div class="focus-btns"><button class="btn primary block" onclick="completeFocus()">Mark Complete</button></div>`;
  }
}
function elapsedFocusSeconds() {
  const pausedMs = APP.focusPausedAccumMs + (APP.focusPausedAt ? (Date.now() - APP.focusPausedAt) : 0);
  return Math.max(0, Math.floor((Date.now() - APP.focusStartedAt - pausedMs) / 1000));
}
function tickFocusClock() {
  const remaining = Math.max(0, APP.focusTargetSeconds - elapsedFocusSeconds());
  const el = document.getElementById('focus-clock'); if (el) el.textContent = fmtClock(remaining);
}
function togglePauseFocus() {
  if (APP.focusPausedAt) { APP.focusPausedAccumMs += Date.now() - APP.focusPausedAt; APP.focusPausedAt = null; }
  else { APP.focusPausedAt = Date.now(); }
  document.getElementById('focus-pause').textContent = APP.focusPausedAt ? 'Resume' : 'Pause';
}
function fmtClock(s) { const m = Math.floor(s / 60), ss = s % 60; return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function closeFocus() { clearInterval(APP.focusTimer); document.getElementById('focus-overlay').classList.remove('open'); APP.focusAction = null; }

async function completeFocus() {
  clearInterval(APP.focusTimer);
  const action = APP.focusAction;
  if (!action) return;
  if (action.kind === 'prayer') {
    const key = action.name.split(' ')[0].toLowerCase();
    APP.log.prayers[key] = true;
    await saveLog(APP.viewingKey, APP.log);
  } else if (action.minutes) {
    // Actual elapsed time (capped to the target — the timer counts down, so it
    // can't exceed it), never a fabricated full-target amount if finished early.
    const elapsedMin = Math.min(action.minutes, Math.round((elapsedFocusSeconds() / 60) * 10) / 10) || action.minutes;
    const { list } = addTimeEntry(APP.timeEntries, {
      date: APP.viewingKey, category: action.missionId, minutes: elapsedMin,
      source: 'focus', note: action.name,
    });
    APP.timeEntries = list;
    await saveAllTimeEntries(APP.timeEntries);
  } else if (action.count) {
    addCountProgress(APP.log, action.missionId, action.count, action.level);
    await saveLog(APP.viewingKey, APP.log);
  }
  const body = document.getElementById('focus-body');
  body.innerHTML = `<div class="focus-complete"><div class="fc-check">✓</div><div class="fc-title">Done</div>
    <div class="fc-sub">You showed up today.</div><div class="fc-xp">+10 XP · ${esc(action.name)} logged</div>
    <button class="btn primary" style="margin-top:20px" onclick="closeFocus()">Continue</button></div>`;
  await refreshCore(); await renderCurrentView();
}

// ── WORK LOG (manual entries into the canonical timeEntries store) ─────
function openAddTime() {
  if (APP.viewingKey !== APP.todayKey) { showToast('Historical days are read-only'); return; }
  const opts = TIME_ENTRY_CATEGORIES.map((c) => `<option value="${c}">${esc(missionLabelById(c))}</option>`).join('');
  openModal(`<div class="modal-handle"></div><div class="modal-title">Log Work</div>
    <div class="field"><label>What did you do?</label><input type="text" id="at-note" placeholder="e.g. Writing Task 2 practice"/></div>
    <div class="field"><label>Category</label><select id="at-cat">${opts}</select></div>
    <div class="field"><label>Time spent (minutes)</label><input type="number" id="at-min" min="1" max="${TIME_ENTRY_MAX_MINUTES}" placeholder="45"/></div>
    <div id="at-err" style="font-size:0.65rem;color:var(--red);display:none;margin-bottom:8px"></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveAddTime()">Save</button></div>`);
}
async function saveAddTime() {
  await withSaveLock(async () => {
    const category = document.getElementById('at-cat').value;
    const minutesRaw = document.getElementById('at-min').value;
    const note = document.getElementById('at-note').value.trim();
    const { list, entry, error } = addTimeEntry(APP.timeEntries, { date: APP.viewingKey, category, minutes: minutesRaw, source: 'manual', note });
    if (error) { const e = document.getElementById('at-err'); e.textContent = error === 'Invalid duration' ? 'Enter a duration greater than 0 (and under 12h).' : error; e.style.display = 'block'; return; }
    APP.timeEntries = list;
    await saveAllTimeEntries(APP.timeEntries);
    closeModal(); await refreshCore(); await renderCurrentView();
    showToast(`+${entry.minutes}m logged`);
  });
}
function editTimeEntry(id) {
  const e = APP.timeEntries.find((x) => x.id === id); if (!e) return;
  APP.editingEntryId = id;
  openModal(`<div class="modal-handle"></div><div class="modal-title">Edit Entry</div>
    <div class="field"><label>What did you do?</label><input type="text" id="et-note" value="${escAttr(e.note || '')}"/></div>
    <div class="field"><label>Minutes</label><input type="number" id="et-min" min="1" max="${TIME_ENTRY_MAX_MINUTES}" value="${e.minutes}"/></div>
    <div id="et-err" style="font-size:0.65rem;color:var(--red);display:none;margin-bottom:8px"></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveEditTimeEntry()">Save</button></div>`);
}
async function saveEditTimeEntry() {
  await withSaveLock(async () => {
    const minutes = document.getElementById('et-min').value;
    const note = document.getElementById('et-note').value;
    const { list, error } = updateTimeEntry(APP.timeEntries, APP.editingEntryId, { minutes, note });
    if (error) { const e = document.getElementById('et-err'); e.textContent = 'Enter a duration greater than 0 (and under 12h).'; e.style.display = 'block'; return; }
    APP.timeEntries = list;
    await saveAllTimeEntries(APP.timeEntries);
    closeModal();
    await refreshCore();       // recomputes mission actual time, weekly totals, and rebuilds momentum
    await renderCurrentView(); // Today's Work Log re-renders inline with the updated entry — no separate view to reopen
  });
}
function deleteTimeEntryPrompt(id) {
  const e = APP.timeEntries.find((x) => x.id === id); if (!e) return;
  openModal(`<div class="modal-handle"></div><div class="modal-title">Delete this entry?</div>
    <div style="font-size:0.75rem;color:var(--text2);margin-bottom:14px">${esc(e.note || missionLabelById(e.category))} — ${fmtMin(e.minutes)} (${sourceLabel(e.source)}) will be removed. Other entries are unaffected.</div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" style="background:var(--red)" onclick="confirmDeleteTimeEntry('${id}')">Delete</button></div>`);
}
async function confirmDeleteTimeEntry(id) {
  APP.timeEntries = deleteTimeEntry(APP.timeEntries, id);
  await saveAllTimeEntries(APP.timeEntries);
  closeModal();
  await refreshCore();
  await renderCurrentView();
  showToast('Entry deleted');
}

// ── GENERIC MODAL ────────────────────────────────────────
function openModal(html) { document.getElementById('modal-sheet').innerHTML = html; document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }
function closeModalBg(e) { if (e.target === document.getElementById('modal')) closeModal(); }

// ── MISSION EDITOR ────────────────────────────────────────
function openMissionEditor(id) {
  const m = missionById(APP.missions, id);
  openModal(`<div class="modal-handle"></div><div class="modal-title">${esc(m.name)}</div>
    <div class="field"><label>Minimum (${m.type==='time'?'minutes':'count'})</label><input type="number" id="me-min" value="${m.levels.minimum}"/></div>
    <div class="field"><label>Standard</label><input type="number" id="me-std" value="${m.levels.standard}"/></div>
    <div class="field"><label>Stretch</label><input type="number" id="me-stretch" value="${m.levels.stretch}"/></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveMissionEdit('${id}')">Save</button></div>`);
}
async function saveMissionEdit(id) {
  const m = missionById(APP.missions, id);
  const min = Number(document.getElementById('me-min').value), std = Number(document.getElementById('me-std').value), str = Number(document.getElementById('me-stretch').value);
  m.levels.minimum = isFinite(min) && min >= 0 ? min : m.levels.minimum;
  m.levels.standard = isFinite(std) && std >= 0 ? std : m.levels.standard;
  m.levels.stretch = isFinite(str) && str >= 0 ? str : m.levels.stretch;
  await saveMissions(APP.missions);
  closeModal(); await refreshCore(); await renderCurrentView(); showToast('Saved');
}

// ── IELTS ACTIONS ────────────────────────────────────────
function openIeltsScoreEditor(skill) {
  openModal(`<div class="modal-handle"></div><div class="modal-title">Log ${esc(skill)} score</div>
    <div class="field"><label>Score (0–9)</label><input type="number" step="0.5" min="0" max="9" id="ielts-score" placeholder="e.g. 6.5"/></div>
    <div class="field"><label>Source</label><input type="text" id="ielts-source" placeholder="Mock test, practice set..."/></div>
    <div id="is-err" style="font-size:0.65rem;color:var(--red);display:none;margin-bottom:8px"></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveIeltsScore('${skill}')">Save</button></div>`);
}
async function saveIeltsScore(skill) {
  const score = document.getElementById('ielts-score').value;
  const source = document.getElementById('ielts-source').value;
  const ok = recordScore(APP.ielts, skill, score, source);
  if (!ok) { const e = document.getElementById('is-err'); e.textContent = 'Enter a valid score between 0 and 9.'; e.style.display = 'block'; return; }
  await saveIelts(APP.ielts); closeModal(); await renderCurrentView();
}
function openNewIeltsTask() {
  const opts = IELTS_TASK_TYPES.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  const skillOpts = IELTS_SKILLS.map((s) => `<option value="${s}">${s}</option>`).join('');
  openModal(`<div class="modal-handle"></div><div class="modal-title">New IELTS Task</div>
    <div class="field"><label>Type</label><select id="it-type">${opts}</select></div>
    <div class="field"><label>Skill</label><select id="it-skill">${skillOpts}</select></div>
    <div class="field"><label>Notes</label><textarea id="it-notes"></textarea></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveNewIeltsTask()">Add</button></div>`);
}
async function saveNewIeltsTask() {
  await withSaveLock(async () => {
    addIeltsTask(APP.ielts, { type: document.getElementById('it-type').value, skill: document.getElementById('it-skill').value, notes: document.getElementById('it-notes').value });
    await saveIelts(APP.ielts); closeModal(); await renderCurrentView();
  });
}
async function toggleIeltsTask(id) {
  const t = APP.ielts.tasks.find((x) => x.id === id); if (!t) return;
  t.status = t.status === 'done' ? 'planned' : 'done'; // task/output metric only — never touches time
  await saveIelts(APP.ielts); await renderCurrentView();
}

// ── PROGRAMMING ACTIONS ──────────────────────────────────
function openNewProject() {
  openModal(`<div class="modal-handle"></div><div class="modal-title">New Project</div>
    <div class="field"><label>Name</label><input type="text" id="np-name" placeholder="e.g. Project name"/></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveNewProject()">Create</button></div>`);
}
async function saveNewProject() {
  await withSaveLock(async () => {
    const name = document.getElementById('np-name').value.trim(); if (!name) return;
    APP.projects.push(newProject(name)); await saveProjects(APP.projects); closeModal(); await renderCurrentView();
  });
}
function openProjectDetail(id) {
  APP.currentProjectId = id;
  const p = APP.projects.find((x) => x.id === id); if (!p) return;
  openModal(`<div class="modal-handle"></div>${renderProjectDetail(p)}`);
}
function openNewFeature(pid) {
  openModal(`<div class="modal-handle"></div><div class="modal-title">New Feature</div>
    <div class="field"><label>Name</label><input type="text" id="nf-name"/></div>
    <div class="modal-btns"><button class="btn block" onclick="openProjectDetail('${pid}')">Cancel</button>
    <button class="btn primary block" onclick="saveNewFeature('${pid}')">Add</button></div>`);
}
async function saveNewFeature(pid) {
  await withSaveLock(async () => {
    const name = document.getElementById('nf-name').value.trim(); if (!name) return;
    const p = APP.projects.find((x) => x.id === pid); p.features.push(newFeature(name));
    await saveProjects(APP.projects); openProjectDetail(pid);
  });
}
function openNewTask(pid, fid) {
  openModal(`<div class="modal-handle"></div><div class="modal-title">New Task</div>
    <div class="field"><label>Name</label><input type="text" id="nt-name"/></div>
    <div class="modal-btns"><button class="btn block" onclick="openProjectDetail('${pid}')">Cancel</button>
    <button class="btn primary block" onclick="saveNewTask('${pid}','${fid}')">Add</button></div>`);
}
async function saveNewTask(pid, fid) {
  await withSaveLock(async () => {
    const name = document.getElementById('nt-name').value.trim(); if (!name) return;
    const p = APP.projects.find((x) => x.id === pid); const f = p.features.find((x) => x.id === fid);
    f.tasks.push(newTask(name)); await saveProjects(APP.projects); openProjectDetail(pid);
  });
}
// Task OUTPUT completion only — never adds fake minutes to Programming time.
// Toggling reverses exactly this one task's contribution via completedAt, and
// re-toggling the same task cannot compound (it's a single boolean flip).
async function toggleProjectTask(pid, fid, tid) {
  const p = APP.projects.find((x) => x.id === pid); const f = p.features.find((x) => x.id === fid);
  const t = f.tasks.find((x) => x.id === tid);
  if (t.status === 'done') { t.status = 'todo'; t.completedAt = null; }
  else { t.status = 'done'; t.completedAt = APP.todayKey; }
  await saveProjects(APP.projects);
  openProjectDetail(pid);
  await refreshCore();
  if (APP.currentView === 'programming') await renderCurrentView();
}

// ── JOBS ACTIONS ──────────────────────────────────────────
function openNewJob() {
  openModal(`<div class="modal-handle"></div><div class="modal-title">New Job</div>
    <div class="field"><label>Company</label><input type="text" id="nj-company"/></div>
    <div class="field"><label>Position</label><input type="text" id="nj-position"/></div>
    <div class="field"><label>URL</label><input type="text" id="nj-url" placeholder="https://..."/></div>
    <div id="nj-err" style="font-size:0.65rem;color:var(--red);display:none;margin-bottom:8px"></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveNewJob()">Add</button></div>`);
}
async function saveNewJob() {
  await withSaveLock(async () => {
    const company = document.getElementById('nj-company').value.trim(); if (!company) return;
    const urlRaw = document.getElementById('nj-url').value.trim();
    const url = validateUrl(urlRaw);
    if (url === null) { const e = document.getElementById('nj-err'); e.textContent = 'URL must start with http:// or https://'; e.style.display = 'block'; return; }
    APP.jobs.push(newJob({ company, position: document.getElementById('nj-position').value, url }));
    await saveJobs(APP.jobs); closeModal(); await refreshCore(); await renderCurrentView();
  });
}
function openJobDetail(id) {
  const j = APP.jobs.find((x) => x.id === id); if (!j) return;
  const statusOpts = JOB_STATUSES.map((s) => `<option value="${s}" ${j.status===s?'selected':''}>${s}</option>`).join('');
  openModal(`<div class="modal-handle"></div><div class="modal-title">${esc(j.company)} — ${esc(j.position)}</div>
    <div class="field"><label>Status</label><select id="jd-status">${statusOpts}</select></div>
    <div class="field"><label>Date applied</label><input type="date" id="jd-date" value="${j.dateApplied||''}"/></div>
    <div class="field"><label>Notes</label><textarea id="jd-notes">${esc(j.notes||'')}</textarea></div>
    <div class="field"><label>Follow-up date</label><input type="date" id="jd-followup" value="${j.followUpDate||''}"/></div>
    <div id="jd-err" style="font-size:0.65rem;color:var(--red);display:none;margin-bottom:8px"></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Close</button>
    <button class="btn primary block" onclick="saveJobDetail('${id}')">Save</button></div>`);
}
async function saveJobDetail(id) {
  const j = APP.jobs.find((x) => x.id === id); if (!j) return;
  const newStatus = document.getElementById('jd-status').value;
  // Empty string is a legitimate, intentional "clear the date" value — never fall back to the old one.
  let dateApplied = document.getElementById('jd-date').value || null;
  if (isApplicationStatus(newStatus) && !dateApplied) dateApplied = APP.todayKey; // sensible default so "Applied" always has a real application date
  j.status = newStatus;
  j.dateApplied = dateApplied;
  j.notes = document.getElementById('jd-notes').value;
  j.followUpDate = document.getElementById('jd-followup').value || null;
  await saveJobs(APP.jobs); closeModal(); await refreshCore(); await renderCurrentView(); showToast('Saved');
}

// ── HISTORY ────────────────────────────────────────────
function viewHistoryDay(k) { APP.viewingKey = k; switchViewByName('today'); }

// ── DAILY REVIEW ─────────────────────────────────────────
function openDailyReview() {
  openModal(`<div class="modal-handle"></div><div class="modal-title">Daily Review</div>
    <div class="review-q"><label>What did I accomplish today?</label><textarea id="dr-acc">${esc(APP.log.reflection.accomplished||'')}</textarea></div>
    <div class="review-q"><label>What blocked me?</label><textarea id="dr-block">${esc(APP.log.reflection.blocker||'')}</textarea></div>
    <div class="review-q"><label>Tomorrow's ONE most important action</label><textarea id="dr-focus">${esc(APP.log.reflection.tomorrowFocus||'')}</textarea></div>
    <button class="btn primary block" onclick="saveDailyReview()">Save Review</button>`);
}
async function saveDailyReview() {
  APP.log.reflection.accomplished = document.getElementById('dr-acc').value;
  APP.log.reflection.blocker = document.getElementById('dr-block').value;
  APP.log.reflection.tomorrowFocus = document.getElementById('dr-focus').value;
  await saveLog(APP.viewingKey, APP.log); closeModal(); showToast('✦ Day saved — keep going');
}
async function saveMonthlyNotes() {
  await storeSet('monthlynotes_' + APP.reviewYearMonth, {
    improved: document.getElementById('rev-improved').value,
    stuck: document.getElementById('rev-stuck').value,
    change: document.getElementById('rev-change').value,
  });
  showToast('Saved');
}

// ── SETTINGS ─────────────────────────────────────────────
function openSettings() {
  const loc = getLocation();
  openModal(`<div class="modal-handle"></div><div class="modal-title">Settings</div>
    <div class="field"><label>Location for prayer times</label>
      <button class="btn block" onclick="useGeolocation()">📍 Use my current location</button>
      <div style="font-size:0.6rem;color:var(--text3);margin-top:5px">Current: ${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}</div></div>
    <div class="field"><label>Calculation method</label>
      <select id="set-method">
        <option value="1"${loc.method===1?' selected':''}>University of Islamic Sciences, Karachi</option>
        <option value="2"${loc.method===2?' selected':''}>ISNA</option>
        <option value="3"${loc.method===3?' selected':''}>Muslim World League</option>
        <option value="4"${loc.method===4?' selected':''}>Umm Al-Qura, Makkah</option>
        <option value="5"${loc.method===5?' selected':''}>Egyptian General Authority</option>
      </select></div>
    <div class="field"><label>Supabase URL (optional sync)</label><input type="text" id="set-sburl" value="${escAttr(SB_URL)}"/></div>
    <div class="field"><label>Supabase anon key</label><input type="text" id="set-sbkey" value="${escAttr(SB_KEY)}"/></div>
    <div style="font-size:0.6rem;color:var(--text3);margin-bottom:10px;line-height:1.5">Create table <code>los_kv</code> (key text primary key, value jsonb, updated_at timestamptz) in Supabase first. Only ever use the public anon key here — never a service-role key.</div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Close</button>
    <button class="btn primary block" onclick="saveSettings()">Save</button></div>`);
}
async function saveMethod() {
  const loc = getLocation();
  setLocation(loc.lat, loc.lng, Number(document.getElementById('set-method').value));
}
async function useGeolocation() { const ok = await requestGeolocation(); showToast(ok ? '📍 Location updated' : 'Could not get location'); if (ok) { await refreshCore(); await renderCurrentView(); } }
async function saveSettings() {
  await saveMethod();
  const url = document.getElementById('set-sburl').value.trim(), key = document.getElementById('set-sbkey').value.trim();
  if (url && key) { saveSupabaseConfig(url, key); const ok = await testSupabaseConnection(); setSyncDot(ok ? 'synced' : 'error'); showToast(ok ? '✅ Connected' : '⚠️ Could not connect — check URL/key/table'); }
  else showToast('Saved');
  closeModal(); await refreshCore(); await renderCurrentView();
}

// ── INIT ───────────────────────────────────────────────
async function init() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('theme-btn').textContent = savedTheme === 'dark' ? '🌙' : '☀️';

  if (syncEnabled) {
    setSyncDot('syncing');
    const ok = await testSupabaseConnection();
    setSyncDot(ok ? 'synced' : 'error');
    if (ok) await hydrateLocalCacheForPrefix('log_'); // fresh-device correctness: momentum's fast local walk needs this first
  } else setSyncDot('error');

  await refreshCore();
  await refreshIelts(); await refreshProjects();
  await switchView('today');
  document.getElementById('loading').classList.add('hidden');
  setTimeout(() => { document.getElementById('loading').style.display = 'none'; }, 400);
}
init();
