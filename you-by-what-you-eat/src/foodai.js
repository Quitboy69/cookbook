/* Essens-Erkennung: Ergebnis der lokalen KI (Bild-Klassifizierung) → Gericht + Nährwerte */
import { LABELS, EXACT, CAT, RULES, EVERYDAY } from './foodkb.js';
import { S, save } from './store.js';
import { todayKey } from './engine.js';

/* Info zu einem Label (englischer Name aus dem Modell) */
export function infoFor(label) {
  if (EXACT[label]) {
    const [name, e, kcal, p, kh, f, g, desc] = EXACT[label];
    return { key: 'x:' + label, label, name, e, n: [kcal, p, kh, f], g, desc, src: 'exact', cat: name };
  }
  let cat = 'gericht';
  for (const [rx, c] of RULES) if (rx.test(label)) { cat = c; break; }
  const [cname, e, kcal, p, kh, f, g, desc] = CAT[cat];
  return { key: 'x:' + label, label, name: label, e, n: [kcal, p, kh, f], g, desc, src: cat === 'gericht' ? 'avg' : 'cat', cat: cname, ck: cat };
}
export function infoEveryday(i) {
  const [name, e, kcal, p, kh, f, g, unit] = EVERYDAY[i];
  return { key: 'e:' + i, label: name, name, e, n: [kcal, p, kh, f], g, unit, desc: unitDesc(name, g, unit), src: 'exact', cat: 'Alltag' };
}
const unitDesc = (name, g, unit) => `Übliche Portion: 1 ${unit} ≈ ${g} ${/saft|cola|bier|milch|wein|kaffee|tee|drink|shake|radler|kakao|gespritzt|cappuccino|latte/i.test(name) ? 'ml' : 'g'}.`;
export function fromKey(key) {
  if (!key) return null;
  if (key.startsWith('e:')) return infoEveryday(+key.slice(2));
  return infoFor(key.slice(2));
}

/* Ergebnis der Klassifizierung sortieren – vertraute Gerichte leicht bevorzugen */
export function rank(labels) {
  const out = [];
  for (const l of labels || []) {
    const name = (l.index != null && LABELS[l.index]) || l.text || '';
    if (!name || name === '__background__' || /^\/[gm]\//.test(name)) continue;
    const info = infoFor(name);
    const boost = info.src === 'exact' ? 1.35 : info.src === 'cat' ? 1.1 : 1;
    out.push({ ...info, conf: l.conf, score: l.conf * boost });
  }
  out.sort((a, b) => b.score - a.score);
  const seen = new Set();
  return out.filter(x => (seen.has(x.label) ? false : seen.add(x.label))).slice(0, 5);
}

/* Nährwerte für eine Menge */
export function nutr(info, factor = 1) {
  const g = info.g * factor, k = g / 100;
  return { g: Math.round(g), kcal: Math.round(info.n[0] * k), prot: Math.round(info.n[1] * k), kh: Math.round(info.n[2] * k), fat: Math.round(info.n[3] * k) };
}
/* Kurze Einschätzung */
export function verdict(info, nn) {
  const t = [];
  const e = info.n[1] * 4 + info.n[2] * 4 + info.n[3] * 9 || 1;
  if (info.n[1] * 4 / e >= 0.25 || nn.prot >= 25) t.push(['💪', 'Viel Eiweiß', 'good']);
  if (info.n[3] * 9 / e >= 0.5) t.push(['🧈', 'Fettreich', 'warn']);
  if (info.n[2] * 4 / e >= 0.6) t.push(['🍞', 'Viele Kohlenhydrate', '']);
  if (info.n[0] < 100) t.push(['🍃', 'Leicht', 'good']);
  if (nn.kcal >= 800) t.push(['💣', 'Kalorienbombe', 'warn']);
  if (['kuchen', 'dessert', 'eis', 'kekse'].includes(info.ck) || /torte|kuchen|strudel|krapfen|donut|brownie|muffin|cupcake|panna|eis\b|eistorte|frozen|cola$|saft|eistee|energy|gummi|schoko|nutella|marmelade|germknödel|waffel|pancakes|crêpe/i.test(info.name)) t.push(['🍬', 'Viel Zucker', 'warn']);
  return t.slice(0, 3);
}

/* Suche (Fallback, wenn das Foto nicht passt) */
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
const DE_EN = { schnitzel: 'schnitzel', gulasch: 'goulash', knodel: 'knödel', nudel: 'pasta', suppe: 'soup', salat: 'salad', kuchen: 'cake', torte: 'cake', hendl: 'chicken', huhn: 'chicken', reis: 'rice', fisch: 'fish', wurst: 'sausage', ei: 'egg', kartoffel: 'potato', erdapfel: 'potato', kase: 'cheese', brot: 'bread', eis: 'ice cream', strudel: 'strudel', burger: 'burger', pizza: 'pizza', curry: 'curry', doner: 'shawarma', kebab: 'kebab' };
export function search(q, max = 30) {
  const n = norm(q.trim()); if (n.length < 2) return [];
  const res = [];
  EVERYDAY.forEach((x, i) => { const s = norm(x[0]); if (s.includes(n)) res.push({ info: infoEveryday(i), s: s.startsWith(n) ? 3 : 2 }); });
  for (const [label, v] of Object.entries(EXACT)) { const s = norm(v[0]) + ' ' + norm(label); if (s.includes(n)) res.push({ info: infoFor(label), s: norm(v[0]).startsWith(n) ? 3 : 2 }); }
  const en = Object.entries(DE_EN).filter(([de]) => n.includes(de) || de.includes(n)).map(([, e]) => e);
  LABELS.forEach(l => { if (!l || EXACT[l]) return; const s = norm(l); if (s.includes(n) || en.some(e => s.includes(e))) res.push({ info: infoFor(l), s: 1 }); });
  const seen = new Set();
  return res.sort((a, b) => b.s - a.s).filter(r => (seen.has(r.info.key) ? false : seen.add(r.info.key))).slice(0, max).map(r => r.info);
}

/* Passende Mahlzeit nach Uhrzeit */
export function slotNow() { const h = new Date().getHours(); return h < 10 ? 'f' : h < 15 ? 'm' : h < 18 ? 's' : 'a'; }

/* Eintragen: eigenes Essen (zählt bei „Gegessen“) */
export function logExtra(k, entry) {
  const list = (S.extra[k] = S.extra[k] || []);
  list.push({ id: Date.now().toString(36), t: Date.now(), ...entry });
  if (entry.replaces) { const L = (S.log[k] = S.log[k] || { eaten: {} }); L.skip = L.skip || {}; L.skip[entry.slot] = true; if (L.eaten) delete L.eaten[entry.slot]; }
  save(true);
}
export function removeExtra(k, id) {
  const list = S.extra[k] || []; const e = list.find(x => x.id === id);
  S.extra[k] = list.filter(x => x.id !== id);
  if (e && e.replaces && S.log[k] && S.log[k].skip && !S.extra[k].some(x => x.replaces && x.slot === e.slot)) delete S.log[k].skip[e.slot];
  save(true);
}
export const extrasOf = k => S.extra[k] || [];
export const todaysExtras = () => extrasOf(todayKey());
