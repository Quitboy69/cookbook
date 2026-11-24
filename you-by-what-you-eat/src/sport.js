/* Laufen & Mini-Workouts: Laufplan nach Niveau, Ersatz-Workouts mit Anleitung, Timer-Abläufe */
import { S, save } from './store.js';
import { addDays, daysBetween, todayKey, wd } from './engine.js';

/* ---------- Übungen (ohne Geräte, für zuhause) ---------- */
export const EX = {
  hampelmann: { name: 'Hampelmann', emoji: '🙆', met: 8,
    how: ['Aufrecht stehen, Arme seitlich am Körper.', 'Springen und dabei Beine grätschen, Arme über den Kopf führen.', 'Zurückspringen in die Ausgangsposition – locker und rhythmisch.'],
    easy: 'Ohne Sprung: abwechselnd ein Bein zur Seite tippen.' },
  kniebeuge: { name: 'Kniebeugen', emoji: '🏋️', met: 5,
    how: ['Füße schulterbreit, Zehen leicht nach außen.', 'Po nach hinten unten schieben, als würdest du dich auf einen Sessel setzen.', 'Knie zeigen in Richtung Zehen, Rücken gerade, Fersen bleiben am Boden.', 'Aus den Fersen wieder hochdrücken.'],
    easy: 'Nur halb so tief gehen oder auf einen Sessel setzen und aufstehen.' },
  liegestuetz: { name: 'Liegestütze', emoji: '💪', met: 6,
    how: ['Hände etwas breiter als schulterbreit, Körper bildet eine gerade Linie.', 'Brust kontrolliert Richtung Boden senken, Ellbogen ca. 45° vom Körper.', 'Kraftvoll hochdrücken, Bauch fest.'],
    easy: 'Auf den Knien oder mit den Händen auf Tisch/Sofa-Lehne.' },
  ausfallschritt: { name: 'Ausfallschritte', emoji: '🦵', met: 5.5,
    how: ['Großer Schritt nach vorne.', 'Hinteres Knie Richtung Boden senken, vorderes Knie über dem Knöchel.', 'Zurückdrücken, Seite wechseln.'],
    easy: 'Kleinere Schritte, an der Wand festhalten.' },
  plank: { name: 'Unterarmstütz (Plank)', emoji: '🧱', met: 4,
    how: ['Unterarme unter den Schultern, Beine gestreckt auf den Zehenspitzen.', 'Körper eine gerade Linie – Po nicht hoch, nicht durchhängen.', 'Bauch und Po anspannen, ruhig weiteratmen.'],
    easy: 'Auf den Knien statt auf den Zehen.' },
  mountain: { name: 'Mountain Climber', emoji: '⛰️', met: 8,
    how: ['Liegestütz-Position, Hände unter den Schultern.', 'Abwechselnd die Knie zügig Richtung Brust ziehen.', 'Hüfte tief halten, wie beim Laufen am Boden.'],
    easy: 'Langsam abwechselnd ein Knie nach vorne setzen.' },
  bridge: { name: 'Glute Bridge', emoji: '🌉', met: 3.5,
    how: ['Rückenlage, Knie angewinkelt, Füße hüftbreit.', 'Po anspannen und Becken hochschieben bis Knie–Hüfte–Schulter eine Linie bilden.', '1 Sek halten, langsam absenken.'],
    easy: 'Kleinere Bewegung, kürzer halten.' },
  wandsitzen: { name: 'Wandsitzen', emoji: '🪑', met: 4,
    how: ['Rücken an die Wand lehnen.', 'Runterrutschen, bis die Knie ca. 90° gebeugt sind.', 'Position halten, Arme locker.'],
    easy: 'Weniger tief sitzen.' },
  wadenheben: { name: 'Wadenheben', emoji: '🦶', met: 3,
    how: ['Hüftbreit stehen, eventuell an der Wand festhalten.', 'Auf die Zehenspitzen hochdrücken.', 'Langsam wieder absenken.'],
    easy: 'Beidbeinig, langsamer.' },
  sumo: { name: 'Sumo-Kniebeugen', emoji: '🤼', met: 5,
    how: ['Breiter Stand, Zehen deutlich nach außen.', 'Gerader Oberkörper, tief in die Hocke.', 'Knie nach außen drücken, hochkommen.'],
    easy: 'Nicht so tief.' },
  seitstuetz: { name: 'Seitstütz (je Seite 20 s)', emoji: '📐', met: 4,
    how: ['Seitlich auf einen Unterarm stützen, Beine gestreckt übereinander.', 'Hüfte hochheben, Körper eine Linie.', 'Nach der Hälfte der Zeit Seite wechseln.'],
    easy: 'Unteres Knie am Boden lassen.' },
  deadbug: { name: 'Dead Bug', emoji: '🪲', met: 3.5,
    how: ['Rückenlage, Arme zur Decke, Beine angewinkelt in der Luft.', 'Gegengleich rechten Arm und linkes Bein langsam strecken.', 'Unterer Rücken bleibt am Boden. Zurück, Seite wechseln.'],
    easy: 'Nur die Beine bewegen.' },
  twist: { name: 'Russian Twist', emoji: '🔄', met: 4,
    how: ['Sitzen, Oberkörper leicht zurücklehnen, Füße am Boden.', 'Hände zusammen, Oberkörper abwechselnd nach links und rechts drehen.', 'Bauch fest, ruhig atmen.'],
    easy: 'Oberkörper aufrechter.' },
  superman: { name: 'Superman', emoji: '🦸', met: 3.5,
    how: ['Bauchlage, Arme nach vorne gestreckt.', 'Arme und Beine gleichzeitig leicht anheben.', '2 Sek halten, absenken.'],
    easy: 'Nur Arme oder nur Beine heben.' },
  beinheben: { name: 'Beinheben', emoji: '🦿', met: 3.5,
    how: ['Rückenlage, Hände unter den Po.', 'Gestreckte Beine langsam heben bis 90°.', 'Langsam senken, nicht ablegen.'],
    easy: 'Knie angewinkelt.' },
  highknees: { name: 'Kniehebelauf', emoji: '🏃', met: 8,
    how: ['Am Stand laufen.', 'Knie abwechselnd bis auf Hüfthöhe ziehen.', 'Arme schwingen mit.'],
    easy: 'Gehen statt laufen, Knie trotzdem hoch.' },
  skater: { name: 'Skater-Sprünge', emoji: '⛸️', met: 7,
    how: ['Seitlich von einem Bein aufs andere springen.', 'Hinteres Bein kreuzt hinter dem Standbein.', 'Weich landen.'],
    easy: 'Seitlicher Schritt statt Sprung.' },
  burpee: { name: 'Burpees (ohne Sprung)', emoji: '🔥', met: 8,
    how: ['Hocke, Hände auf den Boden.', 'Beine nach hinten in den Stütz setzen oder springen.', 'Beine zurück zu den Händen, aufstehen.'],
    easy: 'Beine nacheinander zurücksetzen.' },
  seilspringen: { name: 'Seilspringen ohne Seil', emoji: '🪢', met: 8,
    how: ['Locker auf den Fußballen hüpfen.', 'Hände kreisen, als hättest du ein Seil.', 'Klein und schnell springen.'],
    easy: 'Abwechselnd Fersen heben statt springen.' }
};

/* ---------- Mini-Workouts (Ersatz, wenn du nicht laufen willst) ---------- */
export const WORKOUTS = {
  ganzkoerper: { name: 'Ganzkörper-Express', emoji: '⚡', hue: 160, rounds: 2, work: 40, rest: 20, focus: 'Ganzer Körper',
    desc: 'Der Allrounder: Beine, Oberkörper, Rumpf und ein bisschen Puste.', ex: ['hampelmann', 'kniebeuge', 'liegestuetz', 'ausfallschritt', 'plank', 'mountain'] },
  beine: { name: 'Beine & Po', emoji: '🍑', hue: 20, rounds: 2, work: 40, rest: 20, focus: 'Unterkörper',
    desc: 'Stärkt genau die Muskeln, die du auch beim Laufen brauchst.', ex: ['kniebeuge', 'bridge', 'ausfallschritt', 'wandsitzen', 'wadenheben', 'sumo'] },
  core: { name: 'Core & Rumpf', emoji: '🎯', hue: 260, rounds: 2, work: 40, rest: 20, focus: 'Bauch & Rücken',
    desc: 'Starke Mitte = besserer Laufstil und weniger Rückenweh.', ex: ['plank', 'seitstuetz', 'deadbug', 'twist', 'beinheben', 'superman'] },
  cardio: { name: 'Cardio-Kick', emoji: '💥', hue: 0, rounds: 2, work: 35, rest: 25, focus: 'Ausdauer',
    desc: 'Bringt den Puls hoch wie ein Lauf – nur im Wohnzimmer.', ex: ['hampelmann', 'highknees', 'skater', 'burpee', 'mountain', 'seilspringen'] }
};
export function workoutMinutes(id) { const w = WORKOUTS[id]; return Math.round((w.ex.length * (w.work + w.rest) * w.rounds + 10) / 60); }
export function workoutKcal(id) {
  const w = WORKOUTS[id], kg = S.profile.weight;
  const met = w.ex.reduce((s, e) => s + EX[e].met, 0) / w.ex.length;
  return Math.round((met * w.work + 2.5 * w.rest) * w.ex.length * w.rounds / 3600 * kg);
}
/* Ablauf für den Timer */
export function workoutSeq(id) {
  const w = WORKOUTS[id], seq = [{ k: 'prep', sec: 10, label: 'Gleich geht’s los', ex: w.ex[0] }];
  for (let r = 0; r < w.rounds; r++) w.ex.forEach((e, i) => {
    seq.push({ k: 'work', sec: w.work, label: EX[e].name, ex: e, round: r + 1 });
    const last = r === w.rounds - 1 && i === w.ex.length - 1;
    if (!last) seq.push({ k: 'rest', sec: w.rest, label: 'Pause', ex: i + 1 < w.ex.length ? w.ex[i + 1] : w.ex[0] });
  });
  return seq;
}

/* ---------- Laufen ---------- */
export const LEVELS = {
  einsteiger: { name: 'Einsteiger', pace: 7.5, desc: 'Laufen und Gehen im Wechsel – jede Woche etwas mehr Laufen.' },
  mittel: { name: 'Mittel', pace: 6.5, desc: 'Du schaffst 20–30 Min am Stück.' },
  fortgeschritten: { name: 'Fortgeschritten', pace: 5.75, desc: 'Du läufst regelmäßig 45 Min und mehr.' }
};
export const ZONES = {
  1: { name: 'Zone 1', c: '#94A3B8', txt: 'Sehr locker – Gehen, Aufwärmen' },
  2: { name: 'Zone 2', c: '#22C55E', txt: 'Locker – du kannst noch ganze Sätze reden' },
  3: { name: 'Zone 3', c: '#EAB308', txt: 'Zügig – reden geht nur noch in kurzen Sätzen' },
  4: { name: 'Zone 4', c: '#F97316', txt: 'Hart – nur noch einzelne Wörter' },
  5: { name: 'Zone 5', c: '#EF4444', txt: 'Maximal – nur kurz' }
};
const B = (k, min, z, label) => ({ k, sec: Math.round(min * 60), z, label });

export function runWeek(k) {
  const start = S.profile.runStart || todayKey();
  return Math.max(0, Math.floor(daysBetween(start, k) / 7));
}
export const isRunDay = k => (S.profile.run || []).includes(wd(k));

/* Art der Einheit je nach Position in der Woche */
function runType(k) {
  const days = [...(S.profile.run || [])].sort();
  const idx = days.indexOf(wd(k));
  const n = days.length;
  const pattern = n <= 1 ? ['easy'] : n === 2 ? ['easy', 'long'] : n === 3 ? ['easy', 'interval', 'long'] : ['easy', 'interval', 'easy', 'long', 'easy', 'interval', 'easy'];
  return pattern[Math.max(0, idx) % pattern.length];
}

export function runSession(k) {
  let lvl = S.profile.runLevel || 'einsteiger', w = runWeek(k);
  const type = runType(k);
  if (lvl === 'einsteiger' && w >= 8) { lvl = 'mittel'; w -= 8; }   // Lauf-Geh-Programm geschafft → sanft weiter
  const warm = B('warm', 5, 1, 'Einlaufen: zügig gehen');
  const cool = B('cool', 5, 1, 'Auslaufen: locker gehen');
  let blocks = [], name, desc, emoji, zone;
  if (lvl === 'einsteiger' && w < 8) {
    // Lauf-Geh-Programm: Laufanteil steigt jede Woche
    const run = Math.min(8, 1 + w * (type === 'long' ? 1 : 0.75));
    const walk = w < 3 ? 1.5 : 1;
    const main = type === 'long' ? 28 : 22;
    const reps = Math.max(3, Math.round(main / (run + walk)));
    for (let i = 0; i < reps; i++) { blocks.push(B('run', run, type === 'interval' && i % 2 ? 3 : 2, type === 'interval' && i % 2 ? 'Laufen – etwas zügiger' : 'Locker laufen')); if (i < reps - 1) blocks.push(B('walk', walk, 1, 'Gehen')); }
    name = type === 'long' ? 'Langer Lauf-Geh-Mix' : type === 'interval' ? 'Lauf-Geh mit Tempo' : 'Lauf-Geh-Intervalle';
    desc = `${reps}× ${fmtMin(run)} laufen, dazwischen ${fmtMin(walk)} gehen. Woche ${w + 1} von 8 – dann läufst du 30 Min am Stück.`;
    emoji = '🚶‍♂️'; zone = 2;
  } else if (type === 'interval') {
    const reps = lvl === 'fortgeschritten' ? 6 : 5, on = lvl === 'fortgeschritten' ? 3 : 2;
    blocks.push(B('run', 8, 2, 'Locker einlaufen'));
    for (let i = 0; i < reps; i++) { blocks.push(B('fast', on, 4, 'Zügig laufen')); blocks.push(B('run', 2, 2, 'Locker traben')); }
    name = 'Intervalle'; desc = `${reps}× ${on} Min zügig (Zone 4), dazwischen 2 Min locker. Macht dich schneller.`; emoji = '⚡'; zone = 4;
  } else if (type === 'long') {
    const min = lvl === 'fortgeschritten' ? Math.min(75, 55 + w * 2) : Math.min(60, 35 + w * 2);
    blocks.push(B('run', min, 2, 'Locker & gleichmäßig'));
    name = 'Langer Lauf'; desc = `${min} Min ruhig in Zone 2. Langsam ist richtig – es geht um die Dauer.`; emoji = '🌄'; zone = 2;
  } else {
    const min = lvl === 'fortgeschritten' ? Math.min(50, 40 + w) : (lvl === 'einsteiger' ? 30 : Math.min(40, 28 + w));
    blocks.push(B('run', min, 2, 'Locker laufen'));
    name = 'Lockerer Lauf'; desc = `${min} Min entspannt in Zone 2 – du solltest dich noch unterhalten können.`; emoji = '🏃'; zone = 2;
  }
  blocks = [warm, ...blocks, cool];
  const sec = blocks.reduce((s, b) => s + b.sec, 0);
  const kg = S.profile.weight, pace = LEVELS[lvl].pace;
  const met = { warm: 4, cool: 3.5, walk: 3.8, run: 8.3, fast: 10.5 };
  const kcal = Math.round(blocks.reduce((s, b) => s + met[b.k] * kg * b.sec / 3600, 0));
  const km = blocks.reduce((s, b) => s + b.sec / 60 / (b.k === 'fast' ? pace * 0.82 : b.k === 'run' ? pace : 12), 0);
  return { k, type, name, desc, emoji, zone, blocks, min: Math.round(sec / 60), kcal, km: Math.round(km * 10) / 10, week: runWeek(k) + 1, level: lvl };
}
const fmtMin = m => (m % 1 ? String(m).replace('.', ',') : m) + ' Min';

/* Ersatz-Workout für einen Tag (wechselt durch) */
export function workoutFor(k) {
  const keys = Object.keys(WORKOUTS);
  const a = S.act[k];
  if (a && a.workout) return a.workout;
  return keys[(daysBetween('2026-01-05', k) + keys.length * 100) % keys.length];
}

/* ---------- Aktivitäts-Status ---------- */
export const actOf = k => S.act[k] || null;
export function markRun(k, km, min, kcal) { S.act[k] = { type: 'run', done: true, km, min, kcal, at: Date.now() }; save(); }
export function markWorkout(k, id, kcal, min) { S.act[k] = { type: 'workout', done: true, workout: id, kcal, min, at: Date.now() }; save(); }
export function chooseWorkout(k, id) { S.act[k] = { type: 'workout', done: false, workout: id || workoutFor(k) }; save(); }
export function undoAct(k) {
  Object.values(S.runs || {}).forEach(r => { if (r.date === k) r.hidden = true; });   // eingelesene Läufe dieses Tages nicht gleich wieder holen
  delete S.act[k]; save();
}
export function burned(k) { const a = S.act[k]; return (a && a.done ? a.kcal || 0 : 0) + (S.wlog || []).filter(w => w.d === k).reduce((x, w) => x + (w.kcal || 0), 0); }
export function plannedActivity(k) {
  if (!isRunDay(k)) return null;
  const a = S.act[k];
  if (a && a.type === 'workout') { const id = a.workout; return { kind: 'workout', id, done: !!a.done, min: workoutMinutes(id), kcal: a.kcal || workoutKcal(id) }; }
  const r = runSession(k);
  return { kind: 'run', session: r, done: !!(a && a.done), min: a && a.min || r.min, kcal: a && a.kcal || r.kcal, km: a && a.km };
}
export function weekStats(fromKey) {
  let runs = 0, workouts = 0, km = 0, min = 0, kcal = 0, planned = 0;
  for (let i = 0; i < 7; i++) {
    const k = addDays(fromKey, i);
    if (isRunDay(k)) planned++;
    const a = S.act[k]; if (!a || !a.done) continue;
    if (a.type === 'run') { runs++; km += a.km || 0; } else workouts++;
    min += a.min || 0; kcal += a.kcal || 0;
  }
  return { runs, workouts, km: Math.round(km * 10) / 10, min, kcal, planned, done: runs + workouts };
}
export function streak() {
  let n = 0, k = todayKey();
  if (isRunDay(k) && !(S.act[k] && S.act[k].done)) k = addDays(k, -1);
  for (let i = 0; i < 120; i++) {
    if (isRunDay(k)) { if (S.act[k] && S.act[k].done) n++; else break; }
    k = addDays(k, -1);
  }
  return n;
}
