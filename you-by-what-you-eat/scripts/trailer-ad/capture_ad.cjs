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
  await ctx.addInitScript(({ icon }) => {
    const css = `
    .fx *{box-sizing:border-box}
    #fx-scrim{position:fixed;left:0;right:0;top:0;height:250px;z-index:2147482990;pointer-events:none;background:linear-gradient(rgba(0,0,0,.78),rgba(0,0,0,.42) 55%,transparent);opacity:0;transition:opacity .45s}
    #fx-scrim.on{opacity:1}
    #fx-cap{position:fixed;left:0;right:0;top:58px;padding:0 26px;z-index:2147483000;pointer-events:none;text-align:center;font:800 24px/1.18 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:#fff;text-shadow:0 2px 22px rgba(0,0,0,.8)}
    #fx-cap .w{display:inline-block;margin:0 .22em;opacity:0;transform:translateY(24px) scale(1.18);filter:blur(10px);animation:fxw .6s cubic-bezier(.2,.85,.25,1) forwards;animation-delay:calc(var(--i)*85ms)}
    #fx-cap .w.a{color:#34D399;text-shadow:0 0 26px rgba(52,211,153,.75)}
    #fx-cap .w.o{color:#FF7A2F;text-shadow:0 0 26px rgba(255,122,47,.8)}
    #fx-cap small{display:block;margin-top:10px;font:600 13px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.2em;color:rgba(255,255,255,.72);opacity:0;animation:fxs .6s .5s ease forwards}
    #fx-cap.out .w{animation:fxo .38s ease-in forwards;animation-delay:calc(var(--i)*30ms)}
    #fx-cap.out small{animation:fxo .3s ease-in forwards}
    @keyframes fxw{to{opacity:1;transform:none;filter:none}}@keyframes fxs{to{opacity:1}}
    @keyframes fxo{to{opacity:0;transform:translateY(-16px) scale(.96);filter:blur(8px)}}
    #fx-spot{position:fixed;z-index:2147482980;pointer-events:none;border-radius:20px;opacity:0;transition:all .55s cubic-bezier(.2,.8,.2,1);box-shadow:0 0 0 120vmax rgba(0,0,0,.68),0 0 0 2px var(--c,#34D399),0 0 34px 6px color-mix(in srgb,var(--c,#34D399) 60%,transparent)}
    #fx-spot.on{opacity:1}
    #fx-card{position:fixed;inset:0;z-index:2147483010;pointer-events:none;opacity:0;transition:opacity .5s;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:radial-gradient(90% 60% at 50% 38%,rgba(18,184,134,.40),transparent 66%),radial-gradient(120% 90% at 50% 50%,#04120d,#000 100%)}
    #fx-card.on{opacity:1}
    #fx-card.fast{transition:opacity .12s}
    .fxp{position:absolute;border-radius:50%;background:var(--c,#6EE7B7);opacity:0;animation:fxp linear infinite}
    @keyframes fxp{0%{transform:translateY(0);opacity:0}15%{opacity:.8}100%{transform:translateY(-420px);opacity:0}}
    .fxi{width:128px;height:128px;border-radius:30px;box-shadow:0 20px 70px rgba(18,184,134,.45);animation:fxii 1s cubic-bezier(.2,.9,.25,1.2) both,fxf 3.4s 1s ease-in-out infinite}
    @keyframes fxii{from{transform:scale(.3) rotate(-12deg);opacity:0;filter:blur(14px)}}
    @keyframes fxf{50%{transform:translateY(-9px)}}
    .fxr{position:absolute;width:128px;height:128px;border-radius:34px;border:2px solid rgba(110,231,183,.6);animation:fxring 2.4s ease-out infinite}
    @keyframes fxring{from{transform:scale(1);opacity:.8}to{transform:scale(2.6);opacity:0}}
    .fxt{margin-top:30px;font:900 33px/1.12 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.14em;text-transform:uppercase}
    .fxt .l{display:inline-block;opacity:0;transform:translateY(30px) scale(1.4);filter:blur(12px);animation:fxw .7s cubic-bezier(.2,.85,.25,1) forwards;animation-delay:calc(var(--i)*55ms + 900ms)}
    .fxt .a{color:#6EE7B7;text-shadow:0 0 30px rgba(110,231,183,.8)}
    .fxs{margin-top:18px;font:600 14px/1.3 system-ui,sans-serif;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.7);opacity:0;animation:fxs .8s 2.3s ease forwards}
    .fxsweep{position:absolute;top:0;bottom:0;width:70px;left:-120px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);transform:skewX(-20deg);animation:fxsw 1.2s 1.9s ease-in-out forwards}
    @keyframes fxsw{to{left:120%}}
    .fxword{font:900 82px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:-.01em;text-transform:uppercase;text-shadow:0 0 50px var(--c);display:flex;justify-content:center}
    .fxword .l{display:inline-block;opacity:0;transform:scale(2.1) translateY(18px);filter:blur(14px);animation:fxwl .55s cubic-bezier(.15,.9,.25,1) forwards;animation-delay:calc(var(--i)*55ms)}
    @keyframes fxwl{to{opacity:1;transform:none;filter:none}}
    .fxline{height:4px;width:0;border-radius:4px;margin-top:20px;background:var(--c);box-shadow:0 0 22px var(--c);animation:fxln .7s .35s cubic-bezier(.2,.8,.2,1) forwards}
    @keyframes fxln{to{width:150px}}
    .fxsub{margin-top:18px;font:700 14px/1.3 system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.75);opacity:0;animation:fxs .5s .45s ease forwards}
    #fx-card.exit .fxword{animation:fxx .35s ease-in forwards}
    @keyframes fxx{to{transform:scale(1.18);opacity:0;filter:blur(10px)}}
    .fxl{list-style:none;margin:30px 0 0;padding:0;display:grid;gap:12px;font:700 18px/1.2 system-ui,sans-serif;text-align:left}
    .fxl li{opacity:0;transform:translateX(-26px);animation:fxli .6s cubic-bezier(.2,.85,.25,1) forwards;animation-delay:calc(var(--i)*170ms + 1.0s)}
    @keyframes fxli{to{opacity:1;transform:none}}
    .fxcta{margin-top:30px;padding:13px 26px;border-radius:999px;background:linear-gradient(135deg,#12B886,#0B8F68);font:800 15px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;box-shadow:0 10px 40px rgba(18,184,134,.5);opacity:0;animation:fxs .7s 2.4s ease forwards}
    .fxnote{position:absolute;bottom:34px;left:0;right:0;font:500 11px/1.4 system-ui,sans-serif;color:rgba(255,255,255,.5);padding:0 40px;opacity:0;animation:fxs .8s 3s ease forwards}
    `;
    const mk = (tag, id, cls) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; return e; };
    const letters = (s, cls) => [...s].map((c, i) => c === ' ' ? '<span style="display:inline-block;width:.5em"></span>' : `<span class="${cls}" style="--i:${i}">${c}</span>`).join('');
    const boot = () => {
      if (!document.body) return requestAnimationFrame(boot);
          const LIGHT = `
    #fx-scrim{background:linear-gradient(rgba(255,255,255,.97),rgba(255,255,255,.75) 55%,transparent)!important}
    #fx-cap{color:#0F172A;text-shadow:none}
    #fx-cap .w.a{color:#0B8F68;text-shadow:none}
    #fx-cap .w.o{color:#E4572E;text-shadow:none}
    #fx-cap small{color:#475569}
    #fx-card{color:#0F172A;background:radial-gradient(90% 60% at 50% 38%,rgba(16,179,134,.20),transparent 66%),radial-gradient(120% 90% at 50% 50%,#FFFFFF,#EAF5F0 100%)!important}
    .fxt{color:#0F172A}.fxt .a{color:#0B8F68;text-shadow:none}
    .fxword{color:#0F172A;text-shadow:none}
    .fxs,.fxsub{color:#475569;text-shadow:none}
    .fxl{color:#0F172A}.fxnote{color:#64748B}
    `;
      const st = document.createElement('style'); st.textContent = css + LIGHT; document.head.appendChild(st);
      const scrim = mk('div', 'fx-scrim'), cap = mk('div', 'fx-cap'), spot = mk('div', 'fx-spot'), card = mk('div', 'fx-card');
      document.body.append(scrim, cap, spot, card);
      let ct, cardT;
      const parts = n => Array.from({ length: n }, () => `<i class="fxp" style="left:${Math.random() * 100}%;top:${40 + Math.random() * 60}%;width:${2 + Math.random() * 4}px;height:${2 + Math.random() * 4}px;animation-duration:${3 + Math.random() * 4}s;animation-delay:${-Math.random() * 6}s"></i>`).join('');
      window.__fx = {
        cap(text, ms, sub) {
          clearTimeout(ct); cap.className = '';
          let i = 0;
          cap.innerHTML = text.split(' ').map(w => { const a = w.startsWith('*') ? (w.startsWith('*o') ? 'o' : 'a') : ''; const t = w.replace(/^\*o?/, '').replace(/\*$/, ''); return `<span class="w ${a}" style="--i:${i++}">${t}</span>`; }).join(' ') + (sub ? `<small>${sub}</small>` : '');
          scrim.classList.add('on');
          ct = setTimeout(() => { cap.classList.add('out'); scrim.classList.remove('on'); }, ms || 2600);
        },
        uncap() { clearTimeout(ct); cap.classList.add('out'); scrim.classList.remove('on'); },
        spot(x, y, w, h, r, c) { spot.style.setProperty('--c', c || '#34D399'); spot.style.left = x + 'px'; spot.style.top = y + 'px'; spot.style.width = w + 'px'; spot.style.height = h + 'px'; spot.style.borderRadius = (r || 20) + 'px'; spot.classList.add('on'); },
        unspot() { spot.classList.remove('on'); },
        intro() {
          clearTimeout(cardT); card.className = 'on'; card.style.background = '';
          card.innerHTML = parts(34) + `<div class="fxr"></div><img class="fxi" src="data:image/png;base64,${icon}" alt=""><div class="fxt">${letters('You By', 'l')}<br><span class="a">${[...'What You Eat'].map((c, i) => c === ' ' ? '<span style="display:inline-block;width:.5em"></span>' : `<span class="l" style="--i:${i + 7}">${c}</span>`).join('')}</span></div><div class="fxs">Training · Freunde · Fortschritt</div><div class="fxsweep"></div>`;
        },
        word(text, color, ms, sub) {
          clearTimeout(cardT);
          card.className = 'on fast'; card.style.setProperty('--c', color); card.style.background = `radial-gradient(90% 60% at 50% 42%, ${color}55, transparent 64%), rgba(2,6,4,.88)`;
          const fs = Math.min(82, Math.floor(330 / (text.length * 0.72)));
          card.innerHTML = parts(16) + `<div class="fxword" style="font-size:${fs}px">${letters(text, 'l')}</div><div class="fxline"></div>${sub ? `<div class="fxsub">${sub}</div>` : ''}`;
          cardT = setTimeout(() => card.classList.add('exit'), Math.max(300, (ms || 1100) - 350));
        },
        outro() {
          clearTimeout(cardT); card.className = 'on'; card.style.background = '';
          card.innerHTML = parts(34) + `<div class="fxr"></div><img class="fxi" src="data:image/png;base64,${icon}" alt=""><div class="fxt" style="font-size:30px">${letters('You By', 'l')}<br><span class="a">${[...'What You Eat'].map((c, i) => c === ' ' ? '<span style="display:inline-block;width:.5em"></span>' : `<span class="l" style="--i:${i + 7}">${c}</span>`).join('')}</span></div>
            <ul class="fxl"><li style="--i:0">🤸 137 Übungen ohne Geräte</li><li style="--i:1">💬 Gruppen-Chat mit Stickern</li><li style="--i:2">🏆 Wochen-Rangliste &amp; Duelle</li><li style="--i:3">🏃 Läufe automatisch von Strava</li><li style="--i:4">🥧 Eigener Server auf dem Raspberry Pi</li></ul>
            <div class="fxcta">Jetzt kostenlos starten</div><div class="fxnote">Demo mit erfundenen Namen und Testdaten.</div>`;
        },
        hide() { card.classList.remove('on', 'exit', 'fast'); }
      };
      window.__fx.intro();
    };
    boot();
  }, { icon });
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
    await page.evaluate(() => window.__fx.intro());
    mark('intro.start'); await wait(4300); mark('intro.end'); await hideCard(); await wait(500);

    await step('Problem', async () => {
      mark('problem.word'); await word('ALLEIN?', '#E4572E', 1300, ''); await wait(1400); await hideCard(); await wait(200);
      mark('problem2.word'); await word('NICHT MEHR', '#0B8F68', 1600, 'Deine Gruppe macht mit'); await wait(1700); await hideCard(); await wait(200);
    });

    await step('Heute', async () => {
      await tap('.nav-btn[data-tab="training"]', { after: 1000 });
      mark('heute.start'); cap('Dein Plan für *heute*', 2600, 'Ohne Geräte · ca. 20 Minuten'); await wait(2700);
    });

    await step('Katalog', async () => {
      mark('kat.start');
      await tap('[data-act="ttab"][data-v="workouts"]', { after: 800 });
      cap('*137* Übungen', 2600, 'Nur dein Körper · 4 Level'); await wait(2700);
      await tap('[data-act="wcat"][data-k="lvl"][data-v="4"]', { after: 700 });
    });

    await step('Muskeln', async () => {
      mark('mus.start');
      await tap('[data-act="ttab"][data-v="uebungen"]', { after: 800 });
      cap('Jeder *Muskel* im Blick', 2500, 'Tippe auf die Grafik'); await wait(900);
      const m = page.locator('.mm-pick .mm[data-m="glutes"]').first();
      if (await m.count()) await tap(m, { after: 800 });
      await wait(1200);
    });

    await step('Workout', async () => {
      await tap('[data-act="ttab"][data-v="workouts"]', { after: 800 });
      await tap('.wk-card >> nth=0', { after: 1000 });
      await tap('[data-act="wk-start"]', { after: 900 });
      mark('pl.start'); cap('Timer & *Pausen* für dich', 2500, 'Ansagen · Sätze · Rekorde'); await wait(900);
      let n = 0;
      for (let i = 0; i < 90; i++) {
        if (await page.locator('[data-act="pl-go"]').count()) { await tap('[data-act="pl-go"]', { after: 400 }).catch(() => {}); continue; }
        if (await page.locator('[data-act="pl-done"]').count()) { await tap('[data-act="pl-done"]', { after: 450 }).catch(() => {}); n++; if (n === 1) mark('pl.rest'); continue; }
        if (await page.locator('[data-act="pl-skip"]').count()) { await tap('[data-act="pl-skip"]', { after: 400 }).catch(() => {}); continue; }
        break;
      }
      await wait(1300);
      mark('pl.summary'); cap('Geschafft. *Punkte* für dein Team', 2300, 'Die Gruppe sieht es sofort'); await wait(2300);
      await closeSheet(); await wait(500);
    });

    await step('Freunde-Titel', async () => {
      mark('freunde.word'); await word('FREUNDE', '#0B8F68', 1800, 'Chat · Rangliste · Duell'); await wait(1900); await hideCard(); await wait(200);
      await tap('.nav-btn[data-tab="freunde"]', { after: 1000 });
    });

    await step('Verbinden', async () => {
      mark('setup.start');
      cap('Einmal *verbinden*', 2200, 'Einladung · Adresse · Name'); await wait(900);
      await typeIn('#so-inv', info.invite, 40);
      await tap('#so-url', { after: 150 }); await page.keyboard.type(SURL, { delay: 25 }); await wait(200);
      await typeIn('#so-name', 'Lisa', 110);
      await tap('[data-act="so-col"][data-v="#EC4899"]', { after: 300 });
      mark('setup.join');
      await tap('#so-join', { after: 2300 });
    });

    await step('Beitreten', async () => {
      mark('join.code');
      await tap('.so-qa [data-act="so-joincode"]', { after: 900 });
      await typeIn('#jc', info.code, 110);
      await tap('#jc-go', { after: 2300 });
      const rec = await page.evaluate(() => { const L = (JSON.parse(localStorage.getItem('ybwye.v1') || '{}').wlog) || []; return L[L.length - 1] || null; });
      if (rec) await page.evaluate(r => window.__social.shareWorkout(r), rec);
    });

    await step('Jetzt', async () => {
      mark('jetzt.word'); await word('JETZT?', '#E4572E', 2400, 'Dann mit Freunden'); await wait(2500); await hideCard(); await wait(200);
    });

    let seqP = Promise.resolve();
    await step('Chat', async () => {
      mark('chat.start');
      const g = info.groupId, post = (tok, body) => api(`/api/chats/${g}/messages`, { token: tok, body });
      seqP = (async () => {
        await sleep(700);
        const m1 = (await post(info.M.token, { kind: 'text', text: 'Wer kommt heute zum Beine-Tag? 🦵' })).message;
        await sleep(900);
        await api(`/api/messages/${m1.id}/react`, { token: info.S.token, body: { emoji: '🔥' } });
        await sleep(600);
        await post(info.S.token, { kind: 'text', text: 'Ich! Bin um 18 Uhr im Park 🏃‍♀️' });
        await sleep(900);
        await post(info.M.token, { kind: 'sticker', sticker: 'gym:legday' });
        await sleep(1000);
        await post(info.M.token, { kind: 'text', text: 'Lisa, schaffst du heute 50 Punkte? 😏' });
        await sleep(900);
        await post(info.T.token, { kind: 'image', media: await info.up(PHOTO1), text: 'Form-Check vor dem Training 📸' });
        await sleep(1200);
        await api('/api/activities', { token: info.M.token, body: { kind: 'workout', title: 'Ganzkörper', pts: 54, data: { min: 36, sets: 14, emoji: '💪', prs: 2 } } });
        await sleep(900);
        await api('/api/activities', { token: info.S.token, body: { kind: 'run', title: 'Lauf 7,4 km', pts: 84, data: { km: 7.4, min: 41, emoji: '🏃' } } });
        await sleep(900);
        await api('/api/activities', { token: info.T.token, body: { kind: 'workout', title: 'Beine Power', pts: 46, data: { min: 32, sets: 12, emoji: '🦵' } } });
      })().catch(e => errs.push('SEQ ' + e.message));
      cap('Gruppenchat wie *WhatsApp*', 2300, 'Fotos · Sticker · Reaktionen'); await wait(3600);
      await typeIn('#ch-t', 'Bin dabei! 💪', 70);
      await tap('#ch-send', { after: 1200 });
    });

    await step('Sticker', async () => {
      mark('stk.open');
      await tap('#ch-stk', { after: 500 });
      await tap('[data-act="so-stk-tab"][data-v="gym"]', { after: 500 });
      cap('Fertige *Sticker* – oder deine eigenen', 2300, '24 Motive · Gym · Laufen · Essen'); await wait(900);
      await tap('[data-act="so-stk"][data-id="gym:legday"]', { after: 1500 });
      await wait(700);
    });

    await step('Rangliste', async () => {
      await tap('[data-act="back"]', { after: 900 }).catch(() => {});
      await tap('[data-act="so-tab"][data-v="rang"]', { after: 900 });
      await tap('.so-scope .chip >> nth=1', { after: 500 });
      mark('rang.start');
      cap('Wer ist *Nummer 1*?', 2300, 'Woche · Monat · Gesamt'); await wait(1600);
      await scrollTo(260, 1000); await wait(800);
    });

    await step('Strava', async () => {
      await tap('.nav-btn[data-tab="training"]', { after: 900 });
      await tap('[data-act="ttab"][data-v="heute"]', { after: 800 });
      await scrollTo(900, 1000);
      const row = page.locator('[data-go="#/strava"]').first();
      mark('strava.row'); cap('Läufe *automatisch*', 2600, 'Von Strava – ohne Eintippen'); await wait(1000);
      await tap(row, { after: 1200 });
      await typeIn('#st-cid', CID, 60); await typeIn('#st-sec', SEC, 25);
      await page.evaluate(() => { document.querySelector('.st-manual').open = true; });
      await page.locator('#st-paste').fill('ybwye://localhost?state=&code=goodcode&scope=read,activity:read_all'); await wait(400);
      await tap('[data-act="strava-redeem"]', { after: 2200 });
      mark('strava.list'); cap('Die letzten *Läufe* sind da', 2400, 'Strecke · Pace · Puls'); await wait(2500);
    });

    await step('CTA', async () => {
      mark('cta.word'); await word('KOSTENLOS', '#E4572E', 1500, 'Jetzt starten · Freunde einladen'); await wait(1600); await hideCard(); await wait(200);
    });

    mark('outro.start');
    await page.evaluate(() => window.__fx.outro());
    await wait(6500);
    mark('outro.end');

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
