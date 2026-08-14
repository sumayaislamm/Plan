// ═══════════════════════════════════════════════════════
// STORAGE — localStorage is the source of truth offline;
// Supabase (optional) syncs a generic key→value table so every
// domain (missions, logs, ielts, projects, jobs, time entries...) shares
// one sync path. Client only ever uses a public anon key — never a
// service-role key or other privileged credential.
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

// Returns parsed JSON ONLY on a genuine 2xx response. Any non-2xx status,
// network failure, or unparsable body is treated as failure (null) — never
// as valid data. This is what lets testSupabaseConnection/storeGet/storeSet
// report sync state honestly instead of a false "synced" on a 401/500.
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
    if (!r.ok) return null; // 4xx/5xx are failures, never treated as valid data
    const t = await r.text();
    if (!t) return method === 'GET' ? [] : true; // empty 2xx body (return=minimal) still counts as success
    try { return JSON.parse(t); } catch (e) { return null; } // malformed JSON is a failure, not "success with garbage"
  } catch (e) { return null; } // network error
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
// A failed remote read/write NEVER wipes or overwrites good local data.
async function storeGet(key, fallback) {
  if (syncEnabled) {
    setSyncDot('syncing');
    const r = await sbReq('GET', `${KV_TABLE}?key=eq.${encodeURIComponent(key)}&select=value`);
    if (r === null) { setSyncDot('error'); return lsGet(key, fallback); } // remote failed — fall back to local, don't pretend success
    setSyncDot('synced');
    if (Array.isArray(r) && r.length > 0) { lsSet(key, r[0].value); return r[0].value; }
    return lsGet(key, fallback); // remote has nothing for this key yet — use local
  }
  return lsGet(key, fallback);
}
async function storeSet(key, value) {
  lsSet(key, value); // local write always happens first and always succeeds independently of sync
  if (syncEnabled) {
    setSyncDot('syncing');
    const r = await sbReq('POST', KV_TABLE, { key, value, updated_at: new Date().toISOString() });
    setSyncDot(r !== null ? 'synced' : 'error');
  }
}
// Merge-safe: returns the union of remote keys matching a prefix, used to
// discover history/time-entries that exist on the server but not locally.
async function remoteKeysWithPrefix(prefix) {
  if (!syncEnabled) return [];
  const r = await sbReq('GET', `${KV_TABLE}?key=like.${encodeURIComponent(prefix)}*&select=key`);
  return Array.isArray(r) ? r.map((row) => row.key) : [];
}
// Bulk hydration: one request pulls every remote row for a prefix (e.g. all
// `log_*` days) into local cache. Used once on a fresh device/session so a
// local-only pass (like the momentum rebuild) sees real data immediately
// instead of scoring un-cached remote days as 0.
async function hydrateLocalCacheForPrefix(prefix) {
  if (!syncEnabled) return;
  const r = await sbReq('GET', `${KV_TABLE}?key=like.${encodeURIComponent(prefix)}*&select=*`);
  if (Array.isArray(r)) r.forEach((row) => { if (row.key && lsGet(row.key, undefined) === undefined) lsSet(row.key, row.value); });
}
