/* Ablauf: 1) in www/ einen Server starten (python3 -m http.server 8765 --bind 127.0.0.1)  2) node capture.cjs <Ordner>
   3) python3 edit.py --render, dann --assemble  4) PYTHONPATH=<scipy> python3 music2.py, dann Ton mit ffmpeg dazumischen.
   Aufnahme bewusst in 2x mit vollen Bildraten (3x ruckelt: nur ~7 Bilder/Sek.).
   Trailer 2 – Rohaufnahme: App im Dunkelmodus in Handygröße (3x), mit Markern für den Schnitt.
   Kein Cursor: Fokus entsteht durch Spotlight, kinetische Texte und Wort-Karten. Kamera/Strava sind Simulationen. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2];
const icon = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'app-icon-512.png')).toString('base64');
const pad = n => String(n).padStart(2, '0');
const lisoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}Z`;
const dayAt = (back, h, m) => { const d = new Date(); d.setDate(d.getDate() - back); d.setHours(h, m, 4, 0); return d; };
const CID = '184273', SEC = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const todayWd = (new Date().getDay() + 6) % 7;
let T0 = Date.now();
const log = m => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's  ' + m);

(async () => {
  const browser = await chromium.launch({ args: ['--force-device-scale-factor=2', '--window-size=390,844'] });
  const ctx = await browser.newContext({ viewport: null, colorScheme: 'dark' });
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
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
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
          card.innerHTML = parts(34) + `<div class="fxr"></div><img class="fxi" src="data:image/png;base64,${icon}" alt=""><div class="fxt">${letters('You By', 'l')}<br><span class="a">${[...'What You Eat'].map((c, i) => c === ' ' ? '<span style="display:inline-block;width:.5em"></span>' : `<span class="l" style="--i:${i + 7}">${c}</span>`).join('')}</span></div><div class="fxs">Essen · Laufen · Fortschritt</div><div class="fxsweep"></div>`;
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
            <ul class="fxl"><li style="--i:0">📸 Foto-KI – offline am Handy</li><li style="--i:1">🍬 Zucker &amp; Nährwerttabelle</li><li style="--i:2">🏃 Laufplan &amp; Mini-Workouts</li><li style="--i:3">🧡 Strava: Läufe automatisch einlesen</li><li style="--i:4">🧾 Kassenbons lernen deine Preise</li></ul>
            <div class="fxcta">Dein Plan. Deine Läufe.</div><div class="fxnote">Demo-Aufnahme im Browser-Modus mit Beispieldaten – Kamera und Strava sind simuliert.</div>`;
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
  // ---- Aufnahme: Chrome-Screencast, jedes Bild mit Zeitstempel ----
  const FR = OUT + '/frames'; fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const stamps = [], offs = []; let nf = 0;
  cdp.on('Page.screencastFrame', f => { fs.writeFileSync(`${FR}/${String(nf).padStart(6, '0')}.jpg`, Buffer.from(f.data, 'base64')); stamps.push(f.metadata.timestamp); offs.push(Date.now() / 1000 - f.metadata.timestamp); nf++; cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  const marks = [];
  const mark = n => { marks.push([n, Date.now() / 1000]); log('● ' + n); };
  const errs = [];
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
    // nicht unter der unteren Leiste / dem Kopfbereich tippen: Element in die Bildmitte holen
    if ((cy > 690 || cy < 110) && !(await el.evaluate(e => !!e.closest('.sheet,.sticky-save,.nav,nav')))) {
      await page.evaluate(dy => { const sc = document.querySelector('.screen:last-child'); if (sc) sc.scrollBy({ top: dy, behavior: 'instant' }); }, cy - 400);
      await wait(450); b = await el.boundingBox();
    }
    const x = b.x + b.width / 2 + (o.dx || 0), y = b.y + Math.min(b.height / 2, o.maxY || 9999);
    await page.mouse.move(x, y, { steps: 8 });
    await wait(100);
    await page.mouse.down(); await wait(70); await page.mouse.up();
    await wait(o.after ?? 650);
  }
  async function scrollTo(y, ms = 1100) {
    await page.evaluate(y => { const el = document.querySelector('.screen:last-child'); if (el) el.scrollTo({ top: y, behavior: 'smooth' }); }, y);
    await wait(ms);
  }
  const slow = async r => { try { await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: r }); } catch (e) { /* egal */ } };
  async function typeIn(sel, text, delay = 55) { await tap(sel, { after: 200 }); await page.keyboard.type(text, { delay }); await wait(300); }
  const step = async (name, fn) => { log('▶ ' + name); try { await fn(); } catch (e) { errs.push('SCENE ' + name + ': ' + String(e.message).split('\n')[0]); log('!! ' + name + ' – ' + String(e.message).split('\n')[0]); try { await unspot(); await page.evaluate(() => window.__sheetClose && window.__sheetClose()); } catch (x) { /* egal */ } } };

  await page.goto('http://127.0.0.1:8765/index.html');
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  T0 = Date.now();
  mark('intro.start');
  await wait(4300);
  mark('intro.end');
  await hideCard(); await wait(700);

  await step('Onboarding', async () => {
    mark('onb.start');
    cap('Dein *Plan* beginnt hier', 2300); await wait(1600);
    await tap('[data-act="ob-next"]', { after: 900 });
    mark('onb.profile'); cap('Dein *Körper* – dein Bedarf', 2400, 'Größe · Gewicht · Ziel'); await wait(2200);
    await tap('[data-act="ob-next"]', { after: 900 });
    mark('onb.goal'); cap('Dein *Ziel*', 2000, 'Muskelaufbau · Gewicht halten'); await wait(1700);
    await tap('[data-act="ob-next"]', { after: 900 });
    mark('onb.run'); cap('Deine *Lauftage*', 2200, 'Heute ist dabei'); await wait(800);
    const chip = page.locator(`[data-act="runday"][data-v="${todayWd}"]`).first();
    if (!(await chip.evaluate(e => e.classList.contains('on')))) { await spot(chip, { pad: 6, r: 14 }); await wait(500); await tap(chip, { after: 900 }); await unspot(); }
    await wait(700);
    await tap('[data-act="ob-next"]', { after: 900 });
    mark('onb.notif'); cap('Erinnerungen für *alles*', 2300, 'Kochen · Essen · Laufen'); await wait(1900);
    mark('onb.done');
    await tap('[data-act="ob-done"]', { after: 4600 });
  });

  await step('Heute', async () => {
    mark('heute.start');
    cap('Alles *heute* im Blick', 2500, 'Kalorien · Eiweiß · Plan'); await wait(2800);
    mark('heute.scroll');
    await scrollTo(400, 1300);
    mark('heute.eat');
    cap('Kleines *Frühstück*', 2300, 'Wenn morgens wenig reingeht'); await wait(900);
    await tap('.ml-add >> nth=0', { after: 1200 });
    mark('heute.rate');
    cap('Danach *bewerten*', 2200, '0 bis 5 Sterne'); await wait(700);
    const star = page.locator('.stars-row [data-act="star"][data-v="5"]').first();
    if (await star.count()) { await spot(star, { pad: 10, r: 18 }); await wait(500); await tap(star, { after: 1300 }); await unspot(); }
    await page.evaluate(() => window.__sheetClose && window.__sheetClose()); await wait(500);
    await scrollTo(0, 700);
  });

  await step('Foto', async () => {
    mark('foto.word'); await word('FOTO', '#34D399', 1300, 'Eine Aufnahme genügt'); await wait(1400); await hideCard(); await wait(300);
    mark('foto.pick');
    await tap('.nav-plus', { after: 1300 });
    cap('Foto · Barcode · *Tabelle*', 2500, 'Oder einfach suchen'); await wait(2200);
    mark('foto.scan');
    await tap('[data-act="food-demo"][data-kind="haribo"]', { after: 400 });
    await wait(2900);
    mark('foto.result'); cap('Erkannt in *Sekunden*', 2400, 'Haribo Goldbären · Nutri-Score D'); await wait(2400);
    mark('foto.table');
    await scrollTo(560, 1100); cap('Nährwerte wie auf der *Packung*', 2500, 'Mit Ampel-Farben'); await wait(2400);
    mark('foto.sugar');
    await slow(0.4);
    await scrollTo(1250, 1500); cap('So viel *Zucker*', 2800, 'Gramm · Würfel · WHO-Anteil'); await wait(3600);
    await slow(1);
    await scrollTo(0, 900);
    await tap('[data-act="food-step"][data-v="1"]', { after: 700 });
    mark('foto.save');
    await tap('[data-act="food-save"]', { after: 1800 });
    mark('foto.heute'); cap('Zucker *heute*: mitgezählt', 2400); await scrollTo(430, 2000); await scrollTo(0, 500);
  });

  await step('Suche', async () => {
    mark('search.start');
    await tap('.nav-plus', { after: 800 });
    cap('Oder einfach *suchen*', 2300, 'Spaghetti · Beef Tatar · Cola'); await wait(500);
    await typeIn('#food-q', 'Beef Tatar', 60); await wait(600);
    await tap('.fl >> nth=0', { after: 1800 });
    mark('search.result'); await wait(1300);
    await tap('[data-act="food-save"]', { after: 1500 });
  });

  await step('Laufen', async () => {
    mark('lauf.word'); await word('LAUFEN', '#FF7A2F', 1300, 'Plan · Erinnerung · Workout'); await wait(1400); await hideCard(); await wait(300);
    await tap('.nav-btn[data-tab="training"]', { after: 1300 });
    mark('lauf.card'); cap('Dein *Laufplan*', 2300, 'Passend zu deinem Niveau'); await wait(2500);
    mark('lauf.week'); await scrollTo(520, 1200); await wait(900); await scrollTo(0, 800);
    const no = page.locator('.run-card [data-act="no-run"]').first();
    if (await no.count()) {
      mark('lauf.sheet'); cap('Keine *Lust*?', 2200, 'Dann ein Mini-Workout'); await wait(500);
      await spot(no, { pad: 8, r: 16, c: '#FF7A2F' }); await wait(700); await tap(no, { after: 1500 }); await unspot();
      await tap('#nr-go', { after: 1800 });
      mark('lauf.timer'); cap('Jede Übung *angesagt*', 2300, 'Mit Timer'); await wait(1800);
      await tap('[data-act="timer-skip"]', { after: 1100 });
      await tap('[data-act="timer-stop"]', { after: 700 });
      await tap('#st-quit', { after: 1000 });
    }
  });

  await step('Strava', async () => {
    mark('strava.word'); await word('STRAVA', '#FF6A1F', 1700, 'Deine Läufe. Automatisch.'); await wait(1800); await hideCard(); await wait(300);
    await page.evaluate(() => { location.hash = '#/training'; }); await wait(700);
    await scrollTo(1500, 900);
    mark('strava.row');
    const row = page.locator('[data-go="#/strava"]').first();
    cap('*Strava* – direkt in der App', 2600, 'Training → Strava'); await wait(600);
    await spot(row, { pad: 6, r: 16, c: '#FF6A1F' }); await wait(1000); await tap(row, { after: 1400 }); await unspot();
    mark('strava.hero'); cap('Läufe *einlesen*', 2300, 'Strecke · Pace · Puls · Kalorien'); await wait(2600);
    mark('strava.steps');
    await scrollTo(300, 1100); await wait(500);
    cap('Einmal *einrichten*', 2200, 'In 3 Minuten'); await scrollTo(560, 1200); await wait(1000);
    mark('strava.keys');
    await typeIn('#st-cid', CID, 75); await typeIn('#st-sec', SEC, 20);
    mark('strava.connect');
    cap('*Verbinden*', 2000, 'Strava öffnet sich'); await wait(300);
    const cb = page.locator('[data-act="strava-connect"]').first();
    await spot(cb, { pad: 8, r: 20, c: '#FF6A1F' }); await wait(700); await tap(cb, { after: 600 }); await unspot();
    mark('strava.auth'); await word('AUTORISIEREN', '#FF6A1F', 1500, 'Ein Tipp bei Strava'); await wait(1600); await hideCard(); await wait(200);
    await page.evaluate(() => { document.querySelector('.st-manual').open = true; });
    await page.locator('#st-paste').fill('ybwye://localhost?state=&code=goodcode&scope=read,activity:read_all'); await wait(300);
    mark('strava.back');
    await slow(0.55);
    await tap('[data-act="strava-redeem"]', { after: 3200 });
    mark('strava.connected'); cap('*Verbunden* ✓', 2200, 'Die letzten 30 Tage sind da'); await wait(800);
    await scrollTo(330, 1500);
    mark('strava.list'); await wait(2300);
    await slow(1);
  });

  await step('Strava Neuer Lauf', async () => {
    // Du läufst – Strava hat den Lauf – App öffnen → Jetzt Läufe holen
    acts.push({ id: 3005, name: 'Abendlauf', sport_type: 'Run', distance: 5200, moving_time: 1900, elapsed_time: 1990, start_date_local: lisoOf(dayAt(0, 17, 31)), average_heartrate: 148.6, max_heartrate: 171, total_elevation_gain: 42.3 });
    await scrollTo(0, 800);
    mark('strava.newrun');
    cap('Nach dem *Lauf*', 2500, 'App öffnen – fertig'); await wait(900);
    const sb = page.locator('[data-act="strava-sync"]').first();
    await spot(sb, { pad: 8, r: 20, c: '#FF6A1F' }); await wait(800); await tap(sb, { after: 400 }); await unspot();
    mark('strava.synced'); await wait(3200);
    await tap('.nav-btn[data-tab="training"]', { after: 1400 });
    mark('strava.training'); cap('Dein Lauf *steht drin*', 2500, 'Strecke · Pace · Puls · Höhenmeter'); await wait(1000);
    const src = page.locator('.src-line').first();
    if (await src.count()) { await spot(src, { pad: 10, r: 14, c: '#FF6A1F' }); await wait(2300); await unspot(); } else await wait(2300);
    mark('strava.week'); await scrollTo(480, 1300); await wait(800); await scrollTo(0, 700);
    await tap('.nav-btn[data-tab="heute"]', { after: 1500 });
    mark('strava.heute'); cap('Kalorien *verbrannt* ✓', 2600, 'Zählen zum Tagesziel'); await wait(900);
    await scrollTo(300, 1300); await wait(1800); await scrollTo(0, 700);
  });

  await step('GPX', async () => {
    mark('gpx.start');
    await page.evaluate(() => { location.hash = '#/strava'; }); await wait(900);
    cap('Auch ohne Konto: *Datei*', 2600, 'GPX oder TCX einlesen'); await wait(500);
    const base = dayAt(1, 7, 10), pts = []; let t = base.getTime(), lat = 48.2, lon = 16.37;
    for (let i = 0; i <= 200; i++) { pts.push(`<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><ele>${(180 + Math.sin(i / 20) * 8).toFixed(1)}</ele><time>${new Date(t).toISOString()}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${140 + (i % 10)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`); lat += 0.000122; t += 5000; }
    const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="demo" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><name>Morgenrunde</name><type>running</type><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
    await scrollTo(1400, 1100);
    const fb = page.locator('[data-act="strava-file"]').first();
    await spot(fb, { pad: 8, r: 20 }); await wait(900);
    const fcP = page.waitForEvent('filechooser', { timeout: 6000 });
    await tap(fb, { after: 200 }); await unspot();
    const fc = await fcP; await fc.setFiles({ name: 'morgenrunde.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx) });
    await wait(900);
    mark('gpx.sheet'); cap('Vorschau *prüfen*', 2400, 'Strecke · Pace · Puls'); await wait(2400);
    await tap('#imp-yes', { after: 1600 });
    mark('gpx.saved'); await wait(1000);
  });

  await step('Auto', async () => {
    mark('auto.start');
    await scrollTo(0, 900);
    await scrollTo(330, 1000);
    const tg = page.locator('label.switch-row').first();
    cap('Beim Öffnen *automatisch*', 2600, 'Nichts doppelt · jederzeit trennbar'); await wait(600);
    if (await tg.count()) { await spot(tg, { pad: 6, r: 16, c: '#FF6A1F' }); await wait(2200); await unspot(); } else await wait(2200);
    mark('auto.end');
  });

  await step('Bon', async () => {
    mark('bon.start');
    await tap('.nav-btn[data-tab="einkauf"]', { after: 1200 });
    cap('Einkauf & *Kassenbon*', 2400, 'Die App lernt deine Preise'); await wait(1400);
    await tap('[data-go="#/bon"]', { after: 900 });
    mark('bon.scan');
    await tap('[data-act="scan-demo"]', { after: 2800 });
    mark('bon.review'); await wait(700);
    await tap('[data-act="rv-save"]', { after: 1500 });
    await page.evaluate(() => window.__sheetClose && window.__sheetClose()); await wait(600);
    mark('bon.end');
  });

  await step('Ich', async () => {
    mark('ich.start');
    await tap('.nav-btn[data-tab="heute"]', { after: 1100 });
    await tap('.avatar', { after: 1200 });
    cap('Alles bleibt *privat*', 2400, 'Nur auf deinem Handy'); await scrollTo(500, 1400); await wait(900);
    mark('ich.end');
    await tap('[data-act="back"]', { after: 1000 });
  });

  mark('outro.start');
  await page.evaluate(() => window.__fx.outro());
  await wait(6500);
  mark('outro.end');

  await cdp.send('Page.stopScreencast');
  await browser.close();
  const sorted = offs.slice().sort((a, b) => a - b), off = sorted[sorted.length >> 1];
  const t0 = stamps[0];
  const frames = stamps.map((s, i) => [`${FR}/${String(i).padStart(6, '0')}.jpg`, +(s - t0).toFixed(4)]);
  const marksOut = marks.map(([n, w]) => [n, +(w - off - t0).toFixed(3)]);
  fs.writeFileSync(OUT + '/frames.json', JSON.stringify(frames));
  fs.writeFileSync(OUT + '/markers.json', JSON.stringify(marksOut, null, 1));
  console.log('Bilder:', nf, 'Dauer:', (stamps[nf - 1] - t0).toFixed(1) + 's', 'Uhr-Versatz', off.toFixed(3));
  console.log(errs.length ? 'PROBLEME:\n' + errs.join('\n') : 'KEINE FEHLER');
})();
