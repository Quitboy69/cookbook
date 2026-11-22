/* Rechenkern: Bedarf, Preise (gelernt aus Kassenbons), Plan mit Abwechslung, Bewertungen */
import { ING, DISHES, STORES } from './data.js';
import { S, save } from './store.js';

/* ---------- Datum ---------- */
export const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const DS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const keyOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const dateOf = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const todayKey = () => keyOf(new Date());
export const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
export const wd = k => (dateOf(k).getDay() + 6) % 7;            // 0 = Montag
export const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 86400000);
export const isWeekend = k => wd(k) >= 5;

/* ---------- Format ---------- */
export const fmtInt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const dec = (n, d = 2) => (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ',');
export const eur = n => dec(n) + ' €';
export const lit = n => String(Math.round(n * 100) / 100).replace('.', ',');

/* ---------- Seeded Zufall (Plan bleibt stabil) ---------- */
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const rand = seed => { let t = hash(seed) + 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* ---------- Nährwerte aus den Zutaten berechnen ---------- */
export function nutOf(id) {
  const d = DISHES[id], t = [0, 0, 0, 0];
  for (const [ing, amt] of Object.entries(d.need)) {
    const g = ING[ing]; if (!g || !g.n) continue;
    const f = g.unit === 'stk' ? amt : amt * 10;        // je Stück bzw. je 100 g/ml
    for (let i = 0; i < 4; i++) t[i] += g.n[i] * f;
  }
  const div = d.slot === 'a' ? 6 : 1;
  return { kcal: Math.round(t[0] / div / 5) * 5, prot: Math.round(t[1] / div), kh: Math.round(t[2] / div), fat: Math.round(t[3] / div) };
}
for (const id of Object.keys(DISHES)) Object.assign(DISHES[id], nutOf(id));

/* ---------- Bedarf ---------- */
export function bmi(p = S.profile) { return p.weight / Math.pow(p.height / 100, 2); }
export function bmiLabel(b) { return b < 18.5 ? 'Untergewicht' : b < 25 ? 'Normalgewicht' : b < 30 ? 'Übergewicht' : 'Adipositas'; }
export const GOALS = {
  muskel:   { name: 'Muskelaufbau', add: 300, protein: 1.8, desc: 'Leichter Kalorienüberschuss (+300 kcal) und viel Eiweiß – Ziel +0,25 bis 0,5 kg pro Woche.' },
  halten:   { name: 'Gewicht halten', add: 0, protein: 1.4, desc: 'So viel essen, wie du verbrauchst – Gewicht bleibt stabil.' },
  abnehmen: { name: 'Leicht abnehmen', add: -400, protein: 1.8, desc: 'Moderates Defizit (−400 kcal), viel Eiweiß, damit die Muskeln bleiben.' }
};
export function targets(p = S.profile) {
  const age = p.age || 25;
  const sexAdj = p.sex === 'w' ? -161 : p.sex === 'm' ? 5 : -78;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * age + sexAdj;      // Mifflin-St Jeor
  const tdays = (p.train || []).length;              // Krafttraining; Laufen kommt als „verbrannt“ dazu
  const pal = tdays >= 5 ? 1.725 : tdays >= 3 ? 1.55 : tdays >= 1 ? 1.375 : 1.2;
  const tdee = bmr * pal;
  const g = GOALS[p.goal] || GOALS.muskel;
  const kcal = Math.round((tdee + g.add) / 10) * 10;
  const prot = Math.round(p.weight * g.protein);
  const water = Math.round(p.weight * 0.035 * 4) / 4;                    // ≈ 35 ml/kg
  const fat = Math.round(kcal * 0.28 / 9);                                // ≈ 28 % der Energie
  const kh = Math.round((kcal - prot * 4 - fat * 9) / 4);
  return { bmr: Math.round(bmr), pal, tdee: Math.round(tdee), kcal, prot, kh, fat, water, goal: g, estimatedAge: !p.age, estimatedSex: !p.sex };
}

/* ---------- Preise lernen ---------- */
let priceCache = null;
export function invalidatePrices() { priceCache = null; }

function packPrice(it, ing) {
  const g = ING[ing]; if (!g) return null;
  const qty = it.qty > 0 ? it.qty : 1;
  const total = Math.max(0, it.price - (it.disc || 0));
  const reg = it.price;
  let per = null, perReg = null;
  if (it.kg && g.unit === 'kg') { per = total / it.kg * g.pack; perReg = reg / it.kg * g.pack; }
  else if (it.size && it.sizeUnit === g.unit) { per = total / qty / it.size * g.pack; perReg = reg / qty / it.size * g.pack; }
  else { per = total / qty; perReg = reg / qty; }
  // Plausibilitäts-Check: falsch erkannte Packungsgrößen ignorieren
  if (per < g.base * 0.2 || per > g.base * 5) {
    const alt = total / qty;
    if (alt >= g.base * 0.2 && alt <= g.base * 5) { per = alt; perReg = reg / qty; } else return null;
  }
  return { per, perReg };
}
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function learned() {
  if (priceCache) return priceCache;
  const today = todayKey();
  const byIng = {};      // ing -> store -> { obs:[] }
  const other = {};      // store -> name -> [{d, price}]
  for (const r of S.receipts) {
    for (const it of r.items) {
      if (!it.ing) {
        if (!it.name || it.price <= 0) continue;
        ((other[r.store] = other[r.store] || {})[it.name] = other[r.store][it.name] || []).push({ d: r.date, price: it.price, promo: !!it.promo });
        continue;
      }
      const pp = packPrice(it, it.ing); if (!pp) continue;
      const st = ((byIng[it.ing] = byIng[it.ing] || {})[r.store] = byIng[it.ing][r.store] || { obs: [] });
      st.obs.push({ d: r.date, per: pp.per, reg: pp.perReg, promo: !!it.promo || (it.disc || 0) > 0, pct: it.pct || (it.disc ? Math.round(it.disc / it.price * 100) : 0), rid: r.id, name: it.name });
    }
  }
  const info = {};
  for (const ing of Object.keys(byIng)) {
    const per = {};
    for (const store of Object.keys(byIng[ing])) {
      const obs = byIng[ing][store].obs.sort((a, b) => a.d < b.d ? -1 : 1);
      const recent = obs.filter(o => daysBetween(o.d, today) <= 120);
      const normal = recent.filter(o => !o.promo).map(o => o.per);
      const regular = median(normal.length ? normal : recent.map(o => o.reg)) ?? median(obs.map(o => o.reg));
      const promos = obs.filter(o => o.promo);
      const lastPromo = promos[promos.length - 1] || null;
      const promoNow = lastPromo && daysBetween(lastPromo.d, today) <= 6 ? lastPromo : null;
      // Aktions-Rhythmus: Abstand zwischen Aktionen
      const pd = [...new Set(promos.map(o => o.d))];
      let rhythm = null;
      if (pd.length >= 2) {
        const gaps = []; for (let i = 1; i < pd.length; i++) { const g = daysBetween(pd[i - 1], pd[i]); if (g > 3) gaps.push(g); }
        if (gaps.length) { const avg = gaps.reduce((s, x) => s + x, 0) / gaps.length; rhythm = { every: Math.round(avg), next: addDays(pd[pd.length - 1], Math.round(avg)) }; }
      }
      per[store] = { regular, last: obs[obs.length - 1], n: obs.length, promoN: promos.length, lastPromo, promoNow, rhythm, obs,
        eff: promoNow ? Math.min(promoNow.per, regular ?? promoNow.per) : regular };
    }
    info[ing] = per;
  }
  priceCache = { info, other };
  return priceCache;
}

/* Preis, mit dem gerechnet wird: günstigster Markt (oder Stamm-Markt) */
export function price(ing) {
  const g = ING[ing];
  const per = learned().info[ing];
  const mode = S.profile.priceMode;
  if (per) {
    let best = null;
    for (const [store, x] of Object.entries(per)) {
      if (x.eff == null) continue;
      if (mode !== 'cheapest' && mode !== store) continue;
      if (!best || x.eff < best.price) best = { price: x.eff, store, promo: !!x.promoNow, pct: x.promoNow ? x.promoNow.pct : 0, n: x.n };
    }
    if (best) return { ...best, src: 'bon' };
  }
  return { price: g.base, store: null, promo: false, pct: 0, src: 'base' };
}
export function promoActive(ing) {
  const per = learned().info[ing]; if (!per) return null;
  let p = null;
  for (const [store, x] of Object.entries(per)) if (x.promoNow && (!p || x.promoNow.per < p.price)) p = { store, price: x.promoNow.per, pct: x.promoNow.pct, d: x.promoNow.d };
  return p;
}

/* ---------- Kosten & Nährwerte ---------- */
export const potFactor = () => (S.profile.persons || 1) * 2 / 6;   // 1 Topf-Rezept = 6 Portionen
export function dishCost(id) {
  const d = DISHES[id];
  const rows = Object.entries(d.need).map(([ing, amt]) => {
    const p = price(ing);
    return { ing, amt, cost: amt / ING[ing].pack * p.price, p };
  });
  let total = rows.reduce((s, r) => s + r.cost, 0) + (d.slot === 'a' ? 0.25 : 0.02); // Gewürze ≈
  const portion = d.slot === 'a' ? total / 6 : total;
  return { rows, total, portion, learnedShare: rows.filter(r => r.p.src === 'bon').length / rows.length };
}
/* Menge + Zutat als lesbarer Text, ohne doppelte Wörter („½ Apfel“, „150 g Naturjoghurt“) */
export function fmtIng(ing, amt) {
  const g = ING[ing], t = fmtAmount(ing, amt).replace(/ \(.*\)/, '');
  if (g.piece && g.pn.some(n => t.endsWith(n))) return t;
  if (g.clove) return t + ' Knoblauch';
  return t + ' ' + g.name.replace(/ \(.*\)/, '');
}
export function fmtAmount(ing, amt) {
  const g = ING[ing];
  if (g.clove) { const z = Math.round(amt * 10); return z <= 9 ? z + (z === 1 ? ' Zehe' : ' Zehen') : lit(Math.round(amt * 2) / 2) + ' Knollen'; }
  if (g.piece) {
    const n = amt / g.piece;
    const r = Math.round(n * 2) / 2;
    if (r >= 0.5 && r <= 12) {
      const txt = r === 0.5 ? '½' : (r % 1 ? Math.floor(r) + '½' : String(r));
      return txt + ' ' + (r > 1 ? g.pn[1] : g.pn[0]) + (amt >= 0.3 ? ' (≈ ' + fmtW(amt, 'kg') + ')' : '');
    }
  }
  if (g.unit === 'stk') { const r = Math.round(amt * 4) / 4; return (r % 1 ? lit(r) : r) + (g.pack >= 6 ? ' Stk' : ' Stk'); }
  if (g.spoon && amt <= 0.05) {
    const ml = amt * 1000;
    if (ml >= 12) { const el = Math.round(ml / 15 * 2) / 2; return (el % 1 ? Math.floor(el) + '½' : el) + ' EL'; }
    const tl = Math.max(1, Math.round(ml / 5)); return tl + ' TL';
  }
  return fmtW(amt, g.unit);
}
function fmtW(a, u) {
  if (u === 'kg') return a >= 1 ? lit(Math.round(a * 100) / 100) + ' kg' : fmtInt(Math.round(a * 1000 / 5) * 5) + ' g';
  if (u === 'l') return a >= 1 ? lit(Math.round(a * 100) / 100) + ' L' : fmtInt(Math.round(a * 1000 / 5) * 5) + ' ml';
  return lit(a);
}

/* ---------- Bewertungen ---------- */
export function avgRating(id) { const r = S.ratings[id]; if (!r || !r.length) return null; return r.reduce((s, x) => s + x.st, 0) / r.length; }
export function lowCount(id) {
  const since = S.unblocked[id] || '0000';
  return (S.ratings[id] || []).filter(x => x.st < 3 && x.d >= since).length;
}
export const isBlocked = id => !!S.blocked[id];
export function rate(id, date, slot, st) {
  const list = (S.ratings[id] = S.ratings[id] || []);
  const i = list.findIndex(x => x.d === date && x.slot === slot);
  if (i > -1) list[i].st = st; else list.push({ d: date, st, slot });
  let newlyBlocked = false;
  if (!S.blocked[id] && lowCount(id) >= 2) {
    S.blocked[id] = { since: date, auto: true };
    newlyBlocked = true;
  } else if (S.blocked[id] && S.blocked[id].auto && lowCount(id) < 2) {
    delete S.blocked[id];     // Bewertung korrigiert
  }
  save();
  return { newlyBlocked, low: st < 3, lowN: lowCount(id) };
}
export function ratingOf(id, date, slot) { const r = (S.ratings[id] || []).find(x => x.d === date && x.slot === slot); return r ? r.st : null; }
export function unblock(id) { delete S.blocked[id]; S.unblocked[id] = todayKey(); save(); }
export function block(id) { S.blocked[id] = { since: todayKey(), auto: false }; save(); }

/* ---------- Plan mit Abwechslung ---------- */
const byslot = s => Object.keys(DISHES).filter(id => DISHES[id].slot === s);
export const isTrain = k => (S.profile.train || []).includes(wd(k));

function lastUsed(id, k, field) {
  for (let i = 1; i <= 30; i++) { const p = S.plan[addDays(k, -i)]; if (p && (p[field] === id)) return i; }
  return 99;
}
function everEaten(id) { return (S.ratings[id] || []).length > 0 || Object.values(S.plan).some(p => p.a === id && p.done); }

export function scoreDinner(id, k, prev, explain = false) {
  const d = DISHES[id];
  const why = [];
  let s = 0;
  const lu = lastUsed(id, k, 'a');
  if (lu < 8) s -= 60 - lu * 4;
  s += Math.min(lu, 21) * 0.9;
  if (lu < 99 && lu >= 10) why.push('seit ' + lu + ' Tagen nicht mehr gekocht');
  if (!everEaten(id)) { s += 5; why.push('neu für dich – mehr Abwechslung'); }
  const r = avgRating(id);
  if (r != null) { s += (r - 3) * 4; if (r >= 4) why.push('von dir mit ' + dec(r, 1) + ' ★ bewertet'); }
  for (const ing of Object.keys(d.need)) {
    if (ING[ing].pantry) continue;
    const pr = promoActive(ing);
    if (pr) { s += 4; why.push(ING[ing].name + ' gerade in Aktion bei ' + STORES[pr.store].name + (pr.pct ? ' (−' + pr.pct + ' %)' : '')); }
  }
  const c = dishCost(id).portion;
  s += (1.25 - c) * 8;            // Budget im Blick: günstige Töpfe bevorzugen
  if (c < 1.05) why.push('günstig: ' + eur(c) + ' pro Portion');
  if (prev) {
    const pd = DISHES[prev];
    if (pd && pd.base === d.base) s -= 8;
    if (pd && pd.protein === d.protein) s -= 6;
    if (pd && pd.base !== d.base && explain) why.push('andere Beilage als gestern (' + ({ reis: 'Reis', nudeln: 'Nudeln', kartoffel: 'Erdäpfel', gnocchi: 'Gnocchi', mehl: 'Teig' }[d.base] || d.base) + ')');
  }
  if (d.long && !isWeekend(k)) s -= 40;
  if (d.long && isWeekend(k)) why.push('Wochenende – Zeit für was Aufwändigeres');
  if (isTrain(k)) s += d.prot / 15;
  s += rand(k + id) * 5;
  return explain ? { s, why } : s;
}

function pickSmall(slot, k, avoidDays, extraScore) {
  let best = null, bs = -1e9;
  for (const id of byslot(slot)) {
    if (isBlocked(id)) continue;
    const lu = lastUsed(id, k, slot);
    let s = Math.min(lu, 14) + rand(k + slot + id) * 6;
    if (lu <= avoidDays) s -= 30;
    const r = avgRating(id); if (r != null) s += (r - 3) * 3;
    s += extraScore ? extraScore(id) : 0;
    if (s > bs) { bs = s; best = id; }
  }
  return best || byslot(slot)[0];
}

function genDay(k) {
  const prevKey = addDays(k, -1);
  const prev = S.plan[prevKey];
  const train = isTrain(k);
  // Abendessen
  let best = null, bs = -1e9;
  for (const id of byslot('a')) {
    if (isBlocked(id)) continue;
    const sc = scoreDinner(id, k, prev && prev.a);
    if (sc > bs) { bs = sc; best = id; }
  }
  const f = pickSmall('f', k, 4);
  const s = pickSmall('s', k, 2, id => {
    const d = DISHES[id];
    if (train && d.train) return 40;      // Shake an Trainingstagen
    if (!train && d.train) return -12;
    return 0;
  });
  const m = prev && prev.a && DISHES[prev.a] ? prev.a : pickSmall('s', k, 3, id => (id === s ? -50 : 0) + (DISHES[id].prot > 25 ? 5 : 0));
  return { f, m, mBox: !!(prev && prev.a), s, a: best || 'chili', train };
}

export function ensurePlan(days = 7) {
  const t = todayKey();
  let changed = false;
  for (let i = 0; i < days; i++) {
    const k = addDays(t, i);
    const p = S.plan[k];
    const prev = S.plan[addDays(k, -1)];
    if (!p) { S.plan[k] = genDay(k); changed = true; continue; }
    // Box muss zum Topf vom Vortag passen
    if (prev && prev.a && p.m !== prev.a && p.mBox !== false) { p.m = prev.a; p.mBox = true; changed = true; }
    if (p.train !== isTrain(k)) { p.train = isTrain(k); changed = true; }
  }
  // alte Einträge (> 60 Tage) aufräumen
  for (const k of Object.keys(S.plan)) if (daysBetween(k, t) > 60) { delete S.plan[k]; changed = true; }
  if (changed) save();
}

/* Ab einem Tag neu planen (z. B. nach Sperre eines Gerichts) */
export function replanFrom(k, keepToday = true) {
  const t = todayKey();
  for (const key of Object.keys(S.plan)) {
    if (key > k || (key === k && !(keepToday && key === t && S.log[t] && S.log[t].cooked))) {
      if (key >= t) delete S.plan[key];
    }
  }
  ensurePlan();
}
export function replaceBlocked() {
  const t = todayKey();
  const cookedToday = S.log[t] && S.log[t].cooked;
  let from = null;
  for (let i = 0; i < 7; i++) {
    const k = addDays(t, i), p = S.plan[k]; if (!p) continue;
    if (i === 0 && cookedToday) {
      if (isBlocked(p.f)) p.f = pickSmall('f', k, 4);
      if (isBlocked(p.s)) p.s = pickSmall('s', k, 2);
      continue;
    }
    if (isBlocked(p.a)) { from = k; break; }
    if (isBlocked(p.f)) p.f = pickSmall('f', k, 4);
    if (isBlocked(p.s)) p.s = pickSmall('s', k, 2);
  }
  if (from) { for (const key of Object.keys(S.plan)) if (key >= from) delete S.plan[key]; }
  ensurePlan(); save();
  return from;
}
/* Ein Gericht des Tages tauschen */
export function reroll(k, slot) {
  const p = S.plan[k]; if (!p) return;
  if (slot === 'a') {
    const old = p.a;
    let best = null, bs = -1e9;
    const prev = S.plan[addDays(k, -1)];
    for (const id of byslot('a')) {
      if (id === old || isBlocked(id)) continue;
      const sc = scoreDinner(id, k, prev && prev.a) + rand(Date.now() + id) * 12;
      if (sc > bs) { bs = sc; best = id; }
    }
    p.a = best;
    const next = S.plan[addDays(k, 1)];
    if (next) { next.m = best; next.mBox = true; }
  } else if (slot === 'f' || slot === 's') {
    const old = p[slot];
    const cand = byslot(slot).filter(id => id !== old && !isBlocked(id));
    p[slot] = cand[Math.floor(Math.random() * cand.length)] || old;
  } else if (slot === 'm' && !p.mBox) {
    const cand = byslot('s').filter(id => id !== p.m && !isBlocked(id));
    p.m = cand[Math.floor(Math.random() * cand.length)] || p.m;
  }
  save();
}
export function shuffleFuture() {
  const t = todayKey();
  for (const key of Object.keys(S.plan)) if (key > t) delete S.plan[key];
  // Zufall neu würfeln: Seed-Verschiebung
  S.seen.shuffle = (S.seen.shuffle || 0) + 1;
  ensurePlan();
}

/* Tageswerte pro Person */
export function dayTotals(k) {
  const p = S.plan[k]; if (!p) return { kcal: 0, prot: 0, eur: 0 };
  const t = { kcal: 0, prot: 0, kh: 0, fat: 0, eur: 0, eaten: 0, eatenProt: 0, eatenKh: 0, eatenFat: 0 };
  const log = S.log[k] || {};
  for (const sl of ['f', 'm', 's', 'a']) {
    const d = DISHES[p[sl]]; if (!d) continue;
    t.kcal += d.kcal; t.prot += d.prot; t.kh += d.kh; t.fat += d.fat; t.eur += dishCost(p[sl]).portion;
    if (log.eaten && log.eaten[sl] && !(log.skip && log.skip[sl])) { t.eaten += d.kcal; t.eatenProt += d.prot; t.eatenKh += d.kh; t.eatenFat += d.fat; }
  }
  for (const x of (S.extra && S.extra[k]) || []) { t.eaten += x.kcal; t.eatenProt += x.prot; t.eatenKh += x.kh; t.eatenFat += x.fat; t.extra = (t.extra || 0) + x.kcal; }
  return t;
}
export function varietyScore(fromKey, n = 7) {
  const seen = new Set(); let slots = 0;
  for (let i = 0; i < n; i++) { const p = S.plan[addDays(fromKey, i)]; if (!p) continue; ['f', 's', 'a'].forEach(s => { seen.add(p[s]); slots++; }); }
  return { distinct: seen.size, slots, pct: slots ? seen.size / slots : 0 };
}

/* ---------- Einkaufsliste ---------- */
export function shoppingList(fromKey, n = 7) {
  const per = S.profile.persons || 1, pf = potFactor();
  const need = {};
  const add = (ing, a) => { need[ing] = (need[ing] || 0) + a; };
  for (let i = 0; i < n; i++) {
    const k = addDays(fromKey, i), p = S.plan[k]; if (!p) continue;
    Object.entries(DISHES[p.a].need).forEach(([ing, a]) => add(ing, a * pf));
    Object.entries(DISHES[p.f].need).forEach(([ing, a]) => add(ing, a * per));
    Object.entries(DISHES[p.s].need).forEach(([ing, a]) => add(ing, a * per));
    if (!p.mBox && DISHES[p.m]) Object.entries(DISHES[p.m].need).forEach(([ing, a]) => add(ing, a * per));
  }
  const items = Object.entries(need).map(([ing, amt]) => {
    const g = ING[ing];
    const p = price(ing);
    if (g.loose) { const kg = Math.ceil(amt * 10) / 10; return { ing, amt, packs: kg / g.pack, loose: kg, price: p, cost: kg / g.pack * p.price, use: amt / g.pack * p.price }; }
    const packs = Math.max(1, Math.ceil(amt / g.pack - 0.08));
    return { ing, amt, packs, price: p, cost: packs * p.price, use: amt / g.pack * p.price };
  });
  items.sort((a, b) => a.ing < b.ing ? -1 : 1);
  // Vergleich je Markt: nur Märkte, von denen es Bons gibt
  const L = learned().info;
  const stores = new Set(S.receipts.map(r => r.store));
  const compare = [...stores].map(store => {
    let sum = 0, known = 0;
    for (const it of items) {
      const x = L[it.ing] && L[it.ing][store];
      if (x && x.eff != null) { sum += it.packs * x.eff; known++; } else sum += it.packs * ING[it.ing].base;
    }
    return { store, sum, known, of: items.length };
  }).sort((a, b) => a.sum - b.sum);
  return { items, compare, total: items.reduce((s, x) => s + x.cost, 0), use: items.reduce((s, x) => s + x.use, 0) };
}

/* Warum steht ein Gericht heute im Plan? */
export function whyDish(id, k) {
  const d = DISHES[id];
  if (d.slot === 'a') return scoreDinner(id, k, (S.plan[addDays(k, -1)] || {}).a, true).why.slice(0, 4);
  const why = [];
  if (d.slot === 'f') why.push('klein & leicht – in der Früh geht wenig rein, darum nur ≈ ' + d.kcal + ' kcal');
  if (d.train && isTrain(k)) why.push('Trainingstag: schnelle Kalorien und Eiweiß für die Muskeln');
  const r = avgRating(id); if (r != null && r >= 4) why.push('von dir mit ' + dec(r, 1) + ' ★ bewertet');
  if (d.prot >= 25) why.push(d.prot + ' g Eiweiß – hilft dir beim Tagesziel');
  return why;
}
