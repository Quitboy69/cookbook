/* Trailer 4 – Version 2.0 (Training ohne Geräte + Freunde). Echte App im Dunkelmodus, echter Server
   mit erfundenen Testnutzern. Die Testnutzer schreiben während der Aufnahme live Nachrichten.
   Ablauf: node capture4.cjs <Ausgabeordner>   (www/ läuft auf 127.0.0.1:8765)
   Danach: python3 edit4.py --render · PYTHONPATH=<scipy> python3 music4.py · ffmpeg (Ton dazu). */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const REPO = process.env.REPO || '/home/user/cookbook/you-by-what-you-eat';
const OUT = path.resolve(process.argv[2]); fs.mkdirSync(OUT, { recursive: true });
const icon = fs.readFileSync(path.join(REPO, 'assets', 'app-icon-512.png')).toString('base64');
const SPORT = 8799, SURL = `http://127.0.0.1:${SPORT}`, APP = 'http://127.0.0.1:8765/index.html';
const PHOTO1 = path.join(REPO, 'www/ex/bodyweight_squat/0.webp'), PHOTO2 = path.join(REPO, 'www/ex/incline_push_up/0.webp');
const pad = n => String(n).padStart(2, '0');
let T0 = Date.now();
const log = m => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's  ' + m);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errs = [];
const lisoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}Z`;
const dayAt = (back, h, m) => { const d = new Date(); d.setDate(d.getDate() - back); d.setHours(h, m, 4, 0); return d; };
const CID = '184273', SEC = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

/* ---------- Server + erfundene Testnutzer (Max, Sara, Tom) ---------- */
const DATA = path.join(OUT, 'srvdata'); fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const srv = spawn('node', [path.join(REPO, 'server/server.js')], { env: { ...process.env, YBWYE_DATA: DATA, PORT: String(SPORT), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
srv.stderr.on('data', d => errs.push('SERVER ' + d));
async function api(p, { token, body, raw, type } = {}) {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token;
  if (raw) h['Content-Type'] = type; else if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(SURL + p, { method: 'POST', headers: h, body: raw || (body ? JSON.stringify(body) : undefined) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(p + ': ' + (j.error || r.status)); return j;
}
async function seed(invite) {
  const reg = (name, color) => api('/api/register', { body: { invite, name, color } });
  const M = await reg('Max', '#3B82F6'), S = await reg('Sara', '#F97316'), T = await reg('Tom', '#8B5CF6');
  const g = (await api('/api/groups', { token: M.token, body: { name: 'Gym-Gang', emoji: '🔥' } })).group;
  await api('/api/groups/join', { token: S.token, body: { code: g.code } });
  await api('/api/groups/join', { token: T.token, body: { code: g.code } });
  const up = async f => (await api('/api/media', { token: M.token, raw: fs.readFileSync(f), type: 'image/webp' })).url;
  return { invite, code: g.code, groupId: g.id, M, S, T, up };
}

(async () => {
  let info = null, browser = null;
  try {
    await sleep(800);
    const invite = execFileSync('node', [path.join(REPO, 'server/server.js'), '--invite'], { env: { ...process.env, YBWYE_DATA: DATA } }).toString().match(/Einladungsschlüssel: (\w+)/)[1];
    info = await seed(invite);
    log('Server bereit, Gruppencode ' + info.code);
    const liveMax = text => api(`/api/chats/${info.groupId}/messages`, { token: info.maxToken, body: { kind: 'text', text } });

    browser = await chromium.launch({ args: ['--force-device-scale-factor=2', '--window-size=390,844'] });
    const ctx = await browser.newContext({ viewport: null, colorScheme: 'light' });
    await ctx.addInitScript(() => { const css = '#nav{display:none!important}#toasts,.toast{display:none!important}'; const add = () => { if (!document.head) return requestAnimationFrame(add); const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }; add(); });
  // ---- nachgebaute Strava-Schnittstelle (Demo-Daten) ----
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
  const acts = [
    { id: 3001, name: 'Waldrunde', sport_type: 'TrailRun', distance: 8400, moving_time: 3300, start_date_local: lisoOf(dayAt(3, 8, 5)), average_heartrate: 155, total_elevation_gain: 180 },
    { id: 3002, name: 'Intervalle', sport_type: 'Run', distance: 4100, moving_time: 1560, start_date_local: lisoOf(dayAt(5, 17, 40)), average_heartrate: 162, total_elevation_gain: 24 },
    { id: 3003, name: 'Lockerer Lauf', sport_type: 'Run', distance: 6000, moving_time: 2500, start_date_local: lisoOf(dayAt(8, 18, 5)), average_heartrate: 143, total_elevation_gain: 51 },
    { id: 3004, name: 'Radtour', sport_type: 'Ride', distance: 31000, moving_time: 4800, start_date_local: lisoOf(dayAt(2, 10, 0)) }
  ];
  const cal = { 3001: 640, 3002: 330, 3003: 455, 3005: 412 };
  await ctx.route('https://www.strava.com/**', async route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const j = (status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (url.pathname.startsWith('/oauth/mobile/authorize')) return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<body style="background:#000"></body>' });
    if (url.pathname === '/oauth/token') {
      const b = new URLSearchParams(req.postData());
      if (b.get('grant_type') === 'authorization_code') return j(200, { token_type: 'Bearer', expires_at: Math.floor(Date.now() / 1000) + 21600, refresh_token: 'r1', access_token: 'a1', athlete: { firstname: 'Dein', lastname: 'Strava-Konto' } });
      return j(200, { token_type: 'Bearer', expires_at: Math.floor(Date.now() / 1000) + 21600, refresh_token: 'r2', access_token: 'a2' });
    }
    if (url.pathname === '/api/v3/athlete/activities') return j(200, acts);
    const m = /^\/api\/v3\/activities\/(\d+)$/.exec(url.pathname);
    if (m) return j(200, { id: +m[1], calories: cal[m[1]] || 0 });
    return j(404, { message: 'Not Found' });
  });

    const page = await ctx.newPage();
    ctx.on('page', p => setTimeout(() => p.close().catch(() => {}), 900));
    const cdp = await ctx.newCDPSession(page);

    // ---- Aufnahme: Chrome-Screencast mit Zeitstempel je Bild ----
    const FR = OUT + '/frames'; fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
    const stamps = [], offs = []; let nf = 0;
    cdp.on('Page.screencastFrame', f => { fs.writeFileSync(`${FR}/${String(nf).padStart(6, '0')}.jpg`, Buffer.from(f.data, 'base64')); stamps.push(f.metadata.timestamp); offs.push(Date.now() / 1000 - f.metadata.timestamp); nf++; cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
    const marks = []; const mark = n => { marks.push([n, Date.now() / 1000]); log('● ' + n); };
    page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errs.push('CONSOLE ' + m.text()); });

    const wait = ms => page.waitForTimeout(ms);
    const cap = (t, ms, sub) => page.evaluate(([t, ms, s]) => window.__fx.cap(t, ms, s), [t, ms, sub]);
    const word = (t, c, ms, sub) => page.evaluate(([t, c, ms, s]) => window.__fx.word(t, c, ms, s), [t, c, ms, sub]);
    const hideCard = () => page.evaluate(() => window.__fx.hide());
    async function spot(sel, o = {}) {
      const el = typeof sel === 'string' ? page.locator(sel).first() : sel;
      const b = await el.boundingBox(); const p = o.pad ?? 8;
      await page.evaluate(([x, y, w, h, r, c]) => window.__fx.spot(x, y, w, h, r, c), [b.x - p, b.y - p, b.width + 2 * p, b.height + 2 * p, o.r ?? 20, o.c]);
    }
    const unspot = () => page.evaluate(() => window.__fx.unspot());
    async function tap(sel, o = {}) {
      const el = typeof sel === 'string' ? page.locator(sel).first() : sel;
      await el.scrollIntoViewIfNeeded({ timeout: 8000 });
      await wait(120);
      let b = await el.boundingBox();
      const cy = b.y + b.height / 2;
      if ((cy > 690 || cy < 110) && !(await el.evaluate(e => !!e.closest('.sheet,.sticky-save,.nav,nav')))) {
        await page.evaluate(dy => { const sc = document.querySelector('.screen:last-child'); if (sc) sc.scrollBy({ top: dy, behavior: 'instant' }); }, cy - 400);
        await wait(450); b = await el.boundingBox();
      }
      const x = b.x + b.width / 2, y = b.y + Math.min(b.height / 2, o.maxY || 9999);
      await page.mouse.move(x, y, { steps: 8 });
      await wait(100);
      await page.mouse.down(); await wait(70); await page.mouse.up();
      await wait(o.after ?? 650);
    }
    async function scrollTo(y, ms = 1100) {
      await page.evaluate(y => { const el = document.querySelector('.screen:last-child'); if (el) el.scrollTo({ top: y, behavior: 'smooth' }); }, y);
      await wait(ms);
    }
    async function typeIn(sel, text, delay = 55) { await tap(sel, { after: 200 }); await page.keyboard.type(text, { delay }); await wait(300); }
    const slow = async r => { try { await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: r }); } catch (e) { /* egal */ } };
    const closeSheet = () => page.evaluate(() => window.__sheetClose && window.__sheetClose());
    const step = async (name, fn) => { log('▶ ' + name); try { await fn(); } catch (e) { errs.push('SCENE ' + name + ': ' + String(e.message).split('\n')[0]); log('!! ' + name + ' – ' + String(e.message).split('\n')[0]); try { await unspot(); await closeSheet(); } catch (x) { /* egal */ } } };

    // ---- Vorbereitung (nicht im Film): Onboarding mit Krafttraining heute ----
    await page.goto(APP); await wait(900);
    await page.click('[data-act="ob-next"]'); await wait(400);
    await page.click('[data-act="pset"][data-k="sex"][data-v="w"]'); await wait(300);
    await page.click('[data-act="ob-next"]'); await wait(400);
    const wd = (new Date().getDay() + 6) % 7;
    const tr = page.locator(`[data-act="train"][data-v="${wd}"]`).first(); if (!(await tr.evaluate(e => e.classList.contains('on')))) await tr.click();
    await wait(300);
    for (let i = 0; i < 2; i++) { await page.click('[data-act="ob-next"]'); await wait(400); }
    await page.click('[data-act="ob-done"]'); await wait(4300);

    // ---- Film ----
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
    T0 = Date.now();
    mark('start'); await wait(500);

    const clickNav = async t => { await page.evaluate(t => { const b = document.querySelector(`.nav-btn[data-tab="${t}"]`); if (b) b.click(); }, t); await wait(900); };
    const clip = async (name, hold, inner) => {
      const t0 = Date.now(); mark(name);
      if (inner) await inner().catch(e => errs.push('INNER ' + name + ': ' + String(e.message).split('\n')[0]));
      const rest = hold - (Date.now() - t0); if (rest > 0) await wait(rest);
    };
    const seqState = { teaser: false };
    let seqP = Promise.resolve();
    const runSeq = () => (async () => {
      const g = info.groupId, post = (tok, body) => api(`/api/chats/${g}/messages`, { token: tok, body });
      await sleep(900);
      const m1 = (await post(info.M.token, { kind: 'text', text: 'Wer kommt heute zum Beine-Tag? 🦵' })).message;
      await sleep(900);
      await api(`/api/messages/${m1.id}/react`, { token: info.S.token, body: { emoji: '🔥' } });
      await sleep(600);
      await post(info.S.token, { kind: 'text', text: 'Ich! Bin um 18 Uhr im Park 🏃‍♀️' });
      await sleep(900);
      await post(info.M.token, { kind: 'sticker', sticker: 'gym:legday' });
      await sleep(900);
      await post(info.M.token, { kind: 'text', text: 'Lisa, schaffst du heute 50 Punkte? 😏' });
      seqState.teaser = true;
      await sleep(900);
      await post(info.T.token, { kind: 'image', media: await info.up(PHOTO1), text: 'Form-Check vor dem Training 📸' });
      await sleep(1200);
      await api('/api/activities', { token: info.M.token, body: { kind: 'workout', title: 'Ganzkörper', pts: 54, data: { min: 36, sets: 14, emoji: '💪', prs: 2 } } });
      await sleep(900);
      await api('/api/activities', { token: info.S.token, body: { kind: 'run', title: 'Lauf 7,4 km', pts: 84, data: { km: 7.4, min: 41, emoji: '🏃' } } });
      await sleep(900);
      await api('/api/activities', { token: info.T.token, body: { kind: 'workout', title: 'Beine Power', pts: 46, data: { min: 32, sets: 12, emoji: '🦵' } } });
    })().catch(e => errs.push('SEQ ' + e.message));

    await step('Hook', async () => { await clip('intro', 3800, async () => { await wait(1300); await scrollTo(260, 1300); }); });
    await step('Katalog', async () => {
      await clickNav('training'); await tap('[data-act="ttab"][data-v="workouts"]', { after: 700 });
      await clip('kat', 2800, async () => { await wait(700); await scrollTo(240, 1200); });
    });
    await step('Muskeln', async () => {
      await tap('[data-act="ttab"][data-v="uebungen"]', { after: 700 });
      const m = page.locator('.mm-pick .mm[data-m="glutes"]').first();
      if (await m.count()) await tap(m, { after: 700 });
      await clip('muskel', 2800, async () => { await wait(600); await scrollTo(300, 1200); });
    });
    await step('Uebung', async () => {
      await scrollTo(0, 300);
      await tap('.ex-row >> nth=2', { after: 900 });
      await clip('uebung', 2800, async () => { await wait(600); await scrollTo(380, 1200); });
    });
    await step('Timer', async () => {
      await tap('[data-act="back"]', { after: 800 });
      await tap('[data-act="ttab"][data-v="workouts"]', { after: 800 });
      await tap('.wk-card >> nth=0', { after: 900 });
      await tap('[data-act="wk-start"]', { after: 800 });
      await clip('timer', 2800, async () => { await wait(900); await tap('[data-act="pl-done"]', { after: 300 }); });
    });
    await step('Punkte', async () => {
      for (let i = 0; i < 90; i++) {
        if (await page.locator('[data-act="pl-go"]').count()) { await tap('[data-act="pl-go"]', { after: 400 }).catch(() => {}); continue; }
        if (await page.locator('[data-act="pl-done"]').count()) { await tap('[data-act="pl-done"]', { after: 400 }).catch(() => {}); continue; }
        if (await page.locator('[data-act="pl-skip"]').count()) { await tap('[data-act="pl-skip"]', { after: 350 }).catch(() => {}); continue; }
        break;
      }
      await wait(1300);
      await clip('punkte', 2800);
      await closeSheet(); await wait(500);
    });
    await step('Fortschritt', async () => {
      await tap('[data-act="ttab"][data-v="fortschritt"]', { after: 800 });
      await clip('fort', 2800, async () => { await wait(700); await scrollTo(360, 1200); });
    });
    await step('Freunde', async () => {
      await clickNav('freunde');
      await clip('break', 3800, async () => { await wait(1000); await scrollTo(300, 1500); });
    });
    await step('Gruppe', async () => {
      await scrollTo(0, 400);
      await typeIn('#so-inv', info.invite, 40);
      await page.fill('#so-url', SURL);
      await typeIn('#so-name', 'Lisa', 90);
      await tap('[data-act="so-col"][data-v="#EC4899"]', { after: 200 });
      await tap('#so-join', { after: 2000 });
      await tap('.so-qa [data-act="so-joincode"]', { after: 800 });
      await typeIn('#jc', info.code, 80);
      await tap('#jc-go', { after: 1800 });
      const rec = await page.evaluate(() => { const L = (JSON.parse(localStorage.getItem('ybwye.v1') || '{}').wlog) || []; return L[L.length - 1] || null; });
      if (rec) await page.evaluate(r => window.__social.shareWorkout(r), rec);
      seqP = runSeq();
      await clip('gruppe', 2800);
    });
    await step('Live', async () => {
      for (let i = 0; i < 60 && !seqState.teaser; i++) await sleep(150);
      await clip('live', 2800);
    });
    await step('Sticker', async () => {
      await tap('#ch-stk', { after: 500 });
      await tap('[data-act="so-stk-tab"][data-v="gym"]', { after: 500 });
      await clip('sticker', 2800, async () => { await wait(700); await tap('[data-act="so-stk"][data-id="gym:legday"]', { after: 300 }); });
    });
    await step('Eigene', async () => {
      await tap('[data-act="back"]', { after: 800 });
      await tap('.so-qa [data-go="#/sticker"]', { after: 900 });
      await page.setInputFiles('#ed-file', PHOTO2); await wait(900);
      await typeIn('#ed-top', 'Beast', 80); await typeIn('#ed-bot', 'Mode', 80);
      await tap('[data-act="so-ed"][data-k="shape"][data-v="heart"]', { after: 600 });
      await clip('eigene', 2800, async () => { await wait(600); await tap('[data-act="so-ed"][data-k="emoji"][data-v="🔥"]', { after: 300 }); });
    });
    await step('Rangliste', async () => {
      await seqP;
      await tap('[data-act="back"]', { after: 800 });
      await tap('[data-act="so-tab"][data-v="rang"]', { after: 800 });
      await tap('.so-scope .chip >> nth=1', { after: 600 });
      await clip('rang', 2800, async () => { await wait(700); await scrollTo(260, 1200); });
    });
    await step('Duell', async () => {
      await tap('.lb-row >> nth=1', { after: 1400 });
      await page.locator('.rc-btns.three [data-go^="#/duell"]').first().waitFor({ timeout: 8000 }).catch(() => {});
      await tap('.rc-btns.three [data-go^="#/duell"]', { after: 1300 });
      await clip('duell', 2800, async () => { await wait(700); await scrollTo(360, 1200); });
    });
    await step('Strava', async () => {
      await clickNav('training');
      await tap('[data-act="ttab"][data-v="heute"]', { after: 800 });
      await scrollTo(900, 900);
      await tap(page.locator('[data-go="#/strava"]').first(), { after: 1100 });
      await typeIn('#st-cid', CID, 50); await typeIn('#st-sec', SEC, 20);
      await page.evaluate(() => { document.querySelector('.st-manual').open = true; });
      await page.locator('#st-paste').fill('ybwye://localhost?state=&code=goodcode&scope=read,activity:read_all');
      await tap('[data-act="strava-redeem"]', { after: 1900 });
      await scrollTo(0, 300);
      await clip('strava', 2800, async () => { await wait(600); await scrollTo(300, 1200); });
    });
    await step('Aufruf', async () => {
      await clickNav('heute');
      await clip('jetzt', 2800);
    });
    mark('end'); await wait(300);

    await cdp.send('Page.stopScreencast');
    await browser.close(); browser = null;
    srv.kill();
    const sorted = offs.slice().sort((a, b) => a - b), off = sorted[sorted.length >> 1];
    const t0 = stamps[0];
    const frames = stamps.map((s, i) => [`${FR}/${String(i).padStart(6, '0')}.jpg`, +(s - t0).toFixed(4)]);
    const marksOut = marks.map(([n, w]) => [n, +(w - off - t0).toFixed(3)]);
    fs.writeFileSync(OUT + '/frames.json', JSON.stringify(frames));
    fs.writeFileSync(OUT + '/markers.json', JSON.stringify(marksOut, null, 1));
    console.log('Bilder:', nf, 'Dauer:', (stamps[nf - 1] - t0).toFixed(1) + 's', 'Uhr-Versatz', off.toFixed(3));
  } catch (e) {
    errs.push('FATAL ' + e.message);
  } finally {
    try { if (browser) await browser.close(); } catch (e) { /* egal */ }
    srv.kill();
    console.log(errs.length ? 'PROBLEME:\n' + errs.join('\n') : 'KEINE FEHLER');
  }
})();
