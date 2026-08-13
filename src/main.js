// ═══════════════════════════════════════════════════════
// MAIN — app state, init, wiring
// ═══════════════════════════════════════════════════════
const APP = {
  missions: [], log: null, prayerTimes: null, momentumSeries: [],
  ielts: null, projects: [], jobs: [],
  todayKey: getDateKey(new Date()), viewingKey: getDateKey(new Date()),
  currentView: 'today', weekStart: null, weekLogs: [], weekProgress: {}, balance: {},
  focusAction: null, focusTimer: null, focusSecondsLeft: 0, focusPaused: false,
  currentProjectId: null, reviewYearMonth: null,
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

// ── DATA REFRESH ───────────────────────────────────────
async function refreshCore() {
  APP.missions = await loadMissions();
  APP.log = await loadLog(APP.viewingKey);
  APP.prayerTimes = await fetchPrayerTimes(APP.viewingKey);
  APP.momentumSeries = await loadMomentumSeries();
  APP.weekStart = weekStartKey(new Date(APP.viewingKey + 'T00:00:00'));
  APP.weekLogs = await loadWeekLogs(APP.weekStart);
  APP.weekProgress = {};
  APP.missions.forEach((m) => { APP.weekProgress[m.id] = weeklyProgress(m, APP.weekLogs); });
  APP.balance = lifeBalance(APP.missions, APP.weekLogs);
}
async function refreshIelts() { APP.ielts = await loadIelts(); }
async function refreshProjects() { APP.projects = await loadProjects(); }
async function refreshJobs() { APP.jobs = await loadJobs(); }

function currentState() {
  const isToday = APP.viewingKey === APP.todayKey;
  const weeklyRemaining = {}; Object.entries(APP.weekProgress).forEach(([k, v]) => weeklyRemaining[k] = v.remaining);
  const nextAction = isToday && !APP.isPastComputed ? nextBestAction({
    missions: APP.missions, log: APP.log, energy: APP.log.energy || 'normal',
    recoveryActive: APP.log.recoveryActive, prayerTimes: APP.prayerTimes, weeklyRemaining,
  }) : null;
  return {
    missions: APP.missions, log: APP.log, prayerTimes: APP.prayerTimes,
    momentum: { score: currentMomentum(APP.momentumSeries), trend: momentumTrend(APP.momentumSeries) },
    nextAction, weeklyRemaining, balance: APP.balance,
    viewingKey: APP.viewingKey, isPast: APP.viewingKey < APP.todayKey,
    weekProgress: APP.weekProgress, weekStart: APP.weekStart,
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
    const wa = ieltsWeeklyAnalytics(APP.ielts, APP.weekLogs);
    document.getElementById('view-ielts').innerHTML = renderIelts({ ielts: APP.ielts, weeklyAnalytics: wa });
  } else if (view === 'programming') {
    if (!APP.projects.length) await refreshProjects();
    document.getElementById('view-programming').innerHTML = renderProgramming({ projects: APP.projects });
  } else if (view === 'jobs') {
    if (!APP.jobs.length) await refreshJobs();
    document.getElementById('view-jobs').innerHTML = renderJobs({ jobs: APP.jobs, weekStart: APP.weekStart });
  } else if (view === 'weekly') {
    document.getElementById('view-weekly').innerHTML = renderWeekly(currentState());
  } else if (view === 'history') {
    document.getElementById('view-history').innerHTML = renderHistory(currentState());
    const keys = await allLogKeys();
    const logsById = {}; for (const k of keys) logsById[k] = await loadLog(k);
    document.getElementById('hist-list').innerHTML = renderHistoryList(keys, logsById, APP.missions);
  } else if (view === 'review') {
    APP.reviewYearMonth = APP.reviewYearMonth || APP.todayKey.slice(0, 7);
    const monthly = await monthlyReview(APP.reviewYearMonth, APP.missions);
    document.getElementById('view-review').innerHTML = renderReview({ monthly, yearMonth: APP.reviewYearMonth });
  }
}

// ── TODAY ACTIONS ───────────────────────────────────────
async function setEnergy(level) {
  APP.log.energy = level;
  if (level !== 'low') { APP.log.recoveryActive = false; }
  await saveLog(APP.viewingKey, APP.log);
  await afterLogChange();
}
async function toggleRecovery(on) {
  if (on) { APP.pendingRecovery = true; openRecoveryPicker(); return; }
  APP.log.recoveryActive = false; APP.log.recoveryReason = null;
  await saveLog(APP.viewingKey, APP.log); await afterLogChange();
}
function openRecoveryPicker() {
  const options = RECOVERY_REASONS.map((r) => `<button class="pill" onclick="confirmRecovery('${r.replace(/'/g,"\\'")}')">${r}</button>`).join('');
  openModal(`<div class="modal-handle"></div><div class="modal-title">What's going on today?</div>
    <div class="pill-row">${options}</div>
    <div style="font-size:0.65rem;color:var(--text3);margin-top:12px;line-height:1.5">This just switches today to essentials-only. Nothing missed becomes debt.</div>`);
}
async function confirmRecovery(reason) {
  APP.log.recoveryActive = true; APP.log.recoveryReason = reason; APP.log.energy = 'low';
  await saveLog(APP.viewingKey, APP.log); closeModal(); await afterLogChange();
  showToast('🌊 Recovery Mode on — essentials only today');
}
async function togglePrayerToday(k) {
  togglePrayer(APP.log, k);
  await saveLog(APP.viewingKey, APP.log);
  await afterLogChange();
  showToast(APP.log.prayers[k] ? `🕌 Alhamdulillah` : 'Unchecked');
}
async function quickLogMinimum(missionId) {
  const m = missionById(APP.missions, missionId);
  const already = APP.log.progress[missionId] || 0;
  const min = m.levels.minimum || 1;
  if (already >= min) { APP.log.progress[missionId] = 0; } else { addProgress(APP.log, missionId, min, 'minimum'); }
  await saveLog(APP.viewingKey, APP.log);
  await afterLogChange();
}
async function afterLogChange() {
  await updateMomentum(APP.viewingKey, APP.log, APP.missions);
  await refreshCore();
  await renderCurrentView();
}
function goToday() { APP.viewingKey = APP.todayKey; refreshCore().then(renderCurrentView); }

// ── FOCUS MODE ───────────────────────────────────────────
function startFocus(action) {
  APP.focusAction = action;
  const overlay = document.getElementById('focus-overlay');
  overlay.classList.add('open');
  clearInterval(APP.focusTimer); APP.focusPaused = false;
  const body = document.getElementById('focus-body');
  if (action.minutes) {
    APP.focusSecondsLeft = action.minutes * 60;
    body.innerHTML = `
      <div class="focus-mission">${action.category || ''}</div>
      <div class="focus-task">${action.name}</div>
      <div class="focus-obj">${action.meta}</div>
      <div class="focus-timer" id="focus-clock">${fmtClock(APP.focusSecondsLeft)}</div>
      <div class="focus-btns">
        <button class="btn block" id="focus-pause" onclick="togglePauseFocus()">Pause</button>
        <button class="btn primary block" onclick="completeFocus()">Complete</button>
      </div>`;
    APP.focusTimer = setInterval(() => {
      if (APP.focusPaused) return;
      APP.focusSecondsLeft = Math.max(0, APP.focusSecondsLeft - 1);
      const el = document.getElementById('focus-clock'); if (el) el.textContent = fmtClock(APP.focusSecondsLeft);
    }, 1000);
  } else {
    body.innerHTML = `
      <div class="focus-mission">${action.category || ''}</div>
      <div class="focus-task">${action.name}</div>
      <div class="focus-obj">${action.meta}</div>
      <div class="focus-btns"><button class="btn primary block" onclick="completeFocus()">Mark Complete</button></div>`;
  }
}
function togglePauseFocus() {
  APP.focusPaused = !APP.focusPaused;
  document.getElementById('focus-pause').textContent = APP.focusPaused ? 'Resume' : 'Pause';
}
function fmtClock(s) { const m = Math.floor(s / 60), ss = s % 60; return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function closeFocus() { clearInterval(APP.focusTimer); document.getElementById('focus-overlay').classList.remove('open'); APP.focusAction = null; }

async function completeFocus() {
  clearInterval(APP.focusTimer);
  const action = APP.focusAction;
  if (action.kind === 'prayer') {
    const key = action.name.split(' ')[0].toLowerCase();
    APP.log.prayers[key] = true;
  } else if (action.minutes) {
    addProgress(APP.log, action.missionId, action.minutes, action.level);
  } else if (action.count) {
    addProgress(APP.log, action.missionId, action.count, action.level);
    if (action.missionId === 'job-apps') { /* encourage logging in Jobs tab too */ }
  }
  await saveLog(APP.viewingKey, APP.log);
  await updateMomentum(APP.viewingKey, APP.log, APP.missions);
  const body = document.getElementById('focus-body');
  body.innerHTML = `<div class="focus-complete"><div class="fc-check">✓</div><div class="fc-title">Done</div>
    <div class="fc-sub">You showed up today.</div><div class="fc-xp">+10 XP · ${action.name} logged</div>
    <button class="btn primary" style="margin-top:20px" onclick="closeFocus()">Continue</button></div>`;
  await refreshCore(); await renderCurrentView();
}

// ── GENERIC MODAL ────────────────────────────────────────
function openModal(html) { document.getElementById('modal-sheet').innerHTML = html; document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }
function closeModalBg(e) { if (e.target === document.getElementById('modal')) closeModal(); }

// ── MISSION EDITOR ────────────────────────────────────────
function openMissionEditor(id) {
  const m = missionById(APP.missions, id);
  openModal(`<div class="modal-handle"></div><div class="modal-title">${m.name}</div>
    <div class="field"><label>Minimum (${m.type==='time'?'minutes':'count'})</label><input type="number" id="me-min" value="${m.levels.minimum}"/></div>
    <div class="field"><label>Standard</label><input type="number" id="me-std" value="${m.levels.standard}"/></div>
    <div class="field"><label>Stretch</label><input type="number" id="me-stretch" value="${m.levels.stretch}"/></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveMissionEdit('${id}')">Save</button></div>`);
}
async function saveMissionEdit(id) {
  const m = missionById(APP.missions, id);
  m.levels.minimum = Number(document.getElementById('me-min').value) || 0;
  m.levels.standard = Number(document.getElementById('me-std').value) || 0;
  m.levels.stretch = Number(document.getElementById('me-stretch').value) || 0;
  await saveMissions(APP.missions);
  closeModal(); await refreshCore(); await renderCurrentView(); showToast('Saved');
}

// ── IELTS ACTIONS ────────────────────────────────────────
function openIeltsScoreEditor(skill) {
  openModal(`<div class="modal-handle"></div><div class="modal-title">Log ${skill} score</div>
    <div class="field"><label>Score</label><input type="number" step="0.5" id="ielts-score" placeholder="e.g. 6.5"/></div>
    <div class="field"><label>Source</label><input type="text" id="ielts-source" placeholder="Mock test, practice set..."/></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveIeltsScore('${skill}')">Save</button></div>`);
}
async function saveIeltsScore(skill) {
  const score = parseFloat(document.getElementById('ielts-score').value);
  const source = document.getElementById('ielts-source').value;
  if (!isNaN(score)) recordScore(APP.ielts, skill, score, source);
  await saveIelts(APP.ielts); closeModal(); await renderCurrentView();
}
function openNewIeltsTask() {
  const opts = IELTS_TASK_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('');
  const skillOpts = IELTS_SKILLS.map((s) => `<option value="${s}">${s}</option>`).join('');
  openModal(`<div class="modal-handle"></div><div class="modal-title">New IELTS Task</div>
    <div class="field"><label>Type</label><select id="it-type">${opts}</select></div>
    <div class="field"><label>Skill</label><select id="it-skill">${skillOpts}</select></div>
    <div class="field"><label>Notes</label><textarea id="it-notes"></textarea></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveNewIeltsTask()">Add</button></div>`);
}
async function saveNewIeltsTask() {
  addIeltsTask(APP.ielts, { type: document.getElementById('it-type').value, skill: document.getElementById('it-skill').value, notes: document.getElementById('it-notes').value });
  await saveIelts(APP.ielts); closeModal(); await renderCurrentView();
}
async function toggleIeltsTask(id) {
  const t = APP.ielts.tasks.find((x) => x.id === id);
  t.status = t.status === 'done' ? 'planned' : 'done';
  await saveIelts(APP.ielts); await renderCurrentView();
}

// ── PROGRAMMING ACTIONS ──────────────────────────────────
function openNewProject() {
  openModal(`<div class="modal-handle"></div><div class="modal-title">New Project</div>
    <div class="field"><label>Name</label><input type="text" id="np-name" placeholder="e.g. RentNest"/></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveNewProject()">Create</button></div>`);
}
async function saveNewProject() {
  const name = document.getElementById('np-name').value.trim(); if (!name) return;
  APP.projects.push(newProject(name)); await saveProjects(APP.projects); closeModal(); await renderCurrentView();
}
function openProjectDetail(id) {
  APP.currentProjectId = id;
  const p = APP.projects.find((x) => x.id === id);
  openModal(`<div class="modal-handle"></div>${renderProjectDetail(p)}`);
}
function openNewFeature(pid) {
  openModal(`<div class="modal-handle"></div><div class="modal-title">New Feature</div>
    <div class="field"><label>Name</label><input type="text" id="nf-name"/></div>
    <div class="modal-btns"><button class="btn block" onclick="openProjectDetail('${pid}')">Cancel</button>
    <button class="btn primary block" onclick="saveNewFeature('${pid}')">Add</button></div>`);
}
async function saveNewFeature(pid) {
  const name = document.getElementById('nf-name').value.trim(); if (!name) return;
  const p = APP.projects.find((x) => x.id === pid); p.features.push(newFeature(name));
  await saveProjects(APP.projects); openProjectDetail(pid);
}
function openNewTask(pid, fid) {
  openModal(`<div class="modal-handle"></div><div class="modal-title">New Task</div>
    <div class="field"><label>Name</label><input type="text" id="nt-name"/></div>
    <div class="modal-btns"><button class="btn block" onclick="openProjectDetail('${pid}')">Cancel</button>
    <button class="btn primary block" onclick="saveNewTask('${pid}','${fid}')">Add</button></div>`);
}
async function saveNewTask(pid, fid) {
  const name = document.getElementById('nt-name').value.trim(); if (!name) return;
  const p = APP.projects.find((x) => x.id === pid); const f = p.features.find((x) => x.id === fid);
  f.tasks.push(newTask(name)); await saveProjects(APP.projects); openProjectDetail(pid);
}
async function toggleProjectTask(pid, fid, tid) {
  const p = APP.projects.find((x) => x.id === pid); const f = p.features.find((x) => x.id === fid);
  const t = f.tasks.find((x) => x.id === tid); t.status = t.status === 'done' ? 'todo' : 'done';
  if (t.status === 'done') { addProgress(APP.log, 'programming', 0, 'standard'); /* logged separately via focus timer normally */ }
  await saveProjects(APP.projects); openProjectDetail(pid); refreshCore();
}

// ── JOBS ACTIONS ──────────────────────────────────────────
function openNewJob() {
  openModal(`<div class="modal-handle"></div><div class="modal-title">New Job</div>
    <div class="field"><label>Company</label><input type="text" id="nj-company"/></div>
    <div class="field"><label>Position</label><input type="text" id="nj-position"/></div>
    <div class="field"><label>URL</label><input type="text" id="nj-url"/></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveNewJob()">Add</button></div>`);
}
async function saveNewJob() {
  const company = document.getElementById('nj-company').value.trim(); if (!company) return;
  APP.jobs.push(newJob({ company, position: document.getElementById('nj-position').value, url: document.getElementById('nj-url').value }));
  await saveJobs(APP.jobs); closeModal(); await renderCurrentView();
}
function openJobDetail(id) {
  const j = APP.jobs.find((x) => x.id === id);
  const statusOpts = JOB_STATUSES.map((s) => `<option value="${s}" ${j.status===s?'selected':''}>${s}</option>`).join('');
  openModal(`<div class="modal-handle"></div><div class="modal-title">${j.company} — ${j.position}</div>
    <div class="field"><label>Status</label><select id="jd-status">${statusOpts}</select></div>
    <div class="field"><label>Date applied</label><input type="date" id="jd-date" value="${j.dateApplied||''}"/></div>
    <div class="field"><label>Notes</label><textarea id="jd-notes">${j.notes||''}</textarea></div>
    <div class="field"><label>Follow-up date</label><input type="date" id="jd-followup" value="${j.followUpDate||''}"/></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Close</button>
    <button class="btn primary block" onclick="saveJobDetail('${id}')">Save</button></div>`);
}
async function saveJobDetail(id) {
  const j = APP.jobs.find((x) => x.id === id);
  j.status = document.getElementById('jd-status').value;
  j.dateApplied = document.getElementById('jd-date').value || j.dateApplied;
  j.notes = document.getElementById('jd-notes').value;
  j.followUpDate = document.getElementById('jd-followup').value || null;
  await saveJobs(APP.jobs); closeModal(); await renderCurrentView(); showToast('Saved');
}

// ── HISTORY ────────────────────────────────────────────
function viewHistoryDay(k) { APP.viewingKey = k; switchViewByName('today'); }

// ── DAILY REVIEW ─────────────────────────────────────────
function openDailyReview() {
  openModal(`<div class="modal-handle"></div><div class="modal-title">Daily Review</div>
    <div class="review-q"><label>What did I accomplish today?</label><textarea id="dr-acc">${APP.log.reflection.accomplished||''}</textarea></div>
    <div class="review-q"><label>What blocked me?</label><textarea id="dr-block">${APP.log.reflection.blocker||''}</textarea></div>
    <div class="review-q"><label>Tomorrow's ONE most important action</label><textarea id="dr-focus">${APP.log.reflection.tomorrowFocus||''}</textarea></div>
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
  openModal(`<div class="modal-handle"></div><div class="modal-title">Settings</div>
    <div class="field"><label>Location for prayer times</label>
      <button class="btn block" onclick="useGeolocation()">📍 Use my current location</button></div>
    <div class="field"><label>Supabase URL (optional sync)</label><input type="text" id="set-sburl" value="${SB_URL}"/></div>
    <div class="field"><label>Supabase anon key</label><input type="text" id="set-sbkey" value="${SB_KEY}"/></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Close</button>
    <button class="btn primary block" onclick="saveSettings()">Connect & Sync</button></div>`);
}
async function useGeolocation() { const ok = await requestGeolocation(); showToast(ok ? '📍 Location updated' : 'Could not get location'); if (ok) { await refreshCore(); await renderCurrentView(); } }
async function saveSettings() {
  const url = document.getElementById('set-sburl').value.trim(), key = document.getElementById('set-sbkey').value.trim();
  if (url && key) { saveSupabaseConfig(url, key); const ok = await testSupabaseConnection(); setSyncDot(ok ? 'synced' : 'error'); showToast(ok ? '✅ Connected' : '⚠️ Could not connect'); }
  closeModal();
}

// ── INIT ───────────────────────────────────────────────
async function init() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('theme-btn').textContent = savedTheme === 'dark' ? '🌙' : '☀️';

  if (syncEnabled) { setSyncDot('syncing'); const ok = await testSupabaseConnection(); setSyncDot(ok ? 'synced' : 'error'); }
  else setSyncDot('error');

  await refreshCore();
  await refreshIelts(); await refreshProjects(); await refreshJobs();
  await switchView('today');
  document.getElementById('loading').classList.add('hidden');
  setTimeout(() => { document.getElementById('loading').style.display = 'none'; }, 400);
}
init();
