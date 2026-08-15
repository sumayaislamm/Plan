// ═══════════════════════════════════════════════════════
// JOB TRACKER
// A job counts as a canonical "application" once it has a dateApplied AND
// a status past Saved/Preparing — that single fact is the only source of
// truth for weekly application counts (no separate manual logging needed).
// ═══════════════════════════════════════════════════════
const JOB_STATUSES = ['Saved', 'Preparing', 'Applied', 'Assessment', 'Interview', 'Offer', 'Rejected'];

async function loadJobs() { return normalizeJobs(await storeGet('jobs', [])); }
async function saveJobs(j) { await storeSet('jobs', j); }

function newJob({ company, position, url }) {
  return { id: 'job_' + Date.now(), company: sanitizeNote(company), position: sanitizeNote(position),
    url: validateUrl(url) ?? '', dateApplied: null, status: 'Saved',
    cvVersion: '', coverLetter: '', interviewStage: '', notes: '', followUpDate: null };
}
function isApplicationStatus(status) { return status !== 'Saved' && status !== 'Preparing'; }
function jobsThisWeek(jobs, weekStart) {
  const weekEnd = addDays(weekStart, 7);
  return jobs.filter((j) => j.dateApplied && j.dateApplied >= weekStart && j.dateApplied < weekEnd && isApplicationStatus(j.status));
}
// Applications recorded on one exact date — used by History's daily retrospective.
function jobsAppliedOnDate(jobs, date) { return (jobs || []).filter((j) => j.dateApplied === date && isApplicationStatus(j.status)); }

// http(s) only. Returns null (reject, don't silently strip) for javascript:/data:/vbscript:/anything else.
function validateUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (trimmed === '') return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function normalizeJobs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((j) => j && j.id).map((j) => ({
    id: j.id, company: typeof j.company === 'string' ? j.company : '',
    position: typeof j.position === 'string' ? j.position : '',
    url: validateUrl(j.url) || '', dateApplied: typeof j.dateApplied === 'string' ? j.dateApplied : null,
    status: JOB_STATUSES.includes(j.status) ? j.status : 'Saved',
    cvVersion: typeof j.cvVersion === 'string' ? j.cvVersion : '',
    coverLetter: typeof j.coverLetter === 'string' ? j.coverLetter : '',
    interviewStage: typeof j.interviewStage === 'string' ? j.interviewStage : '',
    notes: typeof j.notes === 'string' ? j.notes : '',
    followUpDate: typeof j.followUpDate === 'string' ? j.followUpDate : null,
  }));
}
