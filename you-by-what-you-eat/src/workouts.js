/* Krafttraining 2.0: Übungen filtern, Workouts erzeugen (12 Typen × 4 Level × Zuhause/Gym), Pläne, Verlauf, Rekorde, Punkte */
import { EXERCISES } from './exercises.js';
import { S, save } from './store.js';
import { todayKey, addDays, wd, keyOf } from './engine.js';

export const EXI = Object.fromEntries(EXERCISES.map(e => [e.id, e]));
export const LEVEL = { 1: { n: 'Einsteiger', c: '#22C55E' }, 2: { n: 'Amateur', c: '#3B82F6' }, 3: { n: 'Fortgeschritten', c: '#F59E0B' }, 4: { n: 'Profi', c: '#EF4444' } };
export const EQUIP = { koerper: 'Ohne Geräte', matte: 'Boden / Matte', moebel: 'Stuhl, Bank, Stufe', stange: 'Klimmzugstange / Barren' };
export const TYPE = { kraft: 'Kraft', core: 'Core', cardio: 'Cardio', plyo: 'Sprungkraft', dehnen: 'Dehnen', mobil: 'Mobilität' };
export const HOME_EQ = ['koerper', 'matte', 'moebel', 'stange'];
export const BASE_EQ = ['koerper', 'matte', 'moebel'];   // hat jeder zu Hause
export const MET = { kraft: 5, core: 3.8, cardio: 8, plyo: 8, dehnen: 2.3, mobil: 2.5 };

export const fit = () => { S.fit = S.fit || { level: 0, place: 'home', eq: BASE_EQ.slice(), plan: null, planStart: null }; if (!S.fit.eq || S.fit.eq.some(q => !HOME_EQ.includes(q))) S.fit.eq = BASE_EQ.concat((S.fit.eq || []).includes('stange') ? ['stange'] : []); return S.fit; };
export const hasBar = () => fit().eq.includes('stange');
export const userLevel = () => fit().level || ({ einsteiger: 1, mittel: 2, fortgeschritten: 3 }[S.profile.runLevel] || 1);

/* ---------- Satz-/Wiederholungs-Schema je Level ---------- */
export function scheme(ex, lvl, kind) {
  const L = Math.max(1, Math.min(4, lvl));
  if (kind === 'hiit') return { sets: [2, 3, 4, 5][L - 1], work: [20, 30, 40, 45][L - 1], rest: [40, 30, 20, 15][L - 1], timed: true };
  if (kind === 'mobil' || ex.t === 'dehnen' || ex.t === 'mobil') return { sets: 1, work: ex.uni ? 30 : 40, rest: 10, timed: true };
  if (ex.t === 'cardio' && ex.eq === 'cardio') return { sets: 1, work: [8, 10, 15, 20][L - 1] * 60, rest: 30, timed: true };
  if (ex.mo === 'time') return { sets: [2, 3, 3, 4][L - 1], work: [20, 30, 45, 60][L - 1], rest: [45, 45, 60, 60][L - 1], timed: true };
  if (ex.t === 'core') return { sets: [2, 3, 3, 4][L - 1], reps: [10, 12, 15, 20][L - 1], rest: [45, 45, 60, 60][L - 1] };
  if (ex.t === 'plyo') return { sets: [2, 3, 4, 5][L - 1], reps: [6, 8, 10, 10][L - 1], rest: [60, 75, 90, 90][L - 1] };
  const heavy = ex.eq === 'lh' && ex.l >= 3;
  return { sets: [2, 3, 4, 5][L - 1], reps: heavy && L === 4 ? 5 : [12, 10, 10, 8][L - 1], rest: [60, 75, 90, heavy ? 150 : 120][L - 1] };
}
export const weighted = ex => ['kh', 'lh', 'kb', 'kabel', 'masch', 'band'].includes(ex.eq) && ex.mo === 'reps';
export const schemeText = (ex, sc) => sc.timed ? (sc.work >= 120 ? `${Math.round(sc.work / 60)} Min` : `${sc.sets}× ${sc.work} s${ex.uni ? ' je Seite' : ''}`) : `${sc.sets}× ${sc.reps}${ex.uni ? ' je Seite' : ''}`;

/* ---------- Filter ---------- */
export function filterEx({ q = '', muscle = '', level = 0, eq = '', place = '', type = '' } = {}) {
  const n = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const qq = n(q.trim());
  return EXERCISES.filter(e => (!qq || n(e.n).includes(qq)) && (!muscle || e.p.includes(muscle) || (muscle.startsWith('~') && e.s2.includes(muscle.slice(1))))
    && (!level || e.l === level) && (!eq || e.eq === eq) && (!type || e.t === type)
    && (!place || place === 'gym' || HOME_EQ.includes(e.eq)));
}

/* ---------- Workout-Generator ---------- */
// Slots: [primäre Muskeln, erlaubte Typen]
const T = {
  ganzkoerper: { n: 'Ganzkörper', e: '⚡', d: 'Beine, Brust, Rücken und Rumpf – nur mit dem eigenen Körper.', slots: [[['quads', 'glutes'], ['kraft']], [['chest'], ['kraft']], [['lats', 'midback'], ['kraft'], ['lowerback', 'glutes']], [['hamstrings', 'glutes'], ['kraft']], [['triceps', 'shoulders'], ['kraft']], [['abs', 'obliques'], ['core']]] },
  oberkoerper: { n: 'Oberkörper', e: '💪', d: 'Brust, Schultern, Rücken und Arme.', slots: [[['chest'], ['kraft']], [['lats', 'midback'], ['kraft'], ['lowerback']], [['triceps'], ['kraft']], [['chest', 'shoulders'], ['kraft']], [['midback', 'lats', 'biceps'], ['kraft'], ['lowerback', 'abs']], [['triceps', 'chest'], ['kraft']], [['abs'], ['core']]] },
  unterkoerper: { n: 'Beine & Po', e: '🦵', d: 'Kniebeugen, Ausfallschritte, Brücken, Sprünge.', slots: [[['quads'], ['kraft']], [['glutes', 'hamstrings'], ['kraft']], [['quads', 'glutes'], ['kraft']], [['hamstrings'], ['kraft']], [['glutes', 'abductors'], ['kraft']], [['quads', 'glutes'], ['plyo']]] },
  push: { n: 'Push: Brust, Schultern, Trizeps', e: '🔥', d: 'Alle Liegestütz-Varianten und Dips.', slots: [[['chest'], ['kraft']], [['triceps'], ['kraft']], [['chest'], ['kraft']], [['shoulders', 'chest'], ['kraft']], [['triceps'], ['kraft']], [['chest'], ['kraft', 'plyo']]] },
  pull: { n: 'Pull: Rücken & Bizeps', e: '🧗', d: 'Klimmzüge, Rudern, Rückenstrecker.', slots: [[['lats'], ['kraft'], ['lowerback']], [['midback'], ['kraft'], ['lowerback', 'abs']], [['lats', 'midback'], ['kraft'], ['lowerback']], [['biceps', 'abs'], ['kraft', 'core'], ['abs']], [['lowerback'], ['core', 'kraft']], [['abs'], ['core']]] },
  po: { n: 'Po-Fokus', e: '🍑', d: 'Glute-Programm: Brücken, Kickbacks, Ausfallschritte.', slots: [[['glutes'], ['kraft']], [['glutes', 'hamstrings'], ['kraft']], [['quads', 'glutes'], ['kraft']], [['abductors', 'glutes'], ['kraft', 'plyo']], [['glutes'], ['kraft']], [['hamstrings', 'glutes'], ['kraft']]] },
  bauch: { n: 'Bauch & Core', e: '🎯', d: 'Gerader, seitlicher und tiefer Bauch.', slots: [[['abs'], ['core']], [['obliques'], ['core']], [['abs'], ['core']], [['lowerback', 'abs'], ['core']], [['obliques', 'abs'], ['core']], [['abs'], ['core']]] },
  arme: { n: 'Arme & Schultern', e: '💥', d: 'Trizeps, Bizeps und Schultern ohne Hanteln.', slots: [[['triceps'], ['kraft']], [['shoulders', 'chest'], ['kraft']], [['biceps', 'lats'], ['kraft', 'core'], ['triceps']], [['triceps'], ['kraft']], [['chest', 'triceps'], ['kraft']], [['abs', 'triceps'], ['core']]] },
  ruecken: { n: 'Gesunder Rücken', e: '🧘', d: 'Haltung, Rumpf, Mobilität – gegen langes Sitzen.', slots: [[['lowerback'], ['core', 'kraft']], [['abs'], ['core']], [['glutes'], ['kraft', 'mobil']], [['*'], ['mobil']], [['*'], ['dehnen']], [['*'], ['dehnen']]] },
  hiit: { n: 'HIIT Fatburner', e: '⏱️', d: 'Intervalle: kurz, intensiv, Puls hoch.', kind: 'hiit', slots: [[['*'], ['plyo', 'cardio']], [['quads', 'glutes'], ['kraft', 'plyo']], [['abs', 'obliques'], ['core']], [['chest'], ['kraft']], [['*'], ['plyo', 'cardio']], [['abs'], ['core']]] },
  cardio: { n: 'Cardio leise (ohne Springen)', e: '🤫', d: 'Wohnungsfreundlich: Puls hoch, ohne Lärm für die Nachbarn.', kind: 'hiit', quiet: true, slots: [[['*'], ['cardio']], [['quads', 'glutes'], ['kraft']], [['abs', 'obliques'], ['core']], [['chest'], ['kraft']], [['*'], ['cardio', 'core']], [['glutes'], ['kraft']]] },
  sprung: { n: 'Sprungkraft & Speed', e: '🚀', d: 'Explosive Beine – macht dich schneller beim Laufen.', slots: [[['quads'], ['plyo']], [['glutes', 'adductors'], ['plyo']], [['quads', 'hamstrings'], ['plyo']], [['quads', 'glutes'], ['kraft']], [['*'], ['plyo', 'cardio']], [['abs'], ['core']]] },
  beine: { n: 'Beine Power', e: '🏋️', d: 'Einbeinig, langsam, explosiv – schwere Beine ohne Gewichte.', slots: [[['quads'], ['kraft']], [['hamstrings'], ['kraft']], [['quads', 'glutes'], ['kraft']], [['quads'], ['plyo']], [['glutes', 'hamstrings'], ['kraft']], [['quads', 'glutes'], ['plyo']]] },
  mobil: { n: 'Mobility & Dehnen', e: '🌿', d: 'Beweglichkeit, Regeneration, ruhiger Puls.', kind: 'mobil', slots: [[['*'], ['mobil']], [['*'], ['mobil']], [['*'], ['dehnen']], [['*'], ['dehnen', 'mobil']], [['*'], ['dehnen']], [['*'], ['dehnen']], [['*'], ['dehnen']]] },
  morgen: { n: 'Morgen-Routine 10 Min', e: '🌅', d: 'Wach werden: mobilisieren, aktivieren, losstarten.', kind: 'mobil', slots: [[['*'], ['mobil']], [['*'], ['mobil']], [['glutes'], ['kraft']], [['abs'], ['core']], [['quads'], ['kraft']], [['*'], ['dehnen']]] }
};
export const WTYPES = T;
const OLY = new Set(['power_clean', 'clean_and_jerk', 'snatch', 'overhead_squat']);   // olympische Lifts nur gezielt, nicht im Zufalls-Workout
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function buildWorkout(type, lvl, place, seed = 0) {
  const t = T[type]; if (!t) return null;
  let allowed = fit().eq;
  if (t.kind === 'mobil') allowed = allowed.filter(q => q !== 'stange');
  const used = new Set(); const items = [];
  const R = (e) => (hash(e.id + seed + type) % 1000) / 1000;
  const loud = id => /jump|hop|bound|leap|skip|kick/i.test(id) && !/flutter/i.test(id);
  const pick = (muscles, types) => {
    let pool = EXERCISES.filter(e => types.includes(e.t) && (muscles[0] === '*' || muscles.some(m => e.p.includes(m))) && allowed.includes(e.eq) && !used.has(e.id) && !OLY.has(e.id) && !(t.quiet && (e.t === 'plyo' || loud(e.id))));
    const ok = pool.filter(e => e.l <= lvl && e.l >= Math.max(1, lvl - 2));
    pool = ok.length ? ok : pool.filter(e => e.l <= lvl).length ? pool.filter(e => e.l <= lvl) : pool;
    if (!pool.length) return null;
    const score = e => R(e) + Math.abs(lvl - e.l) * 0.3 - (e.t === 'kraft' && types.includes('kraft') && e.l === lvl ? 0.15 : 0);
    pool.sort((a, b) => score(a) - score(b)); return pool[0];
  };
  t.slots.forEach(([muscles, types, fb]) => {
    const e = pick(muscles, types) || (fb ? pick(fb, ['kraft', 'core']) : null); if (!e) return;
    used.add(e.id); items.push({ ex: e.id, ...scheme(e, lvl, t.kind) });
  });
  while (items.length < 5) { const e = pick(['*'], t.kind === 'mobil' ? ['dehnen', 'mobil'] : ['core', 'kraft']); if (!e) break; used.add(e.id); items.push({ ex: e.id, ...scheme(e, lvl, t.kind) }); }
  const sec = items.reduce((s, it) => s + it.sets * ((it.timed ? it.work : it.reps * 3.2) + it.rest) + 25, 0);
  const kcal = Math.round(items.reduce((s, it) => { const e = EXI[it.ex]; return s + (MET[e.t] || 5) * S.profile.weight * it.sets * ((it.timed ? it.work : it.reps * 3.2) + it.rest * 0.4) / 3600; }, 0));
  const noBar = type === 'pull' && !allowed.includes('stange');
  return { id: `${type}.${lvl}.${place}.${seed}`, type, lvl, place, n: noBar ? 'Rücken ohne Stange' : t.n, e: t.e, d: noBar ? 'Rückenstrecker und Rumpf – mit Klimmzugstange wird daraus ein echtes Pull-Workout.' : t.d, kind: t.kind || 'kraft', items, min: Math.max(5, Math.round(sec / 60)), kcal };
}
export function parseWid(id) { const [type, l, place, seed] = String(id).split('.'); return buildWorkout(type, +l || 1, place || 'home', +seed || 0); }
export function catalog(lvl, place) { return Object.keys(T).map(k => buildWorkout(k, lvl, place, weekSeed())); }
export const weekSeed = () => Math.floor((Date.now() / 86400000 + 3) / 7);   // jede Woche etwas andere Übungen

/* ---------- Pläne ---------- */
export const PLANS = {
  start: { n: 'Fit-Start', e: '🌱', for: 'Alle', d: '3× Ganzkörper pro Woche – der beste Einstieg.', seq: ['ganzkoerper', 'ganzkoerper', 'mobil'] },
  shape: { n: 'Shape & Po', e: '🍑', for: 'Beliebt bei Frauen', d: 'Po & Beine im Fokus, dazu Oberkörper und HIIT.', seq: ['po', 'oberkoerper', 'unterkoerper', 'hiit'] },
  build: { n: 'Muskelaufbau Ober-/Unterkörper', e: '🦍', for: 'Beliebt bei Männern', d: 'Liegestütz-Varianten, Dips, Beine – Masse ohne Hanteln.', seq: ['oberkoerper', 'unterkoerper', 'push', 'beine'] },
  cali: { n: 'Calisthenics', e: '🤸', for: 'Mit Klimmzugstange', d: 'Push, Pull, Beine, Core – wie im Street-Workout.', seq: ['push', 'pull', 'unterkoerper', 'bauch'] },
  burn: { n: 'Fatburner', e: '🔥', for: 'Alle', d: 'HIIT + Ganzkörper für maximale Kalorien.', seq: ['hiit', 'ganzkoerper', 'cardio', 'bauch'] },
  runner: { n: 'Läufer-Power', e: '🏃', for: 'Für dein Lauftraining', d: 'Sprungkraft, Beine, Mobilität – schneller und verletzungsfrei.', seq: ['sprung', 'unterkoerper', 'mobil'] },
  back: { n: 'Gesunder Rücken', e: '🧘', for: 'Alle', d: 'Für alle, die viel sitzen.', seq: ['ruecken', 'mobil', 'bauch'] }
};
export const defaultPlan = () => S.profile.sex === 'w' ? 'shape' : S.profile.sex === 'm' ? 'build' : 'start';
export const activePlan = () => PLANS[fit().plan] ? fit().plan : defaultPlan();
/* Workout für einen Tag: an Krafttrainingstagen der Reihe nach aus dem Plan */
export function workoutOfDay(k) {
  const days = (S.profile.train || []).slice().sort();
  if (!days.includes(wd(k))) return null;
  const p = PLANS[activePlan()]; const start = fit().planStart || '2026-01-05';
  let n = 0; for (let d = start; d < k; d = addDays(d, 1)) if (days.includes(wd(d))) n++;
  const type = p.seq[n % p.seq.length]; const place = p.place || fit().place;
  return buildWorkout(type, userLevel(), place, weekSeed());
}

/* ---------- Verlauf, Rekorde, Punkte ---------- */
export const wlog = () => (S.wlog = S.wlog || []);
export const e1rm = (kg, reps) => kg * (1 + reps / 30);
export function lastSets(exId) { for (let i = wlog().length - 1; i >= 0; i--) { const s = wlog()[i].sets.filter(x => x.ex === exId); if (s.length) return s; } return []; }
export function bestOf(exId) { let b = null; for (const w of wlog()) for (const s of w.sets) if (s.ex === exId && s.reps) { const v = s.kg ? e1rm(s.kg, s.reps) : s.reps; if (!b || v > b.v) b = { v, kg: s.kg || 0, reps: s.reps, d: w.d }; } return b; }
export function saveSession(wk, sets, sec) {
  const prs = [];
  for (const s of sets) if (s.reps) { const b = bestOf(s.ex); const v = s.kg ? e1rm(s.kg, s.reps) : s.reps; if (b && v > b.v + 0.01) { const p = prs.find(x => x.ex === s.ex); if (p) { if (s.reps > p.reps) Object.assign(p, { kg: s.kg || 0, reps: s.reps }); } else prs.push({ ex: s.ex, kg: s.kg || 0, reps: s.reps }); } }   // Rekord = mehr Wiederholungen als je zuvor
  const vol = Math.round(sets.reduce((v, s) => v + (s.kg || 0) * (s.reps || 0), 0));
  const kcal = Math.round(sets.reduce((v, s) => { const e = EXI[s.ex]; return v + (MET[e.t] || 5) * S.profile.weight * ((s.sec || (s.reps || 10) * 3.2) + 40) / 3600; }, 0));
  const min = Math.max(1, Math.round(sec / 60));
  const pts = points({ kind: 'workout', min, prs: prs.length });
  const rec = { id: 'w' + Date.now(), d: todayKey(), t: Date.now(), wid: wk.id, n: wk.n, e: wk.e, type: wk.type, lvl: wk.lvl, min, kcal, vol, sets, prs, pts };
  wlog().push(rec); save();
  return rec;
}
export const points = ({ kind, min = 0, km = 0, prs = 0 }) => kind === 'run' ? Math.round(10 + km * 10) : Math.round(10 + Math.min(60, min) + prs * 5);
export function weekKey(k = todayKey()) { return addDays(k, -wd(k)); }
/* Wochenübersicht inkl. Läufe aus Strava/Timer */
export function weekSummary(from = weekKey()) {
  const to = addDays(from, 7); let workouts = 0, min = 0, vol = 0, kcal = 0, pts = 0, km = 0, runs = 0;
  for (const w of wlog()) if (w.d >= from && w.d < to) { workouts++; min += w.min; vol += w.vol; kcal += w.kcal; pts += w.pts; }
  for (let d = from; d < to; d = addDays(d, 1)) { const a = S.act[d]; if (a && a.done && a.type === 'run') { runs++; km += a.km || 0; min += a.min || 0; kcal += a.kcal || 0; pts += points({ kind: 'run', km: a.km || 0 }); } else if (a && a.done) { min += a.min || 0; kcal += a.kcal || 0; pts += 10 + Math.min(30, a.min || 0); } }
  return { workouts, runs, km: Math.round(km * 10) / 10, min, vol, kcal, pts };
}
/* Muskel-Heatmap: Sätze je Muskel in den letzten 7 Tagen (primär 1, sekundär 0,5), normiert */
export function muscleHeat(days = 7) {
  const from = addDays(todayKey(), -days + 1); const sc = {};
  for (const w of wlog()) if (w.d >= from) for (const s of w.sets) { const e = EXI[s.ex]; if (!e) continue; e.p.forEach(m => sc[m] = (sc[m] || 0) + 1); e.s2.forEach(m => sc[m] = (sc[m] || 0) + 0.5); }
  const out = {}; for (const [m, v] of Object.entries(sc)) out[m] = Math.min(1, v / 10);
  return out;
}
export function weeksBack(n = 8) { const res = []; let k = weekKey(); for (let i = 0; i < n; i++) { res.unshift({ k, ...weekSummary(k) }); k = addDays(k, -7); } return res; }
export function streakDays() { let n = 0, k = todayKey(); const active = d => wlog().some(w => w.d === d) || (S.act[d] && S.act[d].done); if (!active(k)) k = addDays(k, -1); while (active(k) && n < 400) { n++; k = addDays(k, -1); } return n; }
