/* You By What You Eat – Start, Aktionen, Benachrichtigungen */
import { DISHES, ING, STORES } from './data.js';
import { S, save, resetAll, exportJSON } from './store.js';
import * as E from './engine.js';
import * as V from './screens.js';
import { ui } from './screens.js';
import { $, $$, go, back, refresh, setRenderer, initRouter, current, toast, confetti, sheet, ico, esc } from './ui.js';
import { analyse, DEMO } from './receipt.js';
import { isNative, haptic, onBack, exitApp, onResume, takeReceiptPhoto, ocr, notifPermission, setupNotifications, reschedule, testNotification, statusBar } from './native.js';

let notifPerm = 'unknown';

/* ---------- Routen ---------- */
setRenderer(route => {
  const [path, qs] = route.replace(/^#\//, '').split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const [base, arg] = path.split('/');
  switch (base) {
    case 'heute': return V.heute();
    case 'woche': return V.woche();
    case 'bon': return V.bon();
    case 'einkauf': return V.einkauf();
    case 'ich': return V.ich();
    case 'dish': return V.dish(arg, q);
    case 'info': return V.info(arg);
    case 'review': return V.review();
    case 'receipt': return V.receipt(arg);
    case 'store': return V.store(arg);
    case 'ing': return V.ingredient(arg);
    case 'promos': return V.promos();
    case 'profile': return V.profile();
    case 'notif': return V.notif(notifPerm);
    case 'ratings': return V.ratings();
    case 'rezepte': return V.rezepte(ui.rz);
    case 'trinken': return V.trinken();
    case 'weight': return V.weight();
    case 'onboarding': return V.onboarding();
    default: return V.heute();
  }
});

/* ---------- Theme ---------- */
function applyTheme() {
  const t = S.profile.theme;
  if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  statusBar(dark);
  const m = $('meta[name=theme-color]'); if (m) m.content = dark ? '#0B1410' : '#F2F6F3';
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ---------- Log-Helfer ---------- */
const logOf = k => (S.log[k] = S.log[k] || { eaten: {} });

/* ---------- Bewerten ---------- */
function doRate(id, k, slot, v, el) {
  const res = E.rate(id, k, slot, v);
  const L = logOf(k); L.eaten = L.eaten || {}; L.eaten[slot] = true;
  save();
  if (v >= 5 && el) { const r = el.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2); }
  if (res.newlyBlocked) {
    haptic.warn();
    const from = E.replaceBlocked();
    let repl = '';
    if (from && S.plan[from]) repl = ' Ersetzt durch <b>' + esc(DISHES[S.plan[from].a].name) + '</b>.';
    toast('🚫 <b>' + esc(DISHES[id].name) + '</b> fliegt raus – öfter unter 3 Sterne.' + repl, 'toast-warn');
    scheduleAll();
  } else if (res.low) {
    haptic.tap();
    toast('Notiert. Noch einmal unter 3 ★ und es kommt automatisch was anderes.');
  } else {
    haptic.ok();
    if (v >= 4) toast(v === 5 ? 'Top! Kommt öfter dran 🎉' : 'Merk ich mir – kommt öfter dran 👍');
  }
}
function setStarsUI(row, v) {
  $$('.star', row).forEach((s, i) => {
    const on = i === 0 ? v === 0 : v >= i;
    s.classList.toggle('on', on);
    if (on) { s.classList.remove('pop'); void s.offsetWidth; s.style.animationDelay = (i * 45) + 'ms'; s.classList.add('pop'); }
  });
}
export function openRate(k) {
  if (!S.plan[k]) return;
  haptic.tap();
  sheet(V.rateSheetHTML(k), (el, close) => {
    el.addEventListener('click', e => {
      const st = e.target.closest('[data-act="star"]');
      if (st) {
        const row = st.closest('.stars-row'), v = +st.dataset.v;
        setStarsUI(row, v);
        doRate(row.dataset.id, row.dataset.k, row.dataset.slot, v, st);
        const ri = row.closest('.rate-item'); if (ri) $('.eat', ri).classList.add('on');
        return;
      }
      const eat = e.target.closest('[data-act="eat"]');
      if (eat) { toggleEat(eat.dataset.k, eat.dataset.slot); eat.classList.toggle('on'); haptic.tap(); }
    });
    el.addEventListener('change', e => {
      const cb = e.target.closest('[data-act="cooked-cb"]');
      if (cb) { logOf(cb.dataset.k).cooked = cb.checked; save(); haptic.tap(); }
    });
  });
  const obs = new MutationObserver(() => { if (!$('.sheet-wrap')) { obs.disconnect(); refresh(); } });
  obs.observe(document.body, { childList: true });
}
function toggleEat(k, slot) {
  const L = logOf(k); L.eaten = L.eaten || {};
  L.eaten[slot] = !L.eaten[slot]; save();
}

/* ---------- Kassenbon ---------- */
async function startScan(src) {
  let photo;
  try { photo = await takeReceiptPhoto(src); }
  catch (e) { if (!/cancel/i.test(String(e && e.message || e))) toast('Kamera: ' + esc(e.message || e), 'toast-warn'); return; }
  ui.review = { state: 'scan', img: photo.webPath };
  go('#/review');
  const t0 = Date.now();
  try {
    const res = await ocr(photo.path);
    const a = analyse(res);
    await new Promise(r => setTimeout(r, Math.max(0, 1300 - (Date.now() - t0))));   // Scan-Animation kurz zeigen
    if (!a.items.length) { ui.review = { state: 'error', error: 'Auf dem Foto wurden keine Artikel mit Preis gefunden. Bon flach hinlegen, gutes Licht, ganz ins Bild – und nochmal.' }; refresh(false); return; }
    ui.review = { state: 'done', img: photo.webPath, ...a };
    haptic.ok();
    refresh(false);
  } catch (e) {
    ui.review = { state: 'error', error: String(e && e.message || e) };
    refresh(false);
  }
}
function scanText(txt) {
  const a = analyse(txt.split(/\n/));
  if (!a.items.length) { toast('Keine Artikel mit Preis gefunden.', 'toast-warn'); return; }
  ui.review = { state: 'done', img: null, ...a };
  go('#/review');
}
function readReviewInputs() {
  const R = ui.review; if (!R || R.state !== 'done') return;
  $$('#rv-items .rv-item').forEach(row => {
    const it = R.items[+row.dataset.i]; if (!it) return;
    it.name = $('[data-f=name]', row).value.trim();
    const pr = parseFloat($('[data-f=price]', row).value.replace(',', '.'));
    it.price = isNaN(pr) ? 0 : pr;
    it.ing = $('[data-f=ing]', row).value || null;
  });
  const d = $('#rv-date'); if (d && d.value) R.date = d.value;
}
function saveReview() {
  readReviewInputs();
  const R = ui.review;
  const items = R.items.filter(i => i.name && i.price > 0).map(i => ({ name: i.name, price: Math.round(i.price * 100) / 100, ing: i.ing || null, promo: !!i.promo, disc: i.disc || 0, pct: i.pct || 0, qty: i.qty || 0, kg: i.kg || 0, size: i.size || 0, sizeUnit: i.sizeUnit || null }));
  if (!items.length) { toast('Keine Artikel zum Speichern.', 'toast-warn'); return; }
  const before = new Set(Object.entries(E.learned().info).flatMap(([ing, per]) => Object.keys(per).map(s => ing + '|' + s)));
  const r = { id: Date.now().toString(36), store: R.store || 'sonst', date: R.date || E.todayKey(), total: R.total, items };
  S.receipts.push(r);
  E.invalidatePrices(); save(true);
  const after = E.learned();
  const learnedN = items.filter(i => i.ing).length;
  const fresh = Object.entries(after.info).flatMap(([ing, per]) => Object.keys(per).map(s => ing + '|' + s)).filter(x => !before.has(x)).length;
  const promosN = items.filter(i => i.promo).length;
  ui.review = null;
  haptic.ok();
  const c = $('#screens'); const rr = c.getBoundingClientRect(); confetti(rr.width / 2, rr.height / 2, 40);
  go('#/bon');
  setTimeout(() => sheet(`<div class="learn-sum"><span class="ls-emo">🧾✨</span><h2 class="sh-t">Gelernt!</h2>
    <div class="ls-tiles"><div><b>${learnedN}</b><small>Preise</small></div><div><b>${fresh}</b><small>neu</small></div><div><b>${promosN}</b><small>Aktionen</small></div></div>
    <p class="sh-sub">${STORES[r.store].name} ist jetzt bekannter. Kosten, Einkaufsliste und Plan nutzen ab sofort diese Preise${promosN ? ' – und Gerichte mit Aktions-Zutaten kommen eher dran' : ''}.</p>
    <button class="btn wide tap" data-close>Super</button></div>`), 450);
  // Plan der nächsten Tage darf jetzt Aktionen berücksichtigen (nur ab morgen, nichts schon Gekochtes)
  if (promosN) { E.replanFrom(E.addDays(E.todayKey(), 1)); scheduleAll(); }
}

/* ---------- Benachrichtigungen planen ---------- */
const at = (k, hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = E.dateOf(k); d.setHours(h, m || 0, 0, 0); return d; };
const dayIdx = k => E.daysBetween('2026-01-01', k);
export async function scheduleAll() {
  if (!isNative) return;
  E.ensurePlan();
  const N = S.notif, list = [], t = E.todayKey(), T = E.targets();
  for (let i = 0; i < 7; i++) {
    const k = E.addDays(t, i), p = S.plan[k]; if (!p) continue;
    const base = (dayIdx(k) % 100000) * 10;
    const f = DISHES[p.f], a = DISHES[p.a];
    if (N.f.on) list.push({ id: base + 1, at: at(k, N.f.t), title: 'Guten Morgen ☀️', body: 'Klein anfangen: ' + f.name + ' – nur ≈ ' + f.kcal + ' kcal. Ein paar Löffel reichen schon.', action: null, extra: { route: 'dish', id: p.f, date: k, slot: 'f' } });
    if (N.cook.on) list.push({ id: base + 2, at: at(k, N.cook.t), title: 'Zeit zum Kochen 🍳', body: 'Heute: ' + a.name + ' (≈ ' + a.min + ' Min). Hast du schon angefangen?', action: 'COOK', extra: { route: 'dish', id: p.a, date: k, slot: 'a' } });
    if (N.rate.on) list.push({ id: base + 3, at: at(k, N.rate.t), title: 'Schon gegessen? 🍽️', body: 'Wie war ' + a.name + '? Gib 0–5 Sterne – was öfter unter 3 bekommt, fliegt automatisch raus.', action: 'RATE', extra: { route: 'rate', date: k } });
    if (N.water.on) (N.water.t || '10:00,15:30').split(',').slice(0, 3).forEach((tt, j) => list.push({ id: base + 5 + j, at: at(k, tt.trim()), title: 'Trinkpause 💧', body: 'Ein großes Glas Wasser. Heute-Ziel: ≈ ' + E.lit(T.water + (p.train ? 1 : 0)) + ' L.', channel: 'tips', extra: { route: 'heute' } }));
    if (N.shop.on && E.wd(k) === N.shop.day) list.push({ id: base + 4, at: at(k, N.shop.t), title: 'Einkaufstag 🛒', body: 'Deine Liste ist fertig. Danach den Kassenbon scannen – die App lernt die Preise deines Markts.', action: 'SHOP', channel: 'tips', extra: { route: 'einkauf' } });
  }
  return reschedule(list);
}
function onNotifAction(actionId, extra) {
  const k = extra.date || E.todayKey();
  if (actionId === 'eaten') { const L = logOf(k); L.eaten = { f: true, m: true, s: true, a: true }; save(); ui.day = k; go('#/heute'); setTimeout(() => openRate(k), 500); return; }
  if (actionId === 'cooked') { logOf(k).cooked = true; save(); ui.day = k; go('#/heute'); toast('Gekocht ✓ – Boxen innerhalb von 2 Stunden in den Kühlschrank!'); return; }
  if (actionId === 'list') { go('#/einkauf'); return; }
  if (actionId === 'scan') { go('#/bon'); return; }
  if (actionId === 'rate' || extra.route === 'rate') { ui.day = k; go('#/heute'); setTimeout(() => openRate(k), 500); return; }
  if (actionId === 'recipe' || extra.route === 'dish') { go('#/heute'); setTimeout(() => go('#/dish/' + extra.id + '?d=' + k + '&s=' + (extra.slot || 'a')), 300); return; }
  if (extra.route) go('#/' + extra.route);
}

/* ---------- Aktionen ---------- */
const A = {
  back() { haptic.tap(); back(); },
  day(el) {
    haptic.tap(); ui.day = el.dataset.k;
    if (el.dataset.tab) { go('#/heute'); return; }
    const old = $('.screen:last-child .days .day.on'); refresh();
    const n = $('.screen:last-child .days .day.on'); if (n) n.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    $$('.screen:last-child .hero, .screen:last-child .cook').forEach(c => c.animate([{ opacity: .3, transform: 'translateY(8px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }));
  },
  amt(el) { haptic.tap(); ui.amt = el.dataset.v; refresh(); },
  eat(el) {
    toggleEat(el.dataset.k, el.dataset.slot); haptic.tap();
    el.classList.toggle('on'); el.closest('.meal') && el.closest('.meal').classList.toggle('eaten');
    setTimeout(refresh, 260);
  },
  cooked(el) {
    const L = logOf(el.dataset.k); L.cooked = !L.cooked; save();
    if (L.cooked) { haptic.ok(); const r = el.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top, 18); toast('Gekocht ✓ – Boxen abkühlen lassen und innerhalb von 2 Stunden in den Kühlschrank.'); }
    refresh();
  },
  reroll(el) {
    const k = el.dataset.k || ui.day, slot = el.dataset.slot;
    haptic.med();
    const icon = el.querySelector('svg'); if (icon) icon.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 500 });
    E.reroll(k, slot); scheduleAll();
    const p = S.plan[k];
    setTimeout(() => {
      if (el.dataset.back) { back(); setTimeout(() => toast('Neu: <b>' + esc(DISHES[p[slot]].name) + '</b>'), 400); }
      else { refresh(); toast('Neu: <b>' + esc(DISHES[p[slot]].name) + '</b>'); }
    }, 280);
  },
  'rate-open'(el) { openRate(el.dataset.k); },
  'quick-rate'(el) {
    const k = el.dataset.k, v = +el.dataset.v, p = S.plan[k];
    const row = el.parentElement;
    $$('.star', row).forEach((s, i) => { s.classList.toggle('on', i < v); if (i < v) { s.classList.remove('pop'); void s.offsetWidth; s.style.animationDelay = (i * 45) + 'ms'; s.classList.add('pop'); } });
    doRate(p.a, k, 'a', v, el);
    setTimeout(() => openRate(k), 650);
  },
  star(el) {
    const row = el.closest('.stars-row'), v = +el.dataset.v;
    setStarsUI(row, v);
    doRate(row.dataset.id, row.dataset.k, row.dataset.slot, v, el);
    setTimeout(refresh, 900);
  },
  glass(el) {
    const k = el.dataset.k, i = +el.dataset.i, L = logOf(k);
    L.water = (L.water || 0) === i + 1 ? i : i + 1; save(); haptic.tap();
    refresh();
  },
  water(el) { const L = logOf(el.dataset.k); L.water = Math.max(0, Math.min(30, (L.water || 0) + (+el.dataset.v))); save(); haptic.tap(); refresh(); },
  wmode(el) { logOf(el.dataset.k).waterMode = el.dataset.v; save(); haptic.tap(); refresh(); },
  drink(el) { ui.drink = el.dataset.v; haptic.tap(); refresh(); },
  step(el) { el.classList.toggle('done'); haptic.tap(); },
  unblock(el) { E.unblock(el.dataset.id); haptic.ok(); toast('<b>' + esc(DISHES[el.dataset.id].name) + '</b> kommt wieder in den Plan.'); refresh(); },
  block(el) {
    const id = el.dataset.id;
    sheet(`<h2 class="sh-t">${esc(DISHES[id].name)} nie mehr planen?</h2><p class="sh-sub">Du kannst es in „Meine Bewertungen“ jederzeit zurückholen.</p><div class="sh-btns"><button class="btn ghost tap" data-close>Abbrechen</button><button class="btn tap" id="blk-yes" data-close>Ja, aussortieren</button></div>`, el2 => {
      $('#blk-yes', el2).addEventListener('click', () => { E.block(id); E.replaceBlocked(); scheduleAll(); haptic.warn(); toast('Aussortiert – der Plan wurde angepasst.'); setTimeout(() => back(), 300); });
    });
  },
  shuffle(el) {
    haptic.med();
    const icon = el.querySelector('svg'); if (icon) icon.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(720deg)' }], { duration: 700 });
    $$('.screen:last-child .wday, .screen:last-child .card').forEach((c, i) => c.animate([{ transform: 'none' }, { transform: `translateX(${i % 2 ? 8 : -8}px) rotate(${i % 2 ? 1 : -1}deg)` }, { transform: 'none' }], { duration: 420, delay: i * 30 }));
    E.shuffleFuture(); scheduleAll();
    setTimeout(() => { refresh(); toast('Neu gemischt – ab morgen frischer Plan 🎲'); }, 500);
  },
  /* Kassenbon */
  scan(el) { haptic.tap(); startScan(el.dataset.src); },
  'scan-text'() { const t = $('#bon-text'); if (t && t.value.trim()) scanText(t.value); else toast('Erst Bon-Text einfügen.'); },
  'scan-demo'() { scanText(DEMO); },
  'rv-store'(el) { readReviewInputs(); ui.review.store = el.dataset.v; haptic.tap(); refresh(); },
  'rv-del'(el) { readReviewInputs(); const row = el.closest('.rv-item'); const i = +row.dataset.i; row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-40px)' }], { duration: 220 }).onfinish = () => { ui.review.items.splice(i, 1); refresh(); }; haptic.tap(); },
  'rv-add'() { readReviewInputs(); ui.review.items.push({ name: '', price: 0, ing: null, promo: false, disc: 0 }); refresh(); setTimeout(() => { const n = $$('.screen:last-child .rv-name'); n[n.length - 1] && n[n.length - 1].focus(); }, 50); },
  'rv-promo'(el) { readReviewInputs(); const it = ui.review.items[+el.closest('.rv-item').dataset.i]; it.promo = !it.promo; if (!it.promo) { it.disc = 0; it.pct = 0; } haptic.tap(); refresh(); },
  'rv-save'() { saveReview(); },
  'rc-del'(el) {
    const id = el.dataset.id;
    sheet(`<h2 class="sh-t">Bon löschen?</h2><p class="sh-sub">Die daraus gelernten Preise werden entfernt.</p><div class="sh-btns"><button class="btn ghost tap" data-close>Abbrechen</button><button class="btn tap" id="del-yes" data-close>Löschen</button></div>`, el2 => {
      $('#del-yes', el2).addEventListener('click', () => { S.receipts = S.receipts.filter(r => r.id !== id); E.invalidatePrices(); save(); haptic.warn(); setTimeout(() => back(), 250); });
    });
  },
  /* Einkauf */
  'shop-check'(el) {
    const wk = 'w' + ui.shopFrom, set = new Set(S.shop[wk] || []), id = el.dataset.id;
    if (set.has(id)) set.delete(id); else set.add(id);
    S.shop[wk] = [...set]; save(); haptic.tap();
    el.classList.toggle('on'); el.closest('.rc-item').classList.toggle('done');
    setTimeout(refresh, 250);
  },
  'shop-reset'() { S.shop['w' + ui.shopFrom] = []; save(); haptic.tap(); refresh(); },
  'shop-from'(el) { ui.shopFrom = E.addDays(E.todayKey(), +el.dataset.v); haptic.tap(); refresh(); },
  /* Profil */
  pset(el) {
    const k = el.dataset.k; let v = el.dataset.v;
    S.profile[k] = v === '' ? null : v;
    if (k === 'priceMode') E.invalidatePrices();
    save(); haptic.tap(); refresh();
  },
  persons(el) { S.profile.persons = Math.max(1, Math.min(8, S.profile.persons + (+el.dataset.v))); save(); haptic.tap(); refresh(); },
  train(el) {
    const i = +el.dataset.v, s = new Set(S.profile.train || []);
    if (s.has(i)) s.delete(i); else s.add(i);
    S.profile.train = [...s].sort(); save(); haptic.tap();
    E.ensurePlan(); refresh();
  },
  theme(el) { S.profile.theme = el.dataset.v; save(); applyTheme(); haptic.tap(); refresh(); },
  'rz-filter'(el) { ui.rz = el.dataset.v; haptic.tap(); refresh(); },
  'w-add'() {
    const v = parseFloat(($('#w-in').value || '').replace(',', '.'));
    if (!(v > 30 && v < 250)) { toast('Bitte ein Gewicht in kg eingeben.'); return; }
    const t = E.todayKey(); S.weights = S.weights.filter(x => x.d !== t); S.weights.push({ d: t, kg: v });
    S.profile.weight = v; save(); haptic.ok(); toast('Eingetragen: ' + E.lit(v) + ' kg'); refresh();
  },
  /* Erinnerungen */
  async 'notif-ask'() { notifPerm = await notifPermission(true); if (notifPerm === 'granted') { await scheduleAll(); toast('Erinnerungen sind an 🔔'); } refresh(); },
  async 'notif-test'() {
    if (!isNative) { toast('Geht nur in der installierten App.'); return; }
    notifPerm = await notifPermission(true);
    if (notifPerm !== 'granted') { toast('Bitte erst Benachrichtigungen erlauben.', 'toast-warn'); return; }
    await testNotification(); toast('Kommt in 5 Sekunden – App ruhig schließen.');
  },
  shopday(el) { S.notif.shop.day = +el.dataset.v; save(); scheduleAll(); haptic.tap(); refresh(); },
  /* Daten */
  async backup() {
    const txt = exportJSON();
    try { await navigator.clipboard.writeText(txt); toast('Backup kopiert – z. B. in einer Notiz speichern.'); }
    catch (e) { sheet(`<h2 class="sh-t">Backup</h2><p class="sh-sub">Alles markieren und kopieren:</p><textarea class="ta" rows="8" readonly>${esc(txt)}</textarea><button class="btn wide tap" data-close>Fertig</button>`); }
  },
  restore() {
    sheet(`<h2 class="sh-t">Backup einspielen</h2><p class="sh-sub">Backup-Text einfügen. Das ersetzt alle aktuellen Daten.</p><textarea id="rs-ta" class="ta" rows="7"></textarea><div class="sh-btns"><button class="btn ghost tap" data-close>Abbrechen</button><button class="btn tap" id="rs-yes">Einspielen</button></div>`, (el, close) => {
      $('#rs-yes', el).addEventListener('click', () => {
        try {
          const d = JSON.parse($('#rs-ta', el).value);
          if (!d || !d.profile) throw new Error('kein Backup');
          Object.keys(S).forEach(k => delete S[k]); Object.assign(S, d); save(true); E.invalidatePrices();
          close(); toast('Backup eingespielt ✓'); applyTheme(); scheduleAll(); go('#/heute');
        } catch (e) { toast('Das ist kein gültiges Backup.', 'toast-warn'); }
      });
    });
  },
  reset() {
    sheet(`<h2 class="sh-t">Wirklich alles löschen?</h2><p class="sh-sub">Plan, Kassenbons, Bewertungen und Einstellungen werden gelöscht.</p><div class="sh-btns"><button class="btn ghost tap" data-close>Abbrechen</button><button class="btn danger tap" id="rst-yes" data-close>Alles löschen</button></div>`, el => {
      $('#rst-yes', el).addEventListener('click', () => { resetAll(); E.invalidatePrices(); ui.ob = 0; applyTheme(); go('#/heute'); setTimeout(() => go('#/onboarding', { replace: true }), 50); });
    });
  },
  /* Onboarding */
  'ob-next'() {
    haptic.tap();
    const st = $('.screen:last-child .ob-step');
    const next = () => { ui.ob = Math.min(3, ui.ob + 1); refresh(false); const n = $('.screen:last-child .ob-step'); n && n.animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }); };
    if (st) st.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-40px)' }], { duration: 200, fill: 'forwards' }).onfinish = next; else next();
  },
  async 'ob-notif'() { notifPerm = await notifPermission(true); A['ob-done'](); },
  'ob-done'() {
    S.profile.onboarded = true; save(true);
    E.ensurePlan(); scheduleAll();
    haptic.ok();
    go('#/heute');
    setTimeout(() => { confetti(window.innerWidth / 2, window.innerHeight / 3, 46); toast('Dein Plan steht! Tippe auf alles – überall gibt’s Erklärungen. ✨'); }, 450);
  }
};

/* ---------- Klicks & Eingaben ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a && !a.closest('.sheet')) { const fn = A[a.dataset.act]; if (fn) { e.preventDefault(); fn(a, e); } return; }
  const g = e.target.closest('[data-go]');
  if (g && !g.closest('.sheet')) { e.preventDefault(); haptic.tap(); go(g.dataset.go); }
  if (a && a.closest('.sheet') && A[a.dataset.act] && !['star', 'eat', 'cooked-cb'].includes(a.dataset.act)) A[a.dataset.act](a, e);
  if (g && g.closest('.sheet')) { window.__sheetClose && window.__sheetClose(); go(g.dataset.go); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.p) {
    const k = el.dataset.p; let v = el.value.trim();
    if (['height', 'weight', 'age'].includes(k)) { v = parseFloat(v.replace(',', '.')); if (isNaN(v)) v = k === 'age' ? null : S.profile[k]; }
    if (k === 'height' && v) v = Math.max(120, Math.min(230, v));
    if (k === 'weight' && v) v = Math.max(35, Math.min(250, v));
    if (k === 'age' && v) v = Math.max(12, Math.min(100, Math.round(v)));
    S.profile[k] = v; save();
    if (current().includes('onboarding')) setTimeout(() => refresh(false), 0);
  }
  if (el.dataset.nt) { S.notif[el.dataset.nt].on = el.checked; save(); haptic.tap(); scheduleAll(); refresh(); }
  if (el.dataset.n) { const key = el.dataset.n; const rest = (S.notif[key].t || '').split(',').slice(1); S.notif[key].t = [el.value, ...rest].join(','); save(); scheduleAll(); }
  if (el.dataset.f && el.closest('.rv-item')) { readReviewInputs(); if (el.dataset.f === 'ing') el.closest('.rv-item').classList.toggle('matched', !!el.value); }
});

/* ---------- Start ---------- */
async function boot() {
  applyTheme();
  E.ensurePlan();
  initRouter();
  if (!S.profile.onboarded) setTimeout(() => go('#/onboarding', { replace: true }), 30);
  onBack(() => {
    if (window.__sheetClose) { window.__sheetClose(); return; }
    if (current().includes('onboarding')) { exitApp(); return; }
    if (!back()) exitApp();
  });
  let lastDay = E.todayKey();
  onResume(() => {
    if (E.todayKey() !== lastDay) { lastDay = E.todayKey(); ui.day = lastDay; E.ensurePlan(); scheduleAll(); }
    if (['#/heute', '#/woche', '#/einkauf'].includes(current())) refresh();
  });
  if (isNative) {
    await setupNotifications(onNotifAction);
    notifPerm = await notifPermission(false);
    if (S.profile.onboarded) scheduleAll();
  } else notifPerm = 'browser';
  setTimeout(() => document.body.classList.add('ready'), 50);
}
boot();
