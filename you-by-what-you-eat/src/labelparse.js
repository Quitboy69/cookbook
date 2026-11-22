/* Nährwerttabelle von der Packung lesen (aus den Zeilen der Texterkennung)
 * Ergebnis: Werte je 100 g/ml (+ Portion), nur wenn die Tabelle plausibel ist. */

const norm = s => s.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[‚’`´]/g, "'").replace(/\s+/g, ' ').trim();

/* Zahl: 343 · 0,5 · <0,5 · 0.1 · 46g – OCR-Verwechslungen (O→0, ,→.) werden korrigiert */
const NUM = /(<|≤|ca\.?\s*)?\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*(kj|kcal|g|mg|ml|%)?/gi;
function fixDigits(s) {
  s = s.replace(/\b\d(?: \d){1,4}\b/g, m => m.replace(/ /g, ''));          // „1 4 5 6“ → „1456“
  return s.replace(/(?<=\d)[oO](?=\d|\b)/g, '0').replace(/(?<=\b)[oO](?=[.,]\d)/g, '0').replace(/(?<=\d)[lI|](?=\d|\b)/g, '1').replace(/(?<=\d[.,]\d)\s?[9q](?=\s|$)/g, ' g');
}
const toNum = s => parseFloat(String(s).replace(',', '.'));

function numbersIn(text) {
  const out = [];
  let m; NUM.lastIndex = 0;
  const t = fixDigits(text);
  while ((m = NUM.exec(t))) {
    const v = toNum(m[2]); if (isNaN(v)) continue;
    out.push({ v: m[1] && /</.test(m[1]) ? Math.max(0, v - 0.05) : v, unit: (m[3] || '').toLowerCase(), lt: !!(m[1] && /</.test(m[1])), at: m.index });
  }
  return out;
}

const KEYS = [
  // Reihenfolge wichtig: spezifische zuerst
  ['sat', /ges(ae|a)ttigt|saturate|davon gesaett|saturated/],
  ['sugar', /zucker|sugar/],
  ['fiber', /ballaststoff|fibre|fiber|ballast/],
  ['salt', /^salz|\bsalz\b|\bsalt\b|kochsalz/],
  ['sodium', /natrium|sodium/],
  ['prot', /eiweiss|eiweis|protein|\beiw\b/],
  ['kh', /kohlenhydrat|carbohydrate|kohlenhydr|\bkh\b|carbs/],
  ['fat', /^fett|\bfett\b|\bfat\b|lipid/],
  ['energy', /brennwert|energie|energy|nahrwert/]
];
const SKIP = /einfach ungesaett|mehrfach ungesaett|mono|poly|stärke|starch|polyol|vitamin|calcium|kalium|magnesium|eisen|zink|mineral/;

/* rows: Zeilen als Text (Name und Zahlen in einer Zeile) */
export function parseLabel(rows) {
  const res = { per100: {}, perServ: {}, servG: null, ml: false, hits: 0, order: null };
  const lines = rows.map(r => String(r).replace(/\t/g, ' ').trim()).filter(Boolean);
  // Kopfzeile: pro 100 g | pro Portion → Reihenfolge der Spalten
  for (const l of lines) {
    const n = norm(l);
    if (/(100\s?(g|ml))/.test(n) && /(portion|serving|stueck|scheibe|riegel|per )/.test(n)) {
      const a = n.search(/100\s?(g|ml)/), b = n.search(/portion|serving|stueck|scheibe|riegel/);
      if (a >= 0 && b >= 0) res.order = a < b ? '100first' : 'servfirst';
    }
    const pm = n.match(/(?:portion|serving|riegel|stueck|scheibe)[^0-9]{0,18}\(?\s*(\d{1,3}(?:[.,]\d)?)\s?(g|ml)/);
    if (pm && !res.servG) res.servG = toNum(pm[1]);
    if (/\b100\s?ml\b/.test(n) && !/100\s?g\b/.test(n)) res.ml = true;
  }
  const order = res.order || '100first';
  for (const raw0 of lines) {
    const raw = fixDigits(raw0), n = norm(raw);
    if (SKIP.test(n) && !/zucker|sugar/.test(n)) continue;
    let key = null;
    for (const [k, rx] of KEYS) if (rx.test(n)) { key = k; break; }
    if (!key) continue;
    if (key === 'sugar' && /zuckerarten|zuckerzusatz|ohne zucker/.test(n) && !/\d/.test(n)) continue;
    // Zahl(en) hinter dem Namen
    const nameEnd = raw.search(/[<≤]?\s*\d/);
    const tail = raw.slice(Math.max(0, nameEnd >= 0 ? nameEnd : 0));
    const nums = numbersIn(tail);
    if (!nums.length) continue;
    if (key === 'energy') {
      const kcal = nums.filter(x => x.unit === 'kcal'), kj = nums.filter(x => x.unit === 'kj');
      if (kcal.length) { res.per100.kcal = kcal[0].v; if (kcal[1]) res.perServ.kcal = kcal[1].v; }
      else if (kj.length) { res.per100.kcal = Math.round(kj[0].v / 4.184); if (kj[1]) res.perServ.kcal = Math.round(kj[1].v / 4.184); }
      else if (nums.length && nums[0].v > 20 && nums[0].v < 950 && !res.per100.kcal) res.per100.kcal = nums[0].v;
      continue;
    }
    // Einheiten-Zahlen bevorzugen (g/mg); reine Prozentwerte (%RM) am Ende ignorieren
    const val = nums.filter(x => x.unit !== '%' && x.unit !== 'kj' && x.unit !== 'kcal');
    if (!val.length) continue;
    let a = val[0], b = val[1];
    if (order === 'servfirst' && b) { const t = a; a = b; b = t; }
    const toG = x => (x.unit === 'mg' ? x.v / 1000 : x.v);
    const put = (target, k, x) => { if (target[k] == null) target[k] = toG(x); };
    put(res.per100, key, a);
    if (b) put(res.perServ, key, b);
  }
  // Natrium → Salz
  if (res.per100.salt == null && res.per100.sodium != null) res.per100.salt = Math.round(res.per100.sodium * 2.5 * 100) / 100;
  delete res.per100.sodium; delete res.perServ.sodium;
  const p = res.per100;
  // Plausibilitätsprüfung
  const keys = ['kcal', 'fat', 'kh', 'sugar', 'prot', 'salt'].filter(k => p[k] != null);
  res.hits = keys.length;
  res.ok = keys.length >= 4 && (p.kh == null || p.sugar == null || p.sugar <= p.kh + 0.6) && (p.fat == null || p.sat == null || p.sat <= p.fat + 0.3)
    && (p.kcal == null || p.fat == null || p.kh == null || p.prot == null || Math.abs(4 * (p.kh + p.prot) + 9 * p.fat - p.kcal) <= Math.max(60, 0.35 * p.kcal) + 25);
  return res;
}

/* Fehlende Felder behutsam ergänzen */
export function toN8(p) {
  const kcal = p.kcal != null ? p.kcal : (p.fat != null && p.kh != null && p.prot != null ? Math.round(9 * p.fat + 4 * (p.kh + p.prot)) : null);
  return [kcal, p.prot ?? null, p.kh ?? null, p.sugar ?? null, p.fat ?? null, p.sat ?? null, p.fiber ?? null, p.salt ?? null];
}
