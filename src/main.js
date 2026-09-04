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
  editingEntryId: null, saving: false, analyticsPeriod: 'week', historyDetailDate: null,
  commitments: null, cookingEntries: [], cookingSearchQuery: '', editingCookingId: null,
  religiousJournalDetailDate: null,
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
  APP.commitments = await loadCommitments(APP.viewingKey);
  APP.cookingEntries = await loadCookingEntries();
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
  // Momentum AS IT WAS on the day being viewed, not always "today's" latest value —
  // the Today page is reused for read-only historical viewing, so this must track viewingKey.
  const momentumScore = isToday ? currentMomentum(APP.momentumSeries) : (momentumForDate(APP.momentumSeries, APP.viewingKey) ?? currentMomentum(APP.momentumSeries));
  return {
    missions: APP.missions, log: APP.log, prayerTimes: APP.prayerTimes,
    momentum: { score: momentumScore, trend: isToday ? momentumTrend(APP.momentumSeries) : 'steady' },
    nextAction: isToday ? nextAction : null, weeklyRemaining, balance: APP.balance,
    viewingKey: APP.viewingKey, isPast: APP.viewingKey < APP.todayKey,
    weekProgress: APP.weekProgress, weekStart: APP.weekStart, timeEntries: APP.timeEntries,
    analyticsPeriod: APP.analyticsPeriod, commitments: APP.commitments,
  };
}

// ── VIEW SWITCHING ──────────────────────────────────────
async function switchView(view, btn) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.tabbtn').forEach((t) => t.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  if (btn) btn.classList.add('active'); else { const b = document.querySelector(`.tabbtn[data-view="${view}"]`); if (b) b.classList.add('active'); }
  APP.currentView = view;
  document.getElementById('nav-title').textContent = { today:'Today', missions:'Missions', ielts:'IELTS', programming:'Programming', jobs:'Jobs', weekly:'This Week', history:'History', life:'Journal', review:'Monthly Review' }[view] || 'Life OS';
  await renderCurrentView();
}
function switchViewByName(view) { switchView(view, document.querySelector(`.tabbtn[data-view="${view}"]`)); }

// ── HISTORY DETAIL — gathers exactly one day's data (2 async calls: the log
// and that day's prayer times) and reuses the already-loaded in-memory
// timeEntries/projects/jobs/ielts/momentum arrays — no bulk history scan.
async function buildHistoryDetailHtml(date) {
  const log = await loadLog(date);
  const prayerTimesForDate = await fetchPrayerTimes(date);
  const taskActivity = tasksCompletedOnDate(APP.projects, date);
  const jobActivity = jobsAppliedOnDate(APP.jobs, date);
  const ieltsTaskActivity = ieltsTasksCompletedOnDate(APP.ielts, date);
  const featureActivity = featuresCompletedOnDate(APP.projects, date);
  const commitmentsForDate = await loadCommitments(date);
  const cookingForDate = cookingEntriesForDate(APP.cookingEntries, date);
  const religiousJournalForDate = await loadReligiousDay(date);
  const momentumScore = momentumForDate(APP.momentumSeries, date);
  const hasActivity = dayHasActivity(log, APP.timeEntries, date, APP.projects, APP.jobs, APP.ielts)
    || featureActivity.length > 0 || commitmentsHasActivity(commitmentsForDate)
    || cookingForDate.length > 0 || religiousDayHasActivity(religiousJournalForDate);
  const canGoNext = addDays(date, 1) < APP.todayKey;
  return renderHistoryDetail({
    date, log, prayerTimes: prayerTimesForDate, timeEntries: APP.timeEntries, missions: APP.missions,
    momentumScore, taskActivity, jobActivity, ieltsTaskActivity, featureActivity, commitments: commitmentsForDate,
    cookingEntries: cookingForDate, religiousJournalDay: religiousJournalForDate,
    hasActivity, canGoNext,
  });
}
function openHistoryDetail(date) { APP.historyDetailDate = date; renderCurrentView(); }
function closeHistoryDetail() { APP.historyDetailDate = null; renderCurrentView(); }
function historyPrevDay() { openHistoryDetail(addDays(APP.historyDetailDate, -1)); }
function historyNextDay() { const n = addDays(APP.historyDetailDate, 1); if (n < APP.todayKey) openHistoryDetail(n); }

// Pure display-filter change — no refetch, just re-renders Weekly with the
// already-loaded APP.timeEntries filtered to a different date range.
function setAnalyticsPeriod(period) {
  APP.analyticsPeriod = period;
  if (APP.currentView === 'weekly') renderCurrentView();
}

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
    const commitTotals = await weeklyCommitmentTotals(APP.weekStart);
    document.getElementById('view-weekly').innerHTML += renderCommitmentsWeeklySection(commitTotals);
  } else if (view === 'history') {
    if (APP.historyDetailDate) {
      document.getElementById('view-history').innerHTML = await buildHistoryDetailHtml(APP.historyDetailDate);
    } else {
      document.getElementById('view-history').innerHTML = renderHistory(currentState());
      let keys = mergeActivityDates(await allLogKeys(), APP.timeEntries, APP.jobs, APP.projects, APP.ielts);
      const commitDates = await allCommitmentDates();
      const featureDates = []; APP.projects.forEach((p) => p.features.forEach((f) => { if (f.completedAt) featureDates.push(f.completedAt); }));
      const cookingDates = allCookingDates(APP.cookingEntries);
      const religiousJournalDates = await allReligiousJournalDates();
      keys = [...new Set([...keys, ...commitDates, ...featureDates, ...cookingDates, ...religiousJournalDates])].sort((a, b) => b.localeCompare(a));
      const logsById = {}; for (const k of keys) logsById[k] = await loadLog(k);
      document.getElementById('hist-list').innerHTML = renderHistoryList(keys, logsById, APP.missions, APP.timeEntries);
    }
  } else if (view === 'life') {
    document.getElementById('view-life').innerHTML = await buildLifeHtml();
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
// Period-day exemption — independent of prayer completion state. Only ever
// editable on the current day (readonly gating in renderPrayerStrip already
// hides this control for historical dates, same rule as prayer toggling).
async function togglePeriodDay() {
  togglePeriodDayFlag(APP.log);
  await saveLog(APP.viewingKey, APP.log);
  await afterLogChange();
  showToast(APP.log.periodDay ? '🩸 Period day — prayers exempt' : 'Period day ended');
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
  if (t.status === 'done') { t.status = 'planned'; t.completedAt = null; }
  else { t.status = 'done'; t.completedAt = APP.todayKey; } // task/output metric only — never touches time
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
// ── DAILY COMMITMENTS (isolated — steps/dhikr/LeetCode/GitHub) ─────────
async function commitmentIncrement(key, amount) {
  if (APP.viewingKey !== APP.todayKey) { showToast('Historical days are read-only'); return; }
  await withSaveLock(async () => {
    APP.commitments[key] = Math.max(0, (APP.commitments[key] || 0) + amount);
    await saveCommitments(APP.viewingKey, APP.commitments);
    await renderCurrentView();
  });
}
function openCommitmentEdit(key) {
  const meta = COMMITMENT_META[key];
  openModal(`<div class="modal-handle"></div><div class="modal-title">Edit ${esc(meta.label)}</div>
    <div class="field"><label>${esc(meta.label)}${meta.unit ? ' (' + meta.unit + ')' : ''}</label><input type="number" min="0" id="ce-val" value="${APP.commitments[key]}"/></div>
    <div id="ce-err" style="font-size:0.65rem;color:var(--red);display:none;margin-bottom:8px"></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveCommitmentEdit('${key}')">Save</button></div>`);
}
async function saveCommitmentEdit(key) {
  await withSaveLock(async () => {
    const v = Number(document.getElementById('ce-val').value);
    if (!isFinite(v) || v < 0) { const e = document.getElementById('ce-err'); e.textContent = 'Enter a number 0 or greater.'; e.style.display = 'block'; return; }
    APP.commitments[key] = v;
    await saveCommitments(APP.viewingKey, APP.commitments);
    closeModal(); await renderCurrentView();
  });
}
async function toggleLeetcodeToday() {
  if (APP.viewingKey !== APP.todayKey) { showToast('Historical days are read-only'); return; }
  await withSaveLock(async () => {
    APP.commitments.leetcode.completed = !APP.commitments.leetcode.completed; // completion only — never touches programming time
    await saveCommitments(APP.viewingKey, APP.commitments);
    await renderCurrentView();
  });
}
function openLeetcodeEdit() {
  const lc = APP.commitments.leetcode;
  openModal(`<div class="modal-handle"></div><div class="modal-title">LeetCode Details</div>
    <div class="field"><label>Problem name</label><input type="text" id="lc-name" value="${escAttr(lc.problemName)}"/></div>
    <div class="field"><label>URL</label><input type="text" id="lc-url" value="${escAttr(lc.url)}" placeholder="https://..."/></div>
    <div class="field"><label>Note</label><input type="text" id="lc-note" value="${escAttr(lc.note)}"/></div>
    <div id="lc-err" style="font-size:0.65rem;color:var(--red);display:none;margin-bottom:8px"></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="saveLeetcodeEdit()">Save</button></div>`);
}
async function saveLeetcodeEdit() {
  await withSaveLock(async () => {
    const url = document.getElementById('lc-url').value.trim();
    const validated = validateUrl(url);
    if (validated === null) { const e = document.getElementById('lc-err'); e.textContent = 'URL must start with http:// or https://'; e.style.display = 'block'; return; }
    APP.commitments.leetcode.problemName = document.getElementById('lc-name').value.trim();
    APP.commitments.leetcode.url = validated;
    APP.commitments.leetcode.note = document.getElementById('lc-note').value.trim();
    await saveCommitments(APP.viewingKey, APP.commitments);
    closeModal(); await renderCurrentView();
  });
}

// ── RELIGIOUS TAB (isolated — read-only; editing happens on Today) ─────
// ── PROJECT ROADMAP (isolated — feature planned/completed status) ──────
async function toggleFeatureCompletion(pid, fid) {
  const p = APP.projects.find((x) => x.id === pid); const f = p.features.find((x) => x.id === fid);
  toggleFeatureStatus(f, APP.todayKey);
  await saveProjects(APP.projects);
  openProjectDetail(pid);
  if (APP.currentView === 'programming') await renderCurrentView();
}
function openEditFeature(pid, fid) {
  const p = APP.projects.find((x) => x.id === pid); const f = p.features.find((x) => x.id === fid);
  openModal(`<div class="modal-handle"></div><div class="modal-title">Edit Feature</div>
    <div class="field"><label>Name</label><input type="text" id="ef-name" value="${escAttr(f.name)}"/></div>
    <div class="modal-btns"><button class="btn block" onclick="openProjectDetail('${pid}')">Cancel</button>
    <button class="btn primary block" onclick="saveEditFeature('${pid}','${fid}')">Save</button></div>`);
}
async function saveEditFeature(pid, fid) {
  await withSaveLock(async () => {
    const p = APP.projects.find((x) => x.id === pid); const f = p.features.find((x) => x.id === fid);
    const ok = renameFeature(f, document.getElementById('ef-name').value);
    if (!ok) return; // empty name — leave existing name untouched, just close back to the project
    await saveProjects(APP.projects);
    openProjectDetail(pid);
  });
}
function confirmDeleteFeature(pid, fid) {
  const p = APP.projects.find((x) => x.id === pid); const f = p.features.find((x) => x.id === fid);
  if (!f.tasks.length) { executeDeleteFeature(pid, fid); return; } // no tasks — nothing to lose, no confirmation needed
  openModal(`<div class="modal-handle"></div><div class="modal-title">Delete "${esc(f.name)}"?</div>
    <div style="font-size:0.75rem;color:var(--text2);margin-bottom:14px">This feature has ${f.tasks.length} task${f.tasks.length===1?'':'s'}. Deleting it removes those tasks too. Other features, projects, and time entries are unaffected.</div>
    <div class="modal-btns"><button class="btn block" onclick="openProjectDetail('${pid}')">Cancel</button>
    <button class="btn primary block" style="background:var(--red)" onclick="executeDeleteFeature('${pid}','${fid}')">Delete</button></div>`);
}
async function executeDeleteFeature(pid, fid) {
  const p = APP.projects.find((x) => x.id === pid);
  deleteFeature(p, fid);
  await saveProjects(APP.projects);
  openProjectDetail(pid);
  if (APP.currentView === 'programming') await renderCurrentView();
}

// ── INIT ───────────────────────────────────────────────
// ── LIFE TAB — COOKING JOURNAL (isolated) ───────────────
async function buildLifeHtml() {
  if (APP.religiousJournalDetailDate) {
    const date = APP.religiousJournalDetailDate;
    const religiousDay = await loadReligiousDay(date);
    const quranSessions = quranSessionsForDate(APP.timeEntries, date);
    return renderLife({ cookingEntries: [], searchQuery: '', allReligiousDates: [], religiousDetailDate: date, religiousDay, quranSessions });
  }
  const religiousDates = await allReligiousJournalDates();
  const quranDates = allQuranSessionDates(APP.timeEntries); // free — derived from the already-loaded canonical timeEntries, no extra call
  const allReligiousDates = [...new Set([...religiousDates, ...quranDates])].sort((a, b) => b.localeCompare(a));
  APP.cachedReligiousDates = allReligiousDates; // reused by renderLifeSearchOnly so a search keystroke doesn't need a fresh async call
  return renderLife({ cookingEntries: APP.cookingEntries, searchQuery: APP.cookingSearchQuery, allReligiousDates, religiousDetailDate: null, religiousDay: null, quranSessions: null });
}
function setCookingSearch(q) { APP.cookingSearchQuery = q; renderLifeSearchOnly(); }
// Re-renders just the cooking list portion in place, so the search input never loses focus mid-typing.
function renderLifeSearchOnly() {
  const container = document.getElementById('view-life');
  if (!container) return;
  container.innerHTML = renderLife({ cookingEntries: APP.cookingEntries, searchQuery: APP.cookingSearchQuery, allReligiousDates: APP.cachedReligiousDates || [], religiousDetailDate: null, religiousDay: null, quranSessions: null });
  const input = document.getElementById('cooking-search');
  if (input) { input.focus(); input.selectionStart = input.selectionEnd = input.value.length; }
}
function openNewCookingEntry() { APP.editingCookingId = null; APP.cookAgainDraft = null; openModal(renderCookingForm(null)); }
function openEditCookingEntry(id) {
  const e = APP.cookingEntries.find((x) => x.id === id); if (!e) return;
  APP.editingCookingId = id; APP.cookAgainDraft = e.wouldCookAgain;
  openModal(renderCookingForm(e));
}
function openCookingDetail(id) {
  const e = APP.cookingEntries.find((x) => x.id === id); if (!e) return;
  openModal(renderCookingDetail(e));
}
function setCookAgainField(val) {
  APP.cookAgainDraft = val;
  const row = document.querySelector('#modal-sheet .pill-row');
  if (row) row.querySelectorAll('.pill').forEach((p, i) => p.classList.toggle('active', (i === 0) === val));
}
function readCookingForm() {
  return {
    date: document.getElementById('cf-date').value || getDateKey(new Date()),
    dish: document.getElementById('cf-dish').value,
    source: document.getElementById('cf-source').value,
    sourceUrl: document.getElementById('cf-url').value,
    method: document.getElementById('cf-method').value,
    cookingTime: document.getElementById('cf-time').value ? Number(document.getElementById('cf-time').value) : null,
    result: document.getElementById('cf-result').value,
    rating: document.getElementById('cf-rating').value,
    tips: document.getElementById('cf-tips').value,
    nextTimeChanges: document.getElementById('cf-changes').value,
    wouldCookAgain: APP.cookAgainDraft,
  };
}
async function saveNewCookingEntry() {
  await withSaveLock(async () => {
    const { list, error } = addCookingEntry(APP.cookingEntries, readCookingForm());
    if (error) { const e = document.getElementById('cf-err'); e.textContent = error; e.style.display = 'block'; return; }
    APP.cookingEntries = list;
    await saveCookingEntries(APP.cookingEntries);
    closeModal(); await renderCurrentView(); showToast('Cooking entry saved');
  });
}
async function saveEditCookingEntry(id) {
  await withSaveLock(async () => {
    const { list, error } = updateCookingEntry(APP.cookingEntries, id, readCookingForm());
    if (error) { const e = document.getElementById('cf-err'); e.textContent = error; e.style.display = 'block'; return; }
    APP.cookingEntries = list;
    await saveCookingEntries(APP.cookingEntries);
    closeModal(); await renderCurrentView(); showToast('Saved');
  });
}
function confirmDeleteCookingEntry(id) {
  const e = APP.cookingEntries.find((x) => x.id === id); if (!e) return;
  openModal(`<div class="modal-handle"></div><div class="modal-title">Delete "${esc(e.dish)}"?</div>
    <div style="font-size:0.75rem;color:var(--text2);margin-bottom:14px">This entry will be removed. Other cooking entries are unaffected.</div>
    <div class="modal-btns"><button class="btn block" onclick="openCookingDetail('${id}')">Cancel</button>
    <button class="btn primary block" style="background:var(--red)" onclick="executeDeleteCookingEntry('${id}')">Delete</button></div>`);
}
async function executeDeleteCookingEntry(id) {
  APP.cookingEntries = deleteCookingEntry(APP.cookingEntries, id);
  await saveCookingEntries(APP.cookingEntries);
  closeModal(); await renderCurrentView(); showToast('Deleted');
}

// ── LIFE TAB — RELIGIOUS JOURNAL (isolated; never touches Prayer/Commitments) ─
async function openReligiousJournalEntry(date) {
  const day = await loadReligiousDay(date);
  openModal(renderReligiousJournalForm(day));
}
function addActivityRow() {
  const container = document.getElementById('rj-activities');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderActivityRow({ id: null, name: '', count: null, unit: '', notes: '' });
  container.appendChild(wrapper.firstElementChild);
}
function removeActivityRow(rid) {
  const row = document.querySelector(`[data-activity-row="${rid}"]`);
  if (row) row.remove();
}
async function saveReligiousJournalEntry(date) {
  await withSaveLock(async () => {
    const day = await loadReligiousDay(date);
    const rows = document.querySelectorAll('#rj-activities [data-activity-row]');
    const newActivities = [];
    rows.forEach((row) => {
      const name = row.querySelector('.rj-name').value.trim();
      if (!name) return; // silently skip blank rows
      const countRaw = row.querySelector('.rj-count').value;
      const count = countRaw === '' ? null : Number(countRaw);
      const unit = row.querySelector('.rj-unit').value.trim();
      const notes = row.querySelector('.rj-notes').value.trim();
      const rid = row.getAttribute('data-activity-row');
      const existing = day.activities.find((a) => a.id === rid);
      newActivities.push({
        id: existing ? existing.id : genActivityId(),
        name, count: (typeof count === 'number' && isFinite(count) && count >= 0) ? count : null, unit, notes,
      });
    });
    day.activities = newActivities;
    day.notes = document.getElementById('rj-notes').value;
    await saveReligiousDay(date, day);
    closeModal(); await renderCurrentView(); showToast('Journal saved');
  });
}
function confirmDeleteReligiousDay(date) {
  openModal(`<div class="modal-handle"></div><div class="modal-title">Delete this day's journal?</div>
    <div style="font-size:0.75rem;color:var(--text2);margin-bottom:14px">All activities recorded for ${fmtKeyLong(date)} will be removed. Prayers and Daily Commitments for that day are unaffected.</div>
    <div class="modal-btns"><button class="btn block" onclick="openReligiousJournalEntry('${date}')">Cancel</button>
    <button class="btn primary block" style="background:var(--red)" onclick="executeDeleteReligiousDay('${date}')">Delete</button></div>`);
}
async function executeDeleteReligiousDay(date) {
  await saveReligiousDay(date, emptyReligiousDay(date));
  closeModal(); await renderCurrentView(); showToast('Journal entry deleted');
}

// ── RELIGIOUS JOURNAL — day-detail navigation (Quran sessions + Amal + Notes combined) ─
function openReligiousJournalDate(date) { APP.religiousJournalDetailDate = date; renderCurrentView(); }
function closeReligiousJournalDetail() { APP.religiousJournalDetailDate = null; renderCurrentView(); }

// ── QURAN SESSIONS — pure timeEntries rows (category:'quran'); this is the
// SAME canonical store every other actual-time feature already reads from
// (mission progress, Weekly, Analytics, Work Log, the Religious tab's Quran
// total). No second Quran tracker, no double counting.
function openNewQuranSession(date) { openModal(renderQuranSessionForm(date, null)); }
async function saveNewQuranSession(date) {
  await withSaveLock(async () => {
    const actualDate = document.getElementById('qs-date').value || date;
    const startTime = document.getElementById('qs-time').value || null;
    const note = document.getElementById('qs-surah').value;
    const minutes = document.getElementById('qs-min').value;
    const { list, error } = addTimeEntry(APP.timeEntries, { date: actualDate, category: 'quran', minutes, source: 'manual', note, startTime });
    if (error) { const e = document.getElementById('qs-err'); e.textContent = error === 'Invalid duration' ? 'Enter a duration greater than 0 (and under 12h).' : error; e.style.display = 'block'; return; }
    APP.timeEntries = list;
    await saveAllTimeEntries(APP.timeEntries);
    await refreshCore(); // recomputes mission actual time / weekly / momentum exactly like any other time entry
    if (actualDate !== date) { closeModal(); await renderCurrentView(); showToast('Session logged'); return; }
    openReligiousJournalDate(actualDate);
    showToast('Session logged');
  });
}
function openEditQuranSession(id) {
  const s = APP.timeEntries.find((x) => x.id === id); if (!s) return;
  openModal(renderQuranSessionForm(s.date, s));
}
async function saveEditQuranSession(id, date) {
  await withSaveLock(async () => {
    const startTime = document.getElementById('qs-time').value || null;
    const note = document.getElementById('qs-surah').value;
    const minutes = document.getElementById('qs-min').value;
    const { list, error } = updateTimeEntry(APP.timeEntries, id, { minutes, note, startTime });
    if (error) { const e = document.getElementById('qs-err'); e.textContent = 'Enter a duration greater than 0 (and under 12h).'; e.style.display = 'block'; return; }
    APP.timeEntries = list;
    await saveAllTimeEntries(APP.timeEntries);
    await refreshCore();
    openReligiousJournalDate(date);
    showToast('Session updated');
  });
}
function confirmDeleteQuranSession(id) {
  const s = APP.timeEntries.find((x) => x.id === id); if (!s) return;
  openModal(`<div class="modal-handle"></div><div class="modal-title">Delete this session?</div>
    <div style="font-size:0.75rem;color:var(--text2);margin-bottom:14px">${s.startTime ? esc(fmtStartTime(s.startTime)) + ' — ' : ''}${esc(s.note || 'Quran reading')} (${fmtMin(s.minutes)}) will be removed. Other sessions that day are unaffected.</div>
    <div class="modal-btns"><button class="btn block" onclick="openReligiousJournalDate('${s.date}')">Cancel</button>
    <button class="btn primary block" style="background:var(--red)" onclick="executeDeleteQuranSession('${id}','${s.date}')">Delete</button></div>`);
}
async function executeDeleteQuranSession(id, date) {
  APP.timeEntries = deleteTimeEntry(APP.timeEntries, id);
  await saveAllTimeEntries(APP.timeEntries);
  await refreshCore(); // recalculates the daily total and everything downstream from it
  openReligiousJournalDate(date);
  showToast('Session deleted');
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
