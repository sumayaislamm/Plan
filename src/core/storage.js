// ═══════════════════════════════════════════════════════
// STORAGE — localStorage is the source of truth offline;
// Supabase (optional) syncs a generic key→value table so every
// domain (missions, logs, ielts, projects, jobs...) shares one sync path.
// ═══════════════════════════════════════════════════════
const LOS_PREFIX = 'los_';
const KV_TABLE = 'los_kv';

let SB_URL = localStorage.getItem('sb_url') || '';
let SB_KEY = localStorage.getItem('sb_key') || '';
let syncEnabled = !!(SB_URL && SB_KEY);

function setSyncDot(s) { const el = document.getElementById('sync-dot'); if (el) el.className = 'sync-dot ' + s; }

function lsGet(key, fallback) {
  try { const r = localStorage.getItem(LOS_PREFIX + key); if (r !== null) return JSON.parse(r); } catch (e) {}
  return fallback;
}
function lsSet(key, value) {
  try { localStorage.setItem(LOS_PREFIX + key, JSON.stringify(value)); } catch (e) {}
}
function lsKeys(prefix) {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LOS_PREFIX + prefix)) out.push(k.slice(LOS_PREFIX.length));
  }
  return out;
}

async function sbReq(method, path, body) {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json',
        Prefer: method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const t = await r.text();
    return t ? JSON.parse(t) : [];
  } catch (e) { return null; }
}

async function testSupabaseConnection() {
  const r = await sbReq('GET', `${KV_TABLE}?select=key&limit=1`);
  return r !== null;
}

function saveSupabaseConfig(url, key) {
  SB_URL = url; SB_KEY = key;
  localStorage.setItem('sb_url', url); localStorage.setItem('sb_key', key);
  syncEnabled = true;
}

// Generic get/set that also pushes to Supabase when enabled.
async function storeGet(key, fallback) {
  if (syncEnabled) {
    setSyncDot('syncing');
    const r = await sbReq('GET', `${KV_TABLE}?key=eq.${encodeURIComponent(key)}&select=value`);
    setSyncDot(r !== null ? 'synced' : 'error');
    if (r && r.length > 0) { lsSet(key, r[0].value); return r[0].value; }
  }
  return lsGet(key, fallback);
}
async function storeSet(key, value) {
  lsSet(key, value);
  if (syncEnabled) {
    setSyncDot('syncing');
    const r = await sbReq('POST', KV_TABLE, { key, value, updated_at: new Date().toISOString() });
    setSyncDot(r !== null ? 'synced' : 'error');
  }
}
async function storeSyncAll(prefix) {
  if (!syncEnabled) return;
  const r = await sbReq('GET', `${KV_TABLE}?key=like.${encodeURIComponent(prefix)}*&select=*`);
  if (r) r.forEach((row) => lsSet(row.key, row.value));
}
