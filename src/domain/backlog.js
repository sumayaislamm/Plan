// ═══════════════════════════════════════════════════════
// NO BACKLOG ANXIETY
// Never shows "N overdue tasks." Surfaces stale items one at a time with
// "Still important?" → reschedule (bump date) or discard (archive).
// ═══════════════════════════════════════════════════════
const STALE_DAYS_IELTS = 5;
const STALE_DAYS_PROJECT_TASK = 7;

function staleIeltsTasks(ielts, todayKey) {
  return ielts.tasks.filter((t) => t.status === 'planned' && daysBetween(t.date, todayKey) >= STALE_DAYS_IELTS);
}
function staleProjectTasks(projects, todayKey) {
  const out = [];
  projects.forEach((p) => p.features.forEach((f) => f.tasks.forEach((t) => {
    if (t.status === 'todo' && t.createdAt && daysBetween(t.createdAt, todayKey) >= STALE_DAYS_PROJECT_TASK) {
      out.push({ project: p, feature: f, task: t });
    }
  })));
  return out;
}
function overdueJobFollowUps(jobs, todayKey) {
  return jobs.filter((j) => j.followUpDate && j.followUpDate < todayKey && !['Offer', 'Rejected'].includes(j.status));
}

// One item at a time, never a count-based "pile"
function nextBacklogPrompt(ielts, projects, jobs, todayKey) {
  const si = staleIeltsTasks(ielts, todayKey);
  if (si.length) return { kind: 'ielts', item: si[0] };
  const sp = staleProjectTasks(projects, todayKey);
  if (sp.length) return { kind: 'project', item: sp[0] };
  const oj = overdueJobFollowUps(jobs, todayKey);
  if (oj.length) return { kind: 'job', item: oj[0] };
  return null;
}
