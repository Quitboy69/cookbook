/* Community 2.0: Freunde (Chats, Rangliste, Feed, Freunde), Chat wie im Messenger, Gruppe mit Einladung + QR,
   Profil, 1-gegen-1-Vergleich, Sticker-Editor. Daten kommen vom eigenen Server (social.js). */
import qrcode from 'qrcode-generator';
import { S, save } from './store.js';
import * as SO from './social.js';
import { PACKS, stickerSVG, EMOJIS, editorState, renderSticker, exportSticker, dataUrlToBlob, shrinkImage, loadImage } from './stickers.js';
import { $, $$, ico, esc, toast, sheet, go, back, refresh, current, confetti } from './ui.js';
import { haptic, isNative, openExternal, shareText } from './native.js';

export const ui3 = { tab: 'chats', period: 'week', scope: '', cache: { lb: {}, feed: null, friends: null, prof: {}, gi: {} }, setup: { inv: '', url: '', name: '', color: '' }, panel: false, stTab: 'gym', ed: null, alias: {} };
const COLORS = ['#12B886', '#3B82F6', '#F97316', '#EC4899', '#8B5CF6', '#EAB308', '#EF4444', '#14B8A6', '#6366F1', '#84CC16'];
const REACT = ['🔥', '💪', '😂', '❤️', '👏', '😮'];
const GEMO = ['💪', '🔥', '🏃', '🏋️', '🧘', '🥗', '⚡', '🏆', '👑', '🦁', '🐺', '🚀', '🍑', '🎯', '🌊', '❤️'];
const me = () => (SO.soc().user || {});
const lit = n => String(Math.round((+n || 0) * 10) / 10).replace('.', ',');
const fmt = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const dhead = (title, sub = '', right = '', left = '') => `<header class="dhead"><button class="iconbtn tap" data-act="back" aria-label="Zurück">${ico('back')}</button>${left}<div class="dhead-t"><b>${title}</b>${sub ? '<small>' + sub + '</small>' : ''}</div><span class="dhead-s">${right}</span></header>`;
const pg = (h, cls = 'detail') => `<div class="page ${cls}">${h}</div>`;
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

export function av(u, s = 40, cls = '') {
  u = u || {}; const ini = String(u.name || '?').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
  return u.avatar ? `<span class="av ${cls}" style="--s:${s}px"><img src="${esc(SO.abs(u.avatar))}" alt="" loading="lazy"></span>`
    : `<span class="av ${cls}" style="--s:${s}px;--c:${esc(u.color || '#12B886')}">${esc(ini)}</span>`;
}
const gav = (g, s = 46) => `<span class="av gav" style="--s:${s}px;--h:${hue(g.id || g.name)}">${esc(g.emoji || '💪')}</span>`;
export function when(t, long = false) {
  if (!t) return ''; const d = new Date(t), n = new Date(), hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const day = Math.round((new Date(n.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (day === 0) return long ? 'Heute, ' + hm : hm;
  if (day === 1) return long ? 'Gestern, ' + hm : 'Gestern';
  if (day < 7) return d.toLocaleDateString('de-DE', { weekday: long ? 'long' : 'short' }) + (long ? ', ' + hm : '');
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: long ? 'numeric' : '2-digit' });
}
const dayLabel = t => { const d = new Date(t), n = new Date(); const day = Math.round((new Date(n.toDateString()) - new Date(d.toDateString())) / 864e5); return day === 0 ? 'Heute' : day === 1 ? 'Gestern' : d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }); };
const statusDot = () => `<i class="so-dot ${SO.live.status}" title="${SO.live.status === 'on' ? 'verbunden' : 'verbinde…'}"></i>`;
const chatName = c => c.user ? c.user.name : c.name;
const lastText = c => { if (!c.last) return c.user ? 'Sag Hallo 👋' : 'Noch keine Nachrichten'; const who = c.last.from === me().id ? 'Du' : c.user ? '' : ((SO.live.users[c.last.from] || {}).name || '').split(' ')[0]; return (who ? who + ': ' : '') + (c.last.text || ''); };

/* ================= Freunde (Tab) ================= */
export function freunde() {
  if (!SO.online()) return { html: pg(setupHTML(), 'so-page'), mount: mountSetup };
  const tabs = [['chats', 'Chats'], ['rang', 'Rangliste'], ['feed', 'Feed'], ['freunde', 'Freunde']];
  const html = `<header class="top rise"><div><p class="kicker">${statusDot()}${esc(SO.soc().server || 'Community')}</p><h1 class="h1">Freunde</h1></div><button class="so-me tap" data-go="#/sprofil/me" aria-label="Mein Profil">${av(me(), 44)}</button></header>
    <div class="seg wide ttabs rise">${tabs.map(([k, l]) => `<button class="tap${ui3.tab === k ? ' on' : ''}" data-act="so-tab" data-v="${k}">${l}${k === 'chats' && SO.live.unread ? ` <i class="seg-badge">${SO.live.unread}</i>` : ''}</button>`).join('')}</div>
    <div id="so-body">${bodyHTML()}</div>`;
  return { html: pg(html, 'so-page'), mount: mountFreunde };
}
function bodyHTML() {
  if (ui3.tab === 'rang') return rangHTML();
  if (ui3.tab === 'feed') return feedHTML();
  if (ui3.tab === 'freunde') return friendsHTML();
  return chatsHTML();
}
function chatsHTML() {
  const list = [...SO.live.groups, ...SO.live.dms].sort((a, b) => ((b.last && b.last.t) || 0) - ((a.last && a.last.t) || 0));
  const qa = `<div class="so-qa rise"><button class="tap" data-act="so-newgroup"><span>${ico('plus')}</span>Gruppe</button><button class="tap" data-act="so-joincode"><span>${ico('qr')}</span>Code</button><button class="tap" data-act="so-tab" data-v="freunde"><span>${ico('people')}</span>Freunde</button><button class="tap" data-go="#/sticker"><span>${ico('smile')}</span>Sticker</button></div>`;
  if (!list.length) return qa + `<article class="card so-empty rise"><div class="so-ill">${['💪', '🏃', '🔥'].map((e, i) => `<span style="--i:${i}">${e}</span>`).join('')}</div><h2>Noch kein Chat</h2><p>Erstelle eine Gruppe, schick den Link an deine Freunde – und dann wird jede Woche um den ersten Platz gekämpft.</p><button class="btn wide tap" data-act="so-newgroup">${ico('plus')}Gruppe erstellen</button></article>`;
  return qa + `<div class="card chat-list rise">${list.map(c => {
    const un = SO.unreadOf(c), typ = SO.live.typing[c.id] && SO.live.typing[c.id].until > Date.now();
    return `<button class="chat-row tap${un ? ' un' : ''}" data-go="#/chat/${encodeURIComponent(c.id)}">${c.user ? av(c.user, 50) : gav(c, 50)}<span class="cr-m"><b>${esc(chatName(c))}</b><small>${typ ? '<em>schreibt…</em>' : esc(lastText(c))}</small></span><span class="cr-r"><small>${when(c.last && c.last.t)}</small>${un ? '<i class="cr-badge"></i>' : (!c.user ? `<small class="cr-n">${c.members} ${ico('people')}</small>` : '')}</span></button>`;
  }).join('')}</div>`;
}

/* ---- Rangliste ---- */
function rangHTML() {
  const per = [['week', 'Woche'], ['month', 'Monat'], ['all', 'Gesamt']];
  const scopes = [['', 'Ich + Freunde'], ...SO.live.groups.map(g => [g.id, g.emoji + ' ' + g.name])];
  const key = ui3.scope + '|' + ui3.period, d = ui3.cache.lb[key];
  return `<div class="seg rise">${per.map(([k, l]) => `<button class="tap${ui3.period === k ? ' on' : ''}" data-act="so-per" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="chips so-scope rise">${scopes.map(([k, l]) => `<button class="chip tap${ui3.scope === k ? ' on' : ''}" data-act="so-scope" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>
    <div id="so-lb">${d ? lbHTML(d.rows) : skel(4)}</div>`;
}
const skel = n => `<div class="card">${Array.from({ length: n }, () => '<div class="sk-row"><i></i><span></span></div>').join('')}</div>`;
export function lbHTML(rows) {
  if (!rows || !rows.length) return `<article class="card so-empty"><h2>Noch keine Punkte</h2><p>Mach ein Workout oder lauf eine Runde – dein Ergebnis landet automatisch hier.</p></article>`;
  const myI = rows.findIndex(r => r.user.id === me().id), top = rows.slice(0, 3);
  const pod = [1, 0, 2].filter(i => top[i]).map(i => { const r = top[i]; return `<div class="pod p${i + 1}${r.user.id === me().id ? ' self' : ''}"><span class="pod-av">${i === 0 ? '<i class="crown">👑</i>' : ''}${av(r.user, i === 0 ? 64 : 52)}</span><b>${esc(r.user.name.split(' ')[0])}</b><small>${fmt(r.pts)} Pkt</small><span class="pod-b"><em>${i + 1}</em></span></div>`; }).join('');
  let mot = '';
  if (rows.length > 1 && myI === 0) mot = `<p class="so-mot lead">👑 Du führst mit ${fmt(rows[0].pts - rows[1].pts)} Punkten Vorsprung – verteidige die Spitze!</p>`;
  else if (myI > 0) { const gap = rows[myI - 1].pts - rows[myI].pts + 1; mot = `<p class="so-mot">🔥 Noch <b>${fmt(gap)} Punkte</b> bis Platz ${myI} (${esc(rows[myI - 1].user.name.split(' ')[0])}) – ${gap <= 45 ? 'ein Workout reicht!' : 'zwei, drei Einheiten und du bist vorbei.'}</p>`; }
  const max = Math.max(1, rows[0].pts);
  return `<article class="card so-pod">${pod}</article>${mot}<div class="card lb-list">${rows.map((r, i) => `<button class="lb-row tap${r.user.id === me().id ? ' self' : ''}" data-go="#/sprofil/${r.user.id === me().id ? 'me' : r.user.id}"><span class="lb-n">${i + 1}</span>${av(r.user, 40)}<span class="lb-m"><b>${esc(r.user.name)}</b><small>${r.workouts} Workouts · ${lit(r.km)} km${r.streak ? ' · 🔥' + r.streak : ''}</small><i class="lb-bar"><i data-w="${Math.round(r.pts / max * 100)}%"></i></i></span><b class="lb-p">${fmt(r.pts)}</b></button>`).join('')}</div>
    <p class="fine so-rules">So gibt’s Punkte: Workout 10 + 1 pro Minute (max. 60) + 5 pro Rekord · Lauf 10 + 10 pro km.</p>`;
}

/* ---- Feed ---- */
const ACT_VERB = { workout: 'hat ein Workout geschafft', run: 'war laufen', pr: 'hat einen Rekord geknackt', streak: 'hat eine Serie', meal: 'hat gesund gegessen', weight: 'hat ein Ziel erreicht', goal: 'hat ein Ziel erreicht' };
export function actCard(a, u, compact = false) {
  const d = a.data || {}, chips = [];
  if (d.min) chips.push(`${ico('clock')}${d.min} Min`); if (d.km) chips.push(`${ico('run')}${lit(d.km)} km`); if (d.sets) chips.push(`${ico('dumbbell')}${d.sets} Sätze`);
  if (d.kcal) chips.push(`${ico('fire')}${fmt(d.kcal)} kcal`); if (d.prs) chips.push(`🏆 ${d.prs} Rekord${d.prs > 1 ? 'e' : ''}`);
  const re = a.re || {};
  return `<article class="card act-card${compact ? ' compact' : ''}" data-aid="${a.id}" style="--h:${a.kind === 'run' ? 22 : hue(a.title)}">
    ${compact ? '' : `<header class="ac-h">${av(u, 38)}<span><b>${esc((u || {}).name || '')}</b><small>${ACT_VERB[a.kind] || 'war aktiv'} · ${when(a.t)}</small></span></header>`}
    <div class="ac-tile"><span class="ac-e">${esc(d.emoji || (a.kind === 'run' ? '🏃' : '💪'))}</span><span class="ac-t"><b>${esc(a.title)}</b><span class="ac-chips">${chips.map(c => `<i>${c}</i>`).join('')}</span></span><span class="ac-pts">+${a.pts}<small>Pkt</small></span></div>
    <div class="ac-re">${['🔥', '💪', '👏', '❤️'].map(e => { const l = re[e] || []; return `<button class="re-b tap${l.includes(me().id) ? ' mine' : ''}" data-act="so-react-act" data-id="${a.id}" data-e="${e}">${e}${l.length ? `<small>${l.length}</small>` : ''}</button>`; }).join('')}</div></article>`;
}
function feedHTML() {
  const d = ui3.cache.feed;
  if (!d) return skel(3);
  if (!d.activities.length) return `<article class="card so-empty rise"><div class="so-ill"><span>🏅</span></div><h2>Noch nichts los</h2><p>Hier siehst du jedes Workout und jeden Lauf deiner Freunde und Gruppen – und kannst mit 🔥 anfeuern.</p></article>`;
  return d.activities.map(a => actCard(a, d.users[a.u])).join('');
}

/* ---- Freunde-Liste ---- */
function friendsHTML() {
  const d = ui3.cache.friends, m = me();
  const myCard = `<article class="card so-code rise"><p class="kicker">Dein Freundescode</p><div class="code-big">${esc(m.code || '······').split('').map(c => `<i>${c}</i>`).join('')}</div><p class="fine">Gib den Code an Freunde weiter – sie tragen ihn hier ein und folgen dir.</p><div class="rc-btns"><button class="btn ghost tap" data-act="so-copy" data-v="${esc(m.code || '')}">${ico('copy')}Kopieren</button><button class="btn ghost tap" data-act="so-share-code">${ico('share')}Teilen</button></div></article>
    <article class="card rise"><div class="c-h">${ico('plus')}Freund hinzufügen</div><div class="so-add"><input id="so-fcode" maxlength="6" placeholder="Code, z. B. K7M2QX" autocomplete="off" autocapitalize="characters"><button class="btn tap" data-act="so-follow-code">Folgen</button></div></article>`;
  if (!d) return myCard + skel(3);
  const row = (u, back) => `<div class="fr-row">${`<button class="fr-u tap" data-go="#/sprofil/${u.id}">${av(u, 44)}<span><b>${esc(u.name)}</b><small>${fmt(u.stats.pts)} Pkt diese Woche${u.stats.streak ? ' · 🔥' + u.stats.streak : ''}</small></span></button>`}${back && !u.following ? `<button class="btn sm tap" data-act="so-follow" data-id="${u.id}">Zurückfolgen</button>` : `<button class="iconbtn sm tap" data-go="#/chat/dm.${u.id}" aria-label="Nachricht">${ico('chat')}</button><button class="iconbtn sm tap" data-go="#/duell/${u.id}" aria-label="Vergleichen">${ico('trophy')}</button>`}</div>`;
  return myCard + `<section class="sec rise"><h2>Du folgst <small>${d.following.length}</small></h2></section>
    <div class="card fr-list rise">${d.following.length ? d.following.map(u => row(u)).join('') : '<p class="empty">Noch niemand – trag oben einen Code ein.</p>'}</div>
    <section class="sec rise"><h2>Folgen dir <small>${d.followers.length}</small></h2></section>
    <div class="card fr-list rise">${d.followers.length ? d.followers.map(u => row(u, true)).join('') : '<p class="empty">Noch keine Follower.</p>'}</div>`;
}

let unsubList = null;
function mountFreunde(el) {
  if (unsubList) unsubList();
  const paint = () => { const b = $('#so-body', el); if (!b || !el.isConnected) return; if (document.activeElement && document.activeElement.id === 'so-fcode') return; b.innerHTML = bodyHTML(); animBars(b); };
  unsubList = SO.on((ev) => {
    if (!el.isConnected) { unsubList(); unsubList = null; return; }
    if (ev === 'status') { const k = $('.top .kicker', el); if (k) k.innerHTML = statusDot() + esc(SO.soc().server || 'Community'); }
    if (ui3.tab === 'chats' && ['groups', 'msg', 'unread', 'typing'].includes(ev)) { paint(); const sb = $('.ttabs button[data-v="chats"]', el); if (sb) sb.innerHTML = 'Chats' + (SO.live.unread ? ` <i class="seg-badge">${SO.live.unread}</i>` : ''); }
    if (ui3.tab === 'feed' && ev === 'act') loadTab(el);
  });
  loadTab(el);
}
export async function loadTab(el) {
  try {
    if (ui3.tab === 'chats') await SO.refreshLists();
    else if (ui3.tab === 'rang') { const r = await SO.leaderboard(ui3.scope, ui3.period); ui3.cache.lb[ui3.scope + '|' + ui3.period] = r; const b = $('#so-lb', el); if (b) { b.innerHTML = lbHTML(r.rows); animBars(b); } return; }
    else if (ui3.tab === 'feed') ui3.cache.feed = await SO.feed();
    else if (ui3.tab === 'freunde') ui3.cache.friends = await SO.friends();
    const b = $('#so-body', el); if (b && !(document.activeElement && document.activeElement.id === 'so-fcode')) { b.innerHTML = bodyHTML(); animBars(b); }
  } catch (e) { handleErr(e); }
}
function animBars(root) { requestAnimationFrame(() => $$('[data-w]', root).forEach(b => { b.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => { b.style.width = b.dataset.w; })); })); }
export function handleErr(e) {
  if (e && e.code === 'auth') { toast('Anmeldung abgelaufen – bitte neu verbinden.', 'toast-warn'); SO.logout(); if (current() === '#/freunde') refresh(); return; }
  toast(esc((e && e.message) || 'Fehler'), 'toast-warn');
}

/* ---- Einrichtung (noch nicht verbunden) ---- */
function setupHTML() {
  const s = ui3.setup, col = s.color || COLORS[0];
  return `<header class="top rise"><div><p class="kicker">Community</p><h1 class="h1">Freunde</h1></div></header>
  <article class="card so-hero rise"><div class="so-hero-art"><span class="h-av" style="--c:#EC4899">L</span><span class="h-av" style="--c:#3B82F6">M</span><span class="h-av" style="--c:#F97316">S</span><span class="h-cup">🏆</span><span class="h-b b1">Neuer Rekord 💪</span><span class="h-b b2">🔥 3 Workouts!</span></div>
    <h2>Zusammen trainieren.<br>Gegeneinander gewinnen.</h2>
    <ul class="so-feat"><li><b>💬</b>Gruppenchat mit Fotos und Stickern – fertige und selbstgemachte</li><li><b>🏆</b>Wochen-Rangliste: wer sammelt die meisten Punkte?</li><li><b>⚔️</b>1 gegen 1 vergleichen – Workouts, km, Serie</li><li><b>🔥</b>Dein Fortschritt erscheint automatisch bei deinen Freunden</li></ul></article>
  <article class="card rise"><div class="c-h">${ico('link')}Einladung annehmen</div>
    <label class="field"><span>Einladungslink oder Code</span><textarea id="so-inv" rows="2" placeholder="Link aus WhatsApp einfügen …">${esc(s.inv)}</textarea></label>
    <label class="field"><span>Server-Adresse <small class="soft">(steht im Link – nur bei reinem Code nötig)</small></span><input id="so-url" value="${esc(s.url)}" placeholder="https://dein-pi.ts.net" autocomplete="off" autocapitalize="off" inputmode="url"></label>
    <label class="field"><span>Dein Name</span><input id="so-name" maxlength="30" value="${esc(s.name || S.profile.name || '')}" placeholder="z. B. Lisa"></label>
    <span class="flabel">Deine Farbe</span><div class="col-pick">${COLORS.map(c => `<button class="tap${c === col ? ' on' : ''}" data-act="so-col" data-v="${c}" style="--c:${c}" aria-label="Farbe"></button>`).join('')}</div>
    <button class="btn big wide tap" data-act="so-join" id="so-join">${ico('people')}Beitreten</button></article>
  <article class="card so-host rise"><div class="c-h">${ico('info')}Noch kein Server?</div><p class="rc-desc">Eure Chats laufen auf eurem eigenen kleinen Server – zum Beispiel einem Raspberry Pi 3B+ zu Hause. Der schafft locker 100 Leute, und eure Daten landen bei keiner fremden Firma.</p><button class="btn ghost wide tap" data-act="so-howto">${ico('book')}So richtest du ihn ein</button></article>`;
}
function mountSetup(el) {
  const inv = $('#so-inv', el), url = $('#so-url', el), name = $('#so-name', el);
  const sync = () => { ui3.setup.inv = inv.value; ui3.setup.url = url.value; ui3.setup.name = name.value; const p = SO.parseInvite(inv.value); if (p && p.url && !url.value) { url.value = p.url; ui3.setup.url = p.url; } };
  [inv, url, name].forEach(i => i.addEventListener('input', sync));
}
export function howtoHTML() {
  return `<h2 class="sh-t">Eigener Server in 20 Minuten</h2><ol class="howto">
    <li><b>Raspberry Pi vorbereiten:</b> Mit dem „Raspberry Pi Imager“ <i>Raspberry Pi OS Lite (64-bit)</i> auf die SD-Karte schreiben, dabei WLAN, Benutzer und SSH einstellen.</li>
    <li><b>Per SSH verbinden</b> und den Server mit einem Befehl installieren (steht in der Anleitung <i>server/ANLEITUNG.md</i>).</li>
    <li><b>Von überall erreichbar:</b> Tailscale installieren und „Funnel“ einschalten – du bekommst eine feste https-Adresse.</li>
    <li><b>Hier eintragen:</b> Adresse + Einladungsschlüssel, den der Pi am Ende anzeigt. Dann eine Gruppe erstellen und den Link verschicken.</li></ol>
    <p class="sh-sub">Strom: ca. 3 Watt – kostet etwa 7 € im Jahr.</p><button class="btn wide tap" data-close>Verstanden</button>`;
}

/* ================= Chat ================= */
let unsubChat = null;
const realChat = id => ui3.alias[id] || (id.startsWith('dm.') && me().id ? 'dm:' + [me().id, id.slice(3)].sort().join(':') : id);
function chatMeta(id) {
  const rid = realChat(id);
  const g = SO.live.groups.find(x => x.id === rid); if (g) return { g, title: `${esc(g.emoji)} ${esc(g.name)}`, info: '#/gruppe/' + g.id, sub: `${g.members} Mitglieder` };
  const d = SO.live.dms.find(x => x.id === rid); const uid = id.startsWith('dm.') ? id.slice(3) : rid.split(':').slice(1).find(x => x !== me().id);
  const u = (d && d.user) || SO.live.users[uid] || (ui3.cache.prof[uid] && ui3.cache.prof[uid].user) || { name: 'Chat', id: uid };
  return { u, title: esc(u.name), info: '#/sprofil/' + uid, sub: 'Tippe für Profil & Vergleich' };
}
export function chat(id) {
  id = decodeURIComponent(id || '');
  const rid = realChat(id), meta = chatMeta(id), list = SO.live.chats[rid] || [];
  const isG = !!meta.g;
  const html = `<header class="dhead ch-head">${`<button class="iconbtn tap" data-act="back" aria-label="Zurück">${ico('back')}</button>`}<button class="ch-who tap" data-go="${meta.info}">${isG ? gav(meta.g, 40) : av(meta.u, 40)}<span><b>${meta.title}</b><small id="ch-sub">${meta.sub}</small></span></button></header>
    <div class="ch-list" id="ch-list">${list.length ? msgsHTML(list, isG) : '<p class="ch-hint" id="ch-empty">Lädt…</p>'}</div>
    <div class="ch-panel" id="ch-panel"${ui3.panel ? '' : ' hidden'}>${panelHTML()}</div>
    <div class="ch-comp"><button class="ch-ib tap${ui3.panel ? ' on' : ''}" id="ch-stk" aria-label="Sticker">${ico('smile')}</button><div class="ch-inp"><textarea id="ch-t" rows="1" placeholder="Nachricht" enterkeyhint="send"></textarea><label class="ch-ib tap" for="ch-file" aria-label="Foto senden">${ico('camera')}</label><input type="file" id="ch-file" accept="image/*" hidden></div><button class="ch-send tap" id="ch-send" aria-label="Senden">${ico('send')}</button></div>`;
  return { html, cls: 'chat-screen', mount: el => mountChat(el, id) };
}
export function msgsHTML(list, isG) {
  let out = '', prev = null;
  for (const m of list) { out += msgHTML(m, prev, isG); prev = m; }
  return out;
}
function msgHTML(m, prev, isG) {
  const mine = m.from === me().id, u = SO.live.users[m.from] || {};
  let h = '';
  if (!prev || new Date(prev.t).toDateString() !== new Date(m.t).toDateString()) h += `<div class="ch-day"><span>${dayLabel(m.t)}</span></div>`;
  if (m.kind === 'system') return h + `<div class="ch-sys" data-mid="${m.id}"><span>${esc(m.text)}</span></div>`;
  const cont = prev && prev.from === m.from && prev.kind !== 'system' && m.t - prev.t < 300000 && new Date(prev.t).toDateString() === new Date(m.t).toDateString();
  let body;
  if (m.kind === 'deleted') body = `<div class="bub del"><i>🚫 Nachricht gelöscht</i></div>`;
  else if (m.kind === 'sticker') body = `<div class="ch-stkr">${m.sticker ? stickerSVG(m.sticker) : `<img src="${esc(SO.abs(m.media))}" alt="Sticker" loading="lazy" draggable="false">`}</div>`;
  else if (m.kind === 'image') body = `<div class="bub img"><img src="${esc(SO.abs(m.media))}" alt="Foto" loading="lazy" draggable="false" data-view="${esc(SO.abs(m.media))}">${m.text ? `<p>${linkify(m.text)}</p>` : ''}<small class="bt">${when(m.t).replace('Gestern', '')}</small></div>`;
  else if (m.kind === 'activity') { const a = m.meta || {}; body = actBubble(m, a); }
  else body = `<div class="bub">${!mine && isG && !cont ? `<b class="bn" style="color:${esc(u.color || '#12B886')}">${esc(u.name || '')}</b>` : ''}<p>${linkify(m.text)}</p><small class="bt">${new Date(m.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</small></div>`;
  const re = m.re || {}, rk = Object.keys(re);
  const reH = rk.length ? `<div class="ch-re">${rk.map(e => `<button class="tap${re[e].includes(me().id) ? ' mine' : ''}" data-act="so-react" data-id="${m.id}" data-e="${esc(e)}">${esc(e)}${re[e].length > 1 ? `<small>${re[e].length}</small>` : ''}</button>`).join('')}</div>` : '';
  return h + `<div class="ch-msg${mine ? ' out' : ''}${cont ? ' cont' : ''}" data-mid="${m.id}" data-kind="${m.kind}">${!mine && isG ? `<span class="ch-av">${cont ? '' : av(u, 30)}</span>` : ''}<div class="ch-col">${body}${reH}</div></div>`;
}
function actBubble(m, a) {
  const d = a.data || {}, u = SO.live.users[m.from] || {};
  const st = []; if (d.min) st.push(d.min + ' Min'); if (d.km) st.push(lit(d.km) + ' km'); if (d.sets) st.push(d.sets + ' Sätze'); if (d.prs) st.push('🏆 ' + d.prs);
  return `<div class="bub act" style="--h:${a.kind === 'run' ? 22 : hue(m.text)}"><span class="ab-e">${esc(d.emoji || (a.kind === 'run' ? '🏃' : '💪'))}</span><span class="ab-m"><small>${m.from === me().id ? 'Du hast' : esc((u.name || '').split(' ')[0]) + ' hat'} trainiert</small><b>${esc(m.text)}</b><small>${st.join(' · ')}</small></span><span class="ab-p">+${a.pts || 0}</span></div>`;
}
const linkify = t => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" data-ext="$1">$1</a>').replace(/\n/g, '<br>');

function panelHTML() {
  const tabs = [['mine', '⭐ Meine'], ...PACKS.map(p => [p.id, p.n])];
  const t = ui3.stTab;
  let grid;
  if (t === 'mine') { const mine = SO.soc().stickers || []; grid = `<button class="stk-cell new tap" data-act="so-stk-new">${ico('plus')}<small>Eigener Sticker</small></button>` + mine.map(s => `<button class="stk-cell tap" data-act="so-stk-mine" data-id="${s.id}"><img src="${s.data}" alt=""></button>`).join(''); }
  else grid = PACKS.find(p => p.id === t).items.map(([id]) => `<button class="stk-cell tap" data-act="so-stk" data-id="${t}:${id}">${stickerSVG(t + ':' + id)}</button>`).join('');
  return `<div class="stk-tabs">${tabs.map(([k, l]) => `<button class="tap${t === k ? ' on' : ''}" data-act="so-stk-tab" data-v="${k}">${esc(l)}</button>`).join('')}</div><div class="stk-grid">${grid}</div>`;
}

function mountChat(el, id) {
  if (unsubChat) unsubChat();
  const list = $('#ch-list', el), ta = $('#ch-t', el), meta = chatMeta(id), isG = !!meta.g;
  let rid = realChat(id);
  let stick = true;
  const atBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  const toBottom = () => { stick = true; list.scrollTop = list.scrollHeight; };
  const repaint = (keep) => { const b = keep ? stick : true; list.innerHTML = (SO.live.chats[rid] || []).length ? msgsHTML(SO.live.chats[rid], isG) : `<p class="ch-hint">${isG ? 'Schreib die erste Nachricht oder schick einen Sticker 👋' : 'Sag Hallo 👋 – oder fordere zum Duell heraus.'}</p>`; if (b) toBottom(false); };
  requestAnimationFrame(() => toBottom(false));
  // unten „kleben“, solange man unten ist – auch wenn Bilder erst später laden
  list.addEventListener('scroll', () => { stick = atBottom(); }, { passive: true });
  list.addEventListener('load', e => { if (e.target.tagName === 'IMG' && stick) toBottom(false); }, true);
  SO.loadChat(id).then(real => { rid = real; if (real !== id) ui3.alias[id] = real; repaint(false); SO.markRead(rid); }).catch(e => { list.innerHTML = `<p class="ch-hint">${esc(e.message)}</p>`; if (e.code === 'auth') handleErr(e); });
  // Live
  unsubChat = SO.on((ev, d) => {
    if (!el.isConnected) { unsubChat(); unsubChat = null; return; }
    if (ev === 'msg' && d.chat === rid) {
      const ex = $(`[data-mid="${d.id}"]`, list);
      if (ex || d.kind === 'deleted') repaint(true);
      else { const L = SO.live.chats[rid]; const prev = L[L.length - 2]; const b = stick || d.from === me().id; const hint = $('.ch-hint', list); if (hint) hint.remove(); list.insertAdjacentHTML('beforeend', msgHTML(d, prev, isG)); const n = list.lastElementChild; if (n) n.classList.add('ch-new'); if (b) toBottom(true); }
      if (!document.hidden) SO.markRead(rid);
      if (d.from !== me().id) haptic.tap();
    }
    if (ev === 'react' && d.chat === rid) repaint(true);
    if (ev === 'user') repaint(true);
    if (ev === 'groups' && isG) { const g = SO.live.groups.find(x => x.id === rid), sb = $('#ch-sub', el); if (g && sb && !sb.querySelector('em')) sb.textContent = meta.sub = `${g.members} Mitglieder`; }
    if (ev === 'typing' && d.chat === rid) { const s = $('#ch-sub', el); if (s) { s.innerHTML = `<em>${esc(d.user.name.split(' ')[0])} schreibt…</em>`; clearTimeout(s._t); s._t = setTimeout(() => { s.textContent = meta.sub; }, 4000); } }
    if (ev === 'status') { const s = $('#ch-sub', el); if (s) s.textContent = SO.live.status === 'on' ? meta.sub : 'Verbinde…'; if (SO.live.status === 'on') SO.loadChat(id).then(() => repaint(true)).catch(() => {}); }
  });
  // Eingabe
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; $('#ch-send', el).classList.toggle('ready', !!ta.value.trim()); };
  ta.addEventListener('input', () => { grow(); if (ta.value.trim()) SO.typing(rid); });
  ta.addEventListener('focus', () => { if (ui3.panel) togglePanel(el, false); setTimeout(() => toBottom(true), 250); });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !isNative) { e.preventDefault(); sendText(); } });
  const sendText = async () => {
    const t = ta.value.trim(); if (!t) return; ta.value = ''; grow(); haptic.tap();
    try { await SO.send(rid, { kind: 'text', text: t }); } catch (e) { ta.value = t; grow(); handleErr(e); }
  };
  $('#ch-send', el).addEventListener('click', sendText);
  $('#ch-stk', el).addEventListener('click', () => { togglePanel(el, !ui3.panel); if (ui3.panel) ta.blur(); });
  $('#ch-file', el).addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    const tmp = URL.createObjectURL(f);
    list.insertAdjacentHTML('beforeend', `<div class="ch-msg out pending" id="ch-pend"><div class="ch-col"><div class="bub img"><img src="${tmp}" alt=""><small class="bt">wird gesendet…</small></div></div></div>`); toBottom(true);
    try { const blob = await shrinkImage(f, 1280, 0.8); const url = await SO.upload(blob); await SO.send(rid, { kind: 'image', media: url }); }
    catch (er) { handleErr(er); }
    finally { const p = $('#ch-pend', el); if (p) p.remove(); URL.revokeObjectURL(tmp); }
  });
  // Lange drücken: Reaktion, Kopieren, Löschen, Sticker übernehmen
  let lp = null, sx = 0, sy = 0;
  list.addEventListener('pointerdown', e => { const m = e.target.closest('.ch-msg'); if (!m || m.classList.contains('pending')) return; sx = e.clientX; sy = e.clientY; lp = setTimeout(() => { lp = null; haptic.med(); msgMenu(m.dataset.mid, rid); }, 430); });
  const cancel = e => { if (lp && (!e || e.type !== 'pointermove' || Math.hypot(e.clientX - sx, e.clientY - sy) > 10)) { clearTimeout(lp); lp = null; } };
  ['pointerup', 'pointercancel', 'pointermove', 'scroll'].forEach(t => list.addEventListener(t, cancel, { passive: true }));
  list.addEventListener('contextmenu', e => { const m = e.target.closest('.ch-msg'); if (m) e.preventDefault(); });
  list.addEventListener('dblclick', e => { const m = e.target.closest('.ch-msg'); if (m && m.dataset.kind !== 'deleted') { SO.react(m.dataset.mid, '❤️').catch(handleErr); haptic.tap(); } });
  list.addEventListener('click', e => {
    const im = e.target.closest('[data-view]'); if (im) { viewer(im.dataset.view); return; }
    const a = e.target.closest('[data-ext]'); if (a) { e.preventDefault(); openExternal(a.dataset.ext); }
  });
}
function togglePanel(el, on) {
  ui3.panel = on; const p = $('#ch-panel', el); if (!p) return;
  p.hidden = !on; $('#ch-stk', el).classList.toggle('on', on); if (on) p.innerHTML = panelHTML();
  const list = $('#ch-list', el); list.scrollTo({ top: list.scrollHeight });
}
function msgMenu(mid, rid) {
  const m = (SO.live.chats[rid] || []).find(x => x.id === mid); if (!m || m.kind === 'deleted' || m.kind === 'system') return;
  const mine = m.from === me().id, canSave = m.kind === 'sticker' && m.media;
  sheet(`<div class="re-bar">${REACT.map(e => `<button class="tap" data-r="${e}">${e}</button>`).join('')}</div>
    <div class="menu-list">${m.kind === 'text' ? `<button class="tap" data-m="copy">${ico('copy')}Text kopieren</button>` : ''}${canSave ? `<button class="tap" data-m="save">${ico('star')}Zu meinen Stickern</button>` : ''}${m.kind === 'image' ? `<button class="tap" data-m="view">${ico('image')}Foto ansehen</button>` : ''}${mine ? `<button class="tap danger" data-m="del">${ico('trash')}Für alle löschen</button>` : ''}</div>`, (sh, close) => {
    sh.addEventListener('click', async e => {
      const r = e.target.closest('[data-r]'); if (r) { close(); haptic.tap(); SO.react(mid, r.dataset.r).catch(handleErr); return; }
      const b = e.target.closest('[data-m]'); if (!b) return; close();
      if (b.dataset.m === 'copy') copy(m.text);
      if (b.dataset.m === 'view') viewer(SO.abs(m.media));
      if (b.dataset.m === 'del') SO.delMsg(mid).catch(handleErr);
      if (b.dataset.m === 'save') saveForeignSticker(SO.abs(m.media));
    });
  });
}
async function saveForeignSticker(url) {
  try {
    const blob = await (await fetch(url)).blob(); const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    addMySticker(data, url); toast('Sticker gespeichert ⭐');
  } catch (e) { toast('Sticker konnte nicht gespeichert werden.', 'toast-warn'); }
}
function addMySticker(data, url = '') {
  const so = SO.soc(); so.stickers = so.stickers || [];
  so.stickers.unshift({ id: 's' + Date.now().toString(36), data, url, srv: url ? so.url : '' });
  if (so.stickers.length > 30) so.stickers.length = 30;
  save(true);
}
function viewer(src) {
  const v = document.createElement('div'); v.className = 'viewer'; v.innerHTML = `<img src="${esc(src)}" alt=""><button class="iconbtn tap" aria-label="Schließen">${ico('close')}</button>`;
  document.body.appendChild(v); requestAnimationFrame(() => v.classList.add('open'));
  const close = () => { v.classList.remove('open'); setTimeout(() => v.remove(), 250); window.__sheetClose = null; };
  v.addEventListener('click', close); window.__sheetClose = close;
}
async function sendSticker(rid, body) { haptic.tap(); try { await SO.send(rid, { kind: 'sticker', ...body }); } catch (e) { handleErr(e); } }
export function copy(t) {
  const ok = () => toast('Kopiert ✓');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, () => fallbackCopy(t, ok)); else fallbackCopy(t, ok);
}
function fallbackCopy(t, ok) { const x = document.createElement('textarea'); x.value = t; x.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); ok(); } catch (e) { /* egal */ } x.remove(); }

/* ================= Gruppe ================= */
export function gruppe(id) {
  const g = SO.live.groups.find(x => x.id === id) || (ui3.cache.gi[id] && ui3.cache.gi[id].group);
  if (!g) { setTimeout(() => SO.groupInfo(id, ui3.period).then(r => { ui3.cache.gi[id] = r; if (current() === '#/gruppe/' + id) refresh(); }).catch(handleErr), 0); return { html: pg(dhead('Gruppe') + skel(4)) }; }
  const d = ui3.cache.gi[id], link = SO.inviteLink(g), isOwner = g.owner === me().id;
  const qr = qrSVG(link);
  const per = [['week', 'Woche'], ['month', 'Monat'], ['all', 'Gesamt']];
  const html = dhead('Gruppe', `${g.members} Mitglieder`, isOwner ? `<button class="iconbtn tap" data-act="so-grename" data-id="${g.id}" aria-label="Umbenennen">${ico('edit')}</button>` : '') + `
    <div class="gi-hero rise">${gav(g, 84)}<h1>${esc(g.name)}</h1><button class="btn tap" data-go="#/chat/${g.id}">${ico('chat')}Zum Chat</button></div>
    <article class="card gi-inv rise"><div class="gi-qr">${qr}</div><div class="gi-inv-m"><p class="kicker">Einladen</p><div class="code-big sm">${g.code.split('').map(c => `<i>${c}</i>`).join('')}</div><p class="fine">Freunde scannen den QR-Code mit der Handykamera oder öffnen den Link.</p></div>
      <div class="rc-btns three"><button class="btn tap" data-act="so-share-group" data-id="${g.id}">${ico('share')}Teilen</button><button class="btn ghost tap" data-act="so-wa" data-id="${g.id}">WhatsApp</button><button class="btn ghost tap" data-act="so-copy" data-v="${esc(link)}">${ico('copy')}Link</button></div></article>
    <section class="sec rise sec-row"><h2>Wettkampf</h2><div class="seg sm">${per.map(([k, l]) => `<button class="tap${ui3.period === k ? ' on' : ''}" data-act="so-gper" data-v="${k}" data-id="${g.id}">${l}</button>`).join('')}</div></section>
    <div id="gi-mem">${d && d.members ? memHTML(d.members) : skel(4)}</div>
    <button class="btn ghost wide danger tap rise" data-act="so-leave" data-id="${g.id}">${ico('close')}Gruppe verlassen</button>`;
  return { html: pg(html), mount: el => { SO.groupInfo(id, ui3.period).then(r => { ui3.cache.gi[id] = r; const b = $('#gi-mem', el); if (b) { b.innerHTML = memHTML(r.members); animBars(b); } }).catch(handleErr); } };
}
function memHTML(mem) {
  const max = Math.max(1, ...mem.map(m => m.stats.pts));
  return `<div class="card lb-list">${mem.map((m, i) => `<button class="lb-row tap${m.id === me().id ? ' self' : ''}" data-go="#/${m.id === me().id ? 'sprofil/me' : 'duell/' + m.id}"><span class="lb-n">${i < 3 && m.stats.pts ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>${av(m, 40)}<span class="lb-m"><b>${esc(m.name)}${m.role === 'owner' ? ' <i class="adm">Admin</i>' : ''}</b><small>${m.stats.workouts} Workouts · ${m.stats.runs} Läufe · ${lit(m.stats.km)} km${m.streak ? ' · 🔥' + m.streak : ''}</small><i class="lb-bar"><i data-w="${Math.round(m.stats.pts / max * 100)}%"></i></i></span><b class="lb-p">${fmt(m.stats.pts)}</b></button>`).join('')}</div>`;
}
export function qrSVG(text) { try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { return ''; } }

/* ================= Profil ================= */
export function sprofil(id) {
  const isMe = id === 'me' || id === me().id; const uid = isMe ? me().id : id;
  const d = ui3.cache.prof[uid];
  const load = el => SO.profile(uid).then(r => { const old = JSON.stringify(d || null); ui3.cache.prof[uid] = r; if (isMe && r.user) { SO.soc().user = { ...me(), ...r.user }; save(); } if (el.isConnected && old !== JSON.stringify(r)) refresh(); }).catch(handleErr);
  if (!d && !isMe) return { html: pg(dhead('Profil') + skel(4)), mount: load };
  const u = isMe ? me() : d.user, st = (d && d.stats) || { pts: 0, workouts: 0, runs: 0, km: 0, min: 0, streak: 0 };
  const tiles = [['Punkte', fmt(st.pts), 'diese Woche'], ['Workouts', st.workouts, 'diese Woche'], ['Kilometer', lit(st.km), 'diese Woche'], ['Serie', (st.streak || 0) + ' 🔥', 'Tage am Stück']];
  let actions = '';
  if (isMe) actions = `<div class="rc-btns"><button class="btn ghost tap" data-act="so-edit">${ico('edit')}Profil bearbeiten</button><button class="btn ghost tap" data-act="so-avatar">${ico('camera')}Foto</button></div>`;
  else actions = `<div class="rc-btns three"><button class="btn tap${d.following ? ' ghost' : ''}" data-act="so-follow" data-id="${uid}" data-on="${d.following ? 0 : 1}">${d.following ? ico('check') + 'Folgst du' : ico('plus') + 'Folgen'}</button><button class="btn ghost tap" data-go="#/chat/dm.${uid}">${ico('chat')}Chat</button><button class="btn ghost tap" data-go="#/duell/${uid}">${ico('trophy')}Duell</button></div>`;
  const html = dhead(isMe ? 'Mein Profil' : 'Profil') + `<div class="pf-hero rise">${av(u, 96, 'big')}<h1>${esc(u.name)}</h1>${u.bio ? `<p class="lede">${esc(u.bio)}</p>` : ''}<p class="kicker">Code ${esc(u.code || '')}${d && d.followers != null ? ' · ' + d.followers + ' Follower' : ''}${d && d.followsMe ? ' · folgt dir' : ''}</p></div>
    ${actions}
    <div class="pf-tiles rise">${tiles.map(([l, v, s]) => `<div><small>${l}</small><b>${v}</b><i>${s}</i></div>`).join('')}</div>
    ${d && d.total ? `<article class="card rise pf-total"><div class="c-h">${ico('trophy')}Insgesamt</div><div class="stats3"><span><b>${fmt(d.total.pts)}</b>Punkte</span><span><b>${d.total.workouts}</b>Workouts</span><span><b>${lit(d.total.km)}</b>km</span></div></article>` : ''}
    ${isMe ? meSettingsHTML() : ''}
    ${d && d.acts && d.acts.length ? `<section class="sec rise"><h2>Letzte Aktivitäten</h2></section>${d.acts.slice(0, 10).map(a => actCard(a, u)).join('')}` : ''}`;
  return { html: pg(html), mount: load };
}
function meSettingsHTML() {
  const so = SO.soc();
  return `<article class="card rise"><div class="c-h">${ico('bell')}Teilen & Verbindung</div>
    <label class="switch-row so-sw"><span><b>Fortschritt automatisch teilen</b><small>Workouts und Läufe erscheinen bei Freunden und in deinen Gruppen</small></span><input type="checkbox" data-so-auto ${so.auto !== false ? 'checked' : ''}><i class="sw"></i></label>
    <div class="switch-row so-sw"><span><b>Server</b><small>${esc(so.url)} ${statusDot()}</small></span></div>
    <div class="rc-btns"><button class="btn ghost tap" data-act="so-logout">Abmelden</button><button class="btn ghost danger tap" data-act="so-delete">Konto löschen</button></div></article>`;
}

/* ================= 1 gegen 1 ================= */
export function duell(uid) {
  const d = ui3.cache.prof[uid], m = ui3.cache.prof[me().id];
  const load = el => Promise.all([SO.profile(uid), SO.profile(me().id)]).then(([a, b]) => { ui3.cache.prof[uid] = a; ui3.cache.prof[me().id] = b; if ((!d || !m) && el.isConnected) refresh(); else if (el.isConnected) { const b2 = $('#du-body', el); if (b2) { b2.innerHTML = duelBody(ui3.cache.prof[uid], ui3.cache.prof[me().id]); animBars(b2); } } }).catch(handleErr);
  if (!d || !m) return { html: pg(dhead('1 gegen 1') + skel(5)), mount: load };
  return { html: pg(dhead('1 gegen 1', 'diese Woche') + `<div id="du-body">${duelBody(d, m)}</div>`), mount: load };
}
function duelBody(d, m) {
  const a = m.stats, b = d.stats, ua = me(), ub = d.user;
  const rows = [['Punkte', 'pts', fmt], ['Workouts', 'workouts', x => x], ['Läufe', 'runs', x => x], ['Kilometer', 'km', lit], ['Minuten', 'min', fmt], ['Serie 🔥', 'streak', x => x]];
  let wa = 0, wb = 0; rows.forEach(([, k]) => { if (a[k] > b[k]) wa++; else if (b[k] > a[k]) wb++; });
  const lead = a.pts - b.pts;
  const verdict = lead > 0 ? `Du liegst <b>${fmt(lead)} Punkte</b> vorne 💪` : lead < 0 ? `${esc(ub.name.split(' ')[0])} liegt <b>${fmt(-lead)} Punkte</b> vorne – hol sie dir! 🔥` : 'Gleichstand – das nächste Workout entscheidet ⚡';
  return `<article class="card du-head rise"><div class="du-p${a.pts >= b.pts && a.pts ? ' win' : ''}">${a.pts > b.pts ? '<i class="crown">👑</i>' : ''}${av(ua, 72)}<b>Du</b><em>${wa}</em></div><span class="du-vs">VS</span><div class="du-p${b.pts >= a.pts && b.pts ? ' win' : ''}">${b.pts > a.pts ? '<i class="crown">👑</i>' : ''}${av(ub, 72)}<b>${esc(ub.name.split(' ')[0])}</b><em>${wb}</em></div></article>
    <p class="so-mot rise">${verdict}</p>
    <article class="card du-rows rise">${rows.map(([l, k, f]) => { const x = +a[k] || 0, y = +b[k] || 0, t = Math.max(1, x + y); return `<div class="du-row"><b class="${x > y ? 'w' : ''}">${f(x)}</b><span><small>${l}</small><i class="du-bar"><i class="l" data-w="${Math.round(x / t * 100)}%"></i><i class="r" data-w="${Math.round(y / t * 100)}%"></i></i></span><b class="${y > x ? 'w' : ''}">${f(y)}</b></div>`; }).join('')}</article>
    <article class="card rise"><div class="c-h">${ico('trophy')}Gesamt seit Beginn</div><div class="du-tot"><span><b>${fmt(m.total ? m.total.pts : 0)}</b><small>du</small></span><span><b>${fmt(d.total ? d.total.pts : 0)}</b><small>${esc(ub.name.split(' ')[0])}</small></span></div></article>
    <div class="rc-btns"><button class="btn tap" data-go="#/chat/dm.${ub.id}">${ico('chat')}Herausfordern</button><button class="btn ghost tap" data-go="#/training">${ico('dumbbell')}Jetzt trainieren</button></div>`;
}

/* ================= Sticker-Editor ================= */
export function stickerEditor() {
  const st = ui3.ed || (ui3.ed = editorState());
  const shapes = [['circle', 'Kreis'], ['round', 'Rund'], ['heart', 'Herz'], ['star', 'Stern'], ['square', 'Eckig']];
  const cols = ['#FF4D2E', '#FFD43B', '#22C55E', '#3B82F6', '#EC4899', '#FFFFFF', '#111111'];
  const html = dhead('Sticker erstellen', 'aus deinem Foto', `<button class="btn sm tap" data-act="so-ed-save">Speichern</button>`) + `
    <div class="ed-stage rise"><canvas id="ed-c" width="512" height="512"></canvas>${st.img ? '' : `<label class="ed-pick tap" for="ed-file">${ico('camera')}<b>Foto wählen</b><small>Selfie, Gym-Pic, Haustier …</small></label>`}<input type="file" id="ed-file" accept="image/*" hidden></div>
    ${st.img ? `<p class="fine ed-hint">${st.draw ? 'Mit dem Finger malen' : 'Foto mit dem Finger verschieben'}</p>` : ''}
    <article class="card rise ed-tools">
      <span class="flabel">Form</span><div class="chips">${shapes.map(([k, l]) => `<button class="chip tap${st.shape === k ? ' on' : ''}" data-act="so-ed" data-k="shape" data-v="${k}">${l}</button>`).join('')}</div>
      ${st.img ? `<span class="flabel">Größe</span><input type="range" id="ed-zoom" min="1" max="3" step="0.02" value="${st.zoom}">` : ''}
      <div class="field-2"><label class="field"><span>Text oben</span><input id="ed-top" maxlength="24" value="${esc(st.top)}" placeholder="z. B. BEAST"></label><label class="field"><span>Text unten</span><input id="ed-bot" maxlength="24" value="${esc(st.bottom)}" placeholder="z. B. MODE"></label></div>
      <span class="flabel">Emoji</span><div class="ed-emo">${['', ...EMOJIS].map(e => `<button class="tap${st.emoji === e ? ' on' : ''}" data-act="so-ed" data-k="emoji" data-v="${e}">${e || '–'}</button>`).join('')}</div>
      <span class="flabel">Malen</span><div class="ed-draw"><button class="chip tap${st.draw ? ' on' : ''}" data-act="so-ed" data-k="draw" data-v="${st.draw ? '' : '1'}">${ico('edit')}${st.draw ? 'Malen an' : 'Malen'}</button>${cols.map(c => `<button class="ed-col tap${st.color === c ? ' on' : ''}" data-act="so-ed" data-k="color" data-v="${c}" style="--c:${c}" aria-label="Farbe"></button>`).join('')}<button class="chip tap" data-act="so-ed" data-k="undo">↶</button></div>
      <label class="switch-row so-sw"><span><b>Weißer Rand</b><small>wie ein echter Sticker</small></span><input type="checkbox" id="ed-border" ${st.border ? 'checked' : ''}><i class="sw"></i></label>
      ${st.img ? `<button class="btn ghost wide tap" data-act="so-ed-new">${ico('image')}Anderes Foto</button>` : ''}</article>
    <section class="sec rise"><h2>Meine Sticker <small>${(SO.soc().stickers || []).length}/30</small></h2></section>
    <div class="card stk-mine rise">${(SO.soc().stickers || []).length ? (SO.soc().stickers || []).map(s => `<button class="stk-cell tap" data-act="so-stk-del" data-id="${s.id}"><img src="${s.data}" alt=""></button>`).join('') : '<p class="empty">Noch keine eigenen Sticker.</p>'}</div>
    <p class="fine">Tippe auf einen deiner Sticker, um ihn zu löschen.</p>`;
  return { html: pg(html), mount: mountEditor };
}
function mountEditor(el) {
  const c = $('#ed-c', el), st = ui3.ed; const draw = () => renderSticker(c, st); draw();
  $('#ed-file', el).addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; if (!f) return; try { st.img = await loadImage(f); st.x = st.y = 0; st.zoom = 1; refresh(); } catch (er) { toast('Foto konnte nicht geladen werden.', 'toast-warn'); } });
  const z = $('#ed-zoom', el); if (z) z.addEventListener('input', () => { st.zoom = +z.value; draw(); });
  $('#ed-top', el).addEventListener('input', e => { st.top = e.target.value; draw(); });
  $('#ed-bot', el).addEventListener('input', e => { st.bottom = e.target.value; draw(); });
  $('#ed-border', el).addEventListener('change', e => { st.border = e.target.checked; draw(); });
  let drag = null;
  const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.addEventListener('pointerdown', e => { if (!st.img && !st.draw) return; c.setPointerCapture(e.pointerId); const p = pos(e); if (st.draw) { st.strokes.push({ c: st.color, w: 14, p: [p] }); drag = { draw: true }; } else drag = { p, x: st.x, y: st.y }; draw(); });
  c.addEventListener('pointermove', e => { if (!drag) return; const p = pos(e); if (drag.draw) st.strokes[st.strokes.length - 1].p.push(p); else { st.x = drag.x + p[0] - drag.p[0]; st.y = drag.y + p[1] - drag.p[1]; } draw(); });
  ['pointerup', 'pointercancel'].forEach(t => c.addEventListener(t, () => { drag = null; }));
}
export function saveEditorSticker() {
  const c = $('#ed-c'), st = ui3.ed; if (!c || !st) return false;
  if (!st.img && !st.top && !st.bottom && !st.emoji && !st.strokes.length) { toast('Wähle zuerst ein Foto oder schreib einen Text.', 'toast-warn'); return false; }
  addMySticker(exportSticker(c, 384)); ui3.ed = null; ui3.stTab = 'mine'; haptic.ok(); toast('Sticker gespeichert ⭐ – du findest ihn im Chat unter „Meine“.');
  return true;
}

/* ================= Aktionen (werden in main.js eingehängt) ================= */
export function actions() {
  const chatId = () => { const r = current(); return r.startsWith('#/chat/') ? realChat(decodeURIComponent(r.slice(7))) : null; };
  return {
    'so-tab'(el) { ui3.tab = el.dataset.v; haptic.tap(); refresh(false); },
    'so-per'(el) { ui3.period = el.dataset.v; haptic.tap(); refresh(); },
    'so-scope'(el) { ui3.scope = el.dataset.v; haptic.tap(); refresh(); },
    'so-gper'(el) { ui3.period = el.dataset.v; haptic.tap(); refresh(); },
    'so-col'(el) { ui3.setup.color = el.dataset.v; $$('.col-pick button').forEach(b => b.classList.toggle('on', b === el)); haptic.tap(); },
    'so-howto'() { sheet(howtoHTML()); },
    async 'so-join'(el) {
      const s = ui3.setup; const p = SO.parseInvite(s.inv) || (s.inv.trim() ? null : { url: '', code: '' });
      if (!p || !p.code) { toast('Bitte den Einladungslink oder Code einfügen.', 'toast-warn'); return; }
      const url = p.url || s.url; if (!url) { toast('Bitte noch die Server-Adresse eintragen.', 'toast-warn'); return; }
      if (!(s.name || S.profile.name || '').trim()) { toast('Wie heißt du?', 'toast-warn'); return; }
      el.disabled = true; el.innerHTML = 'Verbinde…';
      try {
        const r = await SO.register(url, p.code, (s.name || S.profile.name).trim(), s.color || COLORS[0]);
        haptic.ok(); confetti(window.innerWidth / 2, window.innerHeight / 3, 40);
        toast(r.group ? `Willkommen in „${esc(r.group.name)}“ ${esc(r.group.emoji)}` : 'Verbunden ✓ – jetzt eine Gruppe erstellen!');
        ui3.setup = { inv: '', url: '', name: '', color: '' }; ui3.tab = 'chats';
        refresh(false); if (r.group) setTimeout(() => go('#/chat/' + r.group.id), 500);
      } catch (e) { el.disabled = false; el.innerHTML = ico('people') + 'Beitreten'; toast(esc(e.message), 'toast-warn'); }
    },
    'so-newgroup'() {
      let emo = GEMO[0];
      sheet(`<h2 class="sh-t">Neue Gruppe</h2><label class="field"><span>Name</span><input id="ng-n" maxlength="40" placeholder="z. B. Gym-Gang, Lauftreff, Familie"></label><span class="flabel">Symbol</span><div class="ed-emo">${GEMO.map(e => `<button class="tap${e === emo ? ' on' : ''}" data-e="${e}">${e}</button>`).join('')}</div><button class="btn big wide tap" id="ng-go">${ico('plus')}Erstellen</button>`, (sh, close) => {
        sh.addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) { emo = b.dataset.e; $$('[data-e]', sh).forEach(x => x.classList.toggle('on', x === b)); } });
        setTimeout(() => $('#ng-n', sh).focus(), 300);
        $('#ng-go', sh).addEventListener('click', async () => {
          const n = $('#ng-n', sh).value.trim(); if (!n) { toast('Gib der Gruppe einen Namen.', 'toast-warn'); return; }
          try { const g = await SO.createGroup(n, emo); close(); haptic.ok(); setTimeout(() => go('#/gruppe/' + g.id), 300); toast('Gruppe erstellt – jetzt Freunde einladen!'); } catch (er) { handleErr(er); }
        });
      });
    },
    'so-joincode'() {
      sheet(`<h2 class="sh-t">Gruppe beitreten</h2><p class="sh-sub">Code oder Einladungslink deiner Freunde:</p><label class="field"><input id="jc" placeholder="z. B. 7KQ2MX" autocapitalize="characters" autocomplete="off"></label><button class="btn big wide tap" id="jc-go">Beitreten</button>`, (sh, close) => {
        setTimeout(() => $('#jc', sh).focus(), 300);
        $('#jc-go', sh).addEventListener('click', async () => {
          const p = SO.parseInvite($('#jc', sh).value); if (!p) { toast('Das ist kein gültiger Code.', 'toast-warn'); return; }
          try { const g = await SO.joinGroup(p.code); close(); haptic.ok(); confetti(window.innerWidth / 2, window.innerHeight / 3); setTimeout(() => go('#/chat/' + g.id), 300); } catch (er) { handleErr(er); }
        });
      });
    },
    'so-copy'(el) { copy(el.dataset.v); haptic.tap(); },
    'so-share-code'() { const m = me(); shareText(`Folg mir in „You By What You Eat“ 💪 Mein Freundescode: ${m.code}`, 'Freundescode'); },
    'so-share-group'(el) { const g = SO.live.groups.find(x => x.id === el.dataset.id); if (g) shareText(SO.inviteText(g), 'Einladung'); },
    'so-wa'(el) { const g = SO.live.groups.find(x => x.id === el.dataset.id); if (g) openExternal('https://wa.me/?text=' + encodeURIComponent(SO.inviteText(g))); },
    async 'so-follow-code'() {
      const i = $('#so-fcode'); const c = (i && i.value || '').trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(c)) { toast('Der Code hat 6 Zeichen.', 'toast-warn'); return; }
      try { const r = await SO.findCode(c); const u = r.users && r.users[0]; if (!u) { toast('Niemand mit diesem Code gefunden.', 'toast-warn'); return; } await SO.follow(u.id); haptic.ok(); toast(`Du folgst jetzt ${esc(u.name)} ✓`); i.value = ''; i.blur(); ui3.cache.friends = await SO.friends(); refresh(); } catch (e) { handleErr(e); }
    },
    async 'so-follow'(el) { const on = el.dataset.on !== '0'; try { await SO.follow(el.dataset.id, on); haptic.tap(); delete ui3.cache.prof[el.dataset.id]; if (ui3.cache.friends) ui3.cache.friends = await SO.friends(); const p = await SO.profile(el.dataset.id).catch(() => null); if (p) ui3.cache.prof[el.dataset.id] = p; refresh(); } catch (e) { handleErr(e); } },
    async 'so-react'(el) { haptic.tap(); try { await SO.react(el.dataset.id, el.dataset.e); } catch (e) { handleErr(e); } },
    async 'so-react-act'(el) {
      haptic.tap(); el.classList.toggle('mine');
      try { const r = await SO.react(el.dataset.id, el.dataset.e, true); const n = (r.re[el.dataset.e] || []).length; el.innerHTML = el.dataset.e + (n ? `<small>${n}</small>` : ''); el.classList.toggle('mine', (r.re[el.dataset.e] || []).includes(me().id)); } catch (e) { handleErr(e); }
    },
    'so-stk-tab'(el) { ui3.stTab = el.dataset.v; const p = $('#ch-panel'); if (p) p.innerHTML = panelHTML(); haptic.tap(); },
    'so-stk'(el) { const c = chatId(); if (c) sendSticker(c, { sticker: el.dataset.id }); },
    async 'so-stk-mine'(el) {
      const c = chatId(); if (!c) return; const so = SO.soc(); const s = (so.stickers || []).find(x => x.id === el.dataset.id); if (!s) return;
      el.classList.add('busy');
      try { if (!s.url || s.srv !== so.url) { s.url = await SO.upload(dataUrlToBlob(s.data)); s.srv = so.url; save(); } await sendSticker(c, { media: s.url }); } catch (e) { handleErr(e); } finally { el.classList.remove('busy'); }
    },
    'so-stk-new'() { ui3.ed = null; go('#/sticker'); },
    'so-stk-del'(el) { sheet(`<h2 class="sh-t">Sticker löschen?</h2><div class="rc-btns"><button class="btn ghost tap" data-close>Behalten</button><button class="btn danger tap" id="sd-y">Löschen</button></div>`, (sh, close) => { $('#sd-y', sh).addEventListener('click', () => { const so = SO.soc(); so.stickers = (so.stickers || []).filter(x => x.id !== el.dataset.id); save(true); close(); refresh(); }); }); },
    'so-ed'(el) {
      const st = ui3.ed; if (!st) return; const k = el.dataset.k, v = el.dataset.v;
      if (k === 'undo') st.strokes.pop(); else if (k === 'draw') st.draw = !!v; else st[k] = v;
      if (k === 'color') st.draw = true;
      haptic.tap(); refresh();
    },
    'so-ed-new'() { const f = $('#ed-file'); if (f) f.click(); },
    'so-ed-save'() { if (saveEditorSticker()) back(); },
    'so-grename'(el) {
      const g = SO.live.groups.find(x => x.id === el.dataset.id); if (!g) return;
      sheet(`<h2 class="sh-t">Gruppe umbenennen</h2><label class="field"><input id="gr-n" maxlength="40" value="${esc(g.name)}"></label><button class="btn wide tap" id="gr-go">Speichern</button>`, (sh, close) => {
        $('#gr-go', sh).addEventListener('click', async () => { try { await SO.api('/api/groups/' + g.id, { method: 'PATCH', body: { name: $('#gr-n', sh).value } }); await SO.refreshLists(); close(); refresh(); } catch (e) { handleErr(e); } });
      });
    },
    'so-leave'(el) {
      sheet(`<h2 class="sh-t">Gruppe verlassen?</h2><p class="sh-sub">Du siehst den Chat und die Rangliste dann nicht mehr. Mit dem Code kannst du jederzeit zurück.</p><div class="rc-btns"><button class="btn ghost tap" data-close>Bleiben</button><button class="btn danger tap" id="lv-y">Verlassen</button></div>`, (sh, close) => {
        $('#lv-y', sh).addEventListener('click', async () => { try { await SO.leaveGroup(el.dataset.id); close(); go('#/freunde'); } catch (e) { handleErr(e); } });
      });
    },
    'so-edit'() {
      const u = me(); let col = u.color;
      sheet(`<h2 class="sh-t">Profil bearbeiten</h2><label class="field"><span>Name</span><input id="pe-n" maxlength="30" value="${esc(u.name)}"></label><label class="field"><span>Über mich</span><input id="pe-b" maxlength="140" value="${esc(u.bio || '')}" placeholder="z. B. Ziel: 10 km unter 50 Min"></label><span class="flabel">Farbe</span><div class="col-pick">${COLORS.map(c => `<button class="tap${c === col ? ' on' : ''}" data-c="${c}" style="--c:${c}"></button>`).join('')}</div><button class="btn wide tap" id="pe-go">Speichern</button>`, (sh, close) => {
        sh.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { col = b.dataset.c; $$('[data-c]', sh).forEach(x => x.classList.toggle('on', x === b)); } });
        $('#pe-go', sh).addEventListener('click', async () => { try { await SO.updateMe({ name: $('#pe-n', sh).value, bio: $('#pe-b', sh).value, color: col }); close(); haptic.ok(); refresh(); } catch (e) { handleErr(e); } });
      });
    },
    'so-avatar'() {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
      i.onchange = async () => { const f = i.files && i.files[0]; if (!f) return; try { toast('Foto wird hochgeladen…'); const b = await shrinkImage(f, 400, 0.85, true); const url = await SO.upload(b); await SO.updateMe({ avatar: url }); haptic.ok(); refresh(); } catch (e) { handleErr(e); } };
      i.click();
    },
    'so-logout'() {
      sheet(`<h2 class="sh-t">Abmelden?</h2><p class="sh-sub">Du kannst dich mit einer neuen Einladung wieder verbinden – dabei bekommst du aber ein neues Konto. Deine Trainingsdaten in der App bleiben erhalten.</p><div class="rc-btns"><button class="btn ghost tap" data-close>Abbrechen</button><button class="btn danger tap" id="lo-y">Abmelden</button></div>`, (sh, close) => { $('#lo-y', sh).addEventListener('click', () => { SO.logout(); close(); go('#/freunde'); }); });
    },
    'so-delete'() {
      sheet(`<h2 class="sh-t">Konto wirklich löschen?</h2><p class="sh-sub">Name, Foto und Profil werden auf dem Server entfernt. Das kann nicht rückgängig gemacht werden.</p><div class="rc-btns"><button class="btn ghost tap" data-close>Abbrechen</button><button class="btn danger tap" id="dl-y">Löschen</button></div>`, (sh, close) => {
        $('#dl-y', sh).addEventListener('click', async () => { try { await SO.api('/api/me', { method: 'DELETE' }); } catch (e) { /* trotzdem lokal abmelden */ } SO.logout(); close(); go('#/freunde'); toast('Konto gelöscht.'); });
      });
    }
  };
}

/* Einladungslink von außen (ybwye://join?…), z. B. aus WhatsApp oder vom QR-Code */
export async function handleInvite(url) {
  const p = SO.parseInvite(url); if (!p) return false;
  if (SO.online() && (!p.url || SO.normUrl(p.url) === SO.soc().url)) {
    try { const g = await SO.joinGroup(p.code); haptic.ok(); toast(`Willkommen in „${esc(g.name)}“ ${esc(g.emoji)}`); go('#/freunde'); setTimeout(() => go('#/chat/' + g.id), 400); } catch (e) { handleErr(e); }
    return true;
  }
  ui3.setup.inv = url; ui3.setup.url = p.url || ''; go('#/freunde'); toast('Einladung erkannt – noch deinen Namen eintragen und beitreten.');
  return true;
}
export function onAutoToggle(on) { SO.soc().auto = on; save(); haptic.tap(); }
