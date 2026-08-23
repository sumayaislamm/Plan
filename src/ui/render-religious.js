// ═══════════════════════════════════════════════════════
// RENDER — Religious tab (isolated). Read-only summary view: the actual
// editing of prayers happens on Today (existing togglePrayerToday), and
// Istighfar/Dua Qunut/Durood/Quran editing happens via Today's Daily
// Commitments / Work Log sections. This tab never writes prayer or
// commitment state itself — it only reads the same canonical sources,
// so there is no possibility of a second, conflicting prayer/commitment
// representation.
// ═══════════════════════════════════════════════════════
function renderReligious(R) {
  const { date, isToday, log, prayerTimes, commitments, quranMinutes, religiousJournalDay, previousDates, canGoNext } = R;

  let html = `<div class="hero"><div class="hero-eyebrow">Religious</div><h1 class="hero-title">Deen <em>Tracker</em></h1>
    <p class="hero-sub">Prayers, dhikr, and Quran — all read from the same records as Today.</p></div>`;

  html += `<div style="display:flex;gap:8px;margin-bottom:14px">
    <button class="btn block" onclick="religiousPrevDay()">← Previous day</button>
    ${isToday ? '' : `<button class="btn block" onclick="religiousGoToday()">Today</button>`}
    <button class="btn block" onclick="religiousNextDay()" ${canGoNext ? '' : 'disabled'}>Next day →</button>
  </div>`;

  html += `<div class="sec-hdr"><span class="sec-title">${isToday ? 'Today' : fmtKeyLong(date)}</span></div>`;

  html += `<div class="sec-hdr" style="margin-top:8px"><span class="sec-title" style="font-size:0.82rem">🕌 Prayers</span></div>`;
  html += renderPrayerStrip(log, prayerTimes, true);
  if (isToday) html += `<div class="sec-link" style="text-align:center;display:block;margin:-4px 0 10px" onclick="switchViewByName('today')">Edit on Today →</div>`;

  html += `<div class="sec-hdr"><span class="sec-title" style="font-size:0.82rem">Dhikr</span></div>`;
  html += renderCommitmentsHistoryBlock({ ...emptyCommitments(date), istighfar: commitments.istighfar, duaQunut: commitments.duaQunut, durood: commitments.durood, leetcode: { completed: false }, walkingSteps: 0, githubPushes: 0 })
    || `<div class="card" style="text-align:center;color:var(--text3);font-size:0.72rem;font-style:italic">No dhikr logged.</div>`;

  html += `<div class="sec-hdr"><span class="sec-title" style="font-size:0.82rem">📖 Quran</span></div>`;
  html += `<div class="card"><div style="display:flex;justify-content:space-between;font-size:0.75rem">
    <span>Actual time</span><span style="color:var(--gold);font-weight:600">${quranMinutes > 0 ? fmtMin(quranMinutes) : '—'}</span>
  </div></div>`;
  if (isToday) html += `<div class="sec-link" style="text-align:center;display:block;margin:-4px 0 10px" onclick="switchViewByName('today')">Log time on Today →</div>`;

  html += renderReligiousJournalHistoryBlock(religiousJournalDay);

  if (previousDates.length) {
    html += `<div class="sec-hdr"><span class="sec-title">Previous Records</span><span class="sec-badge">${previousDates.length}</span></div>`;
    previousDates.forEach((d) => {
      html += `<div class="list-item" onclick="openReligiousDate('${d}')"><div class="li-top"><span class="li-title">${fmtKey(d)}</span></div></div>`;
    });
  }

  return html;
}
