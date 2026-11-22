/* Kassenbon verstehen: OCR-Zeilen → Bon-Zeilen → Artikel, Preise, Aktionen, Markt, Datum */
import { ING, STORES } from './data.js';

export const norm = s => s.toUpperCase()
  .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
  .replace(/[^A-Z0-9%&.,\- ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* 1) ML-Kit-Zeilen (mit Position) zu waagrechten Bon-Zeilen zusammensetzen.
 *    Artikelname links und Preis rechts kommen oft als getrennte Blöcke. */
export function rowsFromOcr(res) {
  const lines = (res.lines || []).filter(l => l.text && l.text.trim() && l.h > 0);
  if (!lines.length) return (res.text || '').split(/\n/);
  // Schräglage schätzen (Foto leicht verdreht)
  const angs = [];
  for (const l of lines) {
    if (l.pts && l.pts.length === 8 && l.w > 80) {
      const dx = l.pts[2] - l.pts[0], dy = l.pts[3] - l.pts[1];
      if (Math.abs(dx) > 1) angs.push(Math.atan2(dy, dx));
    }
  }
  angs.sort((a, b) => a - b);
  const ang = angs.length ? angs[angs.length >> 1] : 0;
  const cos = Math.cos(-ang), sin = Math.sin(-ang);
  const items = lines.map(l => {
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
    return { text: l.text.trim(), x: cx * cos - cy * sin - l.w / 2, y: cx * sin + cy * cos, h: l.h, w: l.w };
  }).sort((a, b) => a.y - b.y);
  const hs = items.map(i => i.h).sort((a, b) => a - b);
  const mh = hs[hs.length >> 1] || 20;
  const rows = [];
  for (const it of items) {
    let row = rows.find(r => Math.abs(r.y - it.y) < mh * 0.55);
    if (!row) { row = { y: it.y, parts: [] }; rows.push(row); }
    row.parts.push(it);
    row.y = row.parts.reduce((s, p) => s + p.y, 0) / row.parts.length;
  }
  rows.sort((a, b) => a.y - b.y);
  return rows.map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.text).join('   '));
}

/* 2) Bon-Zeilen interpretieren */
const META = /(SUMME|ZWISCHENSUMME|GESAMT|TOTAL|ZU ZAHLEN|ZAHLUNG|BAR\b|BARGELD|KARTE|BANKOMAT|MAESTRO|VISA|MASTERCARD|DEBIT|KONTAKTLOS|RUECKGELD|WECHSELGELD|GEGEBEN|MWST|UST|NETTO|BRUTTO|STEUER|UID|ATU\d|TEL\.?|TELEFON|FILIALE|KASSE|KASSIER|BON\s?NR|BELEG|DANKE|OEFFNUNGS|WWW\.|HTTP|SIGNATUR|TSE|DATUM|UHRZEIT|POS\b|TERMINAL|AUTORIS|TRANS|GENEHMIG|KUNDENKARTE|PUNKTE|STAND|EINKAUF|IHR\s|SIE\s?WURDEN|BEDIENT|STEUERNR|RKSV|KASSENID|BELEGNR|MWST-SATZ|SATZ|EUR\s*$)/;
const DISC = /(RABATT|AKTION|PREISVORTEIL|ERSPARNIS|SIE SPAREN|GESPART|NACHLASS|GUTSCHEIN|JOE\b|JÖ|JOE BONUS|BONUS|PICKERL|MINUS|ABZUG|STATT|SONDERPREIS|ANGEBOT|LIDL PLUS|COUPON|MENGENRABATT|\d+\s?%)/;
const PRICE_END = /(-?\s?\d{1,4}[,.]\d{2})\s*(-)?\s*(?:€|EUR)?\s*[A-D]?\s*\*?\s*$/;

export const toNum = s => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));

function parseSize(name) {
  const m = name.match(/(\d+(?:[,.]\d+)?)\s?(KG|G|GR|L|ML|LTR)\b/);
  if (!m) return null;
  let v = toNum(m[1]); const u = m[2];
  if (u === 'G' || u === 'GR') return { size: v / 1000, sizeUnit: 'kg' };
  if (u === 'KG') return { size: v, sizeUnit: 'kg' };
  if (u === 'ML') return { size: v / 1000, sizeUnit: 'l' };
  return { size: v, sizeUnit: 'l' };
}
function cleanName(s) {
  return s.replace(PRICE_END, '')
    .replace(/^\s*\d{4,}\s+/, '')                // Artikelnummer
    .replace(/\s+\d+\s?(STK|ST)?\s?[X×*]\s?\d+[,.]\d{2}.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[*#]+/g, '').trim();
}

export function detectStore(rows) {
  const head = rows.slice(0, 12).map(norm).join(' ');
  const all = rows.map(norm).join(' ');
  for (const [id, st] of Object.entries(STORES)) for (const k of st.kw) if (head.includes(norm(k))) return id;
  for (const [id, st] of Object.entries(STORES)) for (const k of st.kw) if (all.includes(norm(k))) return id;
  return 'sonst';
}
export function detectDate(rows) {
  for (const r of rows) {
    const m = r.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b/);
    if (m) {
      let [_, d, mo, y] = m; y = +y; if (y < 100) y += 2000;
      if (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31 && y >= 2020 && y <= 2100) return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }
  }
  return null;
}

export function matchIng(name) {
  const n = ' ' + norm(name) + ' ';
  let best = null, bl = 0;
  for (const [id, g] of Object.entries(ING)) {
    if (g.ex && g.ex.some(e => n.includes(norm(e)))) continue;
    for (const k of g.kw) {
      const kk = norm(k);
      if (kk.length < 3) continue;
      if (n.includes(kk) && kk.length > bl) { best = id; bl = kk.length; }
    }
  }
  return best;
}

export function parseReceipt(rows) {
  rows = rows.map(r => r.replace(/\t/g, '   ').trim()).filter(Boolean);
  const items = [];
  let total = null, extraDisc = 0, afterSub = false;
  let pendingQty = null;
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const n = norm(raw);
    const pm = raw.match(PRICE_END);
    // Summe merken
    if (/(SUMME|ZU ZAHLEN|GESAMT|TOTAL)/.test(n) && pm) {
      if (/ZWISCHEN/.test(n)) { afterSub = true; continue; }
      if (total == null) total = Math.abs(toNum(pm[1]));
      afterSub = true; continue;
    }
    // Mengenzeile: "2 x 1,29" oder "1,234 kg x 1,99 EUR/kg"
    const wq = n.match(/(\d+[,.]\d{1,3})\s?KG\s?[X*]\s?(\d+[,.]\d{2})/);
    const cq = n.match(/^(\d{1,2})\s?(?:STK|ST)?\s?[X*]\s?(\d+[,.]\d{2})/);
    if (wq || cq) {
      const info = wq ? { kg: toNum(wq[1]), unit: toNum(wq[2]) } : { qty: +cq[1], unit: toNum(cq[2]) };
      const rest = cleanName(raw.replace(wq ? wq[0] : cq[0], '').replace(/EUR\s?\/\s?KG/i, ''));
      const last = items[items.length - 1];
      if (/[A-ZÄÖÜ]{3,}/i.test(rest) && pm) {
        // Name in derselben Zeile
        items.push(mkItem(rest, toNum(pm[1]), info));
      } else if (last && !last.qty && !last.kg && Math.abs((info.qty || 1) * (info.unit) - last.price) < 0.06 + (info.kg ? last.price * 0.05 : 0)) {
        Object.assign(last, info);
      } else if (last && !last.qty && !last.kg && info.kg && Math.abs(info.kg * info.unit - last.price) < 0.1) {
        Object.assign(last, info);
      } else {
        pendingQty = info;
      }
      continue;
    }
    if (!pm) continue;
    const val = toNum(pm[1]) * (pm[2] ? -1 : 1);
    // Rabatt-/Aktionszeile
    if (val < 0 || (DISC.test(n) && !/[A-Z]{4,}.*[A-Z]{4,}/.test(n.replace(DISC, '')))) {
      if (afterSub) { if (total == null) extraDisc += Math.abs(val); continue; }   // Bon-Rabatt (z. B. jö Bonus) – keinem Artikel zuordnen
      const last = items[items.length - 1];
      const pct = (n.match(/(\d{1,2})\s?%/) || [])[1];
      if (last) {
        last.disc = Math.round(((last.disc || 0) + Math.abs(val)) * 100) / 100;
        last.promo = true;
        if (pct) last.pct = +pct;
      }
      continue;
    }
    if (META.test(n) || afterSub) continue;
    const name = cleanName(raw);
    if (!/[A-ZÄÖÜa-zäöü]{2,}/.test(name) || name.length < 3) continue;
    const it = mkItem(name, val, pendingQty);
    pendingQty = null;
    if (/AKTION|ANGEBOT|SONDERPREIS|-\d{1,2}\s?%/.test(n)) { it.promo = true; const p = (n.match(/(\d{1,2})\s?%/) || [])[1]; if (p) it.pct = +p; }
    items.push(it);
  }
  return { items, total, extraDisc: Math.round(extraDisc * 100) / 100 };
}

function mkItem(name, price, info) {
  const it = { name, price: Math.round(price * 100) / 100, ing: matchIng(name), promo: false, disc: 0 };
  const sz = parseSize(norm(name)); if (sz) Object.assign(it, sz);
  if (info) { if (info.kg) it.kg = info.kg; if (info.qty) it.qty = info.qty; }
  return it;
}

export function analyse(rowsOrOcr) {
  const rows = Array.isArray(rowsOrOcr) ? rowsOrOcr : rowsFromOcr(rowsOrOcr);
  const { items, total, extraDisc } = parseReceipt(rows);
  return { rows, items, total, extraDisc, store: detectStore(rows), date: detectDate(rows) };
}

/* Beispielbon zum Ausprobieren (nur im Browser-Modus) */
export const DEMO = `HOFER KG
Filiale Linz-Urfahr
Rohrbacher Str. 50, 4040 Linz
EUR
2 x 1,32
MILFINA VOLLMILCH 3,5% 1L   2,64 A
FASCHIERTES GEMISCHT 500G   4,99 A
AKTION -25%   -1,25
BASMATI REIS 1KG   1,19 A
PENNE RIGATE 500G   0,65 A
BANANEN   1,98 A
1,174 kg x 1,69 EUR/kg
PASSIERTE TOMATEN 500G   0,69 A
ROTE LINSEN 500G   1,19 A
SCHOKOLADE NOUGAT   0,99 B
SUMME EUR   13,07
BAR   20,00
RUECKGELD   6,93
22.11.2026  10:42  Kasse 3
DANKE FUER IHREN EINKAUF`;
