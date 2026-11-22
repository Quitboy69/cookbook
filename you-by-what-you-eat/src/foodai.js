/* Essens-Erkennung & Lebensmittel-Datenbank
 * Quellen: Barcode + Packungstext + Nährwerttabelle (Foto) · Foto-KI (Gerichte, Obst/Gemüse) · Produktdatenbank (Open Food Facts) · Grundnahrungsmittel (USDA)
 * Alle Nährwerte: [kcal, Eiweiß, KH, Zucker, Fett, ges. Fett, Ballaststoffe, Salz] je 100 g bzw. 100 ml (null = unbekannt) */
import { LABELS, EXACT, CAT, RULES } from './foodkb.js';
import { GENERIC } from './generic.js';
import { S, save } from './store.js';
import { todayKey } from './engine.js';
import { INET_NAMES } from './inet.js';
import { parseLabel, toN8 } from './labelparse.js';
import { rowsFromOcr } from './receipt.js';

/* ---------- Text-Normalisierung (Umlaute, Akzente, ae/oe/ue) ---------- */
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
  .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/[^a-z0-9% ]+/g, ' ').replace(/\s+/g, ' ').trim();
const toks = s => norm(s).split(' ').filter(Boolean);

/* ---------- Kategorien der Produktdatenbank ---------- */
const CAT_DE = {
  'Sweets': ['Süßigkeiten', '🍬'], 'Biscuits and cakes': ['Kekse & Kuchen', '🍪'], 'Dressings and sauces': ['Soßen', '🥫'], 'Cereals': ['Getreide', '🌾'], 'Milk and yogurt': ['Milch & Joghurt', '🥛'],
  'Cheese': ['Käse', '🧀'], 'Chocolate products': ['Schokolade', '🍫'], 'One-dish meals': ['Fertiggericht', '🍲'], 'Bread': ['Brot', '🍞'], 'Breakfast cereals': ['Frühstücksflocken', '🥣'],
  'Sweetened beverages': ['Softdrink', '🥤'], 'Vegetables': ['Gemüse', '🥦'], 'Processed meat': ['Wurst & Fleisch', '🥓'], 'Dairy desserts': ['Dessert', '🍮'], 'Fish and seafood': ['Fisch', '🐟'],
  'Nuts': ['Nüsse', '🥜'], 'Fats': ['Fette & Öle', '🧈'], 'Legumes': ['Hülsenfrüchte', '🫘'], 'Appetizers': ['Snack', '🥨'], 'Artificially sweetened beverages': ['Zero-Getränk', '🥤'],
  'Potatoes': ['Erdäpfel', '🥔'], 'Fruit juices': ['Saft', '🧃'], 'Plant-based milk substitutes': ['Pflanzendrink', '🥛'], 'Ice cream': ['Eis', '🍨'], 'Salty and fatty products': ['Salziger Snack', '🥨'],
  'Fruits': ['Obst', '🍎'], 'Teas and herbal teas and coffees': ['Tee & Kaffee', '☕'], 'Meat': ['Fleisch', '🥩'], 'Dried fruits': ['Trockenfrüchte', '🍇'], 'Pizza pies and quiches': ['Pizza & Quiche', '🍕'],
  'Unsweetened beverages': ['Getränk', '🥤'], 'Waters and flavored waters': ['Wasser', '💧'], 'Alcoholic beverages': ['Alkohol', '🍺'], 'Pastries': ['Gebäck', '🥐'], 'Eggs': ['Eier', '🥚'],
  'Sandwiches': ['Sandwich', '🥪'], 'Soups': ['Suppe', '🍲'], 'Baby foods': ['Babynahrung', '🍼'], 'Fruit nectars': ['Nektar', '🧃'], 'Baby milks': ['Babymilch', '🍼']
};
const SNACKY = new Set(['Sweets', 'Chocolate products', 'Biscuits and cakes', 'Salty and fatty products', 'Appetizers', 'Nuts', 'Dried fruits', 'Pastries', 'Ice cream', 'Dairy desserts']);

/* ---------- Items aus den Quellen ---------- */
const nn = n => n.map(v => (v == null || v < 0 ? null : v));
export function dishItem(label) {
  const x = EXACT[label];
  if (x) return { k: 'd', key: 'x:' + label, label, name: x[0], e: x[1], n: x[2], g: x[3], u: 'Portion', desc: x[4], src: 'exact', cat: 'Gericht' };
  let c = 'gericht';
  for (const [rx, k] of RULES) if (rx.test(label)) { c = k; break; }
  const v = CAT[c];
  return { k: 'd', key: 'x:' + label, label, name: label, e: v[1], n: v[2], g: v[3], u: 'Portion', desc: v[4], src: c === 'gericht' ? 'avg' : 'cat', cat: v[0], ck: c };
}
export function catItem(c, label) { const v = CAT[c]; return { k: 'd', key: 'x:' + (label || c), label: label || v[0], name: v[0], e: v[1], n: v[2], g: v[3], u: 'Portion', desc: v[4], src: 'cat', cat: v[0], ck: c }; }
const GEN_BY_NAME = {};
GENERIC.forEach((r, i) => { GEN_BY_NAME[r[0]] = i; });
export const genIndex = n => (GEN_BY_NAME[n] == null ? -1 : GEN_BY_NAME[n]);
export function genItem(i) {
  const r = GENERIC[i];
  return { k: 'g', key: 'g:' + i, name: r[0], e: r[2], cat: r[3], g: r[4], u: r[5], ml: !!r[6], n: r[7], src: r[8] === 'u' ? 'usda' : 'ref', desc: '' };
}
const INET_TARGET = {
  banana: 'Banane', orange: 'Orange / Mandarine', lemon: 'Zitrone', strawberry: 'Erdbeeren', pineapple: 'Ananas', 'Granny Smith': 'Apfel', broccoli: 'Brokkoli', cauliflower: 'Karfiol (Blumenkohl)',
  cucumber: 'Gurke', mushroom: 'Champignons', 'bell pepper': 'Paprika', 'head cabbage': 'Weißkraut', zucchini: 'Zucchini', 'butternut squash': 'Kürbis (Butternut)', 'acorn squash': 'Kürbis (Butternut)',
  'spaghetti squash': 'Kürbis (Butternut)', corn: 'Mais (Zuckermais)', ear: 'Mais (Zuckermais)', bagel: 'Bagel', pretzel: 'Brezel (Laugenbrezel)', 'French loaf': 'Baguette', 'ice cream': 'Speiseeis (Vanille)',
  'ice lolly': 'Speiseeis (Vanille)', guacamole: 'Avocado', espresso: 'Kaffee schwarz', 'red wine': 'Wein (Rot/Weiß)', 'beer glass': 'Bier (Lager/Hell)', fig: 'Datteln', 'custard apple': 'Apfel',
  artichoke: 'Gemüse', pomegranate: 'Granatapfel'
};
const INET_DISH = { hotdog: 'Hot dog', cheeseburger: 'Cheeseburger', burrito: 'Burrito', carbonara: 'Carbonara', 'meat loaf': 'Meatloaf', 'mashed potato': 'Mashed potato', potpie: 'Quiche', trifle: 'Panna cotta' };
const INET_CAT = { pizza: 'pizza', consomme: 'suppe', 'hot pot': 'eintopf', dough: 'brot' };
const INET_PACK = new Set(['pop bottle', 'water bottle', 'beer bottle', 'wine bottle', 'can opener', 'tin can', 'packet', 'carton', 'crate', 'milk can', 'cocktail shaker', 'pill bottle', 'wine bottle']);

/* ---------- Produktdatenbank (lazy) ---------- */
let DB = null, loading = null;
function buildDb(j) {
  const P = j.p, hay = new Array(P.length), byCode = new Map();
  for (let i = 0; i < P.length; i++) { const o = P[i]; hay[i] = ' ' + norm(o[2] + ' ' + o[1]) + ' '; byCode.set(o[0], i); }
  DB = { P, hay, byCode, cats: j.cats };
  return DB;
}
export function loadProducts() {
  if (DB) return Promise.resolve(DB);
  if (!loading) loading = fetch('data/products.json').then(r => r.json()).then(buildDb).catch(e => { loading = null; throw e; });
  return loading;
}
export const dbReady = () => !!DB;
export function prodItem(o) {
  const cat = DB && o[15] >= 0 ? DB.cats[o[15]] : '', cd = CAT_DE[cat] || ['Produkt', '🛒'];
  const ml = !!o[14], pack = o[3];
  const serv = o[4] >= (ml ? 30 : 5) && o[4] <= 600 ? o[4] : 0;        // unplausible Portionsangaben ignorieren
  let g;
  if (serv) g = serv;
  else if (ml) g = pack && pack <= 500 ? pack : 250;
  else if (pack && pack <= 80) g = pack;
  else g = SNACKY.has(cat) ? 30 : 100;
  return { k: 'p', key: 'p:' + o[0], code: o[0], name: o[1], brand: o[2], e: cd[1], cat: cd[0], n: nn([o[5], o[6], o[7], o[8], o[9], o[10], o[11], o[12]]), g, serving: serv, pack, ml, ns: o[13] || '', u: serv ? 'Portion' : (pack && pack <= 80 ? 'Stück' : 'Portion'), src: 'off', scans: o[16] };
}
export function customItem(c) { return { k: 'c', key: 'c:' + c.id, id: c.id, code: c.code || '', name: c.name, brand: c.brand || '', e: c.e || '🏷️', cat: 'Meine Produkte', n: c.n, g: c.g, serving: c.serving || 0, pack: c.pack || 0, ml: !!c.ml, ns: c.ns || '', u: 'Portion', src: c.src || 'label' }; }

/* ---------- Suche ---------- */
const SYN = { tatar: ['tartar', 'tartare'], tartar: ['tatar', 'tartare'], tartare: ['tatar', 'tartar'], kartoffel: ['erdapfel'], erdapfel: ['kartoffel'], gummibarchen: ['gummibar', 'fruchtgummi', 'goldbar'], gummibar: ['gummibarchen', 'goldbar'],
  limo: ['limonade', 'soda'], semmel: ['brotchen', 'kaiser'], brotchen: ['semmel'], hendl: ['huhn', 'hahnchen', 'chicken'], huhn: ['hendl'], hahnchen: ['hendl'], paradeiser: ['tomate'], topfen: ['quark'], quark: ['topfen'], sahne: ['obers', 'schlagobers'],
  obers: ['sahne'], marille: ['aprikose'], aprikose: ['marille'], karfiol: ['blumenkohl'], blumenkohl: ['karfiol'], fisole: ['bohne'], melanzani: ['aubergine'], faschiertes: ['hackfleisch', 'hack'], hackfleisch: ['faschiertes'], schlagobers: ['sahne'], kaffee: ['coffee'], cola: ['coca'] };
function expand(qt) { const out = [qt]; for (const t of qt) if (SYN[t]) SYN[t].forEach(s => out.push(qt.map(x => (x === t ? s : x)))); return out; }

function scoreHay(h, qt, nameN, exact = 8) {
  let s = 0;
  for (const t of qt) {
    const at = h.indexOf(' ' + t);
    if (at >= 0) s += 3 + (at === 0 ? 1 : 0); else if (h.indexOf(t) >= 0) s += 1; else return -1;
  }
  if (nameN === qt.join(' ')) s += exact;
  return s;
}
export function searchLocal(q, max = 40) {
  const qt = toks(q); if (!qt.length || (qt.length === 1 && qt[0].length < 2)) return [];
  const variants = expand(qt);
  const res = [];
  // Eigene Produkte & Verlauf zuerst
  (S.food.cust || []).forEach(c => { const h = ' ' + norm(c.brand + ' ' + c.name) + ' '; for (const v of variants) { const s = scoreHay(h, v, norm(c.name)); if (s >= 0) { res.push({ it: customItem(c), s: s + 6 }); break; } } });
  // Grundnahrungsmittel
  GENERIC.forEach((r, i) => { const h = ' ' + norm(r[0] + ' ' + r[1]) + ' '; for (const v of variants) { const s = scoreHay(h, v, norm(r[0])); if (s >= 0) { res.push({ it: genItem(i), s: s + 5 + (norm(r[0]).startsWith(variants[0].join(' ')) ? 3 : 0) }); break; } } });
  // Gerichte
  for (const [label, x] of Object.entries(EXACT)) { const h = ' ' + norm(x[0] + ' ' + label) + ' '; for (const v of variants) { const s = scoreHay(h, v, norm(x[0])); if (s >= 0) { res.push({ it: dishItem(label), s: s + 4.5 + (norm(x[0]).startsWith(variants[0].join(' ')) ? 3 : 0) }); break; } } }
  // Produkte
  if (DB) {
    const found = [];
    for (let i = 0; i < DB.hay.length; i++) {
      const h = DB.hay[i];
      for (const v of variants) {
        const s = scoreHay(h, v, norm(DB.P[i][1]), 2);
        if (s >= 0) { found.push([i, s + Math.log10((DB.P[i][16] || 0) + 1) * 1.2 - DB.P[i][1].length / 80]); break; }
      }
    }
    found.sort((a, b) => b[1] - a[1]);
    for (const [i, s] of found.slice(0, max)) res.push({ it: prodItem(DB.P[i]), s });
  }
  res.sort((a, b) => b.s - a.s);
  const seen = new Set();
  return res.filter(r => (seen.has(r.it.key) ? false : seen.add(r.it.key))).slice(0, max).map(r => r.it);
}

/* ---------- Barcode ---------- */
export function validEan(c) {
  if (!/^\d{8}$|^\d{12,14}$/.test(c)) return false;
  const d = c.split('').map(Number), chk = d.pop(); let sum = 0;
  d.reverse().forEach((v, i) => { sum += v * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === chk;
}
const pad13 = c => (c.length === 12 ? '0' + c : c);
export async function lookupBarcode(code, { online = true } = {}) {
  code = String(code).replace(/\D/g, '');
  const c = (S.food.cust || []).find(x => x.code && (x.code === code || pad13(x.code) === pad13(code)));
  if (c) return { item: customItem(c), from: 'custom' };
  await loadProducts().catch(() => null);
  if (DB) {
    const i = DB.byCode.get(code) ?? DB.byCode.get(pad13(code)) ?? DB.byCode.get(code.replace(/^0/, ''));
    if (i != null) return { item: prodItem(DB.P[i]), from: 'db' };
  }
  if (online) {
    const it = await lookupOnline(code);
    if (it) return { item: it, from: 'online' };
  }
  return null;
}
export function fromOff(p) {
  if (!p) return null;
  const m = p.nutriments || {};
  const num = k => (m[k] == null || m[k] === '' ? null : +m[k]);
  let kcal = num('energy-kcal_100g'); if (kcal == null && num('energy_100g') != null) kcal = Math.round(num('energy_100g') / 4.184);
  const n = [kcal, num('proteins_100g'), num('carbohydrates_100g'), num('sugars_100g'), num('fat_100g'), num('saturated-fat_100g'), num('fiber_100g'), num('salt_100g') != null ? num('salt_100g') : (num('sodium_100g') != null ? num('sodium_100g') * 2.5 : null)];
  if (n[0] == null && n[2] == null && n[4] == null) return null;
  const cats = (p.categories_tags || []).join(',');
  const ml = /en:beverages|en:waters|en:sodas/.test(cats);
  const pack = +p.product_quantity || 0, serv = +p.serving_quantity || 0;
  const name = (p.product_name_de || p.product_name || 'Produkt').trim();
  const brand = (p.brands || '').split(',')[0].trim();
  const g = serv || (ml ? (pack && pack <= 500 ? pack : 250) : (pack && pack <= 80 ? pack : 30));
  return { k: 'p', key: 'p:' + p.code, code: p.code, name, brand, e: ml ? '🥤' : '🛒', cat: 'Produkt (online)', n, g, serving: serv, pack, ml, ns: (p.nutriscore_grade || '').slice(0, 1), u: 'Portion', src: 'off' };
}
export async function lookupOnline(code) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + code + '.json?fields=code,product_name,product_name_de,brands,product_quantity,serving_quantity,nutriments,nutriscore_grade,categories_tags', { signal: ctl.signal });
    const j = await r.json();
    if (j.status !== 1) return null;
    const it = fromOff(j.product); if (!it) return null;
    saveCustom({ code: it.code, name: it.name, brand: it.brand, n: it.n, g: it.g, serving: it.serving, pack: it.pack, ml: it.ml, ns: it.ns, e: it.e, src: 'off' });
    return it;
  } catch (e) { return null; } finally { clearTimeout(to); }
}

/* ---------- Packungstext → Produkt ---------- */
export function matchPackText(lines) {
  if (!DB) return [];
  const words = new Set(), joined = [];
  for (const l of lines) { const t = toks(l); t.forEach(w => { if (w.length >= 3) words.add(w); }); joined.push(norm(l)); }
  if (words.size < 1) return [];
  const big = joined.join(' '), bigP = ' ' + big;
  const STOP = new Set(['bio', 'und', 'mit', 'der', 'die', 'das', 'von', 'the', 'and', 'frucht', 'classic', 'original', 'natur', 'ohne', 'zucker']);
  const out = [];
  for (let i = 0; i < DB.P.length; i++) {
    const o = DB.P[i];
    const bt = toks(o[2]).filter(t => t.length >= 3), nt = toks(o[1]).filter(t => t.length >= 3 && !STOP.has(t));
    if (!bt.length && !nt.length) continue;
    const brandHit = bt.length > 0 && bt.every(t => words.has(t) || bigP.includes(' ' + t));
    let hit = 0, tot = 0;
    for (const t of nt) { tot += t.length; if (words.has(t) || (t.length >= 6 && bigP.includes(' ' + t))) hit += t.length; }
    if (!tot) continue;
    const ratio = hit / tot;
    if (ratio < 0.7 || hit < 6) continue;
    const score = ratio * 0.9 + (brandHit ? 0.35 : 0) + Math.min(0.1, Math.log10((o[16] || 0) + 1) * 0.05);
    if (!brandHit && bt.length && ratio < 0.95) continue;       // Marke erkannt oder Name komplett
    out.push([i, score]);
  }
  out.sort((a, b) => b[1] - a[1]);
  return out.slice(0, 5).map(([i, s]) => ({ ...prodItem(DB.P[i]), score: s }));
}

/* ---------- Foto-Ergebnis → Kandidaten ---------- */
export function rankDish(labels) {
  const out = [];
  for (const l of labels || []) {
    const name = (l.index != null && LABELS[l.index]) || l.text || '';
    if (!name || name === '__background__' || /^\/[gm]\//.test(name)) continue;
    const it = dishItem(name);
    const boost = it.src === 'exact' ? 1.35 : it.src === 'cat' ? 1.1 : 0.95;
    out.push({ ...it, conf: l.conf, score: l.conf * boost, via: 'ki' });
  }
  return out;
}
export function rankInet(labels) {
  const out = []; let pack = 0;
  for (const l of labels || []) {
    const name = INET_NAMES[l.index] || l.text; if (!name) continue;
    if (INET_PACK.has(name)) { pack = Math.max(pack, l.conf); continue; }
    let it = null;
    if (INET_TARGET[name] && GEN_BY_NAME[INET_TARGET[name]] != null) it = genItem(GEN_BY_NAME[INET_TARGET[name]]);
    else if (INET_DISH[name]) it = dishItem(INET_DISH[name]);
    else if (INET_CAT[name]) it = catItem(INET_CAT[name], name);
    if (it) out.push({ ...it, conf: l.conf, score: l.conf * 1.25, via: 'ki' });
  }
  return { list: out, pack };
}
/* Persönliche Korrekturen: früher für dieses KI-Label gewählte Lebensmittel bevorzugen */
function applyPrefs(list) {
  const out = [...list];
  for (const c of list.slice(0, 6)) {
    const p = S.food.pref[c.label || c.name]; if (!p) continue;
    for (const [key, n] of Object.entries(p)) {
      const it = itemFromKey(key); if (!it) continue;
      const ex = out.find(x => x.key === it.key);
      const bonus = Math.min(0.6, 0.25 + n * 0.12);
      if (ex) ex.score += bonus; else out.push({ ...it, conf: c.conf, score: c.score + bonus * 0.9, via: 'gelernt' });
    }
  }
  return out;
}
export function learnChoice(predicted, chosen) {
  if (!predicted || !chosen || predicted.key === chosen.key) return;
  const lab = predicted.label || predicted.name;
  const p = (S.food.pref[lab] = S.food.pref[lab] || {});
  p[chosen.key] = (p[chosen.key] || 0) + 1;
  // Auch das gewählte Lebensmittel als Snapshot merken, damit es offline wieder auftaucht
  remember(chosen, chosen.g);
  save();
}
export function itemFromKey(key) {
  if (!key) return null;
  if (key.startsWith('g:')) return GENERIC[+key.slice(2)] ? genItem(+key.slice(2)) : null;
  if (key.startsWith('x:')) return dishItem(key.slice(2));
  const h = (S.food.hist || []).find(x => x.key === key) || (S.food.fav || []).find(x => x.key === key);
  if (h) return { ...h };
  if (key.startsWith('c:')) { const c = (S.food.cust || []).find(x => 'c:' + x.id === key); return c ? customItem(c) : null; }
  if (key.startsWith('p:') && DB) { const i = DB.byCode.get(key.slice(2)); return i != null ? prodItem(DB.P[i]) : null; }
  return null;
}

/* Alles auswerten, was die native Analyse geliefert hat */
export async function buildCandidates(res) {
  const out = { cands: [], table: null, barcode: null, unknownCode: null, packHint: false, textHits: [], notes: [] };
  await loadProducts().catch(() => null);
  // 1) Barcode
  for (const b of res.barcodes || []) {
    if (!validEan(b.value)) continue;
    const r = await lookupBarcode(b.value);
    if (r) { out.barcode = { code: b.value, ...r }; out.cands.push({ ...r.item, conf: 1, score: 100, via: 'barcode' }); break; }
    out.unknownCode = b.value;
  }
  // 2) Nährwerttabelle
  const rows = (res.lines || []).length ? rowsFromOcr(res) : String(res.text || '').split('\n');
  const tab = parseLabel(rows);
  if (tab.ok) out.table = tab;
  // 3) Name auf der Packung
  if (!out.barcode) {
    const lines = (res.lines || []).map(l => l.text).filter(Boolean);
    const hits = matchPackText(lines);
    out.textHits = hits;
    hits.forEach((h, i) => out.cands.push({ ...h, conf: Math.min(0.95, h.score), score: 2 + h.score - i * 0.05, via: 'text' }));
  }
  // 4) Foto-KI
  const dish = rankDish(res.labels), inet = rankInet(res.inet);
  out.packHint = inet.pack > 0.25;
  let ki = applyPrefs([...dish, ...inet.list]).sort((a, b) => b.score - a.score);
  // Wenn ein Obst/Gemüse sehr sicher erkannt wurde und kein Gericht, nach oben
  const seen = new Set(out.cands.map(c => c.key));
  ki.forEach(c => { if (!seen.has(c.key)) { seen.add(c.key); out.cands.push(c); } });
  out.cands.sort((a, b) => b.score - a.score);
  const sig = new Set();                                   // fast identische Treffer (andere Barcodes, gleiche Werte) nur einmal zeigen
  out.cands = out.cands.filter(c => { const k = norm((c.brand || '') + c.name) + '|' + Math.round(c.n[0] || 0) + '|' + Math.round(c.n[3] || 0); return sig.has(k) ? false : (sig.add(k), true); }).slice(0, 8);
  return out;
}

/* ---------- Eigene Produkte, Verlauf, Favoriten ---------- */
export function saveCustom(c) {
  const list = (S.food.cust = S.food.cust || []);
  const old = c.code ? list.find(x => x.code === c.code) : null;
  const rec = { id: old ? old.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: Date.now(), ...c };
  if (old) Object.assign(old, rec); else list.unshift(rec);
  if (list.length > 400) list.length = 400;
  save(true);
  return customItem(old || rec);
}
export function remember(item, g) {
  const list = (S.food.hist = S.food.hist || []);
  const snap = { key: item.key, k: item.k, name: item.name, brand: item.brand || '', e: item.e, n: item.n, g: g || item.g, ml: !!item.ml, ns: item.ns || '', cat: item.cat, u: item.u, serving: item.serving || 0, pack: item.pack || 0, code: item.code || '', src: item.src, desc: item.desc || '', label: item.label, t: Date.now() };
  const i = list.findIndex(x => x.key === item.key); if (i >= 0) list.splice(i, 1);
  list.unshift(snap); if (list.length > 40) list.length = 40;
}
export function toggleFav(item) {
  const list = (S.food.fav = S.food.fav || []);
  const i = list.findIndex(x => x.key === item.key);
  if (i >= 0) list.splice(i, 1); else list.unshift({ key: item.key, k: item.k, name: item.name, brand: item.brand || '', e: item.e, n: item.n, g: item.g, ml: !!item.ml, ns: item.ns || '', cat: item.cat, u: item.u, serving: item.serving || 0, pack: item.pack || 0, code: item.code || '', src: item.src, desc: item.desc || '', label: item.label });
  save(true);
  return i < 0;
}
export const isFav = key => (S.food.fav || []).some(x => x.key === key);

/* ---------- Mengen ---------- */
export function portionOptions(it) {
  const o = [];
  if (it.k === 'd') return [[0.75, 'Klein'], [1, 'Normal'], [1.5, 'Groß'], [2, 'Riesig']].map(([f, l]) => ({ g: Math.round(it.g * f), l, big: true }));
  if (it.serving) o.push({ g: it.serving, l: 'Portion' });
  if (it.pack && it.pack !== it.serving) o.push({ g: it.pack, l: it.ml ? 'Flasche/Dose' : 'Packung' });
  if (it.k === 'g' && !o.find(x => x.g === it.g)) o.push({ g: it.g, l: it.u || 'Portion' });
  for (const g of it.ml ? [100, 250, 330, 500] : [25, 50, 100, 150, 250]) if (!o.find(x => x.g === g)) o.push({ g, l: '' });
  return o.slice(0, 6);
}

/* ---------- Werte & Eintragen ---------- */
export function nutr(info, grams) {
  const f = grams / 100, v = i => (info.n[i] == null ? null : info.n[i] * f);
  return { g: Math.round(grams), kcal: v(0) == null ? 0 : Math.round(v(0)), prot: v(1), kh: v(2), sugar: v(3), fat: v(4), sat: v(5), fiber: v(6), salt: v(7) };
}
export function slotNow() { const h = new Date().getHours(); return h < 10 ? 'f' : h < 15 ? 'm' : h < 18 ? 's' : 'a'; }
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
export function sugarToday(k) { return extrasOf(k).reduce((s, x) => s + (x.sugar || 0), 0); }
