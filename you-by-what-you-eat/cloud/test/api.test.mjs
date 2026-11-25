/* API-Test gegen den lokal laufenden Worker (npx wrangler dev --port 8788).  node test/api.test.mjs [http://127.0.0.1:8788] */
const BASE = process.argv[2] || 'http://127.0.0.1:8788';
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
const api = async (p, { token, body, raw, type, method } = {}) => {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body) h['Content-Type'] = 'application/json'; if (raw) h['Content-Type'] = type;
  const r = await fetch(BASE + p, { method: method || (body || raw ? 'POST' : 'GET'), headers: h, body: raw || (body ? JSON.stringify(body) : undefined) });
  let j = null; try { j = await r.json(); } catch (e) { /* kein JSON */ } return { s: r.status, j: j || {} };
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tokOf = link => new URL(link).searchParams.get('k');

let r = await api('/api/health'); ok(r.j.setup === true && r.j.cloud === true, 'Frischer Server meldet „Einrichtung nötig“');
// Besitzer = Erstnutzer, ohne Einladung
r = await api('/api/register', { body: { name: 'Chef', color: '#3B82F6' } }); const owner = r.j; ok(r.s === 200 && owner.owner === true, 'Erster Nutzer wird Besitzer (ohne Einladungsschlüssel)');
r = await api('/api/register', { body: { name: 'Fremder' } }); ok(r.s === 403, 'Zweiter Nutzer ohne Einladung wird abgelehnt');
r = await api('/api/me', { token: owner.token }); const invite = r.j.server.invite; ok(r.j.server.owner === true && /^[A-Z0-9]{8}$/.test(invite), 'Besitzer sieht den Einladungsschlüssel');
// vorbereitete Konten
const names = ['Luca', 'Ajjai', 'David', 'Jonas'];
r = await api('/api/admin/accounts', { token: owner.token, body: { group: 'Gym-Gang', people: names.map(n => ({ name: n, sex: 'm' })) } });
ok(r.s === 200 && r.j.accounts.length === 4 && r.j.group.members === 5, 'Vier vorbereitete Konten + Gruppe mit 5 Mitgliedern angelegt');
const acc = r.j.accounts; ok(acc.every(a => /\/\?k=[0-9a-f]{64}$/.test(a.link)), 'Jedes Konto hat einen persönlichen Link');
const luca = acc.find(a => a.name === 'Luca'), tLuca = tokOf(luca.link);
r = await api('/api/me', { token: tLuca }); ok(r.j.user.name === 'Luca' && r.j.preset && r.j.preset.sex === 'm', 'Link-Zugang funktioniert sofort (Luca eingeloggt, Voreinstellung kommt mit)');
r = await api('/api/friends', { token: tLuca }); ok(r.j.following.length === 4 && r.j.followers.length === 4, 'Alle folgen allen (Luca folgt 4 und hat 4 Follower)');
r = await api('/api/groups', { token: tLuca }); const gid = r.j.groups[0].id; ok(r.j.groups.length === 1 && r.j.groups[0].name === 'Gym-Gang', 'Luca ist schon in der Gruppe „Gym-Gang“');
r = await api('/api/admin/accounts', { token: tLuca }); ok(r.s === 403, 'Ein Freund darf keine Konten verwalten');
r = await api('/api/admin/accounts', { token: owner.token, body: { people: [{ name: 'luca' }, { name: 'Tom' }] } }); ok(r.j.accounts.length === 5 && r.j.group.members === 6, 'Doppelte Namen werden nicht doppelt angelegt, neue kommen dazu');
// Neuer Link macht den alten ungültig
r = await api(`/api/admin/accounts/${luca.id}/relink`, { token: owner.token, method: 'POST' }); const newLink = r.j.accounts.find(a => a.id === luca.id).link;
r = await api('/api/me', { token: tLuca }); ok(r.s === 401, 'Alter Link ist nach „neuer Link“ ungültig');
r = await api('/api/me', { token: tokOf(newLink) }); ok(r.s === 200, 'Neuer Link funktioniert');
const tL = tokOf(newLink), tD = tokOf(acc.find(a => a.name === 'David').link), tJ = tokOf(acc.find(a => a.name === 'Jonas').link);
// Gruppenchat live (SSE) + Nachricht
const ctl = new AbortController(); const got = [];
fetch(BASE + '/api/stream?token=' + tD, { signal: ctl.signal }).then(async res => { const rd = res.body.getReader(), dec = new TextDecoder(); let buf = ''; for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value); let i; while ((i = buf.indexOf('\n\n')) >= 0) { got.push(buf.slice(0, i)); buf = buf.slice(i + 2); } } }).catch(() => {});
await sleep(600);
r = await api(`/api/chats/${gid}/messages`, { token: tL, body: { kind: 'text', text: 'Beine-Tag heute? 🦵' } }); ok(r.s === 200, 'Luca schreibt in die Gruppe');
await sleep(500); ok(got.some(e => e.includes('event: hello')) && got.some(e => e.includes('event: msg') && e.includes('Beine-Tag')), 'David bekommt die Nachricht sofort live (SSE)');
// Gast folgt dem Chef → Chat entsteht von selbst
r = await api('/api/register', { body: { name: 'Gast', invite } }); const gast = r.j; ok(r.s === 200, 'Gast tritt mit Einladungsschlüssel bei');
r = await api(`/api/follow/${owner.user.id}`, { token: gast.token, method: 'POST' }); ok(r.s === 200, 'Gast folgt dem Chef');
r = await api('/api/groups', { token: owner.token }); const dm = r.j.dms.find(d => d.user && d.user.name === 'Gast');
ok(!!dm && /Gast folgt dir jetzt/.test(dm.last.text) && dm.last.from === gast.user.id, 'Chef hat sofort einen Chat mit dem Follower („Gast folgt dir jetzt 👋“)');
r = await api(`/api/chats/dm.${gast.user.id}/messages`, { token: owner.token, body: { kind: 'text', text: 'Willkommen!' } }); ok(r.s === 200, 'Chef kann dem Follower antworten, ohne zurückzufolgen');
r = await api(`/api/chats/dm.${owner.user.id}/messages`, { token: gast.token }); ok(r.j.messages.some(m => m.text === 'Willkommen!') && r.j.messages.some(m => m.kind === 'system'), 'Gast sieht Antwort und Hinweis im selben Chat');
r = await api(`/api/follow/${owner.user.id}`, { token: gast.token, method: 'POST' }); r = await api(`/api/chats/dm.${gast.user.id}/messages`, { token: owner.token });
ok(r.j.messages.filter(m => m.kind === 'system').length === 1, 'Erneutes Folgen erzeugt keine zweite Meldung');
// Medien
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
r = await api('/api/media', { token: tL, raw: png, type: 'image/png' }); ok(r.s === 200 && /^\/media\/[a-f0-9]{24}\.png$/.test(r.j.url), 'Bild-Upload');
const back = await fetch(BASE + r.j.url); const bb = Buffer.from(await back.arrayBuffer()); ok(back.headers.get('content-type') === 'image/png' && bb.equals(png), 'Bild kommt unverändert zurück');
r = await api('/api/media', { token: tL, raw: Buffer.from('<?php evil ?>'), type: 'image/png' }); ok(r.s === 415, 'Kein Bild → abgelehnt');
r = await api('/api/media', { token: tL, raw: Buffer.concat([png, Buffer.alloc(2_000_000)]), type: 'image/png' }); ok(r.s === 413, 'Zu große Datei → 413');
// Aktivitäten + Rangliste
r = await api('/api/activities', { token: tJ, body: { kind: 'workout', title: 'Ganzkörper', pts: 54, data: { min: 36, emoji: '💪' } } }); ok(r.s === 200, 'Jonas teilt ein Workout');
await api('/api/activities', { token: tD, body: { kind: 'run', title: 'Lauf 7,4 km', pts: 84, data: { km: 7.4, min: 41 } } });
r = await api(`/api/leaderboard?group=${gid}&period=week`, { token: tL }); ok(r.j.rows[0].user.name === 'David' && r.j.rows[0].pts === 84 && r.j.rows[1].pts === 54, 'Wochen-Rangliste stimmt (David 84, Jonas 54)');
r = await api(`/api/chats/${gid}/messages`, { token: tL }); ok(r.j.messages.some(m => m.kind === 'activity' && m.text === 'Ganzkörper'), 'Workout erscheint als Karte im Gruppenchat');
// Push-Abo
r = await api('/api/push/key', { token: tL }); ok(/^[A-Za-z0-9_-]{86,88}$/.test(r.j.key), 'Push: öffentlicher Schlüssel (VAPID) vorhanden');
r = await api('/api/push/subscribe', { token: tL, body: { subscription: { endpoint: 'https://push.invalid/abc', keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' } } } }); ok(r.s === 200, 'Push-Abo wird gespeichert');
r = await api('/api/push/subscribe', { token: tL, body: { endpoint: 'http://unsicher', keys: {} } }); ok(r.s === 400, 'Push-Abo ohne https/Schlüssel wird abgelehnt');
r = await api('/api/push/test', { token: tL, method: 'POST' }); ok(r.s === 200 && r.j.devices === 1, 'Push-Test erreicht das Senden (1 Gerät; echter Dienst ist hier nicht erreichbar)');
// Strava
r = await api('/api/strava/status', { token: tL }); ok(r.j.enabled === false && r.j.connected === false, 'Strava: noch nicht eingerichtet');
r = await api('/api/strava/start', { token: tL, method: 'POST' }); ok(r.s === 409, 'Strava: Start ohne Schlüssel → klare Meldung');
r = await api('/api/admin/strava', { token: owner.token, method: 'PUT', body: { clientId: 'abc', clientSecret: 'x' } }); ok(r.s === 400, 'Strava-Schlüssel mit falschem Format werden abgelehnt');
r = await api('/api/admin/strava', { token: owner.token, method: 'PUT', body: { clientId: '184273', clientSecret: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678' } }); ok(r.s === 200 && r.j.redirectDomain, 'Besitzer trägt Strava-Schlüssel ein (Callback-Domain: ' + r.j.redirectDomain + ')');
r = await api('/api/strava/start', { token: tL, method: 'POST' }); const su = new URL(r.j.url);
ok(su.host === 'www.strava.com' && su.searchParams.get('client_id') === '184273' && su.searchParams.get('redirect_uri') === BASE + '/strava/callback' && su.searchParams.get('scope') === 'read,activity:read_all' && su.searchParams.get('state').length === 32, 'Strava: Freigabe-Adresse korrekt (Rückkehr auf den eigenen Server)');
let cb = await fetch(BASE + '/strava/callback?code=x&scope=read,activity:read_all&state=falsch'); ok(cb.status === 200 && (await cb.text()).includes('abgelaufen'), 'Strava-Rückkehr mit falschem state wird freundlich abgelehnt');
r = await api('/api/strava/api?path=' + encodeURIComponent('/athlete/activities?per_page=5'), { token: tL }); ok(r.s === 401, 'Strava-Abfrage ohne Verbindung → 401');
r = await api('/api/strava/api?path=' + encodeURIComponent('/athletes/1/stats'), { token: tL }); ok(r.s === 400, 'Strava-Abfrage nur für erlaubte Pfade');
// Einladungsseite
let jp = await fetch(BASE + '/join/' + 'ZZZZZZ'); ok(jp.status === 200 && (await jp.text()).includes('?c=ZZZZZZ'), 'Einladungsseite öffnet die Web-App mit Code');
ctl.abort(); console.log(fails ? `${fails} FEHLER` : 'CLOUD-API: ALLES OK'); process.exit(fails ? 1 : 0);
