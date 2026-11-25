const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8788', SP = require('os').tmpdir(), scheme = process.argv[2] || 'light';
const errs = []; const ok = (c, m) => { if (!c) { errs.push('FAIL ' + m); console.log('FAIL', m); } else console.log('ok  ', m); };
const nav = (page, h) => page.evaluate(h => { const b = document.createElement('button'); b.dataset.go = h; document.body.appendChild(b); b.click(); b.remove(); }, h);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const mk = async (name, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, ...opts });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ' PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|push\.invalid/.test(m.text())) errs.push(name + ' CONSOLE ' + m.text()); });
    page.shot = async n => { await page.waitForTimeout(500); await page.screenshot({ path: `${SP}/shots8/${scheme[0]}-${n}.png` }); };
    return page;
  };
  const onboard = async page => {
    await page.goto(BASE + '/'); await page.waitForTimeout(900);
    await page.click('[data-act="ob-next"]'); await page.waitForTimeout(350);
    await page.click('[data-act="pset"][data-k="sex"][data-v="m"]'); await page.waitForTimeout(250);
    for (let i = 0; i < 3; i++) { await page.click('[data-act="ob-next"]'); await page.waitForTimeout(350); }
    await page.click('[data-act="ob-done"]'); await page.waitForTimeout(4300);
  };
  const tok = page => page.evaluate(() => JSON.parse(localStorage.getItem('ybwye.v1')).social.token);
  const api = (page, p, o = {}) => page.evaluate(async ([p, o]) => { const t = JSON.parse(localStorage.getItem('ybwye.v1')).social.token; const r = await fetch(p, { method: o.method || 'GET', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }); return r.json(); }, [p, o]);

  // ===== 1) Besitzer richtet den Server ein =====
  const chef = await mk('Chef'); await onboard(chef);
  await chef.click('.nav-btn[data-tab="freunde"]'); await chef.waitForTimeout(1200); await chef.shot('01-einrichten');
  ok((await chef.locator('#so-join').innerText()).includes('Einrichten'), 'Erste Person sieht „Server einrichten“ (keine Einladung nötig)');
  ok(await chef.locator('#so-url').count() === 0, 'Adresse muss nicht eingetippt werden');
  await chef.fill('#so-name', 'Chef'); await chef.click('#so-join'); await chef.waitForTimeout(2200);
  ok(await chef.locator('.so-empty').count() === 1, 'Chef ist drin (leere Chatliste)');
  // Konten anlegen über die App
  await chef.click('.so-me'); await chef.waitForTimeout(1500);
  ok(await chef.locator('[data-act="so-acc-new"]').count() === 1, 'Besitzer sieht „Konten anlegen“ im Profil');
  await chef.click('[data-act="so-acc-new"]'); await chef.waitForTimeout(600); await chef.shot('02-konten-anlegen');
  const names = await chef.inputValue('#ac-names'); ok(names.split('\n').join(',') === 'Luca,Ajjai,David,Jonas', 'Vorgabe: Luca, Ajjai, David, Jonas');
  await chef.click('#ac-go'); await chef.waitForTimeout(1500);
  ok(await chef.locator('.acc-row').count() === 4, 'Vier Konten angelegt, jeweils mit Zeile zum Verschicken'); await chef.shot('03-konten-liste');
  await chef.click('.acc-row >> nth=0'); await chef.waitForTimeout(500); await chef.shot('04-konto-menue'); await chef.evaluate(() => window.__sheetClose && window.__sheetClose());
  const accs = (await api(chef, '/api/admin/accounts')).accounts; const link = n => accs.find(a => a.name === n).link;
  // Strava-Schlüssel (Besitzer)
  await nav(chef, '#/strava'); await chef.waitForTimeout(1300);
  ok(await chef.locator('#sv-cid').count() === 1, 'Besitzer sieht Strava-Einrichtung mit Server-Adresse'); await chef.shot('05-strava-besitzer');
  await chef.fill('#sv-cid', '184273'); await chef.fill('#sv-sec', 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'); await chef.click('[data-act="strava-save-srv"]'); await chef.waitForTimeout(1500);
  ok((await api(chef, '/api/strava/status')).enabled === true, 'Strava ist für alle freigeschaltet');

  // ===== 2) Luca öffnet seinen Link =====
  const luca = await mk('Luca', { colorScheme: scheme }); await luca.goto(link('Luca')); await luca.waitForTimeout(3500); await luca.shot('06-luca-willkommen');
  ok(await luca.locator('[data-act="ob-next"]').count() === 0, 'Luca sieht kein Onboarding');
  ok((await luca.locator('.sheet').innerText().catch(() => '')).includes('Hey Luca'), 'Willkommens-Hinweis „Hey Luca!“ mit zwei Schritten');
  await luca.evaluate(() => window.__sheetClose && window.__sheetClose()); await luca.waitForTimeout(500);
  const st = await luca.evaluate(() => { const s = JSON.parse(localStorage.getItem('ybwye.v1')); return { on: s.profile.onboarded, name: s.profile.name, sex: s.profile.sex, user: s.social.user.name, url: s.social.url }; });
  ok(st.on && st.name === 'Luca' && st.sex === 'm' && st.user === 'Luca' && st.url === BASE, 'Konto, Profil und Serveradresse sind vorbereitet');
  ok(new URL(luca.url()).searchParams.get('k') !== null, 'Im Browser-Tab bleibt der Link in der Adresse (für „Zum Home-Bildschirm“)');
  ok((await luca.evaluate(() => document.querySelector('link[rel=manifest]').getAttribute('href'))).includes('?k='), 'Manifest-Link trägt den Zugangslink');
  await luca.click('.nav-btn[data-tab="freunde"]'); await luca.waitForTimeout(1500); await luca.shot('07-luca-chats');
  ok((await luca.locator('.chat-row').first().innerText()).includes('Gym-Gang'), 'Luca ist schon in der Gruppe „Gym-Gang“');
  await luca.click('[data-act="so-tab"][data-v="rang"]'); await luca.waitForTimeout(500); await luca.click('.so-scope .chip >> nth=1'); await luca.waitForTimeout(1300);
  ok(await luca.locator('.lb-row').count() === 5, 'Rangliste zeigt alle 5 Mitglieder');
  // Strava für Luca
  await nav(luca, '#/strava'); await luca.waitForTimeout(1500); await luca.shot('08-luca-strava');
  ok(await luca.locator('[data-act="strava-connect-srv"]').count() === 1, 'Luca sieht den großen Knopf „Mit Strava verbinden“ (keine Schlüssel nötig)');
  let authUrl = null;
  await luca.route('https://www.strava.com/**', r => { authUrl = r.request().url(); r.fulfill({ status: 200, contentType: 'text/html', body: '<body style="background:#fc4c02"></body>' }); });
  await luca.click('[data-act="strava-connect-srv"]'); await luca.waitForTimeout(2000);
  const au = authUrl && new URL(authUrl); ok(au && au.pathname === '/oauth/authorize' && au.searchParams.get('client_id') === '184273' && au.searchParams.get('redirect_uri') === BASE + '/strava/callback' && /activity:read/.test(au.searchParams.get('scope')), 'Strava-Freigabe öffnet sich mit der Adresse des eigenen Servers');
  await luca.goto(BASE + '/strava/callback?code=goodcode&scope=read,activity:read_all&state=' + au.searchParams.get('state')); await luca.waitForTimeout(1500); await luca.shot('09-strava-ok');
  ok((await luca.locator('h1').innerText()).includes('verbunden'), 'Rückkehr-Seite: „Mit Strava verbunden“');
  await luca.click('a.b'); await luca.waitForTimeout(4500); await luca.shot('10-strava-laeufe');
  const runs = await luca.evaluate(() => Object.values(JSON.parse(localStorage.getItem('ybwye.v1')).runs || {}));
  ok(runs.length === 1 && runs[0].km === 5.2 && runs[0].kcal === 412 && runs[0].src === 'strava', 'Lauf kam über den Server von Strava: 5,2 km, 412 kcal (Rad wurde ignoriert)');
  const st2 = await api(luca, '/api/strava/status'); ok(st2.connected && st2.athlete === 'Luca Test', 'Server hat Luca mit Strava verbunden');
  const feed = await api(luca, '/api/feed'); ok(feed.activities.some(a => a.kind === 'run' && a.data.km === 5.2), 'Lauf wurde automatisch mit der Gruppe geteilt');

  // ===== 3) Fremder folgt dem Besitzer → Chat =====
  const invite = (await api(chef, '/api/me')).server.invite, chefMe = (await api(chef, '/api/me')).user;
  const gast = await mk('Gast'); await onboard(gast);
  await gast.click('.nav-btn[data-tab="freunde"]'); await gast.waitForTimeout(1000); await gast.fill('#so-inv', invite); await gast.fill('#so-name', 'Gast'); await gast.click('#so-join'); await gast.waitForTimeout(2200);
  await gast.click('[data-act="so-tab"][data-v="freunde"]'); await gast.waitForTimeout(900); await gast.fill('#so-fcode', chefMe.code); await gast.click('[data-act="so-follow-code"]'); await gast.waitForTimeout(1800);
  ok(await chef.locator('.toast .tt-go').count() === 1 && (await chef.locator('.toast').innerText()).includes('Gast folgt dir jetzt'), 'Chef bekommt sofort die Meldung „Gast folgt dir jetzt – Hallo sagen“'); await chef.shot('11-folgt-dir');
  await chef.click('.toast .tt-go'); await chef.waitForTimeout(1500);
  ok(chef.url().includes('#/chat/dm.'), 'Tippen auf die Meldung öffnet den Chat mit dem Follower');
  ok((await chef.locator('.ch-sys').first().innerText()).includes('folgt dir jetzt'), 'Im Chat steht „Gast folgt dir jetzt 👋“');
  await chef.fill('#ch-t', 'Willkommen, Gast! 💪'); await chef.click('#ch-send'); await chef.waitForTimeout(800);
  await gast.click('.nav-btn[data-tab="freunde"]'); await gast.waitForTimeout(800); await gast.click('[data-act="so-tab"][data-v="chats"]'); await gast.waitForTimeout(1200);
  ok((await gast.locator('.chat-row').first().innerText()).includes('Willkommen'), 'Gast sieht die Antwort sofort in seiner Chatliste (ohne dass Chef zurückfolgen musste)'); await gast.shot('12-gast-chats');
  // Follower-Zeile mit Chat-Knopf
  await nav(chef, '#/freunde'); await chef.waitForTimeout(800); await chef.click('[data-act="so-tab"][data-v="freunde"]'); await chef.waitForTimeout(1500);
  ok(await chef.locator('.fr-row [aria-label="Nachricht"]').count() >= 1, 'Bei Followern gibt es einen Chat-Knopf'); await chef.shot('13-follower-liste');

  // ===== 4) iPhone (Safari, nicht installiert) =====
  const ios = await mk('iPhone', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', hasTouch: true });
  await ios.goto(link('Jonas')); await ios.waitForTimeout(4000); await ios.evaluate(() => window.__sheetClose && window.__sheetClose()); await ios.waitForTimeout(600);
  ok(await ios.locator('.ios-banner').count() === 1, 'iPhone-Safari: Banner „Als App installieren“'); await ios.shot('14-iphone-banner');
  await ios.click('.ios-banner'); await ios.waitForTimeout(500); ok((await ios.locator('.sheet').innerText()).includes('Zum Home-Bildschirm'), 'Banner erklärt die Installation Schritt für Schritt'); await ios.shot('15-iphone-anleitung'); await ios.evaluate(() => window.__sheetClose && window.__sheetClose());
  await ios.click('.nav-btn[data-tab="freunde"]'); await ios.waitForTimeout(800); await ios.click('.so-me'); await ios.waitForTimeout(1500);
  ok((await ios.locator('#so-push').innerText()).includes('Home-Bildschirm'), 'Profil: Mitteilungen erklären, dass erst installiert werden muss'); await ios.shot('16-iphone-profil');
  // Foto-Seite im Web
  await await ios.click('.nav-plus'); await ios.waitForTimeout(1200);
  ok((await ios.locator('#screens .screen:last-child').innerText()).includes('Android-App'), 'Foto-KI-Hinweis: gibt es nur in der Android-App, im Web wird gesucht');
  console.log(errs.length ? errs.join('\n') : 'ALLES OK');
  await browser.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
