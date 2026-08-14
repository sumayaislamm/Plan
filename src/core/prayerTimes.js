// ═══════════════════════════════════════════════════════
// PRAYER TIMES — Aladhan API, cached per (date, lat, lng, method), geolocation-aware.
// Cache key includes the calculation method so changing it can't silently
// reuse a stale calculation. Fallback times are explicitly flagged as such
// (never cached, never presented as if they were live API data).
// ═══════════════════════════════════════════════════════
const DEFAULT_LOC = { lat: 23.7461, lng: 90.3742, method: 1 }; // fallback: Dhaka

function validLat(n) { return typeof n === 'number' && isFinite(n) && n >= -90 && n <= 90; }
function validLng(n) { return typeof n === 'number' && isFinite(n) && n >= -180 && n <= 180; }

function getLocation() {
  try {
    const s = localStorage.getItem('los_location');
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed && validLat(parsed.lat) && validLng(parsed.lng)) {
        return { lat: parsed.lat, lng: parsed.lng, method: Number.isInteger(parsed.method) ? parsed.method : 1 };
      }
    }
  } catch (e) {}
  return DEFAULT_LOC;
}
function setLocation(lat, lng, method) {
  if (!validLat(lat) || !validLng(lng)) return false; // malformed coordinates never get stored
  localStorage.setItem('los_location', JSON.stringify({ lat, lng, method: Number.isInteger(method) ? method : 1 }));
  return true;
}
function requestGeolocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => { resolve(setLocation(pos.coords.latitude, pos.coords.longitude)); },
      () => resolve(false), // denial or error — never crashes, caller just keeps the existing/default location
      { timeout: 6000 }
    );
  });
}

const FALLBACK_TIMES = { fajr: { h: 4, m: 0 }, dhuhr: { h: 12, m: 5 }, asr: { h: 15, m: 25 }, maghrib: { h: 18, m: 48 }, isha: { h: 20, m: 10 } };

function parseHM(str) {
  if (typeof str !== 'string') return null;
  const clean = str.split(' ')[0]; // Aladhan sometimes appends a timezone suffix like "04:12 (+06)"
  const parts = clean.split(':').map(Number);
  if (parts.length !== 2 || parts.some((n) => !isFinite(n))) return null;
  const [h, m] = parts;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

async function fetchPrayerTimes(dateKey) {
  const loc = getLocation();
  const cacheKey = `pt_${dateKey}_${loc.lat.toFixed(2)}_${loc.lng.toFixed(2)}_m${loc.method}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) { try { return JSON.parse(cached); } catch (e) { /* corrupted cache entry — fall through to refetch */ } }
  try {
    const [y, m, d] = dateKey.split('-');
    const r = await fetch(`https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${loc.lat}&longitude=${loc.lng}&method=${loc.method}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (!j || j.code !== 200 || !j.data || !j.data.timings) throw new Error('malformed response');
    const t = j.data.timings;
    const times = { fajr: parseHM(t.Fajr), dhuhr: parseHM(t.Dhuhr), asr: parseHM(t.Asr), maghrib: parseHM(t.Maghrib), isha: parseHM(t.Isha), __source: 'api' };
    if (Object.values(times).some((v) => v && typeof v === 'object' && v !== times.__source && v === null)) throw new Error('unparseable timing');
    if (!times.fajr || !times.dhuhr || !times.asr || !times.maghrib || !times.isha) throw new Error('missing prayer field');
    localStorage.setItem(cacheKey, JSON.stringify(times));
    return times;
  } catch (e) {
    return { ...FALLBACK_TIMES, __source: 'fallback' }; // never cached — a later successful fetch should replace it immediately
  }
}
