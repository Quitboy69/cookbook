/* Community: Verbindung zum eigenen Server (z. B. Raspberry Pi). REST + Live-Events (SSE).
   Zustand in S.social: { url, token, user, read:{chat:seq}, auto, stickers:[{id,data,url}] } */
import { S, save } from './store.js';

export const soc = () => (S.social = S.social || { url: '', token: '', user: null, read: {}, auto: true, stickers: [] });
export const online = () => !!(soc().url && soc().token);
export const live = { chats: {}, users: {}, groups: [], dms: [], typing: {}, es: null, status: 'off', listeners: new Set(), unread: 0 };
const fire = (ev, data) => { for (const fn of live.listeners) { try { fn(ev, data); } catch (e) { console.error(e); } } };
export const on = fn => { live.listeners.add(fn); return () => live.listeners.delete(fn); };
export const abs = u => !u ? '' : /^https?:/.test(u) ? u : soc().url + u;
const err = (code, msg) => Object.assign(new Error(msg), { code });
export const normUrl = u => { u = String(u || '').trim().replace(/\/+$/, ''); if (u && !/^https?:\/\//i.test(u)) u = (/\.local(:\d+)?$|^\d+\.\d+\.\d+\.\d+/.test(u) ? 'http://' : 'https://') + u; return u; };

export async function api(path, { method = 'GET', body, raw, type, url = soc().url, token = soc().token, timeout = 15000 } = {}) {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token;
  if (body) h['Content-Type'] = 'application/json'; if (raw) h['Content-Type'] = type || 'application/octet-stream';
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout);
  let r;
  try { r = await fetch(url + path, { method, headers: h, body: raw || (body ? JSON.stringify(body) : undefined), signal: ctl.signal }); }
  catch (e) { throw err('net', 'Server nicht erreichbar – Adresse und Internet prüfen.'); }
  finally { clearTimeout(tm); }
  let j = null; try { j = await r.json(); } catch (e) { /* kein JSON */ }
  if (r.status === 401) { throw err('auth', 'Anmeldung ungültig – bitte neu verbinden.'); }
  if (!r.ok) throw err(r.status, (j && j.error) || ('Fehler ' + r.status));
  return j || {};
}

/* ---------- Einladung ---------- */
// Formate: ybwye://join?s=<url>&c=<code> · https://server/join/CODE · "YBWYE1:<url>|<code>" · nur der Code
export function parseInvite(t) {
  t = String(t || '').trim();
  let m = t.match(/ybwye:\/\/join\?s=([^&\s]+)&c=([A-Za-z0-9]{6})/); if (m) return { url: decodeURIComponent(m[1]), code: m[2].toUpperCase() };
  m = t.match(/(https?:\/\/[^\s/]+(?:\/[^\s]*?)?)\/join\/([A-Za-z0-9]{6})\b/); if (m) return { url: m[1], code: m[2].toUpperCase() };
  m = t.match(/YBWYE1:(\S+?)\|([A-Za-z0-9]{6,8})/); if (m) return { url: m[1], code: m[2].toUpperCase() };
  m = t.match(/^[A-Za-z0-9]{6,8}$/); if (m) return { url: '', code: t.toUpperCase() };
  return null;
}
export const inviteLink = g => `${soc().url}/join/${g.code}`;
export const inviteText = g => `Komm in meine Trainingsgruppe „${g.name}“ ${g.emoji} – wir vergleichen unseren Fortschritt in „You By What You Eat“!\n\n👉 ${inviteLink(g)}\n\nOder in der App unter Freunde → Einladung den Code ${g.code} eingeben.`;

export async function register(url, invite, name, color) {
  url = normUrl(url);
  const h = await api('/api/health', { url, token: '' }).catch(e => { throw e; });
  if (!h || h.app !== 'ybwye') throw err('url', 'Unter dieser Adresse läuft kein YBWYE-Server.');
  const r = await api('/api/register', { url, token: '', method: 'POST', body: { invite, name, color } });
  Object.assign(soc(), { url, token: r.token, user: r.user, server: r.server && r.server.name }); save(true);
  connect(); return r;
}
export function logout() { disconnect(); Object.assign(soc(), { token: '', user: null }); save(true); live.chats = {}; live.groups = []; live.dms = []; fire('groups'); }

/* ---------- Live-Verbindung ---------- */
let retry = 0, retryT = null;
export function connect() {
  if (!online() || typeof EventSource === 'undefined') return;
  disconnect(); live.status = 'connecting';
  const es = new EventSource(`${soc().url}/api/stream?token=${encodeURIComponent(soc().token)}`); live.es = es;
  es.addEventListener('hello', () => { live.status = 'on'; retry = 0; fire('status'); refreshLists().catch(() => {}); });
  es.addEventListener('msg', e => { const m = JSON.parse(e.data); addMsg(m.chat, m); fire('msg', m); if (m.from !== (soc().user || {}).id) notify(m); if (!live.users[m.from]) fetchUser(m.from); });
  es.addEventListener('typing', e => { const d = JSON.parse(e.data); live.typing[d.chat] = { name: d.user.name, until: Date.now() + 4000 }; fire('typing', d); });
  es.addEventListener('react', e => { const d = JSON.parse(e.data); if (d.on === 'msg') { const list = live.chats[d.chat]; const m = list && list.find(x => x.id === d.id); if (m) m.re = d.re; } fire('react', d); });
  es.addEventListener('act', e => fire('act', JSON.parse(e.data)));
  es.addEventListener('group', () => refreshLists().catch(() => {}));
  es.addEventListener('follow', e => fire('follow', JSON.parse(e.data)));
  es.addEventListener('user', e => { const u = JSON.parse(e.data); live.users[u.id] = u; fire('user', u); });
  es.onerror = () => { live.status = 'off'; fire('status'); es.close(); live.es = null; clearTimeout(retryT); retryT = setTimeout(connect, Math.min(30000, 2000 * 2 ** retry++)); };
}
export function disconnect() { clearTimeout(retryT); if (live.es) { live.es.close(); live.es = null; } live.status = 'off'; }

const pendingUsers = new Set();
function fetchUser(id) { if (pendingUsers.has(id)) return; pendingUsers.add(id); api('/api/users/' + id).then(r => { live.users[id] = r.user; fire('user', r.user); }).catch(() => {}).finally(() => pendingUsers.delete(id)); }

/* ---------- Chats ---------- */
function addMsg(chat, m) {
  const list = live.chats[chat] || (live.chats[chat] = []);
  const i = list.findIndex(x => x.id === m.id); if (i >= 0) list[i] = m; else list.push(m);
  const g = live.groups.find(x => x.id === chat) || live.dms.find(x => x.id === chat);
  if (g) { g.last = { kind: m.kind, text: m.kind === 'image' ? '📷 Foto' : m.kind === 'sticker' ? '🎨 Sticker' : m.kind === 'activity' ? '🏅 ' + m.text : m.text, from: m.from, t: m.t, seq: m.seq }; g.seq = m.seq; }
  else if (chat.startsWith('dm:')) refreshLists().catch(() => {});
  calcUnread();
}
export async function refreshLists() {
  const r = await api('/api/groups'); live.groups = r.groups || []; live.dms = r.dms || [];
  for (const d of live.dms) if (d.user) live.users[d.user.id] = d.user;
  calcUnread(); fire('groups'); return r;
}
export function calcUnread() {
  const rd = soc().read || {}, me = (soc().user || {}).id; let n = 0;
  for (const c of [...live.groups, ...live.dms]) if (c.last && c.last.from !== me && (c.seq || 0) > (rd[c.id] || 0)) n++;
  live.unread = n; fire('unread', n); return n;
}
export const unreadOf = c => c.last && c.last.from !== (soc().user || {}).id && (c.seq || 0) > ((soc().read || {})[c.id] || 0);
export function markRead(chat) { const list = live.chats[chat] || []; const last = list[list.length - 1]; if (!last) return; soc().read = soc().read || {}; if ((soc().read[chat] || 0) < last.seq) { soc().read[chat] = last.seq; save(); calcUnread(); } }
export async function loadChat(chat) {
  const list = live.chats[chat]; const after = list && list.length ? list[list.length - 1].seq : 0;
  const r = await api(`/api/chats/${encodeURIComponent(chat)}/messages${after ? '?after=' + after : ''}`);
  Object.assign(live.users, r.users || {});
  const real = r.chat || chat; for (const m of r.messages) addMsg(real, m);
  for (const m of live.chats[real] || []) if (!live.users[m.from]) fetchUser(m.from);
  if (!live.chats[real]) live.chats[real] = [];
  return real;
}
export async function send(chat, body) { const r = await api(`/api/chats/${encodeURIComponent(chat)}/messages`, { method: 'POST', body }); addMsg(r.chat, r.message); return r; }
let typingT = 0;
export function typing(chat) { if (Date.now() - typingT < 3000) return; typingT = Date.now(); api(`/api/chats/${encodeURIComponent(chat)}/typing`, { method: 'POST' }).catch(() => {}); }
export const react = (id, emoji, act = false) => api(`/api/${act ? 'activities' : 'messages'}/${id}/react`, { method: 'POST', body: { emoji } });
export const delMsg = id => api(`/api/messages/${id}`, { method: 'DELETE' });
export async function upload(blob) { const r = await api('/api/media', { method: 'POST', raw: blob, type: blob.type || 'image/jpeg', timeout: 45000 }); return r.url; }

/* ---------- Gruppen, Freunde, Feed, Rangliste ---------- */
export const createGroup = (name, emoji) => api('/api/groups', { method: 'POST', body: { name, emoji } }).then(r => { refreshLists().catch(() => {}); return r.group; });
export const joinGroup = code => api('/api/groups/join', { method: 'POST', body: { code } }).then(r => { refreshLists().catch(() => {}); return r.group; });
export const groupInfo = (id, period = 'week') => api(`/api/groups/${id}?period=${period}`);
export const leaveGroup = id => api(`/api/groups/${id}/leave`, { method: 'POST' }).then(r => { refreshLists().catch(() => {}); return r; });
export const friends = () => api('/api/friends');
export const findCode = code => api(`/api/users?code=${encodeURIComponent(code)}`);
export const follow = (id, on = true) => api(`/api/follow/${id}`, { method: on ? 'POST' : 'DELETE' });
export const profile = id => api(`/api/users/${id}`);
export const feed = () => api('/api/feed');
export const leaderboard = (group, period = 'week') => api(`/api/leaderboard?${group ? 'group=' + group + '&' : ''}period=${period}`);
export const me = () => api('/api/me').then(r => { soc().user = r.user; save(); return r; });
export const updateMe = f => api('/api/me', { method: 'PATCH', body: f }).then(r => { soc().user = r.user; save(); return r.user; });

/* ---------- Fortschritt teilen ---------- */
export function postActivity(a) { if (!online() || soc().auto === false) return Promise.resolve(null); return api('/api/activities', { method: 'POST', body: a }).catch(() => null); }
export const shareWorkout = rec => postActivity({ kind: 'workout', title: rec.n, pts: rec.pts, data: { min: rec.min, sets: rec.sets.length, vol: rec.vol, emoji: rec.e, prs: rec.prs.length, kcal: rec.kcal } });
export const shareRun = (km, min, pts, extra = {}) => postActivity({ kind: 'run', title: `Lauf ${String(Math.round(km * 10) / 10).replace('.', ',')} km`, pts, data: { km, min, emoji: '🏃', ...extra } });

/* ---------- Benachrichtigung, wenn die App im Hintergrund ist ---------- */
let notifier = null;
export const setNotifier = fn => { notifier = fn; };
function notify(m) {
  if (!notifier || !document.hidden || m.kind === 'system') return;
  const u = live.users[m.from] || {}; const g = live.groups.find(x => x.id === m.chat);
  const body = m.kind === 'image' ? '📷 Foto' : m.kind === 'sticker' ? '🎨 Sticker' : m.kind === 'activity' ? '🏅 ' + m.text : m.text;
  notifier({ title: g ? `${g.emoji} ${g.name}` : (u.name || 'Neue Nachricht'), body: g ? `${u.name || ''}: ${body}` : body, chat: m.chat });
}
