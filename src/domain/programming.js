// ═══════════════════════════════════════════════════════
// PROGRAMMING — output/project based, not just hours logged
// ═══════════════════════════════════════════════════════
async function loadProjects() { return normalizeProjects(await storeGet('projects', [])); }
async function saveProjects(p) { await storeSet('projects', p); }

function newProject(name) { return { id: 'proj_' + Date.now(), name, status: 'active', features: [] }; }
function newFeature(name) { return { id: 'feat_' + Date.now(), name, tasks: [] }; }
function newTask(name) { return { id: 'task_' + Date.now(), name, status: 'todo', subtasks: [], createdAt: getDateKey(new Date()), completedAt: null }; }
function newSubtask(name) { return { id: 'sub_' + Date.now(), name, done: false }; }

function projectProgress(project) {
  let total = 0, done = 0;
  project.features.forEach((f) => f.tasks.forEach((t) => {
    if (t.subtasks.length) { total += t.subtasks.length; done += t.subtasks.filter((s) => s.done).length; }
    else { total += 1; done += t.status === 'done' ? 1 : 0; }
  }));
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
function activeProject(projects) { return projects.find((p) => p.status === 'active') || projects[0] || null; }
function completedTasksCount(projects) {
  let n = 0;
  projects.forEach((p) => p.features.forEach((f) => f.tasks.forEach((t) => { if (t.status === 'done') n++; })));
  return n;
}
// Task OUTPUT completed within a week — a separate metric from Programming FOCUSED TIME.
// Never invents minutes; toggling a task on/off only ever affects this count once, via completedAt.
function tasksCompletedInRange(projects, startDate, endDateExclusive) {
  let n = 0;
  projects.forEach((p) => p.features.forEach((f) => f.tasks.forEach((t) => {
    if (t.status === 'done' && t.completedAt && t.completedAt >= startDate && t.completedAt < endDateExclusive) n++;
  })));
  return n;
}
// Same idea but returns the actual completed items (not just a count) — used by History's daily retrospective.
function tasksCompletedOnDate(projects, date) {
  const out = [];
  (projects || []).forEach((p) => (p.features || []).forEach((f) => (f.tasks || []).forEach((t) => {
    if (t.status === 'done' && t.completedAt === date) out.push({ projectName: p.name, featureName: f.name, taskName: t.name });
  })));
  return out;
}
function normalizeProjects(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p) => p && p.id && p.name).map((p) => ({
    id: p.id, name: p.name, status: p.status === 'archived' ? 'archived' : 'active',
    features: Array.isArray(p.features) ? p.features.filter((f) => f && f.id).map((f) => ({
      id: f.id, name: f.name || '',
      tasks: Array.isArray(f.tasks) ? f.tasks.filter((t) => t && t.id).map((t) => ({
        id: t.id, name: t.name || '', status: t.status === 'done' ? 'done' : 'todo',
        createdAt: t.createdAt || null, completedAt: t.completedAt || null,
        subtasks: Array.isArray(t.subtasks) ? t.subtasks.filter((s) => s && s.id) : [],
      })) : [],
    })) : [],
  }));
}
