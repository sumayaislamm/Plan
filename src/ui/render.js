// ═══════════════════════════════════════════════════════
// RENDER — pure(ish) functions: state in, HTML string out.
// Wiring/events happen in main.js via inline onclick calling window fns.
// ═══════════════════════════════════════════════════════

const CATEGORY_ICON = { primary: '🎯', career: '💼', foundation: '🕌', body: '🏃', life: '🌿' };
const MISSION_ICON = {
  ielts: '🗣️', programming: '💻', 'job-apps': '📮', portfolio: '🧩', 'career-prep': '📚',
  prayer: '🕌', quran: '📖', family: '👨‍👩‍👧', sleep: '😴', food: '💧',
  exercise: '🏋️', walking: '🚶', yoga: '🧘', reading: '📕', hobby: '🎨', social: '👥', rest: '😌',
};

// ── TODAY ──────────────────────────────────────────────
function renderToday(S) {
  const { missions, log, prayerTimes, momentum, nextAction, weeklyRemaining, balance } = S;
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

  // Energy check-in
  if (!S.isPast) {
    html += `<div class="card"><span class="card-label">How is your energy today?</span>
      <div class="energy-grid">
        <button class="energy-btn low${energy === 'low' ? ' active low' : ''}" onclick="setEnergy('low')"><span class="ei">🪫</span><span class="el">Low</span></button>
        <button class="energy-btn${energy === 'normal' ? ' active' : ''}" onclick="setEnergy('normal')"><span class="ei">🔋</span><span class="el">Normal</span></button>
        <button class="energy-btn high${energy === 'high' ? ' active high' : ''}" onclick="setEnergy('high')"><span class="ei">⚡</span><span class="el">High</span></button>
      </div>
    </div>`;
  }

  // Recovery
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

  // Prayer strip
  html += renderPrayerStrip(log, prayerTimes, S.isPast);

  // Next action
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
      <div class="na-task">${MISSION_ICON[nextAction.missionId] || '✦'} ${nextAction.name}</div>
      <div class="na-meta">${nextAction.meta}</div>
      <button class="btn primary block" onclick='startFocus(${JSON.stringify(nextAction).replace(/'/g,"&#39;")})'>Start Focus →</button>
    </div>`;
  }

  // Momentum
  html += `<div class="sec-hdr"><span class="sec-title">Momentum</span></div>`;
  html += renderMomentumCard(momentum);

  // Foundations quick-check (collapsed / low visual weight)
  html += `<div class="sec-hdr"><span class="sec-title">Foundations</span><span class="sec-link" onclick="switchViewByName('missions')">All missions →</span></div>`;
  html += renderFoundationsQuick(missions, log, S.isPast);

  // Life balance snapshot
  html += `<div class="sec-hdr"><span class="sec-title">Life Balance</span></div>`;
  html += renderBalanceBars(balance, true);

  // End-of-day review CTA
  if (!S.isPast) {
    html += `<div class="card" style="text-align:center;margin-top:8px">
      <div style="font-size:0.78rem;color:var(--text2);margin-bottom:8px">Winding down?</div>
      <button class="btn primary block" onclick="openDailyReview()">Daily Review — 3 quick questions</button>
    </div>`;
  }

  return html;
}

function renderPrayerStrip(log, pt, readonly) {
  const order = [['fajr','Fajr','🌅'],['dhuhr','Dhuhr','☀️'],['asr','Asr','🌤️'],['maghrib','Maghrib','🌇'],['isha','Isha','🌙']];
  const items = order.map(([k, name, emoji]) => {
    const done = log.prayers[k];
    const t = pt[k] ? fmt$(pt[k].h, pt[k].m) : '';
    return `<div class="pc${done ? ' checked' : ''}" style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:9px 3px;text-align:center;cursor:${readonly ? 'default' : 'pointer'}"
      ${readonly ? '' : `onclick="togglePrayerToday('${k}')"`}>
      <div style="font-size:0.95rem">${emoji}</div><div style="font-size:0.55rem;color:var(--text2)">${name}</div>
      <div style="font-size:0.58rem;color:var(--gold);margin-top:2px">${t}</div>
    </div>`;
  }).join('');
  const done = Object.values(log.prayers).filter(Boolean).length;
  return `<div class="sec-hdr"><span class="sec-title">🕌 Prayer Anchors</span><span class="sec-badge${done===5?' done':''}">${done} / 5</span></div>
  <div style="display:flex;gap:5px;margin-bottom:11px">${items}</div>`;
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

function renderFoundationsQuick(missions, log, readonly) {
  const foundations = missions.filter((m) => m.category === 'foundation' && m.id !== 'prayer');
  const cards = foundations.map((m) => {
    const level = 'minimum';
    const target = m.levels[level];
    const done = log.progress[m.id] || 0;
    const isDone = done >= (target || 1) || (target === 0 && done > 0);
    return `<div class="hc${isDone ? ' checked' : ''}" style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:9px 11px;display:flex;align-items:center;gap:8px;${readonly?'':'cursor:pointer'}"
      ${readonly ? '' : `onclick="quickLogMinimum('${m.id}')"`}>
      <div class="hc-box" style="width:16px;height:16px;border-radius:4px;border:1.5px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:0.58rem;${isDone?'background:var(--green);border-color:var(--green);color:#fff':''}">${isDone ? '✓' : ''}</div>
      <div><div style="font-size:0.7rem;color:var(--text)">${MISSION_ICON[m.id]||''} ${m.name}</div><div style="font-size:0.56rem;color:var(--text3)">min ${m.type==='time'?dur$(m.levels.minimum):m.levels.minimum}</div></div>
    </div>`;
  }).join('');
  return `<div class="habit-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:12px">${cards}</div>`;
}

function renderBalanceBars(balance, compact) {
  const rows = Object.entries(balance).map(([cat, b]) => {
    const pct = Math.min(100, Math.round(b.ratio * 100));
    const tag = b.status === 'under' ? 'Underinvesting' : b.status === 'over' ? 'Overloading' : 'Balanced';
    return `<div class="balance-row"><span class="balance-lbl">${cat}</span>
      <div class="balance-track"><div class="balance-fill ${b.status}" style="width:${pct}%"></div></div>
      <span class="balance-tag ${b.status}">${tag}</span></div>`;
  }).join('');
  return `<div class="card">${rows}${compact ? `<div style="font-size:0.6rem;color:var(--text3);margin-top:6px;font-style:italic">Rest, family, and hobbies are protected here — not optimized away.</div>` : ''}</div>`;
}

// ── MISSIONS ───────────────────────────────────────────
function renderMissions(S) {
  const { missions, log } = S;
  let html = `<div class="hero"><div class="hero-eyebrow">Priorities</div><h1 class="hero-title">Your <em>Missions</em></h1>
    <p class="hero-sub">IELTS and Programming are your current growth priorities — everything else supports them.</p></div>`;
  CATEGORY_ORDER.forEach((cat) => {
    const group = missionsByCategory(missions, cat);
    if (!group.length) return;
    html += `<div class="mission-group-title">${CATEGORY_ICON[cat]} ${CATEGORY_LABELS[cat]}</div>`;
    group.forEach((m) => {
      const level = levelForMission(m, log.energy || 'normal', log.recoveryActive);
      const target = m.levels[level] || 1;
      const done = log.progress[m.id] || 0;
      const pct = Math.min(100, Math.round((done / target) * 100));
      html += `<div class="mission-card${m.weight === 'primary' ? ' primary' : ''}" onclick="openMissionEditor('${m.id}')">
        <div class="mc-top"><span class="mc-name">${MISSION_ICON[m.id]||''} ${m.name}</span>
          <span style="font-size:0.63rem;color:var(--text3)">${done}${m.type==='time'?'m':''}/${target}${m.type==='time'?'m':''}</span></div>
        <div class="mc-track"><div class="mc-fill" style="width:${pct}%"></div></div>
        <div class="mc-meta">Min ${fmtLevel(m,'minimum')} · Std ${fmtLevel(m,'standard')} · Stretch ${fmtLevel(m,'stretch')} · ${m.frequency}</div>
      </div>`;
    });
  });
  return html;
}
function fmtLevel(m, level) { return m.type === 'time' ? dur$(m.levels[level]) || '0m' : m.levels[level]; }

// ── IELTS ──────────────────────────────────────────────
function renderIelts(S) {
  const { ielts, weeklyAnalytics } = S;
  let html = `<div class="hero"><div class="hero-eyebrow">Band ${ielts.targetBand}+ target</div><h1 class="hero-title">IELTS <em>Dashboard</em></h1></div>`;
  html += `<div class="stats-g">
    <div class="sc"><div class="sc-v">${dur$(weeklyAnalytics.totalMinutes)||'0m'}</div><div class="sc-l">This week</div></div>
    <div class="sc"><div class="sc-v">${weeklyAnalytics.sessions}</div><div class="sc-l">Sessions</div></div>
  </div>`;
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
      <div class="li-top"><span class="li-title" style="${t.status==='done'?'text-decoration:line-through;color:var(--text3)':''}">${t.type}</span>
      <span class="status-chip status-${t.status==='done'?'Offer':'Preparing'}">${t.status}</span></div>
      <div class="li-sub">${t.skill} · ${fmtKeyS(t.date)}${t.notes?' · '+t.notes:''}</div>
    </div>`;
  });
  return html;
}

// ── PROGRAMMING ────────────────────────────────────────
function renderProgramming(S) {
  const { projects } = S;
  let html = `<div class="hero"><div class="hero-eyebrow">${completedTasksCount(projects)} tasks completed</div><h1 class="hero-title">Programming <em>Projects</em></h1></div>`;
  html += `<div class="sec-hdr"><span class="sec-title">Projects</span><span class="sec-link" onclick="openNewProject()">+ New</span></div>`;
  if (!projects.length) html += `<div class="empty">No projects yet. Add your first one.</div>`;
  projects.forEach((p) => {
    const pct = projectProgress(p);
    const taskCount = p.features.reduce((s, f) => s + f.tasks.length, 0);
    html += `<div class="mission-card${p.status==='active'?' primary':''}" onclick="openProjectDetail('${p.id}')">
      <div class="mc-top"><span class="mc-name">${p.name}</span><span style="font-size:0.6rem;color:var(--text3)">${pct}%</span></div>
      <div class="mc-track"><div class="mc-fill" style="width:${pct}%"></div></div>
      <div class="mc-meta">${p.features.length} features · ${taskCount} tasks · ${p.status}</div>
    </div>`;
  });
  return html;
}

function renderProjectDetail(project) {
  let html = `<div class="hero"><div class="hero-eyebrow">${project.status}</div><h1 class="hero-title">${project.name}</h1></div>`;
  html += `<button class="btn ghost block" style="margin-bottom:10px" onclick="openNewFeature('${project.id}')">+ Add Feature</button>`;
  project.features.forEach((f) => {
    html += `<div class="sec-hdr"><span class="sec-title" style="font-size:0.82rem">${f.name}</span><span class="sec-link" onclick="openNewTask('${project.id}','${f.id}')">+ Task</span></div>`;
    f.tasks.forEach((t) => {
      const subDone = t.subtasks.filter((s) => s.done).length;
      html += `<div class="list-item" onclick="toggleProjectTask('${project.id}','${f.id}','${t.id}')">
        <div class="li-top"><span class="li-title" style="${t.status==='done'?'text-decoration:line-through;color:var(--text3)':''}">${t.name}</span>
        <span class="status-chip status-${t.status==='done'?'Offer':'Preparing'}">${t.status}</span></div>
        ${t.subtasks.length ? `<div class="li-sub">${subDone}/${t.subtasks.length} subtasks</div>` : ''}
      </div>`;
    });
  });
  return html;
}

// ── JOBS ───────────────────────────────────────────────
function renderJobs(S) {
  const { jobs, weekStart } = S;
  const thisWeek = jobsThisWeek(jobs, weekStart);
  let html = `<div class="hero"><div class="hero-eyebrow">Weekly, not daily, targets</div><h1 class="hero-title">Job <em>Tracker</em></h1></div>`;
  html += `<div class="card"><span class="card-label">This week</span>
    <div style="font-size:1.3rem;color:var(--gold);font-weight:700">${thisWeek.length} applications</div>
    <div style="font-size:0.65rem;color:var(--text3)">No daily mandate — pace it across the week however fits.</div></div>`;
  html += `<div class="sec-hdr"><span class="sec-title">Pipeline</span><span class="sec-link" onclick="openNewJob()">+ New</span></div>`;
  if (!jobs.length) html += `<div class="empty">No jobs saved yet.</div>`;
  JOB_STATUSES.forEach((status) => {
    const inStatus = jobs.filter((j) => j.status === status);
    if (!inStatus.length) return;
    inStatus.forEach((j) => {
      html += `<div class="list-item" onclick="openJobDetail('${j.id}')">
        <div class="li-top"><span class="li-title">${j.company} — ${j.position}</span><span class="status-chip status-${j.status}">${j.status}</span></div>
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
      const pct = Math.min(100, Math.round((wp.completed / wp.target) * 100));
      html += `<div class="mission-card${m.weight==='primary'?' primary':''}">
        <div class="mc-top"><span class="mc-name">${MISSION_ICON[m.id]||''} ${m.name}</span><span style="font-size:0.63rem;color:var(--text3)">${wp.completed}/${wp.target}</span></div>
        <div class="mc-track"><div class="mc-fill" style="width:${pct}%"></div></div>
        <div class="mc-meta">${weeklySummaryLine(m, wp)}</div>
      </div>`;
    });
  });
  return html;
}

// ── HISTORY ────────────────────────────────────────────
function renderHistory(S) {
  let html = `<div class="hero"><div class="hero-eyebrow">Your journey</div><h1 class="hero-title">Day <em>History</em></h1>
    <p class="hero-sub">Every logged day is a step forward.</p></div>`;
  html += `<button class="btn ghost block" style="margin-bottom:11px" onclick="switchViewByName('review')">📈 View Monthly Review</button>`;
  html += `<div id="hist-list"></div>`;
  return html;
}
function renderHistoryList(keys, logsById, missions) {
  if (!keys.length) return `<div class="empty">No days logged yet. Start today ✨</div>`;
  return keys.map((k) => {
    const log = logsById[k];
    const score = dailyCompletionScore(log, missions);
    const prayerDone = Object.values(log.prayers).filter(Boolean).length;
    return `<div class="list-item" onclick="viewHistoryDay('${k}')">
      <div class="li-top"><span class="li-title">${fmtKey(k)}</span><span style="color:var(--gold);font-weight:700">${score}%</span></div>
      <div class="li-sub">🕌 ${prayerDone}/5 prayers${log.recoveryActive ? ' · 🌊 recovery day' : ''}${log.reflection?.accomplished ? ' · "'+log.reflection.accomplished.slice(0,40)+'"' : ''}</div>
    </div>`;
  }).join('');
}

// ── MONTHLY REVIEW ─────────────────────────────────────
function renderReview(S) {
  const { monthly, yearMonth } = S;
  let html = `<div class="hero"><div class="hero-eyebrow">${yearMonth}</div><h1 class="hero-title">Monthly <em>Review</em></h1></div>`;
  html += `<div class="stats-g">
    <div class="sc"><div class="sc-v">${monthly.daysLogged}</div><div class="sc-l">Days logged</div></div>
    <div class="sc"><div class="sc-v">${monthly.avgEnergy || '—'}</div><div class="sc-l">Avg energy</div></div>
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
    <div class="field"><label>What improved?</label><textarea id="rev-improved" placeholder="..."></textarea></div>
    <div class="field"><label>What is stuck?</label><textarea id="rev-stuck" placeholder="..."></textarea></div>
    <div class="field"><label>What should change next month?</label><textarea id="rev-change" placeholder="..."></textarea></div>
    <button class="btn primary block" onclick="saveMonthlyNotes()">Save Notes</button>
  </div>`;
  return html;
}

function fmtKeyLong(k) { const d = new Date(k + 'T00:00:00'); return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
