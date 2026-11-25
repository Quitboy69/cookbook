/* Frame-genauer Renderer für das Promo-Video (60 fps, Zeit wird pro Bild exakt berechnet – kein Live-Aufnehmen).
   node render.cjs cues                     → cues_smooth.json für die Musik
   node render.cjs test 0.4,1.2,...         → Einzelbilder test_<t>.png zum Prüfen
   node render.cjs render <worker> <anzahl> → Bilder f_000000.jpg … (jeder Worker jedes n-te Bild)             */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const HERE = __dirname, FPS = 60, BEAT = 0.5;
const REPO = process.env.REPO || '/home/user/cookbook/you-by-what-you-eat';
const OUT = path.join(HERE, 'out');
const frames = JSON.parse(fs.readFileSync(path.join(HERE, 'frames.json'), 'utf8'));
const marks = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(HERE, 'markers.json'), 'utf8')));
const icon = fs.readFileSync(path.join(REPO, 'assets', 'app-icon-512.png')).toString('base64');

// id, Takte, Marker, Farben, POV-Zeile, Schlagzeilen, Textfarbe, Abschnitt, Schlag
const SPEC = [
  ['intro', 6, ['#6D28D9', '#EC4899'], 'POV: dein Training wird zum Spiel', ['DEIN TRAINING', 'JETZT MIT FREUNDEN'], null, 'intro', { hit: 0 }],
  ['kat', 4, ['#15803D', '#22C55E'], 'ohne Geräte · nur dein Körper', ['137 ÜBUNGEN', 'NUR DEIN KÖRPER'], null, 'groove1', { hit: 0 }],
  ['muskel', 4, ['#DB2777', '#7C3AED'], 'jeder Muskel im Blick', ['MUSKEL-GRAFIK'], null, 'groove1', {}],
  ['uebung', 4, ['#EA580C', '#DC2626'], 'mit Foto & Anleitung', ['JEDE ÜBUNG'], null, 'groove1', {}],
  ['timer', 4, ['#2563EB', '#6366F1'], 'Ansagen · Sätze · Pausen', ['TIMER & PAUSEN'], null, 'groove2', { hit: 0 }],
  ['punkte', 4, ['#CA8A04', '#FACC15'], 'Die Gruppe sieht es sofort', ['PUNKTE FÜRS TEAM'], '#0F172A', 'groove2', {}],
  ['fort', 4, ['#0F766E', '#14B8A6'], 'Jede Woche besser', ['DEIN FORTSCHRITT'], null, 'groove2', {}],
  ['break', 6, ['#BE185D', '#7C3AED'], 'Du bist nie allein', ['FREUNDE'], null, 'break', {}],
  ['gruppe', 4, ['#BE185D', '#F43F5E'], 'Fotos · Sticker · Reaktionen', ['GRUPPEN-CHAT'], null, 'drop', { hit: 0, drop: true }],
  ['live', 4, ['#DC2626', '#F97316'], 'Max schreibt jetzt', ['LIVE'], null, 'drop', {}],
  ['sticker', 4, ['#15803D', '#22C55E'], 'fertige – oder eigene', ['STICKER'], null, 'late', {}],
  ['eigene', 4, ['#7C3AED', '#EC4899'], 'aus deinem Foto', ['EIGENE STICKER'], null, 'late', {}],
  ['rang', 4, ['#FACC15', '#F59E0B'], 'Wochen-Rangliste', ['WER IST #1?'], '#0F172A', 'late', {}],
  ['duell', 4, ['#1D4ED8', '#2563EB'], 'Wer führt diese Woche?', ['1 GEGEN 1'], null, 'late', {}],
  ['strava', 4, ['#EA580C', '#F97316'], 'von Strava – ohne Eintippen', ['LÄUFE AUTOMATISCH'], null, 'late', {}],
  ['jetzt', 4, ['#059669', '#10B981'], 'kostenlos · dein Plan', ['JETZT STARTEN'], null, 'late', {}]
];
const OUTRO_BEATS = 13;

function build() {
  let beat = 0; const clips = [], segs = [], shots = [], secs = {};
  for (const [id, beats, c, pov, kin, kc, sec, kw] of SPEC) {
    const t0 = beat * BEAT, dur = beats * BEAT;
    if (!(id in marks)) throw new Error('Marker fehlt: ' + id);
    clips.push({ id, t0, t1: t0 + dur, m: marks[id], c, pov, kc });
    kin.forEach((text, i) => segs.push({ t0: t0 + i * dur / kin.length, t1: t0 + (i + 1) * dur / kin.length, text, kc }));
    shots.push({ name: id, start: beat, beats, sec, hit: kw.hit ?? null, drop: !!kw.drop, final: false });
    secs[sec] = secs[sec] ? [secs[sec][0], beat + beats] : [beat, beat + beats];
    beat += beats;
  }
  const outro = { t0: beat * BEAT, t1: (beat + OUTRO_BEATS) * BEAT };
  shots.push({ name: 'outro', start: beat, beats: OUTRO_BEATS, sec: 'outro', hit: 0, drop: false, final: true });
  secs.outro = [beat, beat + OUTRO_BEATS];
  const TB = beat + OUTRO_BEATS;
  return { clips, segs, outro, shots, secs, TB, total: TB * BEAT };
}
const T = build();
const bullets = ['🤸 137 Übungen ohne Geräte', '💬 Gruppen-Chat mit Stickern', '🏆 Wochen-Rangliste &amp; Duelle', '🏃 Läufe automatisch von Strava', '🥧 Eigener Server auf dem Raspberry Pi'];
const cfg = { clips: T.clips, segs: T.segs, outro: T.outro, ts: frames.map(f => f[1]), urls: frames.map(f => 'file://' + f[0]), icon, bullets };

(async () => {
  const mode = process.argv[2];
  if (mode === 'cues') {
    fs.writeFileSync(path.join(HERE, 'cues_smooth.json'), JSON.stringify({ bpm: 120, total_beats: T.TB, sections: T.secs, shots: T.shots }, null, 1));
    console.log('Takte', T.TB, '=', T.total, 's', JSON.stringify(T.secs)); return;
  }
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await page.goto('file://' + path.join(HERE, 'stage.html'));
  await page.evaluate(c => window.setup(c), cfg);
  if (mode === 'test') {
    for (const t of process.argv[3].split(',').map(Number)) { await page.evaluate(t => window.render(t), t); await page.screenshot({ path: path.join(HERE, `test_${t}.png`) }); }
  } else {
    const w = +process.argv[3], n = +process.argv[4], N = Math.ceil(T.total * FPS); fs.mkdirSync(OUT, { recursive: true });
    for (let i = w; i < N; i += n) {
      await page.evaluate(t => window.render(t), i / FPS);
      await page.screenshot({ path: path.join(OUT, `f_${String(i).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 94 });
      if (i % 120 === w) console.log('worker', w, 'Bild', i, '/', N);
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
