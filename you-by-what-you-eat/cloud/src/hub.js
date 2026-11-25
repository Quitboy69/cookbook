/* You By What You Eat – Community-Server als Cloudflare Durable Object (läuft kostenlos, ganz ohne eigenen Rechner).
   Übertragen aus server/server.js (Raspberry-Pi-Version): gleiche Schnittstelle, plus
   · Erstnutzer = Besitzer (keine Einladung nötig), vorbereitete Konten mit persönlichem Link
   · „X folgt dir“ → Chat mit dem Follower + Mitteilung  · Web-Push (iPhone/Android)  · Strava-Anmeldung über den Server */
import { DurableObject } from 'cloudflare:workers';
import { createHash, randomBytes } from 'node:crypto';
import { newVapidKeys, sendWebPush } from './push.js';

const VERSION = '1.1.0';
const MAX_UPLOAD = 1.8 * 1024 * 1024, MAX_JSON = 64 * 1024;       // Bilder werden in der App vorher verkleinert
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COLORS = ['#12B886', '#3B82F6', '#F97316', '#EC4899', '#8B5CF6', '#EAB308', '#EF4444', '#14B8A6', '#6366F1', '#84CC16'];
const code = (n = 6) => Array.from(randomBytes(n), b => ALPH[b % ALPH.length]).join('');
const sha = s => createHash('sha256').update(String(s)).digest('hex');
const now = () => Date.now();
const hex = n => randomBytes(n).toString('hex');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'Access-Control-Max-Age': '86400' };
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const TZ = 'Europe/Berlin';
const fmtDay = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtFull = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dayKey = t => fmtDay.format(t);
function tzOffset(t) { const p = Object.fromEntries(fmtFull.formatToParts(t).map(x => [x.type, +x.value])); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000; }
function berlinMidnight(y, m, d) { const g = Date.UTC(y, m - 1, d), t = g - tzOffset(g), o2 = tzOffset(t); return o2 === tzOffset(g) ? t : g - o2; }
function weekStart(t = now()) { const [y, m, d] = dayKey(t).split('-').map(Number); const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; return berlinMidnight(y, m, d - wd); }
function periodStart(p) { if (p === 'all') return 0; if (p === 'month') { const [y, m] = dayKey(now()).split('-').map(Number); return berlinMidnight(y, m, 1); } return weekStart(); }

export class Hub extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.core = null; ctx.blockConcurrencyWhile(async () => { this.core = await makeCore(ctx, env); }); }
  fetch(request) { return this.core.handle(request); }
}

async function makeCore(ctx, env) {
  const sql = ctx.storage.sql;
  sql.exec('CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, line TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS media (name TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, t INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS push (endpoint TEXT PRIMARY KEY, uid TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, t INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS presets (uid TEXT PRIMARY KEY, name TEXT, token TEXT, sex TEXT, t INTEGER)');
  sql.exec('CREATE TABLE IF NOT EXISTS strava (uid TEXT PRIMARY KEY, access TEXT, refresh TEXT, exp INTEGER, athlete TEXT, t INTEGER)');
  const kvGet = k => { const r = sql.exec('SELECT v FROM kv WHERE k=?', k).toArray()[0]; return r ? JSON.parse(r.v) : undefined; };
  const kvSet = (k, v) => sql.exec('INSERT OR REPLACE INTO kv(k,v) VALUES (?,?)', k, JSON.stringify(v));
  const cfg = kvGet('cfg') || {};
  if (!cfg.invite) { cfg.invite = code(8); cfg.name = 'YBWYE Community'; kvSet('cfg', cfg); }
  if (!cfg.vapid) { cfg.vapid = await newVapidKeys(); kvSet('cfg', cfg); }
  const saveCfg = () => kvSet('cfg', cfg);

  /* ---------- Zustand + Log ---------- */
  const st = { users: new Map(), tokens: new Map(), follows: new Map(), groups: new Map(), chats: new Map(), msg: new Map(), acts: [], act: new Map(), seq: 0 };
  const following = u => st.follows.get(u) || st.follows.set(u, new Set()).get(u);
  const chatList = c => st.chats.get(c) || st.chats.set(c, []).get(c);
  const dmId = (a, b) => 'dm:' + [a, b].sort().join(':');
  function apply(o) {
    switch (o.op) {
      case 'user': st.users.set(o.id, { id: o.id, name: o.name, color: o.color, code: o.code, avatar: null, bio: '', created: o.t, deleted: false }); break;
      case 'token': st.tokens.set(o.h, o.u); break;
      case 'untoken': st.tokens.delete(o.h); break;
      case 'user_upd': { const u = st.users.get(o.id); if (u) Object.assign(u, o.f); break; }
      case 'user_del': { const u = st.users.get(o.id); if (u) { u.deleted = true; u.name = 'Gelöschter Nutzer'; u.avatar = null; u.bio = ''; }
        for (const [h, id] of st.tokens) if (id === o.id) st.tokens.delete(h);
        st.follows.delete(o.id); for (const s of st.follows.values()) s.delete(o.id);
        for (const g of st.groups.values()) g.members.delete(o.id); break; }
      case 'follow': following(o.a).add(o.b); break;
      case 'unfollow': following(o.a).delete(o.b); break;
      case 'group': st.groups.set(o.id, { id: o.id, name: o.name, emoji: o.emoji, code: o.code, owner: o.u, created: o.t, members: new Map([[o.u, { role: 'owner', t: o.t }]]) }); break;
      case 'group_upd': { const g = st.groups.get(o.id); if (g) Object.assign(g, o.f); break; }
      case 'join': { const g = st.groups.get(o.g); if (g) g.members.set(o.u, { role: 'member', t: o.t }); break; }
      case 'leave': { const g = st.groups.get(o.g); if (g) g.members.delete(o.u); break; }
      case 'msg': { const m = { id: o.id, chat: o.chat, from: o.u, kind: o.kind, text: o.text || '', media: o.media || null, sticker: o.sticker || null, meta: o.meta || null, t: o.t, re: {}, seq: ++st.seq };
        chatList(o.chat).push(m); st.msg.set(o.id, m); break; }
      case 'del_msg': { const m = st.msg.get(o.id); if (m) { m.kind = 'deleted'; m.text = ''; m.media = null; m.sticker = null; m.meta = null; m.seq = ++st.seq; } break; }
      case 'act': { const a = { id: o.id, u: o.u, kind: o.kind, title: o.title, pts: o.pts || 0, data: o.data || {}, t: o.t, re: {}, seq: ++st.seq }; st.acts.push(a); st.act.set(o.id, a); break; }
      case 'react': { const x = o.on === 'act' ? st.act.get(o.id) : st.msg.get(o.id); if (!x) break;
        const set = new Set(x.re[o.e] || []); if (set.has(o.u)) set.delete(o.u); else set.add(o.u);
        if (set.size) x.re[o.e] = [...set]; else delete x.re[o.e]; x.seq = ++st.seq; break; }
    }
  }
  function commit(o) { o.t = o.t || now(); apply(o); sql.exec('INSERT INTO log(line) VALUES (?)', JSON.stringify(o)); return o; }
  for (const row of sql.exec('SELECT line FROM log ORDER BY id')) { try { apply(JSON.parse(row.line)); } catch (e) { console.warn('[db] kaputte Zeile'); } }

  /* ---------- Hilfen ---------- */
  const pub = u => u && ({ id: u.id, name: u.name, color: u.color, avatar: u.avatar, bio: u.bio, code: u.code, deleted: u.deleted || undefined });
  function statsOf(uid, from = weekStart()) {
    let pts = 0, workouts = 0, runs = 0, km = 0, min = 0;
    for (const a of st.acts) if (a.u === uid && a.t >= from) { pts += a.pts; if (a.kind === 'workout') workouts++; if (a.kind === 'run') { runs++; km += +a.data.km || 0; } min += +a.data.min || 0; }
    const days = new Set(st.acts.filter(a => a.u === uid).map(a => dayKey(a.t)));
    let streak = 0, t = now(); if (!days.has(dayKey(t))) t -= 86400000;
    while (days.has(dayKey(t)) && streak < 999) { streak++; t -= 86400000; }
    return { pts, workouts, runs, km: Math.round(km * 10) / 10, min, streak };
  }
  const memberOf = uid => [...st.groups.values()].filter(g => g.members.has(uid));
  const mates = uid => { const s = new Set(); for (const g of memberOf(uid)) for (const m of g.members.keys()) s.add(m); s.delete(uid); return s; };
  const canChat = (uid, chat) => chat.startsWith('dm:') ? chat.split(':').slice(1).includes(uid) : !!((st.groups.get(chat) || {}).members || new Map()).has(uid);
  const chatMembers = chat => chat.startsWith('dm:') ? chat.split(':').slice(1) : [...((st.groups.get(chat) || {}).members || new Map()).keys()];
  const cleanText = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, n).trim();
  const lastOf = (c, list) => { const l = list[list.length - 1]; return l ? { kind: l.kind, text: l.kind === 'image' ? '📷 Foto' : l.kind === 'sticker' ? '🎨 Sticker' : l.kind === 'activity' ? '🏅 ' + l.text : l.text, from: l.from, t: l.t, seq: l.seq } : null; };
  const groupOut = g => { const list = st.chats.get(g.id) || []; return { id: g.id, name: g.name, emoji: g.emoji, code: g.code, owner: g.owner, members: g.members.size, last: lastOf(g.id, list), seq: list.length ? list[list.length - 1].seq : 0 }; };
  const isOwner = u => u && cfg.owner === u.id;

  /* ---------- Live-Events (SSE) ---------- */
  const streams = new Map(); const enc = new TextEncoder();
  function emit(uids, ev, data) {
    const msg = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const u of new Set(uids)) for (const s of [...(streams.get(u) || [])]) s.write(msg);
  }
  setInterval(() => { for (const set of streams.values()) for (const s of [...set]) s.write(': ping\n\n'); }, 20000);
  const buckets = new Map();
  function limited(key, max, perMs) { const b = buckets.get(key) || { n: 0, t: now() }; if (now() - b.t > perMs) { b.n = 0; b.t = now(); } b.n++; buckets.set(key, b); return b.n > max; }
  setInterval(() => { const t = now(); for (const [k, b] of buckets) if (t - b.t > 600000) buckets.delete(k); }, 600000);

  /* ---------- Web-Push ---------- */
  const subject = () => cfg.publicUrl || 'https://ybwye.invalid';
  function notify(uids, payload) {
    for (const uid of new Set(uids)) for (const r of sql.exec('SELECT endpoint, p256dh, auth FROM push WHERE uid=?', uid).toArray()) {
      ctx.waitUntil(sendWebPush({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }, payload, cfg.vapid, subject()).then(res => { if (res.gone) sql.exec('DELETE FROM push WHERE endpoint=?', r.endpoint); }).catch(e => console.warn('[push]', e.message)));
    }
  }

  /* ---------- HTTP-Hilfen ---------- */
  const send = (status, obj, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
  const err = (status, msg) => send(status, { error: msg });
  const httpErr = (status, msg) => Object.assign(new Error(msg), { code: status });
  async function bytes(req, max) {
    if ((+req.headers.get('content-length') || 0) > max) throw httpErr(413, 'Datei zu groß');
    const ab = await req.arrayBuffer(); if (ab.byteLength > max) throw httpErr(413, 'Datei zu groß'); return new Uint8Array(ab);
  }
  async function json(req) { const b = await bytes(req, MAX_JSON); if (!b.length) return {}; try { return JSON.parse(new TextDecoder().decode(b)); } catch (e) { throw httpErr(400, 'JSON ungültig'); } }
  function auth(req, url) {
    const h = req.headers.get('authorization') || ''; const tok = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
    if (!tok) return null; const uid = st.tokens.get(sha(tok)); const u = uid && st.users.get(uid); return u && !u.deleted ? u : null;
  }
  function sniff(b) {
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif';
    return null;
  }
  const originOf = (req, url) => cfg.publicUrl || url.origin;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function newMsg(u, chat, b) {
    const kind = ['text', 'image', 'sticker'].includes(b.kind) ? b.kind : 'text';
    const text = cleanText(b.text, 2000);
    const media = typeof b.media === 'string' && /^\/media\/[a-f0-9]{24}\.(jpg|png|webp|gif)$/.test(b.media) ? b.media : null;
    const sticker = typeof b.sticker === 'string' && /^[a-z0-9:_-]{1,40}$/i.test(b.sticker) ? b.sticker : null;
    if (kind === 'text' && !text) return null;
    if (kind === 'image' && !media) return null;
    if (kind === 'sticker' && !sticker && !media) return null;
    const m = commit({ op: 'msg', id: 'm' + hex(8), chat, u: u.id, kind, text, media, sticker, meta: null });
    const msg = st.msg.get(m.id); emit(chatMembers(chat), 'msg', msg);
    const g = st.groups.get(chat), others = chatMembers(chat).filter(x => x !== u.id);
    const preview = kind === 'image' ? '📷 Foto' : kind === 'sticker' ? '🎨 Sticker' : text.slice(0, 140);
    for (const o of others) notify([o], g ? { title: `${g.emoji} ${g.name}`, body: `${u.name}: ${preview}`, url: '/#/chat/' + g.id, tag: g.id } : { title: u.name, body: preview, url: '/#/chat/dm.' + u.id, tag: 'dm-' + u.id });
    return msg;
  }
  function postActivity(u, b) {
    const kind = ['workout', 'run', 'pr', 'streak', 'meal', 'weight', 'goal'].includes(b.kind) ? b.kind : 'workout';
    const pts = Math.max(0, Math.min(200, Math.round(+b.pts || 0)));
    const data = {}; for (const k of ['min', 'km', 'kcal', 'sets', 'vol', 'emoji', 'pace', 'hr', 'prs', 'lvl', 'exercise', 'kg', 'reps']) if (b.data && b.data[k] != null && typeof b.data[k] !== 'object') data[k] = typeof b.data[k] === 'string' ? cleanText(b.data[k], 60) : +b.data[k];
    const o = commit({ op: 'act', id: 'a' + hex(8), u: u.id, kind, title: cleanText(b.title, 80) || 'Training', pts, data });
    const a = st.act.get(o.id);
    const fans = [...st.follows.entries()].filter(([, s]) => s.has(u.id)).map(([f]) => f);
    emit([u.id, ...fans, ...mates(u.id)], 'act', { ...a, user: pub(u) });
    if (b.share !== false) for (const g of memberOf(u.id)) {
      const mo = commit({ op: 'msg', id: 'm' + hex(8), chat: g.id, u: u.id, kind: 'activity', text: a.title, meta: { act: a.id, kind, pts, data } });
      emit(chatMembers(g.id), 'msg', st.msg.get(mo.id));
    }
    return a;
  }
  function sysMsg(chat, uid, text) { const sys = commit({ op: 'msg', id: 'm' + hex(8), chat, u: uid, kind: 'system', text }); const m = st.msg.get(sys.id); emit(chatMembers(chat), 'msg', m); return m; }
  function createUser(name, color) {
    let fc; do { fc = code(6); } while ([...st.users.values()].some(u => u.code === fc));
    const id = 'u' + hex(6), token = hex(32);
    commit({ op: 'user', id, name, color: COLORS.includes(color) ? color : COLORS[st.users.size % COLORS.length], code: fc });
    commit({ op: 'token', h: sha(token), u: id });
    return { id, token };
  }

  /* ---------- Strava über den Server ---------- */
  const SB = () => env.STRAVA_BASE || 'https://www.strava.com';   // nur für Tests umstellbar
  const stravaKeys = () => ({ id: env.STRAVA_CLIENT_ID || cfg.stravaId || '', secret: env.STRAVA_CLIENT_SECRET || cfg.stravaSecret || '' });
  const stravaStates = new Map();
  async function stravaToken(uid) {
    const r = sql.exec('SELECT * FROM strava WHERE uid=?', uid).toArray()[0]; if (!r) return null;
    if (r.exp > Date.now() / 1000 + 120) return r.access;
    const k = stravaKeys();
    const res = await fetch(SB() + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ client_id: k.id, client_secret: k.secret, grant_type: 'refresh_token', refresh_token: r.refresh }) });
    const j = await res.json().catch(() => ({})); if (!j.access_token) return null;
    sql.exec('UPDATE strava SET access=?, refresh=?, exp=?, t=? WHERE uid=?', j.access_token, j.refresh_token || r.refresh, j.expires_at, now(), uid); return j.access_token;
  }
  const page = (title, body) => new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(120% 80% at 50% 0%,#14a77a,#062019 60%,#000);color:#fff;font:16px/1.45 system-ui,sans-serif}main{max-width:380px;padding:28px 22px;text-align:center}h1{font-size:26px;margin:10px 0 6px}.e{font-size:60px}a.b{display:block;margin:12px 0;padding:16px;border-radius:16px;background:#12B886;color:#fff;font-weight:800;text-decoration:none;box-shadow:0 10px 30px rgba(18,184,134,.45)}a.g{background:rgba(255,255,255,.14);box-shadow:none}ol{text-align:left;opacity:.92;padding-left:20px}small{opacity:.7}.code{display:inline-block;margin:10px 0;padding:10px 18px;border-radius:14px;background:rgba(255,255,255,.12);font:700 26px ui-monospace,monospace;letter-spacing:.18em}</style></head><body><main>${body}</main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

  /* ---------- Routen ---------- */
  async function route(req, url) {
    const p = url.pathname, M = req.method; let m, m0;
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'local';
    if (M === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (p === '/api/health') return send(200, { ok: true, app: 'ybwye', cloud: true, name: cfg.name, version: VERSION, users: [...st.users.values()].filter(u => !u.deleted).length, setup: st.users.size === 0 });

    if ((m0 = p.match(/^\/join\/([A-Za-z0-9]{6})$/)) && M === 'GET') {   // Einladungs-Seite zum Weiterschicken
      const c = m0[1].toUpperCase(), g = [...st.groups.values()].find(x => x.code === c), origin = originOf(req, url);
      const deep = `ybwye://join?s=${encodeURIComponent(origin)}&c=${c}`;
      return page('Einladung – You By What You Eat', `<div class="e">${g ? esc(g.emoji) : '💪'}</div><h1>${g ? 'Komm in „' + esc(g.name) + '“' : 'Einladung'}</h1><p>${g ? g.members.size + ' Mitglieder trainieren schon zusammen.' : 'Diese Gruppe gibt es nicht (mehr).'}</p>
<a class="b" href="/?c=${c}">Jetzt im Browser öffnen</a><p><b>iPhone:</b> Danach unten auf <b>Teilen ⎙</b> tippen → <b>„Zum Home-Bildschirm“</b>. Dann ist es eine App auf deinem Handy.</p>
<a class="b g" href="${esc(deep)}">In der Android-App öffnen</a><p>Gruppen-Code:</p><div class="code">${esc(c)}</div><p><small>Server: ${esc(origin)}</small></p>`);
    }
    if (p === '/strava/callback' && M === 'GET') {   // Rückkehr von Strava nach der Freigabe
      const q = url.searchParams, state = stravaStates.get(q.get('state') || ''); stravaStates.delete(q.get('state') || '');
      const fail = t => page('Strava', `<div class="e">😕</div><h1>Das hat nicht geklappt</h1><p>${esc(t)}</p><a class="b" href="/">Zurück zur App</a>`);
      if (!state || now() - state.t > 600000) return fail('Der Link ist abgelaufen. Bitte in der App noch mal auf „Mit Strava verbinden“ tippen.');
      if (q.get('error')) return fail('Du hast die Freigabe abgebrochen.');
      if (!/activity:read/.test(q.get('scope') || '')) return fail('Bei der Freigabe fehlte „Aktivitäten ansehen“. Bitte noch mal verbinden und den Haken gesetzt lassen.');
      const k = stravaKeys();
      const res = await fetch(SB() + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ client_id: k.id, client_secret: k.secret, code: q.get('code') || '', grant_type: 'authorization_code' }) });
      const j = await res.json().catch(() => ({}));
      if (!j.access_token) return fail(res.status === 403 || /limit/i.test(JSON.stringify(j)) ? 'Strava erlaubt für diese App noch nicht mehr Personen (Strava muss das erst freischalten).' : 'Strava hat die Anmeldung abgelehnt.');
      sql.exec('INSERT OR REPLACE INTO strava(uid,access,refresh,exp,athlete,t) VALUES (?,?,?,?,?,?)', state.uid, j.access_token, j.refresh_token, j.expires_at, [j.athlete && j.athlete.firstname, j.athlete && j.athlete.lastname].filter(Boolean).join(' '), now());
      emit([state.uid], 'strava', { connected: true });
      return page('Strava verbunden', `<div class="e">✅</div><h1>Mit Strava verbunden</h1><p>Deine Läufe kommen jetzt automatisch in die App.</p><a class="b" href="/">Zurück zur App</a>`);
    }
    if (p.startsWith('/media/') && M === 'GET') {
      const f = p.slice(7); if (!/^[a-f0-9]{24}\.(jpg|png|webp|gif)$/.test(f)) return err(404, 'nicht gefunden');
      const r = sql.exec('SELECT mime, data FROM media WHERE name=?', f).toArray()[0]; if (!r) return err(404, 'nicht gefunden');
      return new Response(r.data, { headers: { ...CORS, 'Content-Type': r.mime, 'Cache-Control': 'public, max-age=31536000, immutable' } });
    }
    if (p === '/api/register' && M === 'POST') {
      if (limited('reg:' + ip, 12, 3600000)) return err(429, 'Zu viele Versuche – später nochmal.');
      const b = await json(req); const inv = String(b.invite || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const first = st.users.size === 0, grp = [...st.groups.values()].find(g => g.code === inv);
      if (first && env.SETUP_KEY && inv !== String(env.SETUP_KEY).toUpperCase().replace(/[^A-Z0-9]/g, '')) return err(403, 'Setup-Schlüssel stimmt nicht.');
      if (!first && inv !== cfg.invite && !grp) return err(403, 'Einladungscode stimmt nicht.');
      const name = cleanText(b.name, 30); if (!name) return err(400, 'Bitte einen Namen angeben.');
      const { id, token } = createUser(name, b.color);
      if (first) { cfg.owner = id; saveCfg(); }
      if (grp) { commit({ op: 'join', g: grp.id, u: id }); sysMsg(grp.id, id, name + ' ist beigetreten 👋'); emit(chatMembers(grp.id), 'group', { id: grp.id }); }
      return send(200, { token, user: pub(st.users.get(id)), group: grp ? groupOut(grp) : null, owner: first, server: { name: cfg.name, version: VERSION } });
    }
    if (p === '/api/stream' && M === 'GET') {
      const u = auth(req, url); if (!u) return err(401, 'Nicht angemeldet');
      const ts = new TransformStream(), w = ts.writable.getWriter(); let closed = false;
      const s = { write(str) { if (closed) return; w.write(enc.encode(str)).catch(() => s.close()); }, close() { if (closed) return; closed = true; const set = streams.get(u.id); if (set) { set.delete(s); if (!set.size) streams.delete(u.id); } try { w.close(); } catch (e) { /* egal */ } } };
      if (!streams.has(u.id)) streams.set(u.id, new Set()); streams.get(u.id).add(s);
      req.signal.addEventListener('abort', () => s.close()); w.closed.catch(() => s.close());
      setTimeout(() => s.close(), 30 * 60 * 1000);   // alte, vergessene Verbindungen räumt der Server selbst weg (die App verbindet sich neu)
      s.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ seq: st.seq })}\n\n`);
      return new Response(ts.readable, { headers: { ...CORS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
    }
    // ---- ab hier angemeldet ----
    const u = auth(req, url); if (!u) return err(401, 'Nicht angemeldet');
    if (limited('u:' + u.id, 300, 60000)) return err(429, 'Langsam 🙂 – zu viele Anfragen.');
    const owner = isOwner(u);
    if (p === '/api/me' && M === 'GET') {
      const pr = sql.exec('SELECT sex FROM presets WHERE uid=?', u.id).toArray()[0];
      return send(200, { user: pub(u), stats: statsOf(u.id), preset: pr ? { sex: pr.sex } : undefined, server: { name: cfg.name, version: VERSION, owner, invite: owner ? cfg.invite : undefined } });
    }
    if (p === '/api/me' && M === 'PATCH') {
      const b = await json(req), f = {};
      if (b.name != null) { const n = cleanText(b.name, 30); if (n) f.name = n; }
      if (b.bio != null) f.bio = cleanText(b.bio, 140);
      if (b.color && COLORS.includes(b.color)) f.color = b.color;
      if (b.avatar === null || (typeof b.avatar === 'string' && /^\/media\/[a-f0-9]{24}\.(jpg|png|webp|gif)$/.test(b.avatar))) f.avatar = b.avatar;
      commit({ op: 'user_upd', id: u.id, f }); emit([u.id, ...mates(u.id)], 'user', pub(u)); return send(200, { user: pub(u) });
    }
    if (p === '/api/me' && M === 'DELETE') { if (owner) return err(400, 'Der Besitzer kann sein Konto nicht löschen.'); commit({ op: 'user_del', id: u.id }); sql.exec('DELETE FROM push WHERE uid=?', u.id); sql.exec('DELETE FROM strava WHERE uid=?', u.id); return send(200, { ok: true }); }
    if (p === '/api/media' && M === 'POST') {
      if (limited('up:' + u.id, 40, 600000)) return err(429, 'Zu viele Uploads – kurz warten.');
      const b = await bytes(req, MAX_UPLOAD); const ext = sniff(b); if (!ext) return err(415, 'Nur JPG, PNG, WebP oder GIF.');
      const f = hex(12) + '.' + ext; sql.exec('INSERT INTO media(name,mime,data,t) VALUES (?,?,?,?)', f, MIME[ext], b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), now());
      return send(200, { url: '/media/' + f, bytes: b.length });
    }
    if (p === '/api/users' && M === 'GET') {
      const c = (url.searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), q = (url.searchParams.get('q') || '').toLowerCase();
      const list = [...st.users.values()].filter(x => !x.deleted && x.id !== u.id && (c ? x.code === c : q ? x.name.toLowerCase().includes(q) : false)).slice(0, 20);
      return send(200, { users: list.map(x => ({ ...pub(x), stats: statsOf(x.id), following: following(u.id).has(x.id) })) });
    }
    if ((m = p.match(/^\/api\/users\/(u[a-f0-9]{12})$/)) && M === 'GET') {
      const x = st.users.get(m[1]); if (!x) return err(404, 'Unbekannt');
      const acts = st.acts.filter(a => a.u === x.id).slice(-20).reverse();
      return send(200, { user: pub(x), stats: statsOf(x.id), month: statsOf(x.id, periodStart('month')), total: statsOf(x.id, 0), following: following(u.id).has(x.id), followsMe: following(x.id).has(u.id), followers: [...st.follows.values()].filter(s => s.has(x.id)).length, acts });
    }
    if ((m = p.match(/^\/api\/follow\/(u[a-f0-9]{12})$/))) {
      const target = st.users.get(m[1]); if (!target || target.deleted || m[1] === u.id) return err(400, 'Geht nicht');
      if (M === 'POST') {
        const had = following(u.id).has(m[1]);
        if (!had) {
          commit({ op: 'follow', a: u.id, b: m[1] });
          if (!limited('fol:' + u.id + ':' + m[1], 2, 86400000)) {   // „X folgt dir“ → Chat mit dem Follower + Mitteilung
            sysMsg(dmId(u.id, m[1]), u.id, `${u.name} folgt dir jetzt 👋`);
            notify([m[1]], { title: `${u.name} folgt dir`, body: 'Tippe, um Hallo zu sagen 👋', url: '/#/chat/dm.' + u.id, tag: 'follow-' + u.id });
          }
          emit([m[1]], 'follow', { from: pub(u) });
        }
      } else if (M === 'DELETE') commit({ op: 'unfollow', a: u.id, b: m[1] });
      return send(200, { ok: true });
    }
    if (p === '/api/friends' && M === 'GET') {
      const fol = [...following(u.id)].map(id => st.users.get(id)).filter(x => x && !x.deleted);
      const fans = [...st.follows.entries()].filter(([, s]) => s.has(u.id)).map(([id]) => st.users.get(id)).filter(x => x && !x.deleted);
      const pack = x => ({ ...pub(x), stats: statsOf(x.id), following: following(u.id).has(x.id) });
      return send(200, { following: fol.map(pack), followers: fans.map(pack), me: { ...pub(u), stats: statsOf(u.id) } });
    }
    if (p === '/api/groups' && M === 'GET') return send(200, { groups: memberOf(u.id).map(groupOut), dms: [...st.chats.keys()].filter(c => c.startsWith('dm:') && canChat(u.id, c)).map(c => { const other = c.split(':').slice(1).find(x => x !== u.id) || u.id; const list = st.chats.get(c); return { id: c, user: pub(st.users.get(other)), last: lastOf(c, list), seq: list.length ? list[list.length - 1].seq : 0 }; }) });
    if (p === '/api/groups' && M === 'POST') {
      const b = await json(req); const name = cleanText(b.name, 40); if (!name) return err(400, 'Name fehlt');
      if (memberOf(u.id).filter(g => g.owner === u.id).length >= 20) return err(400, 'Maximal 20 eigene Gruppen.');
      let gc; do { gc = code(6); } while ([...st.groups.values()].some(g => g.code === gc));
      const o = commit({ op: 'group', id: 'g' + hex(6), name, emoji: cleanText(b.emoji, 8) || '💪', code: gc, u: u.id });
      commit({ op: 'msg', id: 'm' + hex(8), chat: o.id, u: u.id, kind: 'system', text: `${u.name} hat die Gruppe „${name}“ erstellt` });
      return send(200, { group: groupOut(st.groups.get(o.id)) });
    }
    if (p === '/api/groups/join' && M === 'POST') {
      const b = await json(req); const c = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const g = [...st.groups.values()].find(x => x.code === c); if (!g) return err(404, 'Gruppen-Code unbekannt.');
      if (!g.members.has(u.id)) { if (g.members.size >= 150) return err(400, 'Gruppe ist voll.'); commit({ op: 'join', g: g.id, u: u.id }); sysMsg(g.id, u.id, u.name + ' ist beigetreten 👋'); emit(chatMembers(g.id), 'group', { id: g.id }); }
      return send(200, { group: groupOut(g) });
    }
    if ((m = p.match(/^\/api\/groups\/(g[a-f0-9]{12})(\/leave|\/members\/(u[a-f0-9]{12}))?$/))) {
      const g = st.groups.get(m[1]); if (!g || !g.members.has(u.id)) return err(404, 'Gruppe nicht gefunden');
      if (m[2] === '/leave' && M === 'POST') { commit({ op: 'leave', g: g.id, u: u.id }); sysMsg(g.id, u.id, u.name + ' hat die Gruppe verlassen'); return send(200, { ok: true }); }
      if (m[3] && M === 'DELETE') { if (g.owner !== u.id) return err(403, 'Nur der Ersteller darf entfernen.'); commit({ op: 'leave', g: g.id, u: m[3] }); emit([m[3]], 'group', { id: g.id, removed: true }); return send(200, { ok: true }); }
      if (!m[2] && M === 'PATCH') { if (g.owner !== u.id) return err(403, 'Nur der Ersteller darf ändern.'); const b = await json(req), f = {}; if (b.name) f.name = cleanText(b.name, 40); if (b.emoji) f.emoji = cleanText(b.emoji, 8); commit({ op: 'group_upd', id: g.id, f }); emit(chatMembers(g.id), 'group', { id: g.id }); return send(200, { group: groupOut(g) }); }
      if (!m[2] && M === 'GET') {
        const from = periodStart(url.searchParams.get('period') || 'week');
        const members = [...g.members.keys()].map(id => { const x = st.users.get(id); return { ...pub(x), role: g.members.get(id).role, stats: statsOf(id, from), streak: statsOf(id).streak }; }).sort((a, b) => b.stats.pts - a.stats.pts);
        return send(200, { group: groupOut(g), members });
      }
    }
    if ((m = p.match(/^\/api\/chats\/([a-zA-Z0-9:.%]+)\/(messages|typing)$/))) {
      let chat; try { chat = decodeURIComponent(m[1]); } catch (e) { return err(400, 'Ungültiger Chat'); }
      if (/^dm\.u[a-f0-9]{12}$/.test(chat)) { const other = chat.slice(3); if (!st.users.get(other) || other === u.id) return err(404, 'Unbekannt'); chat = dmId(u.id, other); }
      if (!canChat(u.id, chat)) return err(403, 'Kein Zugriff');
      if (m[2] === 'typing' && M === 'POST') { emit(chatMembers(chat).filter(x => x !== u.id), 'typing', { chat, user: { id: u.id, name: u.name } }); return send(200, { ok: true }); }
      if (M === 'GET') {
        const list = st.chats.get(chat) || [], after = +url.searchParams.get('after') || 0, lim = Math.min(200, +url.searchParams.get('limit') || 60);
        const out = after ? list.filter(x => x.seq > after) : list.slice(-lim);
        const users = {}; for (const x of out) if (!users[x.from]) users[x.from] = pub(st.users.get(x.from));
        return send(200, { chat, messages: out, users });
      }
      if (M === 'POST') { if (limited('msg:' + u.id, 30, 10000)) return err(429, 'Nicht so schnell 🙂'); const msg = newMsg(u, chat, await json(req)); if (!msg) return err(400, 'Leere Nachricht'); return send(200, { message: msg, chat }); }
    }
    if ((m = p.match(/^\/api\/(messages|activities)\/([am][a-f0-9]{16})(\/react)?$/))) {
      const isAct = m[1] === 'activities', x = isAct ? st.act.get(m[2]) : st.msg.get(m[2]); if (!x) return err(404, 'Nicht gefunden');
      const who = isAct ? [x.u, ...mates(x.u), ...[...st.follows.entries()].filter(([, s]) => s.has(x.u)).map(([f]) => f)] : chatMembers(x.chat);
      if (!isAct && !canChat(u.id, x.chat)) return err(403, 'Kein Zugriff');
      if (m[3] && M === 'POST') { const b = await json(req); const e = cleanText(b.emoji, 8); if (!e) return err(400, 'Emoji fehlt'); commit({ op: 'react', on: isAct ? 'act' : 'msg', id: x.id, e, u: u.id }); emit(who, 'react', { on: isAct ? 'act' : 'msg', id: x.id, re: x.re, chat: x.chat, seq: x.seq }); return send(200, { re: x.re }); }
      if (!m[3] && M === 'DELETE' && !isAct) { if (x.from !== u.id) return err(403, 'Nur eigene Nachrichten.'); commit({ op: 'del_msg', id: x.id }); emit(chatMembers(x.chat), 'msg', x); return send(200, { ok: true }); }
    }
    if (p === '/api/activities' && M === 'POST') { if (limited('act:' + u.id, 30, 3600000)) return err(429, 'Zu viele Aktivitäten.'); return send(200, { activity: postActivity(u, await json(req)) }); }
    if (p === '/api/feed' && M === 'GET') {
      const who = new Set([u.id, ...following(u.id), ...mates(u.id)]);
      const list = st.acts.filter(a => who.has(a.u)).slice(-60).reverse();
      const users = {}; for (const a of list) if (!users[a.u]) users[a.u] = pub(st.users.get(a.u));
      return send(200, { activities: list, users });
    }
    if (p === '/api/leaderboard' && M === 'GET') {
      const gid = url.searchParams.get('group'), from = periodStart(url.searchParams.get('period') || 'week');
      let ids; if (gid) { const g = st.groups.get(gid); if (!g || !g.members.has(u.id)) return err(403, 'Kein Zugriff'); ids = [...g.members.keys()]; } else ids = [u.id, ...following(u.id)];
      const rows = ids.map(id => ({ user: pub(st.users.get(id)), ...statsOf(id, from), streak: statsOf(id).streak })).filter(r => r.user && !r.user.deleted).sort((a, b) => b.pts - a.pts || b.min - a.min);
      return send(200, { rows, period: url.searchParams.get('period') || 'week' });
    }

    /* ---- Mitteilungen (Web-Push) ---- */
    if (p === '/api/push/key' && M === 'GET') return send(200, { key: cfg.vapid.pub });
    if (p === '/api/push/subscribe' && M === 'POST') {
      const b = await json(req); const s = b.subscription || b;
      if (!s.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) return err(400, 'Abo ungültig');
      sql.exec('INSERT OR REPLACE INTO push(endpoint,uid,p256dh,auth,t) VALUES (?,?,?,?,?)', String(s.endpoint).slice(0, 600), u.id, String(s.keys.p256dh), String(s.keys.auth), now());
      return send(200, { ok: true });
    }
    if (p === '/api/push/unsubscribe' && M === 'POST') { const b = await json(req); sql.exec('DELETE FROM push WHERE endpoint=? AND uid=?', String(b.endpoint || ''), u.id); return send(200, { ok: true }); }
    if (p === '/api/push/test' && M === 'POST') {
      const rows = sql.exec('SELECT endpoint, p256dh, auth FROM push WHERE uid=?', u.id).toArray(); const out = [];
      for (const r of rows) { try { const res = await sendWebPush({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }, { title: 'Es klappt! 🎉', body: 'So sehen deine Mitteilungen aus.', url: '/', tag: 'test' }, cfg.vapid, subject()); out.push(res.status); if (res.gone) sql.exec('DELETE FROM push WHERE endpoint=?', r.endpoint); } catch (e) { out.push('Fehler: ' + e.message); } }
      return send(200, { devices: rows.length, results: out });
    }

    /* ---- Strava über den Server ---- */
    if (p === '/api/strava/status' && M === 'GET') {
      const r = sql.exec('SELECT athlete, t FROM strava WHERE uid=?', u.id).toArray()[0], k = stravaKeys();
      return send(200, { enabled: !!(k.id && k.secret), connected: !!r, athlete: r ? r.athlete : '' });
    }
    if (p === '/api/strava/start' && M === 'POST') {
      const k = stravaKeys(); if (!k.id || !k.secret) return err(409, 'Strava ist auf diesem Server noch nicht eingerichtet.');
      const state = hex(16); stravaStates.set(state, { uid: u.id, t: now() });
      for (const [s, v] of stravaStates) if (now() - v.t > 600000) stravaStates.delete(s);
      const q = new URLSearchParams({ client_id: k.id, redirect_uri: originOf(req, url) + '/strava/callback', response_type: 'code', approval_prompt: 'auto', scope: 'read,activity:read_all', state });
      return send(200, { url: 'https://www.strava.com/oauth/authorize?' + q });
    }
    if (p === '/api/strava' && M === 'DELETE') { sql.exec('DELETE FROM strava WHERE uid=?', u.id); return send(200, { ok: true }); }
    if (p === '/api/strava/api' && M === 'GET') {   // nur Lesen, nur Läufe/Aktivitäten des eigenen Kontos
      if (limited('sv:' + u.id, 40, 60000)) return err(429, 'Strava: kurz warten.');
      const path = url.searchParams.get('path') || '';
      if (!/^\/(athlete|athlete\/activities|activities\/\d+)(\?[A-Za-z0-9_=&%.:-]*)?$/.test(path)) return err(400, 'Pfad nicht erlaubt');
      const tok = await stravaToken(u.id); if (!tok) return err(401, 'Nicht mit Strava verbunden.');
      const r = await fetch(SB() + '/api/v3' + path, { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' } });
      return new Response(await r.text(), { status: r.status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    }

    /* ---- Besitzer: vorbereitete Konten, Strava-Schlüssel, Einladung ---- */
    if (p.startsWith('/api/admin/')) {
      if (!owner) return err(403, 'Nur der Besitzer.');
      const origin = originOf(req, url), link = t => origin + '/?k=' + t;
      const listPresets = () => sql.exec('SELECT uid, name, token, sex FROM presets ORDER BY t').toArray().map(r => ({ id: r.uid, name: r.name, sex: r.sex, link: link(r.token), code: (st.users.get(r.uid) || {}).code }));
      if (p === '/api/admin/accounts' && M === 'GET') return send(200, { accounts: listPresets() });
      if (p === '/api/admin/accounts' && M === 'POST') {
        const b = await json(req); const people = (Array.isArray(b.people) ? b.people : []).map(x => ({ name: cleanText(x && x.name || x, 30), sex: (x && x.sex) === 'w' ? 'w' : 'm' })).filter(x => x.name).slice(0, 20);
        if (!people.length) return err(400, 'Bitte mindestens einen Namen angeben.');
        const gname = cleanText(b.group, 40) || 'Gym-Gang'; let g = [...st.groups.values()].find(x => x.owner === u.id && x.name.toLowerCase() === gname.toLowerCase());
        if (!g) { let gc; do { gc = code(6); } while ([...st.groups.values()].some(x => x.code === gc)); const o = commit({ op: 'group', id: 'g' + hex(6), name: gname, emoji: cleanText(b.emoji, 8) || '🔥', code: gc, u: u.id }); g = st.groups.get(o.id); commit({ op: 'msg', id: 'm' + hex(8), chat: g.id, u: u.id, kind: 'system', text: `${u.name} hat die Gruppe „${gname}“ erstellt` }); }
        const made = [];
        for (const pe of people) {
          const ex = sql.exec('SELECT uid FROM presets WHERE lower(name)=lower(?)', pe.name).toArray()[0]; if (ex) { made.push(ex.uid); continue; }
          const { id, token } = createUser(pe.name);
          sql.exec('INSERT INTO presets(uid,name,token,sex,t) VALUES (?,?,?,?,?)', id, pe.name, token, pe.sex, now());
          commit({ op: 'join', g: g.id, u: id }); sysMsg(g.id, id, pe.name + ' ist beigetreten 👋'); made.push(id);
        }
        const all = [u.id, ...sql.exec('SELECT uid FROM presets').toArray().map(r => r.uid)];   // alle folgen allen → Rangliste, Feed und Chats sind sofort da
        for (const a of all) for (const c of all) if (a !== c && !following(a).has(c)) commit({ op: 'follow', a, b: c });
        emit(all, 'group', { id: g.id });
        return send(200, { group: groupOut(g), accounts: listPresets() });
      }
      if ((m = p.match(/^\/api\/admin\/accounts\/(u[a-f0-9]{12})\/relink$/)) && M === 'POST') {   // neuer Link, alter wird ungültig
        const r = sql.exec('SELECT token FROM presets WHERE uid=?', m[1]).toArray()[0]; if (!r) return err(404, 'Kein vorbereitetes Konto');
        const tok = hex(32); commit({ op: 'untoken', h: sha(r.token) }); commit({ op: 'token', h: sha(tok), u: m[1] }); sql.exec('UPDATE presets SET token=? WHERE uid=?', tok, m[1]);
        return send(200, { accounts: listPresets() });
      }
      if (p === '/api/admin/strava' && M === 'PUT') {
        const b = await json(req); const id = String(b.clientId || '').trim(), sec = String(b.clientSecret || '').trim();
        if (!/^\d{3,10}$/.test(id) || !/^[0-9a-f]{20,64}$/i.test(sec)) return err(400, 'Client-ID (nur Zahlen) und Client-Secret (lange Buchstaben/Zahlen) bitte genau eintragen.');
        cfg.stravaId = id; cfg.stravaSecret = sec; saveCfg(); return send(200, { ok: true, redirectDomain: new URL(origin).host });
      }
      if (p === '/api/admin/strava' && M === 'GET') { const k = stravaKeys(); return send(200, { enabled: !!(k.id && k.secret), redirectDomain: new URL(origin).host }); }
      if (p === '/api/admin/server' && M === 'PATCH') { const b = await json(req); if (b.name) cfg.name = cleanText(b.name, 40); if (b.rotateInvite) cfg.invite = code(8); saveCfg(); return send(200, { name: cfg.name, invite: cfg.invite }); }
    }
    return err(404, 'Unbekannter Pfad');
  }

  return {
    async handle(request) {
      let url; try { url = new URL(request.url); } catch (e) { return err(400, 'Ungültige URL'); }
      try { return await route(request, url); }
      catch (e) { if (e && e.code && e.code >= 400 && e.code < 600) return err(e.code, e.message); console.error(e); return err(500, 'Serverfehler'); }
    }
  };
}
