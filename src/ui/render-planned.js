// ═══════════════════════════════════════════════════════
// RENDER — Planned Work (isolated). "📌 Planned for Today" + "Upcoming",
// both on the Today page. Reuses existing card/checkbox/list-item styling
// verbatim — no new CSS.
// ═══════════════════════════════════════════════════════
function renderPlannedForTodaySection(todayItems, readonly, viewingKey) {
  const title = readonly ? '📌 Planned Work' : '📌 Planned for Today';
  let html = `<div class="sec-hdr"><span class="sec-title">${title}</span>${readonly ? '' : `<span class="sec-link" onclick="openNewPlannedWork()">+ Add</span>`}</div>`;
  if (!todayItems.length) {
    html += `<div class="card" style="text-align:center;color:var(--text3);font-size:0.72rem;font-style:italic">${readonly ? 'Nothing was planned for this day.' : 'Nothing planned for today.'}</div>`;
  } else {
    html += renderPlannedWorkList(todayItems, readonly);
  }
  return html;
}

function renderUpcomingPlannedSection(items) {
  if (!items.length) return '';
  let html = `<div class="sec-hdr"><span class="sec-title">Upcoming</span></div>`;
  const byDate = {};
  items.forEach((e) => { (byDate[e.date] ||= []).push(e); });
  Object.keys(byDate).forEach((date) => {
    html += `<div style="font-size:0.6rem;color:var(--gold);text-transform:uppercase;letter-spacing:0.07em;margin:9px 0 4px">${fmtKeyS(date)}</div>`;
    html += renderPlannedWorkList(byDate[date], false);
  });
  return html;
}

function renderPlannedWorkList(items, readonly) {
  let html = `<div class="card">`;
  items.forEach((e) => {
    html += `<div class="hc" style="margin-bottom:6px;${readonly?'':'cursor:pointer'}" ${readonly ? '' : `onclick="togglePlannedWorkDone('${e.id}')"`}>
      <div class="hc-box">${e.completed ? '✓' : ''}</div>
      <div style="flex:1;min-width:0">
        <div class="hc-name" style="${e.completed?'text-decoration:line-through;color:var(--text3)':''}">${esc(e.title)}</div>
        ${e.notes ? `<div class="hc-sub">${esc(e.notes)}</div>` : ''}
      </div>
      ${!readonly ? `<div style="display:flex;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
        <button onclick="openEditPlannedWork('${e.id}')" style="background:var(--surface2);border:1px solid var(--border2);color:var(--text2);border-radius:6px;width:24px;height:24px;font-size:0.6rem;cursor:pointer">✎</button>
        <button onclick="confirmDeletePlannedWork('${e.id}')" style="background:var(--surface2);border:1px solid var(--border2);color:var(--text2);border-radius:6px;width:24px;height:24px;font-size:0.6rem;cursor:pointer">✕</button>
      </div>` : ''}
    </div>`;
  });
  html += `</div>`;
  return html;
}

function renderPlannedWorkForm(item, defaultDate) {
  const isEdit = !!item;
  const v = item || { date: defaultDate, title: '', notes: '' };
  return `<div class="modal-handle"></div><div class="modal-title">${isEdit ? 'Edit' : 'New'} Planned Work</div>
    <div class="field"><label>Date</label><input type="date" id="pw-date" value="${v.date}"/></div>
    <div class="field"><label>Task title</label><input type="text" id="pw-title" value="${escAttr(v.title)}" placeholder="e.g. IELTS Writing mock test"/></div>
    <div class="field"><label>Notes (optional)</label><textarea id="pw-notes">${esc(v.notes)}</textarea></div>
    <div id="pw-err" style="font-size:0.65rem;color:var(--red);display:none;margin-bottom:8px"></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" onclick="${isEdit ? `saveEditPlannedWork('${item.id}')` : 'saveNewPlannedWork()'}">Save</button></div>`;
}

// ── History block ──
function renderPlannedWorkHistoryBlock(items) {
  if (!items || !items.length) return '';
  let html = `<div class="sec-hdr"><span class="sec-title">Planned Work</span></div><div class="card">`;
  items.forEach((e) => {
    html += `<div style="font-size:0.75rem;padding:5px 0;border-bottom:1px solid var(--border)">${e.completed ? '✓' : '○'} ${esc(e.title)}${e.notes ? `<div style="font-size:0.65rem;color:var(--text3)">${esc(e.notes)}</div>` : ''}</div>`;
  });
  html += `</div>`;
  return html;
}
