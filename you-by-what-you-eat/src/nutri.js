/* Nährwert-Modell: alles je 100 g / 100 ml als [kcal, Eiweiß, KH, Zucker, Fett, ges. Fett, Ballaststoffe, Salz] */
export const K = { kcal: 0, prot: 1, kh: 2, sugar: 3, fat: 4, sat: 5, fiber: 6, salt: 7 };
export const ROWS = [
  { k: 'kcal', label: 'Brennwert', unit: 'kcal', ri: 2000, bold: true },
  { k: 'fat', label: 'Fett', unit: 'g', ri: 70, bold: true },
  { k: 'sat', label: 'davon gesättigte Fette', unit: 'g', ri: 20, sub: true },
  { k: 'kh', label: 'Kohlenhydrate', unit: 'g', ri: 260, bold: true },
  { k: 'sugar', label: 'davon Zucker', unit: 'g', ri: 90, sub: true },
  { k: 'fiber', label: 'Ballaststoffe', unit: 'g', ri: 25 },
  { k: 'prot', label: 'Eiweiß', unit: 'g', ri: 50, bold: true },
  { k: 'salt', label: 'Salz', unit: 'g', ri: 6, bold: true }
];
export const SUGAR_CUBE = 3;          // 1 Würfelzucker ≈ 3 g
export const WHO_SUGAR = 50;          // max. 50 g freie Zucker/Tag (ideal 25 g)

/* Ampel nach Lebensmittel-Ampel (UK FSA), je 100 g bzw. 100 ml */
const T_FOOD = { fat: [3, 17.5], sat: [1.5, 5], sugar: [5, 22.5], salt: [0.3, 1.5] };
const T_DRINK = { fat: [1.5, 8.75], sat: [0.75, 2.5], sugar: [2.5, 11.25], salt: [0.3, 1.5] };
export function light(k, v, ml) {
  const t = (ml ? T_DRINK : T_FOOD)[k]; if (!t || v == null) return '';
  return v <= t[0] ? 'g' : v <= t[1] ? 'y' : 'r';
}
export const LIGHT_TXT = { g: 'wenig', y: 'mittel', r: 'viel' };

export const val = (n, k) => (n[K[k]] == null ? null : n[K[k]]);

/* Für eine Menge (g/ml) umrechnen */
export function scale(n, grams) {
  const f = grams / 100, o = {};
  for (const k of Object.keys(K)) { const v = n[K[k]]; o[k] = v == null ? null : v * f; }
  o.g = grams;
  return o;
}
export const r0 = v => Math.round(v), r1 = v => Math.round(v * 10) / 10;
export function fmtV(k, v) {
  if (v == null) return '–';
  if (k === 'kcal') return String(Math.round(v));
  const d = v >= 10 ? 0 : v >= 1 ? 1 : v > 0 ? (k === 'salt' ? 2 : 1) : 0;
  return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ',');
}
export const kJ = kcal => Math.round(kcal * 4.184);

/* Kurz-Einschätzung für Chips */
export function verdict(n, per, ml) {
  const t = [];
  const [kcal, prot, kh, sugar, fat, sat, fiber, salt] = n;
  const e = prot * 4 + kh * 4 + fat * 9 || 1;
  if (prot * 4 / e >= 0.25 || per.prot >= 25) t.push(['💪', 'Viel Eiweiß', 'good']);
  if (fiber != null && (fiber >= 6 || per.fiber >= 8)) t.push(['🌾', 'Ballaststoffreich', 'good']);
  if (sugar != null && light('sugar', sugar, ml) === 'r') t.push(['🍬', 'Viel Zucker', 'warn']);
  else if (per.sugar != null && per.sugar >= 20) t.push(['🍬', 'Viel Zucker', 'warn']);
  if (fat * 9 / e >= 0.5 && fat > 10) t.push(['🧈', 'Fettreich', 'warn']);
  if (salt != null && light('salt', salt, ml) === 'r') t.push(['🧂', 'Salzig', 'warn']);
  if (kh * 4 / e >= 0.6 && kh > 30 && sugar != null && sugar < kh * 0.35) t.push(['🍞', 'Viele Kohlenhydrate', '']);
  if (kcal < 100 && !ml) t.push(['🍃', 'Leicht', 'good']);
  if (per.kcal >= 800) t.push(['💣', 'Kalorienbombe', 'warn']);
  if (ml && kcal < 5) t.push(['💧', 'Kaum Kalorien', 'good']);
  return t.slice(0, 4);
}

/* Zucker veranschaulichen */
export function sugarInfo(gSugar) {
  if (gSugar == null) return null;
  const cubes = gSugar / SUGAR_CUBE;
  const pct = gSugar / WHO_SUGAR * 100;
  const tsp = gSugar / 4;
  let lvl = 'ok', txt = 'wenig Zucker';
  if (gSugar >= 25) { lvl = 'high'; txt = 'Das ist schon deine ganze „ideale“ Tagesmenge'; }
  else if (gSugar >= 12) { lvl = 'mid'; txt = 'ordentlich Zucker'; }
  else if (gSugar >= 5) { lvl = 'low'; txt = 'mäßig Zucker'; }
  return { g: gSugar, cubes, pct, tsp, lvl, txt };
}

/* Nutri-Score (2023, vereinfacht ohne Obst/Gemüse-Anteil) – nur als Schätzung für Lebensmittel ohne OFF-Wert */
export function nutriScore(n, ml) {
  if (!n) return null;
  const [kcal, prot, , sugar, , sat, fiber, salt] = n;
  if ([kcal, sugar, sat, salt].some(x => x == null)) return null;
  const pts = (v, th) => { let p = 0; for (const t of th) if (v > t) p++; return p; };
  if (ml) {
    const kj = kcal * 4.184, e = pts(kj, [0, 30, 60, 90, 120, 150, 180, 210, 240, 270]);
    const s = pts(sugar, [0, 1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5]), sa = pts(sat, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const na = pts(salt * 400, [0, 90, 180, 270, 360, 450, 540, 630, 720, 810]);
    const total = e + s + sa + na - (prot > 1.2 ? Math.min(7, Math.floor((prot - 0.2) / 1.2)) : 0);
    return total <= 0 ? (kcal < 2 ? 'a' : 'b') : total <= 2 ? 'c' : total <= 6 ? 'd' : 'e';
  }
  const kj = kcal * 4.184;
  const e = pts(kj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]);
  const s = pts(sugar, [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51]);
  const sa = pts(sat, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const na = pts(salt * 400, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900, 990, 1080, 1170, 1260, 1350, 1440, 1530, 1620, 1710, 1800]);
  const neg = e + s + sa + na;
  const fb = pts(fiber || 0, [3.0, 4.1, 5.2, 6.3, 7.4]);
  const pr = pts(prot, [2.4, 4.8, 7.2, 9.6, 12, 14, 17]);
  const total = neg >= 11 && !(0) ? neg - fb : neg - fb - pr;
  return total <= 0 ? 'a' : total <= 2 ? 'b' : total <= 10 ? 'c' : total <= 18 ? 'd' : 'e';
}
export const NS_COL = { a: '#038141', b: '#85BB2F', c: '#FECB02', d: '#EE8100', e: '#E63E11' };
