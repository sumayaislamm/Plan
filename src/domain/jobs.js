// ═══════════════════════════════════════════════════════
// JOB TRACKER
// ═══════════════════════════════════════════════════════
const JOB_STATUSES = ['Saved', 'Preparing', 'Applied', 'Assessment', 'Interview', 'Offer', 'Rejected'];

async function loadJobs() { return await storeGet('jobs', []); }
async function saveJobs(j) { await storeSet('jobs', j); }

function newJob({ company, position, url }) {
  return { id: 'job_' + Date.now(), company, position, url: url || '', dateApplied: null, status: 'Saved',
    cvVersion: '', coverLetter: '', interviewStage: '', notes: '', followUpDate: null };
}
function jobsThisWeek(jobs, weekStart) {
  const weekEnd = addDays(weekStart, 7);
  return jobs.filter((j) => j.dateApplied && j.dateApplied >= weekStart && j.dateApplied < weekEnd && j.status !== 'Saved');
}
