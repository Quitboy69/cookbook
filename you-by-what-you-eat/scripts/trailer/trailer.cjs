/* Aufruf: im Ordner www/ einen Server starten (python3 -m http.server 8765 --bind 127.0.0.1), dann
     node scripts/trailer/trailer.cjs <Ausgabeordner>   → Bilder + frames.txt
     ffmpeg -f concat -safe 0 -i frames.txt -vf fps=30,format=yuv420p -c:v libx264 -crf 20 stumm.mp4
     python3 scripts/trailer/music.py 106 && ffmpeg -i stumm.mp4 -i music.wav -c:v copy -c:a aac -shortest trailer.mp4
   Trailer: spielt die App im Browser (Handygröße) von A bis Z durch und nimmt das als Video auf.
   Kamera/Strava sind Simulationen (Demo-Fotos der App, nachgebaute Strava-Schnittstelle). */
const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2], OUT = SP + '/trailer';
const icon = fs.readFileSync(require('path').join(__dirname, '..', '..', 'assets', 'app-icon-512.png')).toString('base64');
const pad = n => String(n).padStart(2, '0');
const lisoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}Z`;
const dayAt = (back, h, m) => { const d = new Date(); d.setDate(d.getDate() - back); d.setHours(h, m, 4, 0); return d; };
const CID = '123456', SEC = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const todayWd = (new Date().getDay() + 6) % 7;
const log = m => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's  ' + m);
let T0 = Date.now();

(async () => {
  const browser = await chromium.launch({ args: ['--force-device-scale-factor=2', '--window-size=390,844'] });   // echte 2x-Auflösung (780 × 1688)
  const ctx = await browser.newContext({ viewport: null, colorScheme: 'light' });
  await ctx.addInitScript(({ icon }) => {
    const css = `
    .fx-cur{position:fixed;left:0;top:0;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.9);box-shadow:0 2px 14px rgba(0,0,0,.35);z-index:2147483000;pointer-events:none;opacity:0;transition:opacity .25s,transform .12s;will-change:transform}
    .fx-cur.on{opacity:1}.fx-cur.dn{scale:.78;background:rgba(18,184,134,.55)}
    .fx-rip{position:fixed;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:3px solid #12B886;z-index:2147482999;pointer-events:none;animation:fxr .6s ease-out forwards}
    @keyframes fxr{to{transform:scale(4.2);opacity:0}}
    .fx-cap{position:fixed;left:50%;bottom:112px;transform:translate(-50%,16px);max-width:86vw;padding:11px 18px;border-radius:999px;background:rgba(8,14,12,.86);color:#fff;font:700 15px/1.25 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;z-index:2147483001;pointer-events:none;opacity:0;transition:opacity .35s,transform .35s;box-shadow:0 8px 28px rgba(0,0,0,.35);backdrop-filter:blur(8px)}
    .fx-cap.on{opacity:1;transform:translate(-50%,0)}
    .fx-card{position:fixed;inset:0;z-index:2147483002;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 28px;text-align:center;color:#fff;background:radial-gradient(120% 80% at 50% 28%,#14a77a 0%,#0b3d2e 52%,#07110d 100%);opacity:0;pointer-events:none;transition:opacity .6s;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
    .fx-card.on{opacity:1}
    .fx-card img{width:132px;height:132px;border-radius:30px;box-shadow:0 18px 50px rgba(0,0,0,.45);animation:fxf 3.2s ease-in-out infinite}
    @keyframes fxf{50%{transform:translateY(-8px)}}
    .fx-card h1{margin:6px 0 0;font-size:40px;line-height:1.05;font-weight:800;letter-spacing:-.02em}.fx-card h1 span{color:#6EE7B7}
    .fx-card p{margin:0;font-size:17px;opacity:.88;line-height:1.35}
    .fx-card ul{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:9px;font-size:17px;font-weight:600;text-align:left}
    .fx-card small{margin-top:10px;font-size:12px;opacity:.62;line-height:1.4;max-width:300px}
    .fx-card .fx-in{animation:fxi .7s both}@keyframes fxi{from{opacity:0;transform:translateY(14px)}}`;
    const mk = (c) => { const e = document.createElement('div'); e.className = c; return e; };
    const boot = () => {
      if (!document.body) return requestAnimationFrame(boot);
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      const cur = mk('fx-cur'), cap = mk('fx-cap'), card = mk('fx-card');
      document.body.append(cur, cap, card);
      let ct;
      window.__fx = {
        cap(t, ms) { clearTimeout(ct); cap.textContent = t; cap.classList.add('on'); ct = setTimeout(() => cap.classList.remove('on'), ms || 2600); },
        card(html, show) { card.innerHTML = html; card.classList.toggle('on', show !== false); },
        hide() { card.classList.remove('on'); }
      };
      addEventListener('pointermove', e => { cur.classList.add('on'); cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
      addEventListener('pointerdown', e => { cur.classList.add('dn'); const r = mk('fx-rip'); r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
      addEventListener('pointerup', () => cur.classList.remove('dn'), true);
      window.__fx.card(`<img src="data:image/png;base64,${icon}" alt=""><h1>You By<br><span>What You Eat</span></h1><p>Essen · Zucker · Laufen · Strava</p>`);
    };
    boot();
  }, { icon });

  // ---- nachgebaute Strava-Schnittstelle (Demo-Daten) ----
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
  const acts = [
    { id: 2001, name: 'Abendlauf', sport_type: 'Run', distance: 5200, moving_time: 1900, elapsed_time: 1990, start_date_local: lisoOf(dayAt(0, 17, 31)), average_heartrate: 148.6, max_heartrate: 171, total_elevation_gain: 42.3 },
    { id: 2002, name: 'Waldrunde', sport_type: 'TrailRun', distance: 8400, moving_time: 3300, start_date_local: lisoOf(dayAt(3, 8, 5)), average_heartrate: 155, total_elevation_gain: 180 },
    { id: 2003, name: 'Rad', sport_type: 'Ride', distance: 22000, moving_time: 3600, start_date_local: lisoOf(dayAt(1, 9, 0)) }
  ];
  const cal = { 2001: 412, 2002: 640 };
  await ctx.route('https://www.strava.com/**', async route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const j = (status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (url.pathname.startsWith('/oauth/mobile/authorize')) return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<body style="font:20px system-ui;background:#fc4c02;color:#fff;display:grid;place-items:center;height:100vh">Strava (Demo)</body>' });
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
  // Aufnahme: Chrome-Screencast, jedes Bild mit Zeitstempel (nur bei Bildänderung)
  const FR = OUT + '/frames'; fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const stamps = []; let nf = 0;
  cdp.on('Page.screencastFrame', f => { fs.writeFileSync(`${FR}/${String(nf).padStart(6, '0')}.jpg`, Buffer.from(f.data, 'base64')); stamps.push(f.metadata.timestamp); nf++; cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 2 });
  ctx.on('page', p => setTimeout(() => p.close().catch(() => {}), 1100));   // Strava-Seite im neuen Tab kurz zeigen und schließen
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  const K = 0.68;                                         // Tempo: kürzere Pausen als beim Testlauf
  const wait = ms => page.waitForTimeout(Math.round(ms * K));
  const rwait = ms => page.waitForTimeout(ms);            // echte Zeit (Animationen der App)
  const cap = (t, ms) => page.evaluate(([t, ms]) => window.__fx && window.__fx.cap(t, ms), [t, ms]);
  const card = (html, show = true) => page.evaluate(([h, s]) => window.__fx.card(h, s), [html, show]);
  const hideCard = () => page.evaluate(() => window.__fx.hide());
  async function tap(sel, o = {}) {
    const el = typeof sel === 'string' ? page.locator(sel).first() : sel;
    await el.scrollIntoViewIfNeeded({ timeout: 8000 });
    await wait(120);
    const b = await el.boundingBox();
    const x = b.x + b.width / 2 + (o.dx || 0), y = b.y + Math.min(b.height / 2, o.maxY || 9999);
    await page.mouse.move(x, y, { steps: 12 });
    await wait(130);
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    await (o.real ? rwait(o.after ?? 600) : wait(o.after ?? 600));
  }
  async function scrollTo(y, ms = 1000) {
    await page.evaluate(y => { const el = document.querySelector('.screen:last-child'); if (el) el.scrollTo({ top: y, behavior: 'smooth' }); }, y);
    await wait(ms);
  }
  async function typeIn(sel, text, delay = 60) { await tap(sel, { after: 200 }); await page.keyboard.type(text, { delay }); await wait(300); }
  const step = async (name, fn) => { log('▶ ' + name); try { await fn(); } catch (e) { errs.push('SCENE ' + name + ': ' + String(e.message).split('\n')[0]); log('!! ' + name + ' – ' + String(e.message).split('\n')[0]); try { await page.evaluate(() => window.__sheetClose && window.__sheetClose()); } catch (x) { /* egal */ } } };

  T0 = Date.now();
  await page.goto('http://127.0.0.1:8765/index.html');
  await rwait(2600);                                  // Titelkarte
  await hideCard(); await rwait(700);

  await step('Onboarding', async () => {
    cap('Dein Speiseplan, der mitdenkt', 2200);
    await wait(1700); await tap('[data-act="ob-next"]', { after: 700 });
    cap('Größe & Gewicht – die App rechnet deinen Bedarf', 2400); await wait(1900);
    await tap('[data-act="ob-next"]', { after: 600 });
    cap('Ziel wählen: Muskelaufbau, Gewicht halten …', 2300); await wait(1500);
    await tap('[data-act="ob-next"]', { after: 600 });
    cap('Lauftage festlegen – heute ist dabei', 2300); await wait(700);
    const chip = page.locator(`[data-act="runday"][data-v="${todayWd}"]`).first();
    if (!(await chip.evaluate(e => e.classList.contains('on')))) await tap(chip, { after: 700 });
    await wait(1100);
    await tap('[data-act="ob-next"]', { after: 700 });
    cap('Erinnerungen: Kochen, Essen bewerten, Laufen', 2400); await wait(1900);
    await tap('[data-act="ob-done"]', { after: 4300, real: true });
  });

  await step('Heute', async () => {
    cap('Heute: Kalorien, Eiweiß, Plan – alles auf einen Blick', 2500); await wait(2300);
    await scrollTo(380, 1000);
    cap('Kleines Frühstück – wenn morgens wenig reingeht', 2400); await wait(1100);
    await tap('.ml-add >> nth=0', { after: 1000 });
    cap('Gegessen? Gleich mit 0–5 Sternen bewerten', 2400); await wait(900);
    const star = page.locator('.stars-row [data-act="star"][data-v="5"]').first();
    if (await star.count()) await tap(star, { after: 1100 });
    await page.evaluate(() => window.__sheetClose && window.__sheetClose()); await wait(500);
    await scrollTo(0, 700);
  });

  await step('Gericht', async () => {
    await scrollTo(520, 800);
    cap('Jedes Gericht mit Rezept, Nährwerten und Preis', 2500);
    await tap('.cook-ph', { after: 1300 });
    await scrollTo(520, 1300);
    await tap('[data-act="back"]', { after: 600 });
  });

  await step('Plan', async () => {
    await tap('.nav-btn[data-tab="plan"]', { after: 900 });
    cap('Wochenplan – jeden Tag Abwechslung', 2300); await wait(1200);
    await scrollTo(650, 1300);
  });

  await step('Foto-Modus', async () => {
    await tap('.nav-btn[data-tab="heute"]', { after: 700 });
    await tap('.nav-plus', { after: 900 });
    cap('Foto, Barcode oder Nährwerttabelle – oder einfach suchen', 2800); await wait(2400);
    await tap('[data-act="food-demo"][data-kind="haribo"]', { after: 400 });
    cap('Die KI liest Packung & Barcode – offline am Handy', 2400); await rwait(2700);
    cap('Erkannt: Haribo Goldbären – mit Nutri-Score', 2200); await wait(1500);
    await scrollTo(560, 1000);
    cap('Nährwerttabelle wie auf der Packung – mit Ampel', 2600); await wait(2000);
    await scrollTo(1250, 1000);
    cap('Zucker in Gramm, Zuckerwürfeln & % der WHO-Menge', 2800); await wait(2400);
    await scrollTo(0, 700);
    await tap('[data-act="food-step"][data-v="1"]', { after: 700 });
    cap('Menge einstellen, eintragen – fertig', 2200);
    await tap('[data-act="food-save"]', { after: 1800 });
    cap('Der Zucker-Tagesstand steht gleich auf „Heute“', 2600); await scrollTo(430, 1800); await scrollTo(0, 500);
  });

  await step('Suche', async () => {
    await tap('.nav-plus', { after: 700 });
    cap('Kein Foto? Einfach suchen: Spaghetti, Beef Tatar, Cola …', 2900);
    await typeIn('#food-q', 'Beef Tatar', 55); await wait(700);
    await tap('.fl >> nth=0', { after: 1800 });
    cap('Auch Grundnahrungsmittel mit allen Nährwerten', 2400); await wait(1500);
    await tap('[data-act="food-save"]', { after: 1700 });
    await tap('.nav-btn[data-tab="training"]', { after: 1000 });
  });

  await step('Training', async () => {
    cap('Laufplan mit Erinnerung – passend zu deinem Niveau', 2600); await wait(1600);
    await scrollTo(480, 1100); await scrollTo(0, 700);
    const no = page.locator('.run-card [data-act="no-run"]').first();
    if (await no.count()) {
      cap('Keine Lust zu laufen? Dann ein Mini-Workout', 2500); await tap(no, { after: 1300 });
      await tap('#nr-go', { after: 1500 });
      cap('Jede Übung wird angesagt – mit Timer', 2400); await wait(1500);
      await tap('[data-act="timer-skip"]', { after: 900 });
      await tap('[data-act="timer-stop"]', { after: 600 });
      await tap('#st-quit', { after: 900 });
    }
  });

  await step('Strava', async () => {
    await page.evaluate(() => { location.hash = '#/training'; }); await wait(700);
    await scrollTo(1500, 800);
    await tap('[data-go="#/strava"]', { after: 1000 });
    cap('Strava verbinden: Läufe automatisch einlesen', 2600); await wait(1500);
    await scrollTo(420, 900);
    await typeIn('#st-cid', CID, 70); await typeIn('#st-sec', SEC, 22);
    await tap('[data-act="strava-connect"]', { after: 1700 });
    cap('In Strava „Autorisieren“ – und zurück in die App', 2600);
    await page.evaluate(() => { document.querySelector('.st-manual').open = true; });
    await wait(500);
    await page.locator('#st-paste').fill('ybwye://localhost?state=&code=goodcode&scope=read,activity:read_all');
    await wait(700);
    await tap('[data-act="strava-redeem"]', { after: 2600, real: true });
    cap('Fertig: Strecke, Pace, Puls und Kalorien von Strava', 2800); await scrollTo(320, 1500); await scrollTo(0, 500);
    await tap('.nav-btn[data-tab="training"]', { after: 1000 });
    cap('Der Lauf steht im Training – die Serie läuft weiter 🔥', 2900); await wait(2300);
  });

  await step('Kassenbon', async () => {
    await tap('.nav-btn[data-tab="einkauf"]', { after: 1000 });
    cap('Einkaufsliste mit Preisen deiner Märkte', 2300); await wait(1500);
    await tap('[data-go="#/bon"]', { after: 900 });
    cap('Kassenbon fotografieren – die App lernt Preise & Aktionen', 2900);
    await tap('[data-act="scan-demo"]', { after: 2400, real: true });
    await tap('[data-act="rv-save"]', { after: 1500 });
    await page.evaluate(() => window.__sheetClose && window.__sheetClose()); await wait(600);
  });

  await step('Dunkelmodus', async () => {
    await tap('.nav-btn[data-tab="heute"]', { after: 900 });
    await tap('.avatar', { after: 1000 });
    cap('Alles bleibt auf deinem Handy', 2300); await scrollTo(520, 1100);
    const dark = page.locator('[data-act="theme"][data-v="dark"]').first();
    if (await dark.count()) { cap('Hell oder Dunkel – wie du magst', 2300); await tap(dark, { after: 1500 }); }
    await tap('[data-act="back"]', { after: 1500 });
  });

  await card(`<img src="data:image/png;base64,${icon}" alt=""><h1 class="fx-in">You By<br><span>What You Eat</span></h1><ul class="fx-in"><li>📸 Foto-KI – offline am Handy</li><li>🍬 Zucker & Nährwerttabelle</li><li>🏃 Laufplan, Workouts & Strava</li><li>🧾 Kassenbons lernen deine Preise</li></ul><small>Demo-Aufnahme im Browser-Modus mit Beispieldaten – Kamera und Strava sind simuliert.</small>`);
  await rwait(4800);

  await cdp.send('Page.stopScreencast');
  await browser.close();
  // Liste mit Bilddauern für ffmpeg (Bilder erscheinen nur bei Änderungen → variable Dauer)
  const lines = [];
  for (let i = 0; i < nf; i++) { const d = i + 1 < nf ? stamps[i + 1] - stamps[i] : 0.5; lines.push(`file '${FR}/${String(i).padStart(6, '0')}.jpg'`, `duration ${Math.max(0.001, d).toFixed(4)}`); }
  lines.push(`file '${FR}/${String(nf - 1).padStart(6, '0')}.jpg'`);
  fs.writeFileSync(OUT + '/frames.txt', lines.join('\n'));
  console.log('Bilder:', nf, 'Dauer:', (stamps[nf - 1] - stamps[0]).toFixed(1) + 's');
  console.log(errs.length ? 'PROBLEME:\n' + errs.join('\n') : 'KEINE FEHLER');
})();
