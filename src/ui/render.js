// ═══════════════════════════════════════════════════════
// RENDER — pure(ish) functions: state in, HTML string out.
// Every piece of user-controlled text is passed through esc() before
// being placed in innerHTML. Wiring/events live in main.js.
// ═══════════════════════════════════════════════════════

const CATEGORY_ICON = { primary: '🎯', career: '💼', foundation: '🕌', body: '🏃', life: '🌿' };
const MISSION_ICON = {
  ielts: '🗣️', programming: '💻', 'job-apps': '📮', portfolio: '🧩', 'career-prep': '📚',
  prayer: '🕌', quran: '📖', family: '👨‍👩‍👧', sleep: '😴', food: '💧',
  exercise: '🏋️', walking: '🚶', yoga: '🧘', reading: '📕', hobby: '🎨', social: '👥', rest: '😌',
};

// ── TODAY ──────────────────────────────────────────────
function renderToday(S) {
  const { missions, log, prayerTimes, momentum, nextAction, balance, timeEntries } = S;
  const energy = log.energy;
  const suggestRecovery = shouldSuggestRecovery(log);

  let html = `
  <div class="hero"><div class="hero-glow"></div>
    <div class="hero-eyebrow">${fmtKeyLong(S.viewingKey)}</div>
    <h1 class="hero-title">The next <em>right thing</em></h1>
    <p class="hero-sub">You don't have to control the whole day. Just this one.</p>
  </div>`;

  if (S.isPast) {
    html += `<div class="card" style="text-align:center;color:var(--blue);font-size:0.7rem;border-color:rgba(116,175,211,0.3)">📅 Viewing ${fmtKey(S.viewingKey)} — read only <span style="cursor:pointer;color:var(--gold);text-decoration:underline" onclick="goToday()">Back to today</span></div>`;
  }

  if (!S.isPast) {
    html += `<div class="card"><span class="card-label">How is your energy today?</span>
      <div class="energy-grid">
        <button class="energy-btn low${energy === 'low' ? ' active low' : ''}" onclick="setEnergy('low')"><span class="ei">🪫</span><span class="el">Low</span></button>
        <button class="energy-btn${energy === 'normal' ? ' active' : ''}" onclick="setEnergy('normal')"><span class="ei">🔋</span><span class="el">Normal</span></button>
        <button class="energy-btn high${energy === 'high' ? ' active high' : ''}" onclick="setEnergy('high')"><span class="ei">⚡</span><span class="el">High</span></button>
      </div>
    </div>`;
  }

  if (log.recoveryActive) {
    html += `<div class="recovery-banner">
      <div class="rb-title">🌊 Recovery Mode</div>
      <div class="rb-sub">Forget the original plan. Today is about protecting the habit and recovering. Only the essentials below — nothing else is expected. Nothing missed becomes debt.</div>
    </div>
    <div class="recovery-toggle on" onclick="toggleRecovery(false)">Turn off recovery mode</div>`;
  } else if (!S.isPast) {
    if (suggestRecovery) {
      html += `<div class="recovery-banner"><div class="rb-title">💙 Today looks heavy</div><div class="rb-sub">Your energy is very low. Want to switch to Recovery Mode — essentials only, no guilt?</div>
        <div class="modal-btns"><button class="btn primary block" onclick="toggleRecovery(true)">Yes, recover today</button></div></div>`;
    } else {
      html += `<div class="recovery-toggle" onclick="openRecoveryPicker()">Having a hard day? Turn on Recovery Mode</div>`;
    }
  }

  html += renderPrayerStrip(log, prayerTimes, S.isPast);

  html += `<div class="sec-hdr"><span class="sec-title">What should I do now?</span></div>`;
  if (S.isPast) {
    html += `<div class="card" style="font-size:0.75rem;color:var(--text3);text-align:center">Past days don't get a live recommendation.</div>`;
  } else if (!energy) {
    html += `<div class="next-action"><div class="na-none">Set today's energy above and I'll suggest the next right thing.</div></div>`;
  } else if (!nextAction) {
    html += `<div class="next-action"><div class="na-label">✓ All Set</div><div class="na-none">Everything that matters today is covered. Rest is productive too — enjoy it, guilt-free.</div></div>`;
  } else {
    html += `<div class="next-action">
      <div class="na-label">Next Best Action</div>
      <div class="na-task">${MISSION_ICON[nextAction.missionId] || '✦'} ${esc(nextAction.name)}</div>
      <div class="na-meta">${esc(nextAction.meta)}</div>
      <button class="btn primary block" onclick="startFocusFromAction()">Start Focus →</button>
    </div>`;
  }

  html += `<div class="sec-hdr"><span class="sec-title">Today's Work Log</span>${S.isPast ? '' : '<span class="sec-link" onclick="openAddTime()">+ Log Work</span>'}</div>`;
  html += renderWorkLog(timeEntries, log.date, S.isPast);

  html += `<div class="sec-hdr"><span class="sec-title">Momentum</span></div>`;
  html += renderMomentumCard(momentum);

  html += `<div class="sec-hdr"><span class="sec-title">Foundations</span><span class="sec-link" onclick="switchViewByName('missions')">All missions →</span></div>`;
  html += renderFoundationsQuick(missions, log, S.isPast, timeEntries);

  html += `<div class="sec-hdr"><span class="sec-title">Life Balance</span></div>`;
  html += renderBalanceBars(balance, true);

  if (!S.isPast) {
    html += `<div class="card" style="text-align:center;margin-top:8px">
      <div style="font-size:0.78rem;color:var(--text2);margin-bottom:8px">Winding down?</div>
      <button class="btn primary block" onclick="openDailyReview()">Daily Review — 3 quick questions</button>
    </div>`;
  }

  html += renderDailyCommitmentsSection(S.commitments, S.isPast);

  return html;
}

// "Today's Work Log" — individual entries shown inline (grouped by category,
// each entry keeps its own description/time/source), not hidden behind a
// modal. This is a rendering change only — reads the same canonical
// timeEntries list as everything else; no second data source.
function renderWorkLog(timeEntries, date, readonly) {
  const entries = entriesForDate(timeEntries, date).slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  if (!entries.length) return `<div class="card" style="text-align:center;color:var(--text3);font-size:0.72rem;font-style:italic">No work logged ${readonly ? 'that day' : 'yet today'}.</div>`;

  const total = entries.reduce((s, e) => s + e.minutes, 0);
  const grouped = {};
  entries.forEach((e) => { (grouped[e.category] ||= []).push(e); });

  let html = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">
      <span style="font-size:0.7rem;color:var(--text2)">Total logged ${readonly ? 'that day' : 'today'}</span>
      <span style="font-size:0.95rem;color:var(--gold);font-weight:700">${fmtMin(total)}</span>
    </div>`;

  Object.keys(grouped).forEach((cat) => {
    const catEntries = grouped[cat];
    const catTotal = catEntries.reduce((s, e) => s + e.minutes, 0);
    html += `<div style="font-size:0.6rem;color:var(--gold);text-transform:uppercase;letter-spacing:0.07em;margin:9px 0 5px;display:flex;justify-content:space-between">
      <span>${MISSION_ICON[cat] || ''} ${esc(missionLabelById(cat))}</span><span>${fmtMin(catTotal)}</span>
    </div>`;
    catEntries.forEach((e) => {
      html += `<div class="time-entry-row">
        <div><div class="te-main">${esc(e.note || missionLabelById(cat))}</div>
        <div class="te-meta te-source-${e.source}">${fmtMin(e.minutes)} · ${sourceLabel(e.source)}</div></div>
        ${!readonly ? `<div class="te-actions"><button onclick="editTimeEntry('${e.id}')">✎</button><button onclick="deleteTimeEntryPrompt('${e.id}')">✕</button></div>` : ''}
      </div>`;
    });
  });
  html += `</div>`;
  return html;
}
function missionLabelById(id) {
  const m = { ielts: 'IELTS', programming: 'Programming', portfolio: 'Portfolio', 'career-prep': 'Career Prep',
    quran: 'Quran', family: 'Family', exercise: 'Exercise', walking: 'Walking', yoga: 'Yoga',
    reading: 'Reading', hobby: 'Hobby', social: 'Social', rest: 'Rest', sleep: 'Sleep', other: 'Other' };
  return m[id] || id;
}

function renderPrayerStrip(log, pt, readonly) {
  const order = [['fajr','Fajr','🌅'],['dhuhr','Dhuhr','☀️'],['asr','Asr','🌤️'],['maghrib','Maghrib','🌇'],['isha','Isha','🌙']];
  const items = order.map(([k, name, emoji]) => {
    const done = !!log.prayers[k];
    const t = (pt && pt[k]) ? fmt$(pt[k].h, pt[k].m) : '';
    return `<div class="pc${done ? ' checked' : ''}" style="flex:1;cursor:${readonly ? 'default' : 'pointer'}"
      ${readonly ? '' : `onclick="togglePrayerToday('${k}')"`}>
      <div class="pc-check">${done ? '✓' : emoji}</div>
      <div class="pc-name">${name}</div>
      <div class="pc-time">${t}</div>
    </div>`;
  }).join('');
  const done = Object.values(log.prayers).filter(Boolean).length;
  const fallbackNote = (pt && pt.__source === 'fallback') ? `<div style="font-size:0.56rem;color:var(--text3);margin:-6px 0 8px;font-style:italic">⚠ Using estimated prayer times — live times unavailable right now</div>` : '';
  return `<div class="sec-hdr"><span class="sec-title">🕌 Prayer Anchors</span><span class="sec-badge${done===5?' done':''}">${done} / 5</span></div>
  <div style="display:flex;gap:5px;margin-bottom:11px">${items}</div>${fallbackNote}`;
}

function renderMomentumCard(momentum) {
  const circ = 175.9, pct = momentum.score;
  const offset = circ - (pct / 100) * circ;
  const trendMsg = momentum.trend === 'rising' ? 'Rising — keep showing up.'
    : momentum.trend === 'recovering-or-dipping' ? 'A dip is normal. Showing up today rebuilds it.'
    : 'Steady. Consistency compounds quietly.';
  return `<div class="card momentum-card">
    <div class="momentum-ring-wrap">
      <svg class="momentum-ring" width="64" height="64" viewBox="0 0 64 64">
        <circle class="mr-bg" cx="32" cy="32" r="28" stroke-width="5"/>
        <circle class="mr-fill" cx="32" cy="32" r="28" stroke-width="5" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="mr-center"><div class="mr-pct">${pct}%</div></div>
    </div>
    <div class="momentum-info">
      <div class="momentum-title">Momentum ${pct}%</div>
      <div class="momentum-sub">${trendMsg} One missed day never resets this.</div>
    </div>
  </div>`;
}

function renderFoundationsQuick(missions, log, readonly, timeEntries) {
  const foundations = missions.filter((m) => m.category === 'foundation' && m.id !== 'prayer');
  const cards = foundations.map((m) => {
    let isDone, sub;
    if (m.type === 'count') {
      const done = log.progress[m.id] || 0;
      isDone = done >= (m.levels.minimum || 1);
      sub = `${done} logged today`;
    } else {
      // Time-based Foundation: actual logged time (Focus or Manual, via the
      // canonical timeEntries system) satisfies completion on its own —
      // quickMin remains available as a separate "acknowledge without
      // logging exact time" option, but it can no longer contradict real
      // logged time that already meets the minimum.
      const actual = missionActualMinutes(timeEntries || [], m.id, log.date);
      const meetsMinimum = actual >= (m.levels.minimum || 0) && (m.levels.minimum || 0) > 0;
      isDone = meetsMinimum || !!log.quickMin[m.id];
      sub = actual > 0 ? `${fmtMin(actual)} logged today` : `min ${dur$(m.levels.minimum)} · tap to acknowledge`;
    }
    return `<div class="hc${isDone ? ' checked' : ''}" style="${readonly?'':'cursor:pointer'}"
      ${readonly ? '' : `onclick="quickAction('${m.id}')"`}>
      <div class="hc-box">${isDone ? '✓' : ''}</div>
      <div><div class="hc-name">${MISSION_ICON[m.id]||''} ${esc(m.name)}</div><div class="hc-sub">${esc(sub)}</div></div>
    </div>`;
  }).join('');
  return `<div class="habit-grid">${cards}</div>`;
}

function renderBalanceBars(balance, compact) {
  const rows = Object.entries(balance).map(([cat, b]) => {
    const pct = Math.min(100, Math.round(b.ratio * 100));
    const tag = b.status === 'under' ? 'Underinvesting' : b.status === 'over' ? 'Overloading' : 'Balanced';
    return `<div class="balance-row"><span class="balance-lbl">${esc(cat)}</span>
      <div class="balance-track"><div class="balance-fill ${b.status}" style="width:${pct}%"></div></div>
      <span class="balance-tag ${b.status}">${tag}</span></div>`;
  }).join('');
  return `<div class="card">${rows}${compact ? `<div style="font-size:0.6rem;color:var(--text3);margin-top:6px;font-style:italic">Rest, family, and hobbies are protected here — not optimized away.</div>` : ''}</div>`;
}

// ── MISSIONS ───────────────────────────────────────────
function renderMissions(S) {
  const { missions, log, timeEntries } = S;
  let html = `<div class="hero"><div class="hero-eyebrow">Priorities</div><h1 class="hero-title">Your <em>Missions</em></h1>
    <p class="hero-sub">IELTS and Programming are your current growth priorities — everything else supports them.</p></div>`;
  CATEGORY_ORDER.forEach((cat) => {
    const group = missionsByCategory(missions, cat);
    if (!group.length) return;
    html += `<div class="mission-group-title">${CATEGORY_ICON[cat]} ${CATEGORY_LABELS[cat]}</div>`;
    group.forEach((m) => {
      const level = levelForMission(m, log.energy || 'normal', log.recoveryActive);
      const target = m.levels[level] || 1;
      let done, line;
      if (m.id === 'prayer') {
        done = Object.values(log.prayers).filter(Boolean).length; line = `${done} / 5 today`;
      } else if (m.type === 'time') {
        done = missionActualMinutes(timeEntries, m.id, log.date); line = progressLine(m, done);
      } else if (m.id === 'job-apps') {
        done = 0; line = `Tracked in Jobs tab · weekly target`;
      } else {
        done = log.progress[m.id] || 0; line = `${done} / ${target} today`;
      }
      const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
      html += `<div class="mission-card${m.weight === 'primary' ? ' primary' : ''}" onclick="openMissionEditor('${m.id}')">
        <div class="mc-top"><span class="mc-name">${MISSION_ICON[m.id]||''} ${esc(m.name)}</span></div>
        <div class="mc-track"><div class="mc-fill" style="width:${pct}%"></div></div>
        <div class="mc-meta">${esc(line)}</div>
        <div class="mc-meta">Min ${fmtLevel(m,'minimum')} · Std ${fmtLevel(m,'standard')} · Stretch ${fmtLevel(m,'stretch')} · ${m.frequency}</div>
      </div>`;
    });
  });
  return html;
}
function fmtLevel(m, level) { return m.type === 'time' ? (dur$(m.levels[level]) || '0m') : m.levels[level]; }

// ── IELTS ──────────────────────────────────────────────
function renderIelts(S) {
  const { ielts, weeklyAnalytics } = S;
  let html = `<div class="hero"><div class="hero-eyebrow">Band ${ielts.targetBand}+ target</div><h1 class="hero-title">IELTS <em>Dashboard</em></h1></div>`;
  html += `<div class="stats-g">
    <div class="sc"><div class="sc-v">${dur$(weeklyAnalytics.totalMinutes)||'0m'}</div><div class="sc-l">This week</div></div>
    <div class="sc"><div class="sc-v">${weeklyAnalytics.sessions}</div><div class="sc-l">Sessions</div></div>
    <div class="sc"><div class="sc-v">${weeklyAnalytics.completedTasks}</div><div class="sc-l">Tasks done</div></div>
    <div class="sc"><div class="sc-v" style="text-transform:capitalize">${weeklyAnalytics.weakest || '—'}</div><div class="sc-l">Weakest skill</div></div>
  </div>
  <div style="font-size:0.6rem;color:var(--text3);margin:-6px 0 12px;text-align:center;font-style:italic">Time and task completion are tracked separately — a task never counts as minutes.</div>`;
  html += `<div class="sec-hdr"><span class="sec-title">Skills</span></div>`;
  const grid = IELTS_SKILLS.map((s) => {
    const sk = ielts.skills[s];
    const isWeak = weeklyAnalytics.weakest === s;
    return `<div class="card" style="cursor:pointer${isWeak?';border-color:rgba(224,123,106,0.4)':''}" onclick="openIeltsScoreEditor('${s}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:0.8rem;text-transform:capitalize">${s}${isWeak?' <span style=\'color:var(--red);font-size:0.6rem\'>weakest</span>':''}</span>
        <span style="font-size:1rem;color:var(--gold);font-weight:700">${sk.current ?? '—'}</span>
      </div>
      <div style="font-size:0.6rem;color:var(--text3);margin-top:3px">Target ${sk.target} · ${sk.history.length} scores logged</div>
    </div>`;
  }).join('');
  html += grid;
  html += `<div class="sec-hdr"><span class="sec-title">Practice Tasks</span><span class="sec-link" onclick="openNewIeltsTask()">+ New</span></div>`;
  if (!ielts.tasks.length) html += `<div class="empty">No tasks yet. Add one to start tracking specific practice.</div>`;
  ielts.tasks.slice(0, 12).forEach((t) => {
    html += `<div class="list-item" onclick="toggleIeltsTask('${t.id}')">
      <div class="li-top"><span class="li-title" style="${t.status==='done'?'text-decoration:line-through;color:var(--text3)':''}">${esc(t.type)}</span>
      <span class="status-chip status-${t.status==='done'?'Offer':'Preparing'}">${t.status}</span></div>
      <div class="li-sub">${esc(t.skill)} · ${fmtKeyS(t.date)}${t.notes?' · '+esc(t.notes):''}</div>
    </div>`;
  });
  return html;
}

// ── PROGRAMMING ────────────────────────────────────────
function renderProgramming(S) {
  const { projects, weekStart, timeEntries } = S;
  const weekEnd = addDays(weekStart, 7);
  const weekMinutes = missionActualMinutesRange(timeEntries, 'programming', weekStart, weekEnd);
  const weekTasks = tasksCompletedInRange(projects, weekStart, weekEnd);
  let html = `<div class="hero"><div class="hero-eyebrow">${completedTasksCount(projects)} tasks completed all-time</div><h1 class="hero-title">Programming <em>Projects</em></h1></div>`;
  html += `<div class="stats-g">
    <div class="sc"><div class="sc-v">${dur$(weekMinutes)||'0m'}</div><div class="sc-l">Focused time · week</div></div>
    <div class="sc"><div class="sc-v">${weekTasks}</div><div class="sc-l">Tasks done · week</div></div>
  </div>
  <div style="font-size:0.6rem;color:var(--text3);margin:-6px 0 12px;text-align:center;font-style:italic">Time and task output are tracked separately — completing a task never adds fake minutes.</div>`;
  html += `<div class="sec-hdr"><span class="sec-title">Projects</span><span class="sec-link" onclick="openNewProject()">+ New</span></div>`;
  if (!projects.length) html += `<div class="empty">No projects yet. Add your first one.</div>`;
  projects.forEach((p) => {
    const pct = projectProgress(p);
    const taskCount = p.features.reduce((s, f) => s + f.tasks.length, 0);
    html += `<div class="mission-card${p.status==='active'?' primary':''}" onclick="openProjectDetail('${p.id}')">
      <div class="mc-top"><span class="mc-name">${esc(p.name)}</span><span style="font-size:0.6rem;color:var(--text3)">${pct}%</span></div>
      <div class="mc-track"><div class="mc-fill" style="width:${pct}%"></div></div>
      <div class="mc-meta">${p.features.length} features · ${taskCount} tasks · ${esc(p.status)}</div>
    </div>`;
  });
  return html;
}

function renderProjectDetail(project) {
  let html = `<div class="hero"><div class="hero-eyebrow">${esc(project.status)}</div><h1 class="hero-title">${esc(project.name)}</h1></div>`;
  html += `<button class="btn ghost block" style="margin-bottom:10px" onclick="openNewFeature('${project.id}')">+ Add Feature</button>`;
  html += renderFeatureRoadmap(project);
  return html;
}

// ── JOBS ───────────────────────────────────────────────
function renderJobs(S) {
  const { jobs, weekStart } = S;
  const thisWeek = jobsThisWeek(jobs, weekStart);
  let html = `<div class="hero"><div class="hero-eyebrow">Weekly, not daily, targets</div><h1 class="hero-title">Job <em>Tracker</em></h1></div>`;
  html += `<div class="card"><span class="card-label">This week</span>
    <div style="font-size:1.3rem;color:var(--gold);font-weight:700">${thisWeek.length} applications</div>
    <div style="font-size:0.65rem;color:var(--text3)">No daily mandate — pace it across the week however fits. A job counts once it's actually applied to.</div></div>`;
  html += `<div class="sec-hdr"><span class="sec-title">Pipeline</span><span class="sec-link" onclick="openNewJob()">+ New</span></div>`;
  if (!jobs.length) html += `<div class="empty">No jobs saved yet.</div>`;
  JOB_STATUSES.forEach((status) => {
    const inStatus = jobs.filter((j) => j.status === status);
    inStatus.forEach((j) => {
      html += `<div class="list-item" onclick="openJobDetail('${j.id}')">
        <div class="li-top"><span class="li-title">${esc(j.company)} — ${esc(j.position)}</span><span class="status-chip status-${status}">${status}</span></div>
        <div class="li-sub">${j.dateApplied ? 'Applied ' + fmtKeyS(j.dateApplied) : 'Not yet applied'}</div>
      </div>`;
    });
  });
  return html;
}

// ── WEEKLY ─────────────────────────────────────────────
function renderWeekly(S) {
  const { missions, weekProgress, weekStart } = S;
  let html = `<div class="hero"><div class="hero-eyebrow">Week of ${fmtKeyS(weekStart)}</div><h1 class="hero-title">Weekly <em>Dashboard</em></h1>
    <p class="hero-sub">Weekly targets matter more than any single day. A miss today just means more remains this week — never a failure.</p></div>`;
  CATEGORY_ORDER.forEach((cat) => {
    const group = missionsByCategory(missions, cat).filter((m) => weekProgress[m.id]);
    if (!group.length) return;
    html += `<div class="mission-group-title">${CATEGORY_ICON[cat]} ${CATEGORY_LABELS[cat]}</div>`;
    group.forEach((m) => {
      const wp = weekProgress[m.id];
      const pct = wp.target > 0 ? Math.min(100, Math.round((wp.completed / wp.target) * 100)) : 0;
      html += `<div class="mission-card${m.weight==='primary'?' primary':''}">
        <div class="mc-top"><span class="mc-name">${MISSION_ICON[m.id]||''} ${esc(m.name)}</span><span style="font-size:0.63rem;color:var(--text3)">${wp.completed}/${wp.target}</span></div>
        <div class="mc-track"><div class="mc-fill" style="width:${pct}%"></div></div>
        <div class="mc-meta">${esc(weeklySummaryLine(m, wp))}</div>
      </div>`;
    });
  });

  html += renderTimeDistributionSection(S);
  return html;
}

// ── TIME DISTRIBUTION ANALYTICS (derived view only — reads S.timeEntries) ─
function renderTimeDistributionSection(S) {
  const { timeEntries, missions, viewingKey, weekStart, analyticsPeriod } = S;
  const period = analyticsPeriod || 'week';
  const [start, end] = rangeForPeriod(period, viewingKey, weekStart);
  const distribution = distributionForRange(timeEntries, start, end);
  const entries = sortedDistributionEntries(distribution);
  const total = distributionTotal(distribution);

  let html = `<div class="sec-hdr"><span class="sec-title">Where did my time go?</span></div>`;
  html += `<div class="pill-row" style="margin-bottom:9px">
    <button class="pill${period==='today'?' active':''}" onclick="setAnalyticsPeriod('today')">Today</button>
    <button class="pill${period==='week'?' active':''}" onclick="setAnalyticsPeriod('week')">This Week</button>
    <button class="pill${period==='month'?' active':''}" onclick="setAnalyticsPeriod('month')">This Month</button>
  </div>`;

  if (!entries.length) {
    html += `<div class="card" style="text-align:center;color:var(--text3);font-size:0.75rem;font-style:italic">No actual time logged ${period === 'today' ? 'today' : period === 'month' ? 'this month' : 'this week'} yet. Log some work or complete a Focus session to see it here.</div>`;
    return html;
  }

  const max = entries[0][1];
  html += `<div class="card">`;
  entries.forEach(([cat, mins]) => {
    const pct = max > 0 ? Math.round((mins / max) * 100) : 0;
    html += `<div style="margin-bottom:9px">
      <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">
        <span>${MISSION_ICON[cat] || ''} ${esc(missionLabelById(cat))}</span>
        <span style="color:var(--gold);font-weight:600">${dur$(mins)}</span>
      </div>
      <div class="mc-track"><div class="mc-fill" style="width:${pct}%"></div></div>
    </div>`;
  });
  html += `<div class="insight-note">${esc(distributionInsightText(entries, total, period))}</div>`;
  html += `</div>`;

  // 7-day trend — only rendered alongside the week/month periods, keeps Today uncluttered.
  if (period !== 'today') {
    const trendStart = period === 'month' ? start : weekStart;
    const trendEnd = period === 'month' ? end : addDays(weekStart, 7);
    const days = dailyTotalsForRange(timeEntries, trendStart, trendEnd);
    if (days.length && days.length <= 31) {
      const trendMax = Math.max(1, ...days.map((d) => d.minutes));
      const todayKeyForTrend = viewingKey; // only meaningfully highlights "today" when viewing the current day
      html += `<div class="sec-hdr" style="margin-top:16px"><span class="sec-title" style="font-size:0.85rem">7-Day Time Trend</span></div>`;
      html += `<div class="card"><div class="trend-row">`;
      days.slice(-7).forEach((d) => {
        const h = Math.max(2, Math.round((d.minutes / trendMax) * 60));
        const dow = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })[0];
        html += `<div class="trend-col">
          <div class="trend-bar${d.date === todayKeyForTrend ? ' today' : ''}" style="height:${h}px" title="${dur$(d.minutes) || '0m'}"></div>
          <div class="trend-lbl">${dow}</div>
        </div>`;
      });
      html += `</div></div>`;
    }
  }

  return html;
}
function distributionInsightText(sortedEntries, total, period) {
  const periodLabel = period === 'today' ? 'today' : period === 'month' ? 'this month' : 'this week';
  if (!sortedEntries.length) return '';
  if (sortedEntries.length === 1) return `You spent ${dur$(total)} ${periodLabel}, all on ${missionLabelById(sortedEntries[0][0])}.`;
  const [topCat] = sortedEntries[0];
  return `Most of your logged time ${periodLabel} went to ${missionLabelById(topCat)} — ${dur$(total)} logged in total.`;
}

// ── HISTORY ────────────────────────────────────────────
function renderHistory(S) {
  let html = `<div class="hero"><div class="hero-eyebrow">Your journey</div><h1 class="hero-title">Day <em>History</em></h1>
    <p class="hero-sub">Every logged day is a step forward.</p></div>`;
  html += `<button class="btn ghost block" style="margin-bottom:11px" onclick="switchViewByName('review')">📈 View Monthly Review</button>`;
  html += `<div id="hist-list"><div class="empty">Loading…</div></div>`;
  return html;
}
function renderHistoryList(keys, logsById, missions, timeEntries) {
  if (!keys.length) return `<div class="empty">No days logged yet. Start today ✨</div>`;
  return keys.map((k) => {
    const log = logsById[k];
    const score = Math.round(dailyCompletionScore(log, missions, timeEntries));
    const prayerDone = Object.values(log.prayers).filter(Boolean).length;
    return `<div class="list-item" onclick="openHistoryDetail('${k}')">
      <div class="li-top"><span class="li-title">${fmtKey(k)}</span><span style="color:var(--gold);font-weight:700">${score}%</span></div>
      <div class="li-sub">🕌 ${prayerDone}/5 prayers${log.recoveryActive ? ' · 🌊 recovery day' : ''}${log.reflection?.accomplished ? ' · "'+esc(log.reflection.accomplished.slice(0,40))+'"' : ''}</div>
    </div>`;
  }).join('');
}

// ── HISTORY DETAIL (full daily retrospective for one date) ─────────────
// Read-only always — this view never shows edit/delete controls, matching
// History's existing read-only rule. Reuses renderPrayerStrip/renderWorkLog
// exactly as Today does, so the same entries/prayer state render identically
// in both places (single source of truth, no history-specific copies).
function renderHistoryDetail(D) {
  const { date, log, prayerTimes, timeEntries, missions, momentumScore, taskActivity, jobActivity, ieltsTaskActivity, featureActivity, commitments, cookingEntries, religiousJournalDay, hasActivity, canGoNext } = D;

  let html = `<button class="btn ghost block" style="margin-bottom:11px" onclick="closeHistoryDetail()">← Back to History</button>`;
  html += `<div class="hero"><div class="hero-eyebrow">${fmtKeyLong(date)}</div><h1 class="hero-title">Day <em>Retrospective</em></h1></div>`;
  html += `<div style="display:flex;gap:8px;margin-bottom:14px">
    <button class="btn block" onclick="historyPrevDay()">← Previous day</button>
    <button class="btn block" onclick="historyNextDay()" ${canGoNext ? '' : 'disabled'}>Next day →</button>
  </div>`;

  if (!hasActivity) {
    html += `<div class="empty">No activity recorded for this day.</div>`;
    html += `<div class="sec-link" style="text-align:center;display:block;margin-top:10px" onclick="viewHistoryDay('${date}')">Open in Today layout →</div>`;
    return html;
  }

  // Day summary
  const score = Math.round(dailyCompletionScore(log, missions, timeEntries));
  html += `<div class="stats-g">
    <div class="sc"><div class="sc-v">${score}%</div><div class="sc-l">Day score</div></div>
    <div class="sc"><div class="sc-v">${momentumScore ?? '—'}${momentumScore != null ? '%' : ''}</div><div class="sc-l">Momentum that day</div></div>
  </div>`;
  if (log.energy || log.recoveryActive) {
    html += `<div class="card" style="font-size:0.75rem;color:var(--text2)">${log.recoveryActive ? '🌊 Recovery Mode day' : `Energy: ${esc(energyLabel(log.energy))}`}${log.energyScore != null ? ` (${log.energyScore}/10)` : ''}</div>`;
  }

  html += `<div class="sec-hdr"><span class="sec-title">🕌 Prayers</span></div>`;
  html += renderPrayerStrip(log, prayerTimes, true);

  html += `<div class="sec-hdr"><span class="sec-title">Work Log</span></div>`;
  html += renderWorkLog(timeEntries, date, true);

  // Compact mission recap — only missions actually touched that day, using
  // the same progressLine()/actual-time derivation as everywhere else.
  const missionRows = missions.filter((m) => {
    if (m.id === 'prayer' || m.id === 'sleep') return false;
    if (m.type === 'time') return missionActualMinutes(timeEntries, m.id, date) > 0;
    if (m.id === 'job-apps') return jobActivity.length > 0;
    return (log.progress[m.id] || 0) > 0;
  });
  if (missionRows.length) {
    html += `<div class="sec-hdr"><span class="sec-title">Missions</span></div><div class="card">`;
    missionRows.forEach((m) => {
      const line = m.type === 'time' ? progressLine(m, missionActualMinutes(timeEntries, m.id, date))
        : m.id === 'job-apps' ? `${jobActivity.length} application${jobActivity.length === 1 ? '' : 's'}`
        : `${log.progress[m.id] || 0} logged`;
      html += `<div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:5px 0"><span>${MISSION_ICON[m.id]||''} ${esc(m.name)}</span><span style="color:var(--text2)">${esc(line)}</span></div>`;
    });
    html += `</div>`;
  }

  if (ieltsTaskActivity.length) {
    html += `<div class="sec-hdr"><span class="sec-title">IELTS Practice Completed</span></div><div class="card">`;
    ieltsTaskActivity.forEach((t) => {
      html += `<div style="font-size:0.75rem;padding:5px 0;border-bottom:1px solid var(--border)">✓ ${esc(t.type)} <span style="color:var(--text3);font-size:0.65rem">— ${esc(t.skill)}</span>${t.notes ? `<div style="font-size:0.65rem;color:var(--text3);margin-top:2px">${esc(t.notes)}</div>` : ''}</div>`;
    });
    html += `<div style="font-size:0.6rem;color:var(--text3);margin-top:6px;font-style:italic">Task completion only — actual time (if logged) appears in the Work Log above.</div></div>`;
  }

  if (taskActivity.length) {
    html += `<div class="sec-hdr"><span class="sec-title">Project / Task Activity</span></div><div class="card">`;
    taskActivity.forEach((t) => {
      html += `<div style="font-size:0.75rem;padding:5px 0;border-bottom:1px solid var(--border)">✓ ${esc(t.taskName)} <span style="color:var(--text3);font-size:0.65rem">— ${esc(t.projectName)} / ${esc(t.featureName)}</span></div>`;
    });
    html += `</div>`;
  }

  if (featureActivity && featureActivity.length) {
    html += `<div class="sec-hdr"><span class="sec-title">Project Roadmap Activity</span></div><div class="card">`;
    featureActivity.forEach((f) => {
      html += `<div style="font-size:0.75rem;padding:5px 0;border-bottom:1px solid var(--border)">✓ ${esc(f.featureName)} feature completed <span style="color:var(--text3);font-size:0.65rem">— ${esc(f.projectName)}</span></div>`;
    });
    html += `</div>`;
  }

  html += renderCommitmentsHistoryBlock(commitments);

  html += renderCookingHistoryBlock(cookingEntries);
  html += renderReligiousJournalHistoryBlock(religiousJournalDay);

  if (jobActivity.length) {
    html += `<div class="sec-hdr"><span class="sec-title">Jobs</span></div><div class="card">`;
    jobActivity.forEach((j) => {
      html += `<div style="font-size:0.75rem;padding:5px 0;border-bottom:1px solid var(--border)">${esc(j.company)} — ${esc(j.position)} <span class="status-chip status-${j.status}" style="margin-left:6px">${j.status}</span></div>`;
    });
    html += `</div>`;
  }

  if (log.reflection && (log.reflection.accomplished || log.reflection.blocker || log.reflection.tomorrowFocus)) {
    html += `<div class="sec-hdr"><span class="sec-title">Reflection</span></div><div class="card">`;
    if (log.reflection.accomplished) html += `<div style="font-size:0.72rem;margin-bottom:8px"><span style="color:var(--gold)">Accomplished:</span> ${esc(log.reflection.accomplished)}</div>`;
    if (log.reflection.blocker) html += `<div style="font-size:0.72rem;margin-bottom:8px"><span style="color:var(--gold)">Blocked by:</span> ${esc(log.reflection.blocker)}</div>`;
    if (log.reflection.tomorrowFocus) html += `<div style="font-size:0.72rem"><span style="color:var(--gold)">Next focus:</span> ${esc(log.reflection.tomorrowFocus)}</div>`;
    html += `</div>`;
  }

  return html;
}

// ── MONTHLY REVIEW ─────────────────────────────────────
function renderReview(S) {
  const { monthly, yearMonth } = S;
  let html = `<div class="hero"><div class="hero-eyebrow">${yearMonth}</div><h1 class="hero-title">Monthly <em>Review</em></h1></div>`;
  html += `<div class="stats-g">
    <div class="sc"><div class="sc-v">${monthly.daysLogged}</div><div class="sc-l">Days logged</div></div>
    <div class="sc"><div class="sc-v">${monthly.avgEnergy ?? '—'}</div><div class="sc-l">Avg energy</div></div>
    <div class="sc"><div class="sc-v">${monthly.prayerTotal}</div><div class="sc-l">Prayers</div></div>
    <div class="sc"><div class="sc-v">${monthly.momentumEnd ?? '—'}%</div><div class="sc-l">Momentum now</div></div>
  </div>`;
  html += `<div class="card"><span class="card-label">Time invested</span>`;
  ['ielts', 'programming'].forEach((id) => {
    html += `<div class="balance-row"><span class="balance-lbl">${id === 'ielts' ? 'IELTS' : 'Programming'}</span>
      <span style="font-size:0.75rem;color:var(--gold);margin-left:auto">${dur$(monthly.totals[id]) || '0m'}</span></div>`;
  });
  html += `</div>`;
  html += `<div class="card">
    <div class="field"><label>What improved?</label><textarea id="rev-improved">${esc(monthly.notes.improved)}</textarea></div>
    <div class="field"><label>What is stuck?</label><textarea id="rev-stuck">${esc(monthly.notes.stuck)}</textarea></div>
    <div class="field"><label>What should change next month?</label><textarea id="rev-change">${esc(monthly.notes.change)}</textarea></div>
    <button class="btn primary block" onclick="saveMonthlyNotes()">Save Notes</button>
  </div>`;
  return html;
}

function fmtKeyLong(k) { const d = new Date(k + 'T00:00:00'); return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
