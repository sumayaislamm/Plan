// ═══════════════════════════════════════════════════════
// SAFE — escaping helpers. Every piece of user-controlled text (project/
// feature/task names, job fields, notes, reflections, IELTS notes, monthly
// review notes) must pass through esc() before being placed in innerHTML.
// ═══════════════════════════════════════════════════════
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
// For text placed inside an already-single-quoted onclick="...('...')" argument.
function escAttr(str) { return esc(str).replace(/`/g, '&#96;'); }
