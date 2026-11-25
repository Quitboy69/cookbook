/* Promo im Stil des Vorbild-Videos (Monitor im dunklen Raum, 4 Akte). 60 fps, Zeit wird pro Bild exakt berechnet.
   node render2.cjs cues | test t1,t2,… | render <worker> <anzahl>                                                   */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const HERE = __dirname, FPS = 60, BEAT = 0.5, OUT = path.join(HERE, 'out2');
const REPO = process.env.REPO || '/home/user/cookbook/you-by-what-you-eat';
const frames = JSON.parse(fs.readFileSync(path.join(HERE, 'frames.json'), 'utf8'));
const marks = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(HERE, 'markers.json'), 'utf8')));
const icon = fs.readFileSync(path.join(REPO, 'assets', 'app-icon-512.png')).toString('base64');
const TB = 46, total = TB * BEAT;       // 23 s
const bullets = ['🤸 137 Übungen ohne Geräte', '💬 Gruppen-Chat mit Stickern', '🏆 Wochen-Rangliste &amp; Duelle', '🏃 Läufe automatisch von Strava', '🥧 Eigener Server auf dem Raspberry Pi'];
const cfg = { ts: frames.map(f => f[1]), urls: frames.map(f => 'file://' + f[0]), icon, bullets, total, m: { kat: marks.kat, live: marks.live, rang: marks.rang } };
const cues = { bpm: 120, total_beats: TB, sections: { intro: [0, 10], groove1: [10, 15], break: [15, 19], drop: [19, 29], late: [29, 35], outro: [35, 46] },
  shots: [{ name: 'intro', start: 0, beats: 10, sec: 'intro', hit: 1, drop: false, final: false }, { name: 'act2a', start: 10, beats: 5, sec: 'groove1', hit: 0, drop: false, final: false },
    { name: 'act2b', start: 15, beats: 4, sec: 'break', hit: null, drop: false, final: false }, { name: 'act3', start: 19, beats: 10, sec: 'drop', hit: 0, drop: true, final: false },
    { name: 'act4', start: 29, beats: 6, sec: 'late', hit: 0, drop: false, final: false }, { name: 'outro', start: 35, beats: 11, sec: 'outro', hit: 0, drop: false, final: true }] };
(async () => {
  const mode = process.argv[2];
  if (mode === 'cues') { fs.writeFileSync(path.join(HERE, 'cues_ref.json'), JSON.stringify(cues, null, 1)); console.log('ok', total); return; }
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage(); page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await page.goto('file://' + path.join(HERE, 'stage2.html'));
  await page.evaluate(c => window.setup(c), cfg);
  if (mode === 'test') {
    for (const t of process.argv[3].split(',').map(Number)) { await page.evaluate(t => window.render(t), t); await page.screenshot({ path: path.join(HERE, `t2_${t}.png`) }); }
  } else {
    const w = +process.argv[3], n = +process.argv[4], N = Math.ceil(total * FPS); fs.mkdirSync(OUT, { recursive: true });
    for (let i = w; i < N; i += n) { await page.evaluate(t => window.render(t), i / FPS); await page.screenshot({ path: path.join(OUT, `f_${String(i).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 94 }); if (i % 120 === w) console.log('worker', w, i, '/', N); }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
