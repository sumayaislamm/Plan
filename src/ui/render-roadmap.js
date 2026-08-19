// ═══════════════════════════════════════════════════════
// RENDER — Project Roadmap (isolated). Replaces only the features-loop
// portion of the existing renderProjectDetail; task rendering itself is
// copied verbatim from the original implementation so task behavior is
// pixel-for-pixel unchanged.
// ═══════════════════════════════════════════════════════
function renderFeatureRoadmap(project) {
  const completed = project.features.filter((f) => f.status === 'completed');
  const planned = project.features.filter((f) => f.status !== 'completed');
  let html = '';
  if (completed.length) {
    html += `<div class="mission-group-title">✓ Completed Features</div>`;
    completed.forEach((f) => { html += renderFeatureBlock(project, f); });
  }
  html += `<div class="mission-group-title">○ Future Features</div>`;
  if (!planned.length) html += `<div class="empty">No planned features yet.</div>`;
  planned.forEach((f) => { html += renderFeatureBlock(project, f); });
  return html;
}

function renderFeatureBlock(project, f) {
  const isDone = f.status === 'completed';
  let html = `<div class="sec-hdr">
    <span class="sec-title" style="font-size:0.82rem">${isDone ? '✓' : '○'} ${esc(f.name)}</span>
    <span style="display:flex;gap:8px;flex-shrink:0">
      <span class="sec-link" onclick="toggleFeatureCompletion('${project.id}','${f.id}')">${isDone ? 'Mark Planned' : 'Mark Completed'}</span>
      <span class="sec-link" onclick="openEditFeature('${project.id}','${f.id}')">Edit</span>
      <span class="sec-link" style="color:var(--red)" onclick="confirmDeleteFeature('${project.id}','${f.id}')">Delete</span>
    </span>
  </div>`;
  html += `<div class="sec-link" style="display:block;margin-bottom:6px" onclick="openNewTask('${project.id}','${f.id}')">+ Task</div>`;
  // Task rendering copied verbatim from the original renderProjectDetail — unchanged behavior.
  f.tasks.forEach((t) => {
    const subDone = t.subtasks.filter((s) => s.done).length;
    html += `<div class="list-item" onclick="toggleProjectTask('${project.id}','${f.id}','${t.id}')">
      <div class="li-top"><span class="li-title" style="${t.status==='done'?'text-decoration:line-through;color:var(--text3)':''}">${esc(t.name)}</span>
      <span class="status-chip status-${t.status==='done'?'Offer':'Preparing'}">${t.status}</span></div>
      ${t.subtasks.length ? `<div class="li-sub">${subDone}/${t.subtasks.length} subtasks</div>` : ''}
    </div>`;
  });
  return html;
}
