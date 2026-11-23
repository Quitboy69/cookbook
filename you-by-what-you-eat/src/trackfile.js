/* Lauf aus einer GPX- oder TCX-Datei lesen (Strava: Aktivität → Original exportieren, oder GPX-Export) */
const R = 6371000;
const rad = x => x * Math.PI / 180;
const hav = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
const first = (el, name) => { const n = el.getElementsByTagNameNS('*', name)[0]; return n ? n.textContent.trim() : ''; };
const num = v => { const x = parseFloat(v); return isFinite(x) ? x : null; };
const pad = n => String(n).padStart(2, '0');
/* Uhrzeit in der Zeitzone des Handys, aber als "…Z" geschrieben – genau wie Strava es bei start_date_local macht */
export const localIso = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}Z`; };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

/* Höhenmeter mit Schwelle, damit GPS-Rauschen nicht mitzählt */
function gain(eles) {
  let g = 0, ref = null;
  for (const e of eles) {
    if (e == null) continue;
    if (ref == null) { ref = e; continue; }
    if (e - ref > 2.5) { g += e - ref; ref = e; } else if (ref - e > 2.5) ref = e;
  }
  return Math.round(g);
}
const kindOf = (s, kmh) => {
  const t = String(s || '').toLowerCase();
  if (/run|lauf|jog|^9$/.test(t)) return 'run';
  if (/bik|cycl|ride|rad|^1$/.test(t)) return 'bike';
  if (/walk|hik|geh|wander|^10$|^4$/.test(t)) return 'walk';
  if (!t) return kmh >= 6 && kmh <= 22 ? 'run' : 'unknown';
  return 'other';
};

function finish(x) {
  const km = Math.round(x.m / 100) / 10, sec = Math.round(x.sec);
  if (!x.start || !isFinite(x.start)) return { ok: false, error: 'In der Datei fehlt die Uhrzeit des Laufs.' };
  if (km < 0.2 || sec < 60) return { ok: false, error: 'Die Aktivität ist zu kurz (unter 200 m oder 1 Minute).' };
  const kmh = km / (sec / 3600);
  const kind = kindOf(x.sport, kmh);
  const startL = localIso(x.start);
  const rec = {
    id: 'f' + hash(startL + '|' + km + '|' + sec), src: 'file', date: startL.slice(0, 10), start: startL,
    name: x.name || 'Lauf', km, sec, min: Math.max(1, Math.round(sec / 60)),
    kcal: x.kcal || 0, hr: x.hr ? Math.round(x.hr) : null, hrMax: x.hrMax ? Math.round(x.hrMax) : null, elev: x.elev || 0
  };
  const warn = kind === 'bike' ? 'Das sieht nach Radfahren aus' : kind === 'walk' ? 'Das sieht nach Gehen/Wandern aus' : kind === 'other' ? 'Die Sportart ist kein Laufen' : kind === 'unknown' ? 'Die Sportart ist unklar' : '';
  return { ok: true, rec, warn };
}

function parseGpx(doc) {
  const pts = [...doc.getElementsByTagNameNS('*', 'trkpt')].map(p => ({
    lat: parseFloat(p.getAttribute('lat')), lon: parseFloat(p.getAttribute('lon')),
    ele: num(first(p, 'ele')), t: Date.parse(first(p, 'time')), hr: num(first(p, 'hr'))
  })).filter(p => isFinite(p.lat) && isFinite(p.lon));
  if (pts.length < 2) return { ok: false, error: 'In der GPX-Datei sind zu wenige Punkte.' };
  if (!pts.some(p => isFinite(p.t))) return { ok: false, error: 'Die GPX-Datei hat keine Zeitstempel (nur eine Route, kein aufgezeichneter Lauf).' };
  let m = 0, mov = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = hav(pts[i - 1], pts[i]), dt = (pts[i].t - pts[i - 1].t) / 1000;
    if (!isFinite(dt) || dt <= 0) { continue; }
    if (d / dt > 12) continue;                       // GPS-Sprung (> 43 km/h) ignorieren
    m += d; if (dt <= 20) mov += dt;                 // längere Lücken = Pause
  }
  const ts = pts.map(p => p.t).filter(isFinite);
  const elapsed = (ts[ts.length - 1] - ts[0]) / 1000;
  const hrs = pts.map(p => p.hr).filter(v => v != null && v > 30);
  const trk = doc.getElementsByTagNameNS('*', 'trk')[0];
  return finish({
    start: ts[0], m, sec: mov > 30 ? mov : elapsed, name: trk ? first(trk, 'name') : '', sport: trk ? first(trk, 'type') : '',
    elev: gain(pts.map(p => p.ele)), hr: hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : 0, hrMax: hrs.length ? Math.max(...hrs) : 0
  });
}

function parseTcx(doc) {
  const act = doc.getElementsByTagNameNS('*', 'Activity')[0];
  if (!act) return { ok: false, error: 'In der TCX-Datei steckt keine Aktivität.' };
  const laps = [...act.getElementsByTagNameNS('*', 'Lap')];
  let m = 0, sec = 0, kcal = 0, hrw = 0, hrt = 0, hrMax = 0;
  for (const l of laps) {
    const t = num(first(l, 'TotalTimeSeconds')) || 0;
    m += num(first(l, 'DistanceMeters')) || 0; sec += t; kcal += num(first(l, 'Calories')) || 0;
    const avg = l.getElementsByTagNameNS('*', 'AverageHeartRateBpm')[0], mx = l.getElementsByTagNameNS('*', 'MaximumHeartRateBpm')[0];
    if (avg) { const v = num(first(avg, 'Value')); if (v) { hrw += v * t; hrt += t; } }
    if (mx) hrMax = Math.max(hrMax, num(first(mx, 'Value')) || 0);
  }
  const tps = [...act.getElementsByTagNameNS('*', 'Trackpoint')];
  if (!m) { for (const p of tps) { const d = num(first(p, 'DistanceMeters')); if (d != null) m = Math.max(m, d); } }
  const eles = tps.map(p => num(first(p, 'AltitudeMeters')));
  const startStr = first(act, 'Id') || (laps[0] && laps[0].getAttribute('StartTime')) || '';
  return finish({
    start: Date.parse(startStr), m, sec, kcal, name: '', sport: act.getAttribute('Sport') || '',
    elev: gain(eles), hr: hrt ? hrw / hrt : 0, hrMax
  });
}

export function parseTrack(text) {
  let doc;
  try { doc = new DOMParser().parseFromString(String(text), 'application/xml'); } catch (e) { return { ok: false, error: 'Die Datei konnte nicht gelesen werden.' }; }
  if (doc.getElementsByTagName('parsererror').length) return { ok: false, error: 'Das ist keine gültige GPX/TCX-Datei (FIT-Dateien werden noch nicht gelesen).' };
  if (doc.getElementsByTagNameNS('*', 'trkpt').length) return parseGpx(doc);
  if (doc.getElementsByTagNameNS('*', 'Activity').length) return parseTcx(doc);
  return { ok: false, error: 'Weder GPX- noch TCX-Lauf gefunden.' };
}
