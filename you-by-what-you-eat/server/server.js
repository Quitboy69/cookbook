#!/usr/bin/env node
/* You By What You Eat – Community-Server (läuft z. B. auf einem Raspberry Pi 3B+ für ~100 Leute)
   Node.js ≥ 18, keine Abhängigkeiten, keine Datenbank: Daten = Logdatei (data/db.jsonl) + Bilder (data/media).
   Start: node server.js            Einladungsschlüssel anzeigen: node server.js --invite
   Weitere: --rotate-invite  --users  --compact  --name "Meine Gruppe"  --url https://ybwye.xyz.ts.net
   App zum Herunterladen anbieten: APK als data/app.apk ablegen → https://<server>/app.apk                                        */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const VERSION = '1.0.0';
const DIR = process.env.YBWYE_DATA || path.join(__dirname, 'data');
const PORT = +process.env.PORT || 8787, HOST = process.env.HOST || '0.0.0.0';
const MAX_UPLOAD = 6 * 1024 * 1024, MAX_JSON = 64 * 1024;
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (n = 6) => Array.from(crypto.randomBytes(n), b => ALPH[b % ALPH.length]).join('');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const now = () => Date.now();
fs.mkdirSync(path.join(DIR, 'media'), { recursive: true });

/* ---------- Konfiguration ---------- */
const CFG = path.join(DIR, 'config.json');
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (e) { /* neu */ }
const saveCfg = () => fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2));
if (!cfg.invite) { cfg.invite = code(8); cfg.name = cfg.name || 'YBWYE Community'; saveCfg(); }

/* ---------- Zustand + Log ---------- */
const LOG = path.join(DIR, 'db.jsonl');
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
let logFd = null;
function commit(o) { o.t = o.t || now(); apply(o); if (!logFd) logFd = fs.openSync(LOG, 'a'); fs.writeSync(logFd, JSON.stringify(o) + '\n'); return o; }
function load() {
  if (!fs.existsSync(LOG)) return;
  const lines = fs.readFileSync(LOG, 'utf8').split('\n'); let bad = 0;
  for (const l of lines) { if (!l) continue; try { apply(JSON.parse(l)); } catch (e) { bad++; } }
  if (bad) console.warn(`[db] ${bad} kaputte Zeilen übersprungen`);
}
/* Log neu schreiben (kompakt) – Reihenfolge bleibt erhalten */
function compact() {
  const out = [];
  const tok = [...st.tokens].map(([h, u]) => ({ op: 'token', h, u }));
  for (const u of st.users.values()) { out.push({ op: 'user', id: u.id, name: u.name, color: u.color, code: u.code, t: u.created }); out.push({ op: 'user_upd', id: u.id, f: { avatar: u.avatar, bio: u.bio, deleted: u.deleted, name: u.name } }); }
  out.push(...tok);
  for (const [a, s] of st.follows) for (const b of s) out.push({ op: 'follow', a, b });
  for (const g of st.groups.values()) { out.push({ op: 'group', id: g.id, name: g.name, emoji: g.emoji, code: g.code, u: g.owner, t: g.created }); for (const [u, m] of g.members) if (u !== g.owner) out.push({ op: 'join', g: g.id, u, t: m.t }); if (!g.members.has(g.owner)) out.push({ op: 'leave', g: g.id, u: g.owner }); }
  const items = [];
  for (const list of st.chats.values()) for (const m of list) items.push({ t: m.t, o: { op: 'msg', id: m.id, chat: m.chat, u: m.from, kind: m.kind, text: m.text, media: m.media, sticker: m.sticker, meta: m.meta, t: m.t }, re: m.re, on: 'msg' });
  for (const a of st.acts) items.push({ t: a.t, o: { op: 'act', id: a.id, u: a.u, kind: a.kind, title: a.title, pts: a.pts, data: a.data, t: a.t }, re: a.re, on: 'act' });
  items.sort((x, y) => x.t - y.t);
  for (const it of items) { out.push(it.o); for (const [e, us] of Object.entries(it.re)) for (const u of us) out.push({ op: 'react', on: it.on, id: it.o.id, e, u }); }
  const tmp = LOG + '.tmp'; fs.writeFileSync(tmp, out.map(o => JSON.stringify(o)).join('\n') + '\n'); fs.renameSync(tmp, LOG);
  if (logFd) { fs.closeSync(logFd); logFd = null; }
}

/* ---------- Hilfen ---------- */
const pub = u => u && ({ id: u.id, name: u.name, color: u.color, avatar: u.avatar, bio: u.bio, code: u.code, deleted: u.deleted || undefined });
function weekStart(t = now()) { const d = new Date(t); const wd = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); return d.getTime() - wd * 86400000; }
function periodStart(p) { if (p === 'all') return 0; if (p === 'month') { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); } return weekStart(); }
function statsOf(uid, from = weekStart()) {
  let pts = 0, workouts = 0, runs = 0, km = 0, min = 0;
  for (const a of st.acts) if (a.u === uid && a.t >= from) { pts += a.pts; if (a.kind === 'workout') workouts++; if (a.kind === 'run') { runs++; km += +a.data.km || 0; } min += +a.data.min || 0; }
  const days = new Set(st.acts.filter(a => a.u === uid).map(a => new Date(a.t).toDateString()));
  let streak = 0; const d = new Date(); if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString()) && streak < 999) { streak++; d.setDate(d.getDate() - 1); }
  return { pts, workouts, runs, km: Math.round(km * 10) / 10, min, streak };
}
const memberOf = (uid) => [...st.groups.values()].filter(g => g.members.has(uid));
const mates = uid => { const s = new Set(); for (const g of memberOf(uid)) for (const m of g.members.keys()) s.add(m); s.delete(uid); return s; };
function canChat(uid, chat) {
  if (chat.startsWith('dm:')) return chat.split(':').slice(1).includes(uid);
  const g = st.groups.get(chat); return !!(g && g.members.has(uid));
}
const chatMembers = chat => chat.startsWith('dm:') ? chat.split(':').slice(1) : [...((st.groups.get(chat) || {}).members || new Map()).keys()];
const cleanText = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, n).trim();
const COLORS = ['#12B886', '#3B82F6', '#F97316', '#EC4899', '#8B5CF6', '#EAB308', '#EF4444', '#14B8A6', '#6366F1', '#84CC16'];

/* ---------- Live-Events (SSE) ---------- */
const streams = new Map();   // uid -> Set(res)
function emit(uids, ev, data) {
  const msg = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const u of new Set(uids)) for (const res of streams.get(u) || []) { try { res.write(msg); } catch (e) { /* weg */ } }
}
setInterval(() => { for (const set of streams.values()) for (const res of set) { try { res.write(': ping\n\n'); } catch (e) { /* weg */ } } }, 20000).unref();

/* ---------- Rate-Limit ---------- */
const buckets = new Map();
function limited(key, max, perMs) {
  const b = buckets.get(key) || { n: 0, t: now() }; if (now() - b.t > perMs) { b.n = 0; b.t = now(); }
  b.n++; buckets.set(key, b); return b.n > max;
}
setInterval(() => { const t = now(); for (const [k, b] of buckets) if (t - b.t > 600000) buckets.delete(k); }, 600000).unref();

/* ---------- HTTP ---------- */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Max-Age': '86400' };
const send = (res, code, obj) => { res.writeHead(code, { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const err = (res, code, msg) => send(res, code, { error: msg });
function body(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > max) { reject(Object.assign(new Error('zu groß'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject);
  });
}
async function json(req) { const b = await body(req, MAX_JSON); if (!b.length) return {}; try { return JSON.parse(b.toString('utf8')); } catch (e) { throw Object.assign(new Error('JSON ungültig'), { code: 400 }); } }
function auth(req, url) {
  const h = req.headers.authorization || ''; const tok = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  if (!tok) return null; const uid = st.tokens.get(sha(tok)); const u = uid && st.users.get(uid); return u && !u.deleted ? u : null;
}
function sniff(b) {
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
  if (b[0] === 0x89 && b.slice(1, 4).toString() === 'PNG') return 'png';
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'webp';
  if (b.slice(0, 4).toString() === 'GIF8') return 'gif';
  return null;
}
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
function newMsg(u, chat, b) {
  const kind = ['text', 'image', 'sticker'].includes(b.kind) ? b.kind : 'text';
  const text = cleanText(b.text, 2000);
  const media = typeof b.media === 'string' && /^\/media\/[a-f0-9]{24}\.(jpg|png|webp|gif)$/.test(b.media) ? b.media : null;
  const sticker = typeof b.sticker === 'string' && /^[a-z0-9:_-]{1,40}$/i.test(b.sticker) ? b.sticker : null;
  if (kind === 'text' && !text) return null;
  if (kind === 'image' && !media) return null;
  if (kind === 'sticker' && !sticker && !media) return null;
  const m = commit({ op: 'msg', id: 'm' + crypto.randomBytes(8).toString('hex'), chat, u: u.id, kind, text, media, sticker, meta: null });
  const msg = st.msg.get(m.id); emit(chatMembers(chat), 'msg', msg); return msg;
}
function postActivity(u, b) {
  const kind = ['workout', 'run', 'pr', 'streak', 'meal', 'weight', 'goal'].includes(b.kind) ? b.kind : 'workout';
  const pts = Math.max(0, Math.min(200, Math.round(+b.pts || 0)));
  const data = {}; for (const k of ['min', 'km', 'kcal', 'sets', 'vol', 'emoji', 'pace', 'hr', 'prs', 'lvl', 'exercise', 'kg', 'reps']) if (b.data && b.data[k] != null && typeof b.data[k] !== 'object') data[k] = typeof b.data[k] === 'string' ? cleanText(b.data[k], 60) : +b.data[k];
  const o = commit({ op: 'act', id: 'a' + crypto.randomBytes(8).toString('hex'), u: u.id, kind, title: cleanText(b.title, 80) || 'Training', pts, data });
  const a = st.act.get(o.id);
  const fans = [...st.follows.entries()].filter(([, s]) => s.has(u.id)).map(([f]) => f);
  emit([u.id, ...fans, ...mates(u.id)], 'act', { ...a, user: pub(u) });
  if (b.share !== false) for (const g of memberOf(u.id)) {   // Fortschritt erscheint auch als Karte in jeder Gruppe
    const mo = commit({ op: 'msg', id: 'm' + crypto.randomBytes(8).toString('hex'), chat: g.id, u: u.id, kind: 'activity', text: a.title, meta: { act: a.id, kind, pts, data } });
    emit(chatMembers(g.id), 'msg', st.msg.get(mo.id));
  }
  return a;
}
const groupOut = (g, uid) => { const list = st.chats.get(g.id) || []; const last = list[list.length - 1];
  return { id: g.id, name: g.name, emoji: g.emoji, code: g.code, owner: g.owner, members: g.members.size, last: last ? { kind: last.kind, text: last.kind === 'image' ? '📷 Foto' : last.kind === 'sticker' ? '🎨 Sticker' : last.kind === 'activity' ? '🏅 ' + last.text : last.text, from: last.from, t: last.t, seq: last.seq } : null, seq: list.length ? list[list.length - 1].seq : 0 }; };

async function route(req, res, url) {
  const p = url.pathname, M = req.method;
  const ip = req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress;
  let m0;
  if (M === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (p === '/' || p === '/api/health') return send(res, 200, { ok: true, app: 'ybwye', name: cfg.name, version: VERSION, users: [...st.users.values()].filter(u => !u.deleted).length });
  if ((m0 = p.match(/^\/join\/([A-Za-z0-9]{6})$/)) && M === 'GET') {   // Einladungs-Seite für WhatsApp & Co.
    const g = [...st.groups.values()].find(x => x.code === m0[1].toUpperCase());
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] || (req.socket.encrypted ? 'https' : 'http');
    const origin = cfg.publicUrl || `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const deep = `ybwye://join?s=${encodeURIComponent(origin)}&c=${m0[1].toUpperCase()}`;
    const apk = fs.existsSync(path.join(DIR, 'app.apk'));
    const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Einladung – You By What You Eat</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(120% 80% at 50% 0%,#14a77a,#062019 60%,#000);color:#fff;font:16px/1.45 system-ui,sans-serif}main{max-width:380px;padding:28px 22px;text-align:center}
h1{font-size:28px;margin:10px 0 6px}.e{font-size:64px}.code{display:inline-block;margin:14px 0;padding:10px 18px;border-radius:14px;background:rgba(255,255,255,.12);font:700 26px ui-monospace,monospace;letter-spacing:.18em}
a.b{display:block;margin:12px 0;padding:16px;border-radius:16px;background:#12B886;color:#fff;font-weight:800;text-decoration:none;box-shadow:0 10px 30px rgba(18,184,134,.45)}a.g{background:rgba(255,255,255,.14);box-shadow:none}ol{text-align:left;opacity:.9;padding-left:20px}small{opacity:.7}</style></head><body><main>
<div class="e">${g ? esc(g.emoji) : '💪'}</div><h1>${g ? 'Komm in „' + esc(g.name) + '“' : 'Einladung'}</h1><p>${g ? g.members.size + ' Mitglieder trainieren schon zusammen.' : 'Diese Gruppe gibt es nicht (mehr).'}</p>
<a class="b" href="${esc(deep)}">In der App öffnen</a>${apk ? '<a class="b g" href="/app.apk">App herunterladen (Android)</a>' : ''}
<p>Oder in der App unter <b>Freunde → Einladung</b> diesen Code eingeben:</p><div class="code">${esc(m0[1].toUpperCase())}</div>
<p><small>Server: ${esc(origin)}</small></p></main></body></html>`);
  }
  if (p === '/app.apk' && M === 'GET') {
    const fp = path.join(DIR, 'app.apk'); if (!fs.existsSync(fp)) return err(res, 404, 'Keine App hinterlegt');
    res.writeHead(200, { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Disposition': 'attachment; filename="YouByWhatYouEat.apk"', 'Content-Length': fs.statSync(fp).size });
    return fs.createReadStream(fp).pipe(res);
  }
  if (p.startsWith('/media/') && M === 'GET') {
    const f = path.basename(p); if (!/^[a-f0-9]{24}\.(jpg|png|webp|gif)$/.test(f)) return err(res, 404, 'nicht gefunden');
    const fp = path.join(DIR, 'media', f); if (!fs.existsSync(fp)) return err(res, 404, 'nicht gefunden');
    res.writeHead(200, { ...CORS, 'Content-Type': MIME[f.split('.')[1]], 'Cache-Control': 'public, max-age=31536000, immutable' });
    return fs.createReadStream(fp).pipe(res);
  }
  if (p === '/api/register' && M === 'POST') {
    if (limited('reg:' + ip, 8, 3600000)) return err(res, 429, 'Zu viele Versuche – später nochmal.');
    const b = await json(req); const inv = String(b.invite || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const grp = [...st.groups.values()].find(g => g.code === inv);
    if (inv !== cfg.invite && !grp) return err(res, 403, 'Einladungscode stimmt nicht.');
    const name = cleanText(b.name, 30); if (!name) return err(res, 400, 'Bitte einen Namen angeben.');
    let fc; do { fc = code(6); } while ([...st.users.values()].some(u => u.code === fc));
    const id = 'u' + crypto.randomBytes(6).toString('hex'), token = crypto.randomBytes(32).toString('hex');
    commit({ op: 'user', id, name, color: COLORS.includes(b.color) ? b.color : COLORS[st.users.size % COLORS.length], code: fc });
    commit({ op: 'token', h: sha(token), u: id });
    if (grp) { commit({ op: 'join', g: grp.id, u: id }); const sys = commit({ op: 'msg', id: 'm' + crypto.randomBytes(8).toString('hex'), chat: grp.id, u: id, kind: 'system', text: name + ' ist beigetreten 👋' }); emit(chatMembers(grp.id), 'msg', st.msg.get(sys.id)); emit(chatMembers(grp.id), 'group', { id: grp.id }); }
    return send(res, 200, { token, user: pub(st.users.get(id)), group: grp ? groupOut(grp, id) : null, server: { name: cfg.name, version: VERSION } });
  }
  if (p === '/api/stream' && M === 'GET') {
    const u = auth(req, url); if (!u) return err(res, 401, 'Nicht angemeldet');
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ seq: st.seq })}\n\n`);
    if (!streams.has(u.id)) streams.set(u.id, new Set()); streams.get(u.id).add(res);
    req.on('close', () => { const s = streams.get(u.id); if (s) { s.delete(res); if (!s.size) streams.delete(u.id); } });
    return;
  }
  // ---- ab hier angemeldet ----
  const u = auth(req, url); if (!u) return err(res, 401, 'Nicht angemeldet');
  if (limited('u:' + u.id, 240, 60000)) return err(res, 429, 'Langsam 🙂 – zu viele Anfragen.');
  let m;
  if (p === '/api/me' && M === 'GET') return send(res, 200, { user: pub(u), stats: statsOf(u.id), server: { name: cfg.name, version: VERSION } });
  if (p === '/api/me' && M === 'PATCH') {
    const b = await json(req), f = {};
    if (b.name != null) { const n = cleanText(b.name, 30); if (n) f.name = n; }
    if (b.bio != null) f.bio = cleanText(b.bio, 140);
    if (b.color && COLORS.includes(b.color)) f.color = b.color;
    if (b.avatar === null || (typeof b.avatar === 'string' && /^\/media\/[a-f0-9]{24}\.(jpg|png|webp|gif)$/.test(b.avatar))) f.avatar = b.avatar;
    commit({ op: 'user_upd', id: u.id, f }); emit([u.id, ...mates(u.id)], 'user', pub(u)); return send(res, 200, { user: pub(u) });
  }
  if (p === '/api/me' && M === 'DELETE') { commit({ op: 'user_del', id: u.id }); return send(res, 200, { ok: true }); }
  if (p === '/api/media' && M === 'POST') {
    if (limited('up:' + u.id, 40, 600000)) return err(res, 429, 'Zu viele Uploads – kurz warten.');
    const b = await body(req, MAX_UPLOAD); const ext = sniff(b); if (!ext) return err(res, 415, 'Nur JPG, PNG, WebP oder GIF.');
    const f = crypto.randomBytes(12).toString('hex') + '.' + ext; fs.writeFileSync(path.join(DIR, 'media', f), b);
    return send(res, 200, { url: '/media/' + f, bytes: b.length });
  }
  if (p === '/api/users' && M === 'GET') {
    const c = (url.searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), q = (url.searchParams.get('q') || '').toLowerCase();
    const list = [...st.users.values()].filter(x => !x.deleted && x.id !== u.id && (c ? x.code === c : q ? x.name.toLowerCase().includes(q) : false)).slice(0, 20);
    return send(res, 200, { users: list.map(x => ({ ...pub(x), stats: statsOf(x.id), following: following(u.id).has(x.id) })) });
  }
  if ((m = p.match(/^\/api\/users\/(u[a-f0-9]{12})$/)) && M === 'GET') {
    const x = st.users.get(m[1]); if (!x) return err(res, 404, 'Unbekannt');
    const acts = st.acts.filter(a => a.u === x.id).slice(-20).reverse();
    return send(res, 200, { user: pub(x), stats: statsOf(x.id), month: statsOf(x.id, periodStart('month')), total: statsOf(x.id, 0), following: following(u.id).has(x.id), followsMe: following(x.id).has(u.id),
      followers: [...st.follows.values()].filter(s => s.has(x.id)).length, acts });
  }
  if ((m = p.match(/^\/api\/follow\/(u[a-f0-9]{12})$/))) {
    if (!st.users.get(m[1]) || m[1] === u.id) return err(res, 400, 'Geht nicht');
    if (M === 'POST') { commit({ op: 'follow', a: u.id, b: m[1] }); emit([m[1]], 'follow', { from: pub(u) }); }
    else if (M === 'DELETE') commit({ op: 'unfollow', a: u.id, b: m[1] });
    return send(res, 200, { ok: true });
  }
  if (p === '/api/friends' && M === 'GET') {
    const fol = [...following(u.id)].map(id => st.users.get(id)).filter(x => x && !x.deleted);
    const fans = [...st.follows.entries()].filter(([, s]) => s.has(u.id)).map(([id]) => st.users.get(id)).filter(x => x && !x.deleted);
    const pack = x => ({ ...pub(x), stats: statsOf(x.id), following: following(u.id).has(x.id) });
    return send(res, 200, { following: fol.map(pack), followers: fans.map(pack), me: { ...pub(u), stats: statsOf(u.id) } });
  }
  if (p === '/api/groups' && M === 'GET') return send(res, 200, { groups: memberOf(u.id).map(g => groupOut(g, u.id)), dms: [...st.chats.keys()].filter(c => c.startsWith('dm:') && canChat(u.id, c)).map(c => { const other = c.split(':').slice(1).find(x => x !== u.id) || u.id; const list = st.chats.get(c); const last = list[list.length - 1]; return { id: c, user: pub(st.users.get(other)), last: last ? { kind: last.kind, text: last.kind === 'image' ? '📷 Foto' : last.kind === 'sticker' ? '🎨 Sticker' : last.text, from: last.from, t: last.t, seq: last.seq } : null, seq: last ? last.seq : 0 }; }) });
  if (p === '/api/groups' && M === 'POST') {
    const b = await json(req); const name = cleanText(b.name, 40); if (!name) return err(res, 400, 'Name fehlt');
    if (memberOf(u.id).filter(g => g.owner === u.id).length >= 20) return err(res, 400, 'Maximal 20 eigene Gruppen.');
    let gc; do { gc = code(6); } while ([...st.groups.values()].some(g => g.code === gc));
    const o = commit({ op: 'group', id: 'g' + crypto.randomBytes(6).toString('hex'), name, emoji: cleanText(b.emoji, 8) || '💪', code: gc, u: u.id });
    commit({ op: 'msg', id: 'm' + crypto.randomBytes(8).toString('hex'), chat: o.id, u: u.id, kind: 'system', text: `${u.name} hat die Gruppe „${name}“ erstellt` });
    return send(res, 200, { group: groupOut(st.groups.get(o.id), u.id) });
  }
  if (p === '/api/groups/join' && M === 'POST') {
    const b = await json(req); const c = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const g = [...st.groups.values()].find(x => x.code === c); if (!g) return err(res, 404, 'Gruppen-Code unbekannt.');
    if (!g.members.has(u.id)) { if (g.members.size >= 150) return err(res, 400, 'Gruppe ist voll.'); commit({ op: 'join', g: g.id, u: u.id }); const sys = commit({ op: 'msg', id: 'm' + crypto.randomBytes(8).toString('hex'), chat: g.id, u: u.id, kind: 'system', text: u.name + ' ist beigetreten 👋' }); emit(chatMembers(g.id), 'msg', st.msg.get(sys.id)); emit(chatMembers(g.id), 'group', { id: g.id }); }
    return send(res, 200, { group: groupOut(g, u.id) });
  }
  if ((m = p.match(/^\/api\/groups\/(g[a-f0-9]{12})(\/leave|\/members\/(u[a-f0-9]{12}))?$/))) {
    const g = st.groups.get(m[1]); if (!g || !g.members.has(u.id)) return err(res, 404, 'Gruppe nicht gefunden');
    if (m[2] === '/leave' && M === 'POST') { commit({ op: 'leave', g: g.id, u: u.id }); const sys = commit({ op: 'msg', id: 'm' + crypto.randomBytes(8).toString('hex'), chat: g.id, u: u.id, kind: 'system', text: u.name + ' hat die Gruppe verlassen' }); emit(chatMembers(g.id), 'msg', st.msg.get(sys.id)); return send(res, 200, { ok: true }); }
    if (m[3] && M === 'DELETE') { if (g.owner !== u.id) return err(res, 403, 'Nur der Ersteller darf entfernen.'); commit({ op: 'leave', g: g.id, u: m[3] }); emit([m[3]], 'group', { id: g.id, removed: true }); return send(res, 200, { ok: true }); }
    if (!m[2] && M === 'PATCH') { if (g.owner !== u.id) return err(res, 403, 'Nur der Ersteller darf ändern.'); const b = await json(req), f = {}; if (b.name) f.name = cleanText(b.name, 40); if (b.emoji) f.emoji = cleanText(b.emoji, 8); commit({ op: 'group_upd', id: g.id, f }); emit(chatMembers(g.id), 'group', { id: g.id }); return send(res, 200, { group: groupOut(g, u.id) }); }
    if (!m[2] && M === 'GET') {
      const from = periodStart(url.searchParams.get('period') || 'week');
      const members = [...g.members.keys()].map(id => { const x = st.users.get(id); return { ...pub(x), role: g.members.get(id).role, stats: statsOf(id, from), streak: statsOf(id).streak }; }).sort((a, b) => b.stats.pts - a.stats.pts);
      return send(res, 200, { group: groupOut(g, u.id), members });
    }
  }
  if ((m = p.match(/^\/api\/chats\/([a-zA-Z0-9:.%]+)\/(messages|typing)$/))) {
    let chat; try { chat = decodeURIComponent(m[1]); } catch (e) { return err(res, 400, 'Ungültiger Chat'); } if (/^dm\.u[a-f0-9]{12}$/.test(chat)) { const other = chat.slice(3); if (!st.users.get(other) || other === u.id) return err(res, 404, 'Unbekannt'); chat = dmId(u.id, other); }   // dm.<id> = mein Chat mit dieser Person; dm:a:b nur für Beteiligte
    if (!canChat(u.id, chat)) return err(res, 403, 'Kein Zugriff');
    if (m[2] === 'typing' && M === 'POST') { emit(chatMembers(chat).filter(x => x !== u.id), 'typing', { chat, user: { id: u.id, name: u.name } }); return send(res, 200, { ok: true }); }
    if (M === 'GET') {
      const list = st.chats.get(chat) || [], after = +url.searchParams.get('after') || 0, lim = Math.min(200, +url.searchParams.get('limit') || 60);
      const out = after ? list.filter(x => x.seq > after) : list.slice(-lim);
      const users = {}; for (const x of out) if (!users[x.from]) users[x.from] = pub(st.users.get(x.from));
      return send(res, 200, { chat, messages: out, users });
    }
    if (M === 'POST') { if (limited('msg:' + u.id, 30, 10000)) return err(res, 429, 'Nicht so schnell 🙂'); const msg = newMsg(u, chat, await json(req)); if (!msg) return err(res, 400, 'Leere Nachricht'); return send(res, 200, { message: msg, chat }); }
  }
  if ((m = p.match(/^\/api\/(messages|activities)\/([am][a-f0-9]{16})(\/react)?$/))) {
    const isAct = m[1] === 'activities', x = isAct ? st.act.get(m[2]) : st.msg.get(m[2]); if (!x) return err(res, 404, 'Nicht gefunden');
    const who = isAct ? [x.u, ...mates(x.u), ...[...st.follows.entries()].filter(([, s]) => s.has(x.u)).map(([f]) => f)] : chatMembers(x.chat);
    if (!isAct && !canChat(u.id, x.chat)) return err(res, 403, 'Kein Zugriff');
    if (m[3] && M === 'POST') { const b = await json(req); const e = cleanText(b.emoji, 8); if (!e) return err(res, 400, 'Emoji fehlt'); commit({ op: 'react', on: isAct ? 'act' : 'msg', id: x.id, e, u: u.id }); emit(who, 'react', { on: isAct ? 'act' : 'msg', id: x.id, re: x.re, chat: x.chat, seq: x.seq }); return send(res, 200, { re: x.re }); }
    if (!m[3] && M === 'DELETE' && !isAct) { if (x.from !== u.id) return err(res, 403, 'Nur eigene Nachrichten.'); commit({ op: 'del_msg', id: x.id }); emit(chatMembers(x.chat), 'msg', x); return send(res, 200, { ok: true }); }
  }
  if (p === '/api/activities' && M === 'POST') { if (limited('act:' + u.id, 30, 3600000)) return err(res, 429, 'Zu viele Aktivitäten.'); return send(res, 200, { activity: postActivity(u, await json(req)) }); }
  if (p === '/api/feed' && M === 'GET') {
    const who = new Set([u.id, ...following(u.id), ...mates(u.id)]);
    const list = st.acts.filter(a => who.has(a.u)).slice(-60).reverse();
    const users = {}; for (const a of list) if (!users[a.u]) users[a.u] = pub(st.users.get(a.u));
    return send(res, 200, { activities: list, users });
  }
  if (p === '/api/leaderboard' && M === 'GET') {
    const gid = url.searchParams.get('group'), from = periodStart(url.searchParams.get('period') || 'week');
    let ids; if (gid) { const g = st.groups.get(gid); if (!g || !g.members.has(u.id)) return err(res, 403, 'Kein Zugriff'); ids = [...g.members.keys()]; } else ids = [u.id, ...following(u.id)];
    const rows = ids.map(id => ({ user: pub(st.users.get(id)), ...statsOf(id, from), streak: statsOf(id).streak })).filter(r => r.user && !r.user.deleted).sort((a, b) => b.pts - a.pts || b.min - a.min);
    return send(res, 200, { rows, period: url.searchParams.get('period') || 'week' });
  }
  return err(res, 404, 'Unbekannter Pfad');
}

/* ---------- Start / Befehle ---------- */
load();
const arg = process.argv[2];
if (arg === '--invite') { console.log(`Einladungsschlüssel: ${cfg.invite}\nServer-Name: ${cfg.name}\nNutzer: ${[...st.users.values()].filter(u => !u.deleted).length}`); process.exit(0); }
if (arg === '--rotate-invite') { cfg.invite = code(8); saveCfg(); console.log('Neuer Einladungsschlüssel:', cfg.invite); process.exit(0); }
if (arg === '--url') { cfg.publicUrl = String(process.argv[3] || '').replace(/\/$/, ''); saveCfg(); console.log('Öffentliche Adresse:', cfg.publicUrl || '(automatisch)'); process.exit(0); }
if (arg === '--name') { cfg.name = String(process.argv[3] || 'YBWYE Community').slice(0, 40); saveCfg(); console.log('Server-Name:', cfg.name); process.exit(0); }
if (arg === '--users') { for (const u of st.users.values()) console.log(u.id, u.code, u.deleted ? '(gelöscht)' : '', u.name); process.exit(0); }
if (arg === '--compact') { compact(); console.log('Log kompakt geschrieben:', (fs.statSync(LOG).size / 1024).toFixed(0), 'KB'); process.exit(0); }
try { if (fs.existsSync(LOG) && fs.statSync(LOG).size > 40 * 1024 * 1024) { compact(); console.log('[db] Log komprimiert'); } } catch (e) { console.warn('[db] Komprimieren fehlgeschlagen', e.message); }
const server = http.createServer((req, res) => {
  let url; try { url = new URL(req.url, 'http://x'); } catch (e) { return err(res, 400, 'Ungültige URL'); }
  route(req, res, url).catch(e => { if (!res.headersSent) err(res, e.code && e.code >= 400 && e.code < 600 ? e.code : 500, e.code ? e.message : 'Serverfehler'); if (!e.code) console.error(e); });
});
server.keepAliveTimeout = 65000; server.headersTimeout = 70000; server.requestTimeout = 120000;
server.listen(PORT, HOST, () => console.log(`YBWYE Community-Server ${VERSION} läuft auf http://${HOST}:${PORT}  ·  ${st.users.size} Nutzer  ·  Einladungsschlüssel: ${cfg.invite}`));
const bye = () => { try { if (logFd) fs.fsyncSync(logFd); } catch (e) { /* egal */ } process.exit(0); };
process.on('SIGINT', bye); process.on('SIGTERM', bye);
