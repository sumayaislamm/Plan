// ═══════════════════════════════════════════════════════
// TIME ENGINE (preserved from the original app, unchanged math)
// ═══════════════════════════════════════════════════════
const a$ = (h, m) => h * 60 + m;
const hm$ = (a) => { const n = ((a % 1440) + 1440) % 1440; return { h: Math.floor(n / 60), m: n % 60 }; };
const fmt$ = (h, m) => { const hh = ((h % 24) + 24) % 24, ap = hh >= 12 ? 'PM' : 'AM', h12 = hh % 12 || 12; return `${h12}:${String(m).padStart(2, '0')} ${ap}`; };
const fmtA$ = (a) => { const { h, m } = hm$(a); return fmt$(h, m); };
const dur$ = (m) => { if (m <= 0) return ''; const h = Math.floor(m / 60), mm = m % 60; return h > 0 && mm > 0 ? `${h}h ${mm}m` : h > 0 ? `${h}h` : `${mm}m`; };

function getDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmtKey(k) { const [y, m, d] = k.split('-'); const M = ['January','February','March','April','May','June','July','August','September','October','November','December']; return `${M[+m - 1]} ${+d}, ${y}`; }
function fmtKeyS(k) { const [, m, d] = k.split('-'); const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${M[+m - 1]} ${+d}`; }
function weekStartKey(d) { const dt = new Date(d); const day = dt.getDay(); dt.setDate(dt.getDate() - day); return getDateKey(dt); }
function addDays(key, n) { const d = new Date(key + 'T00:00:00'); d.setDate(d.getDate() + n); return getDateKey(d); }
function daysBetween(k1, k2) { const d1 = new Date(k1 + 'T00:00:00'), d2 = new Date(k2 + 'T00:00:00'); return Math.round((d2 - d1) / 86400000); }
