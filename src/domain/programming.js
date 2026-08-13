// ═══════════════════════════════════════════════════════
// PROGRAMMING — output/project based, not just hours logged
// ═══════════════════════════════════════════════════════
async function loadProjects() { return await storeGet('projects', []); }
async function saveProjects(p) { await storeSet('projects', p); }

function newProject(name) { return { id: 'proj_' + Date.now(), name, status: 'active', features: [] }; }
function newFeature(name) { return { id: 'feat_' + Date.now(), name, tasks: [] }; }
function newTask(name) { return { id: 'task_' + Date.now(), name, status: 'todo', subtasks: [], createdAt: getDateKey(new Date()) }; }
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
