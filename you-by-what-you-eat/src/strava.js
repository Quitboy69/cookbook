/* Strava: Läufe aus dem eigenen Strava-Konto holen (offizielle API, Lesezugriff).
   Jeder nutzt seine eigene kleine „API-Anwendung“ (strava.com/settings/api) – Schlüssel und Tokens bleiben nur auf dem Handy. */
import { S, save } from './store.js';
import { http, openExternal, isNative } from './native.js';
import * as SO from './social.js';

export const REDIRECT = 'ybwye://localhost';          // Rückkehr in die App (Callback-Domain in Strava: localhost)
export const MANUAL_REDIRECT = 'http://localhost/exchange_token';
const BASE = 'https://www.strava.com';
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

const sv = () => S.strava;
/* Cloud-Modus: Anmeldung und Abfragen laufen über den Server – die Freunde tippen nur „Verbinden“ */
export const server = { enabled: false, connected: false, athlete: '', checked: false };
export async function refreshServer() {
  if (!SO.online()) return false;
  try { const r = await SO.api('/api/strava/status'); const changed = r.enabled !== server.enabled || r.connected !== server.connected || r.athlete !== server.athlete; Object.assign(server, { enabled: !!r.enabled, connected: !!r.connected, athlete: r.athlete || '', checked: true }); return changed; } catch (e) { return false; }
}
const local = () => !!(S.strava && S.strava.refresh);
export const viaServer = () => server.connected && !local();
export async function startServerAuth() { const r = await SO.api('/api/strava/start', { method: 'POST' }); if (isNative) await openExternal(r.url); else location.assign(r.url); }
export const connected = () => local() || server.connected;
export const hasKeys = () => !!(S.strava && S.strava.cid && S.strava.secret);
export const validKeys = (cid, secret) => /^\d{3,10}$/.test(String(cid).trim()) && /^[0-9a-f]{20,64}$/i.test(String(secret).trim());
export function setKeys(cid, secret) { sv().cid = String(cid).trim(); sv().secret = String(secret).trim(); save(true); }

const err = (code, msg) => Object.assign(new Error(msg), { code });
const round1 = n => Math.round(n * 10) / 10, round2 = n => Math.round(n * 100) / 100;

/* ---------- Anmeldung ---------- */
export function authUrl(manual) {
  const q = new URLSearchParams({ client_id: sv().cid, redirect_uri: manual ? MANUAL_REDIRECT : REDIRECT, response_type: 'code', approval_prompt: 'auto', scope: 'read,activity:read_all' });
  return BASE + (manual ? '/oauth/authorize?' : '/oauth/mobile/authorize?') + q.toString();
}
export async function startAuth(manual) {
  if (!hasKeys()) throw err('keys', 'Erst Client-ID und Client-Secret eintragen.');
  sv().pending = Date.now(); save(true);
  await openExternal(authUrl(manual));
}
/* code/scope/error aus der Rückkehr-Adresse (oder aus einer eingefügten localhost-Adresse) holen */
export function parseAuth(url) {
  const pick = k => { const m = new RegExp('[?&]' + k + '=([^&#\\s]+)').exec(url || ''); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; };
  let code = pick('code');
  if (!code && /^[0-9a-f]{30,64}$/i.test(String(url || '').trim())) code = String(url).trim();   // nur der Code eingefügt
  return { code, scope: pick('scope'), error: pick('error') };
}
const form = o => new URLSearchParams(o).toString();
async function tokenCall(params) {
  const r = await http(BASE + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: form(params) });
  let j = {}; try { j = JSON.parse(r.text); } catch (e) { /* kein JSON */ }
  if (r.status === 429) throw err('limit', 'Strava-Limit erreicht – bitte in ein paar Minuten nochmal.');
  if (r.status >= 400 || !j.access_token) {
    const bad = (j.errors || []).map(e => e.field + ':' + e.code).join(' ');
    if (/client_id|client_secret/.test(bad)) throw err('keys', 'Strava kennt diese Client-ID/dieses Secret nicht. Bitte noch mal genau abtippen.');
    if (/code/.test(bad)) throw err('code', 'Der Code ist abgelaufen oder wurde schon benutzt. Bitte noch mal verbinden.');
    throw err('auth', 'Strava hat die Anmeldung abgelehnt (' + (j.message || r.status) + ').');
  }
  return j;
}
function apply(j) {
  const s = sv();
  s.access = j.access_token; s.refresh = j.refresh_token || s.refresh; s.exp = j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 21600));
  if (j.athlete) s.athlete = [j.athlete.firstname, j.athlete.lastname].filter(Boolean).join(' ') || j.athlete.username || s.athlete;
  s.pending = 0; save(true);
}
export async function redeem(code, scope) {
  if (scope && !/activity:read/.test(scope)) throw err('scope', 'Bei der Freigabe fehlte „Aktivitäten ansehen“. Bitte noch mal verbinden und den Haken gesetzt lassen.');
  apply(await tokenCall({ client_id: sv().cid, client_secret: sv().secret, code, grant_type: 'authorization_code' }));
}
export function disconnect() {
  if (viaServer()) { server.connected = false; SO.api('/api/strava', { method: 'DELETE' }).catch(() => {}); }
  const s = sv(); s.access = ''; s.refresh = ''; s.exp = 0; s.athlete = ''; s.last = 0; s.since = 0; s.pending = 0; save(true);
}

/* ---------- Abfragen ---------- */
async function token() {
  const s = sv();
  if (!s.refresh) throw err('auth', 'Nicht mit Strava verbunden.');
  if (s.access && s.exp > Date.now() / 1000 + 120) return s.access;
  apply(await tokenCall({ client_id: s.cid, client_secret: s.secret, grant_type: 'refresh_token', refresh_token: s.refresh }));
  return s.access;
}
async function getViaServer(path) {
  try { return await SO.api('/api/strava/api?path=' + encodeURIComponent(path), { timeout: 30000 }); }
  catch (e) {
    if (e.code === 429) throw err('limit', 'Strava-Limit erreicht – bitte in ein paar Minuten nochmal.');
    if (e.code === 'auth' || e.code === 401 || e.code === 403) { server.connected = false; throw err('auth', 'Die Strava-Verbindung ist abgelaufen. Bitte neu verbinden.'); }
    throw err('http', e.code === 'net' ? 'Keine Verbindung zum Server.' : 'Strava-Fehler: ' + e.message);
  }
}
async function get(path) {
  if (viaServer()) return getViaServer(path);
  const r = await http(BASE + '/api/v3' + path, { headers: { Authorization: 'Bearer ' + await token(), Accept: 'application/json' } });
  if (r.status === 429) throw err('limit', 'Strava-Limit erreicht – bitte in ein paar Minuten nochmal.');
  if (r.status === 401 || r.status === 403) {
    const miss = /activity:read|permission/i.test(r.text);
    if (!miss) sv().access = '';
    throw err(miss ? 'scope' : 'auth', miss ? 'Die Freigabe enthält keine Aktivitäten. Bitte neu verbinden und „Aktivitäten ansehen“ erlauben.' : 'Strava hat den Zugriff abgelehnt. Bitte neu verbinden.');
  }
  if (r.status >= 400) throw err('http', 'Strava-Fehler ' + r.status);
  try { return JSON.parse(r.text); } catch (e) { throw err('http', 'Unerwartete Antwort von Strava.'); }
}

/* Kalorien, falls Strava keine liefert: Laufen ≈ 1 kcal je kg und km */
const estKcal = km => Math.round(S.profile.weight * km);

export function fromStrava(a, detail) {
  const km = round2((a.distance || 0) / 1000), sec = Math.round(a.moving_time || a.elapsed_time || 0);
  const kcal = detail && detail.calories ? Math.round(detail.calories) : estKcal(km);
  return {
    id: 's' + a.id, src: 'strava', date: String(a.start_date_local || '').slice(0, 10), start: a.start_date_local || '',
    name: a.name || 'Lauf', km, sec, min: Math.max(1, Math.round(sec / 60)), kcal,
    hr: a.average_heartrate ? Math.round(a.average_heartrate) : null, hrMax: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    elev: Math.round(a.total_elevation_gain || 0)
  };
}

/* ---------- Läufe speichern und dem Tag zuordnen ---------- */
export const visible = () => Object.values(S.runs || {}).filter(r => !r.hidden).sort((a, b) => (b.start || '').localeCompare(a.start || ''));
export function applyDay(date) {
  const rs = Object.values(S.runs).filter(r => r.date === date && !r.hidden);
  if (!rs.length) return;
  const km = rs.reduce((s, r) => s + r.km, 0), sec = rs.reduce((s, r) => s + r.sec, 0);
  const hrs = rs.filter(r => r.hr), hr = hrs.length ? Math.round(hrs.reduce((s, r) => s + r.hr * r.sec, 0) / hrs.reduce((s, r) => s + r.sec, 0)) : null;
  S.act[date] = {
    type: 'run', done: true, km: round2(km), min: Math.max(1, Math.round(sec / 60)), kcal: rs.reduce((s, r) => s + r.kcal, 0), at: Date.now(),
    src: rs[0].src, n: rs.length, pace: km ? round2(sec / 60 / km) : null, hr, elev: rs.reduce((s, r) => s + (r.elev || 0), 0), name: rs.length === 1 ? rs[0].name : rs.length + ' Läufe'
  };
}
/* Gibt den Lauf zurück, wenn er neu war – sonst null (schon bekannt, auch wenn dieselbe Einheit aus Datei und Strava kommt) */
export function addRun(r) {
  if (!S.runs) S.runs = {};
  if (S.runs[r.id]) return null;
  const t = Date.parse(r.start);
  for (const x of Object.values(S.runs)) {
    if (x.date === r.date && isFinite(t) && Math.abs(Date.parse(x.start) - t) < 300000 && Math.abs(x.km - r.km) < 0.3) return null;
  }
  S.runs[r.id] = r;
  applyDay(r.date);
  save();
  // Neue Läufe der letzten 2 Tage automatisch mit Freunden teilen (ältere Importe nicht)
  try { if (window.__social && isFinite(t) && Date.now() - t < 2 * 864e5) window.__social.shareRun(r.km, r.min, Math.round(10 + r.km * 10), { hr: r.hr || undefined, kcal: r.kcal || undefined }); } catch (e) { /* offline egal */ }
  return r;
}
export function hideRunsOf(date) { Object.values(S.runs || {}).forEach(r => { if (r.date === date) r.hidden = true; }); }

/* ---------- Synchronisieren ---------- */
let busy = false;
export const syncing = () => busy;
export async function sync(opts = {}) {
  if (busy) return { n: 0, added: [], busy: true };
  busy = true;
  try {
    const s = sv(), now = Math.floor(Date.now() / 1000);
    const after = opts.days ? now - opts.days * 86400 : (s.since ? s.since - 3 * 86400 : now - 30 * 86400);
    const list = await get('/athlete/activities?after=' + after + '&per_page=50');
    const runsInList = (Array.isArray(list) ? list : []).filter(a => RUN_TYPES.has(a.sport_type || a.type) && (a.distance || 0) >= 300);
    const fresh = runsInList.filter(a => !(S.runs && S.runs['s' + a.id]))
      .sort((a, b) => String(a.start_date_local).localeCompare(String(b.start_date_local)));
    const added = [];
    for (const a of fresh.slice(0, 12)) {
      let d = null;
      try { d = await get('/activities/' + a.id); } catch (e) { if (e.code === 'limit' || e.code === 'auth' || e.code === 'scope') throw e; }
      const r = addRun(fromStrava(a, d)); if (r) added.push(r);
    }
    if (fresh.length <= 12) s.since = now;
    s.last = Date.now(); save(true);
    return { n: added.length, added, seen: runsInList.length };
  } finally { busy = false; }
}
