// ═══════════════════════════════════════════════════════
// PRAYER TIMES — Aladhan API, cached per day, geolocation-aware
// ═══════════════════════════════════════════════════════
const DEFAULT_LOC = { lat: 23.7461, lng: 90.3742, method: 1 }; // fallback: Dhaka

function getLocation() {
  try { const s = localStorage.getItem('los_location'); if (s) return JSON.parse(s); } catch (e) {}
  return DEFAULT_LOC;
}
function setLocation(lat, lng, method) {
  localStorage.setItem('los_location', JSON.stringify({ lat, lng, method: method || 1 }));
}
function requestGeolocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation(pos.coords.latitude, pos.coords.longitude); resolve(true); },
      () => resolve(false),
      { timeout: 6000 }
    );
  });
}

async function fetchPrayerTimes(dateKey) {
  const loc = getLocation();
  const cacheKey = `pt_${dateKey}_${loc.lat.toFixed(2)}_${loc.lng.toFixed(2)}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);
  try {
    const [y, m, d] = dateKey.split('-');
    const r = await fetch(`https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${loc.lat}&longitude=${loc.lng}&method=${loc.method || 1}`);
    const j = await r.json();
    if (j.code !== 200) throw new Error();
    const t = j.data.timings;
    const p = (s) => { const [h, m] = s.split(':').map(Number); return { h, m }; };
    const times = { fajr: p(t.Fajr), dhuhr: p(t.Dhuhr), asr: p(t.Asr), maghrib: p(t.Maghrib), isha: p(t.Isha) };
    localStorage.setItem(cacheKey, JSON.stringify(times));
    return times;
  } catch (e) {
    return { fajr: { h: 4, m: 0 }, dhuhr: { h: 12, m: 5 }, asr: { h: 15, m: 25 }, maghrib: { h: 18, m: 48 }, isha: { h: 20, m: 10 } };
  }
}
