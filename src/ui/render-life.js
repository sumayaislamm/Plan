// ═══════════════════════════════════════════════════════
// RENDER — Life tab (Cooking Journal + Religious Journal). Isolated;
// reuses existing .card/.list-item/.pill/.sec-hdr classes throughout —
// no new component CSS needed.
// ═══════════════════════════════════════════════════════
function stars(rating) { return rating ? '⭐'.repeat(rating) + '☆'.repeat(5 - rating) : ''; }

// ── MAIN LIFE TAB ────────────────────────────────────────
function renderLife(L) {
  const { cookingEntries, searchQuery, religiousDates } = L;
  let html = `<div class="hero"><div class="hero-eyebrow">Life</div><h1 class="hero-title">Cooking & <em>Religious Journal</em></h1>
    <p class="hero-sub">A record of what you actually did — not a mission, not a target.</p></div>`;

  html += renderCookingSection(cookingEntries, searchQuery);
  html += renderReligiousJournalSection(religiousDates);

  return html;
}

// ── COOKING ──────────────────────────────────────────────
function renderCookingSection(cookingEntries, searchQuery) {
  let html = `<div class="sec-hdr"><span class="sec-title">🍳 Cooking</span><span class="sec-link" onclick="openNewCookingEntry()">+ Add Cooking Entry</span></div>`;
  html += `<div class="field" style="margin-bottom:9px"><input type="text" id="cooking-search" placeholder="Search dish, tips, result..." value="${escAttr(searchQuery || '')}" oninput="setCookingSearch(this.value)"/></div>`;

  const results = searchCookingEntries(cookingEntries, searchQuery);
  if (!results.length) {
    html += `<div class="empty">${searchQuery ? 'No matching entries.' : 'No cooking entries yet.'}</div>`;
  } else {
    results.forEach((e) => {
      html += `<div class="list-item" onclick="openCookingDetail('${e.id}')">
        <div class="li-top"><span class="li-title">${esc(e.dish)}</span><span style="color:var(--gold)">${stars(e.rating)}</span></div>
        <div class="li-sub">${fmtKeyS(e.date)}${e.source ? ' · ' + esc(e.source) : ''}${e.wouldCookAgain === true ? ' · would cook again' : e.wouldCookAgain === false ? ' · wouldn\'t repeat' : ''}</div>
      </div>`;
    });
  }
  return html;
}

function renderCookingDetail(e) {
  let html = `<div class="modal-handle"></div><div class="modal-title">${esc(e.dish)}</div>`;
  html += `<div style="font-size:0.7rem;color:var(--text3);margin-bottom:10px">${fmtKeyLong(e.date)}</div>`;
  if (e.rating) html += `<div style="font-size:0.9rem;color:var(--gold);margin-bottom:8px">${stars(e.rating)}</div>`;
  if (e.source) html += `<div style="font-size:0.75rem;margin-bottom:6px"><span style="color:var(--gold)">Source:</span> ${esc(e.source)}</div>`;
  if (e.sourceUrl) html += `<div style="font-size:0.75rem;margin-bottom:6px"><span style="color:var(--gold)">URL:</span> ${esc(e.sourceUrl)}</div>`;
  if (e.cookingTime) html += `<div style="font-size:0.75rem;margin-bottom:6px"><span style="color:var(--gold)">Cooking time:</span> ${dur$(e.cookingTime)}</div>`;
  if (e.result) html += `<div style="font-size:0.75rem;margin-bottom:6px"><span style="color:var(--gold)">Result:</span> ${esc(e.result)}</div>`;
  if (e.tips) html += `<div style="font-size:0.75rem;margin-bottom:6px"><span style="color:var(--gold)">Tips:</span> ${esc(e.tips)}</div>`;
  if (e.nextTimeChanges) html += `<div style="font-size:0.75rem;margin-bottom:6px"><span style="color:var(--gold)">Next time:</span> ${esc(e.nextTimeChanges)}</div>`;
  if (e.wouldCookAgain !== null) html += `<div style="font-size:0.75rem;margin-bottom:10px"><span style="color:var(--gold)">Would cook again:</span> ${e.wouldCookAgain ? 'Yes' : 'No'}</div>`;
  html += `<div class="modal-btns"><button class="btn block" onclick="closeModal()">Close</button>
    <button class="btn block" onclick="openEditCookingEntry('${e.id}')">Edit</button>
    <button class="btn primary block" style="background:var(--red)" onclick="confirmDeleteCookingEntry('${e.id}')">Delete</button></div>`;
  return html;
}

function renderCookingForm(e) {
  const isEdit = !!e;
  const v = e || { date: '', dish: '', source: '', sourceUrl: '', cookingTime: '', result: '', rating: '', tips: '', nextTimeChanges: '', wouldCookAgain: null };
  return `<div class="modal-handle"></div><div class="modal-title">${isEdit ? 'Edit' : 'New'} Cooking Entry</div>
    <div class="field"><label>Date</label><input type="date" id="cf-date" value="${v.date || getDateKey(new Date())}"/></div>
    <div class="field"><label>Dish / Recipe</label><input type="text" id="cf-dish" value="${escAttr(v.dish)}" placeholder="e.g. Chicken Curry"/></div>
    <div class="field"><label>Recipe source</label><input type="text" id="cf-source" value="${escAttr(v.source)}" placeholder="YouTube, cookbook..."/></div>
    <div class="field"><label>Recipe URL (optional)</label><input type="text" id="cf-url" value="${escAttr(v.sourceUrl)}" placeholder="https://..."/></div>
    <div class="field"><label>Cooking time (minutes, optional)</label><input type="number" min="1" id="cf-time" value="${v.cookingTime || ''}"/></div>
    <div class="field"><label>Result</label><textarea id="cf-result">${esc(v.result)}</textarea></div>
    <div class="field"><label>Rating (1-5)</label><input type="number" min="1" max="5" id="cf-rating" value="${v.rating || ''}"/></div>
    <div class="field"><label>Important tips</label><textarea id="cf-tips">${esc(v.tips)}</textarea></div>
    <div class="field"><label>What I'd change next time</label><textarea id="cf-changes">${esc(v.nextTimeChanges)}</textarea></div>
    <div class="field"><label>Would cook again?</label>
      <div class="pill-row">
        <button type="button" class="pill${v.wouldCookAgain===true?' active':''}" onclick="setCookAgainField(true)">Yes</button>
        <button type="button" class="pill${v.wouldCookAgain===false?' active':''}" onclick="setCookAgainField(false)">No</button>
      </div>
    </div>
    <div id="cf-err" style="font-size:0.65rem;color:var(--red);display:none;margin:6px 0"></div>
    <div class="modal-btns"><button class="btn block" onclick="${isEdit ? `openCookingDetail('${e.id}')` : 'closeModal()'}">Cancel</button>
    <button class="btn primary block" onclick="${isEdit ? `saveEditCookingEntry('${e.id}')` : 'saveNewCookingEntry()'}">Save</button></div>`;
}

// ── History block ──
function renderCookingHistoryBlock(entries) {
  if (!entries || !entries.length) return '';
  let html = `<div class="sec-hdr"><span class="sec-title">Cooking</span></div><div class="card">`;
  entries.forEach((e) => {
    html += `<div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:5px 0;border-bottom:1px solid var(--border)"><span>🍲 ${esc(e.dish)}</span><span style="color:var(--gold)">${stars(e.rating)}</span></div>`;
  });
  html += `</div>`;
  return html;
}

// ── RELIGIOUS JOURNAL ────────────────────────────────────
function renderReligiousJournalSection(religiousDates) {
  let html = `<div class="sec-hdr"><span class="sec-title">🕌 Religious Journal</span><span class="sec-link" onclick="openReligiousJournalEntry('${getDateKey(new Date())}')">+ Add Religious Entry</span></div>`;
  if (!religiousDates.length) {
    html += `<div class="empty">No journal entries yet.</div>`;
  } else {
    religiousDates.forEach((d) => {
      html += `<div class="list-item" onclick="openReligiousJournalEntry('${d}')"><div class="li-top"><span class="li-title">${fmtKey(d)}</span></div></div>`;
    });
  }
  return html;
}

function renderReligiousJournalForm(day) {
  let html = `<div class="modal-handle"></div><div class="modal-title">Religious Journal — ${fmtKeyLong(day.date)}</div>
    <div id="rj-activities">`;
  day.activities.forEach((a) => { html += renderActivityRow(a); });
  html += `</div>
    <div class="sec-link" style="display:block;margin:4px 0 12px" onclick="addActivityRow()">+ Add activity</div>
    <div class="field"><label>Notes</label><textarea id="rj-notes">${esc(day.notes)}</textarea></div>
    <div class="modal-btns"><button class="btn block" onclick="closeModal()">Cancel</button>
    <button class="btn primary block" style="background:var(--red)" onclick="confirmDeleteReligiousDay('${day.date}')">Delete Day</button>
    <button class="btn primary block" onclick="saveReligiousJournalEntry('${day.date}')">Save</button></div>`;
  return html;
}
function renderActivityRow(a) {
  const rid = a.id || ('new_' + Math.random().toString(36).slice(2, 8));
  return `<div class="card" data-activity-row="${rid}" style="margin-bottom:8px">
    <div class="field"><label>Activity</label><input type="text" class="rj-name" value="${escAttr(a.name || '')}" placeholder="e.g. Surah Yasin"/></div>
    <div style="display:flex;gap:6px">
      <div class="field" style="flex:1"><label>Count</label><input type="number" min="0" class="rj-count" value="${a.count ?? ''}"/></div>
      <div class="field" style="flex:1"><label>Unit</label><input type="text" class="rj-unit" value="${escAttr(a.unit || '')}" placeholder="x, pages..."/></div>
    </div>
    <div class="field"><label>Notes</label><input type="text" class="rj-notes" value="${escAttr(a.notes || '')}"/></div>
    <div class="sec-link" style="color:var(--red)" onclick="removeActivityRow('${rid}')">Remove</div>
  </div>`;
}

// ── History block ──
function renderReligiousJournalHistoryBlock(day) {
  if (!religiousDayHasActivity(day)) return '';
  let html = `<div class="sec-hdr"><span class="sec-title">Religious Journal</span></div><div class="card">`;
  day.activities.forEach((a) => {
    html += `<div style="font-size:0.75rem;padding:4px 0">${esc(a.name)}${a.count != null ? ` — ${a.count}${a.unit ? esc(a.unit) : 'x'}` : ''}</div>`;
  });
  if (day.notes) html += `<div style="font-size:0.68rem;color:var(--text3);margin-top:6px;font-style:italic">${esc(day.notes)}</div>`;
  html += `</div>`;
  return html;
}
