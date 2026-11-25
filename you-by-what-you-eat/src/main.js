/* You By What You Eat – Start, Aktionen, Timer, Benachrichtigungen */
import { DISHES, STORES } from './data.js';
import { S, save, resetAll, exportJSON, restoreState } from './store.js';
import * as E from './engine.js';
import * as SP from './sport.js';
import * as V from './screens.js';
import { ui } from './screens.js';
import { $, $$, go, back, refresh, setRenderer, initRouter, current, toast, confetti, sheet, ico, esc, ring } from './ui.js';
import { analyse, DEMO } from './receipt.js';
import * as FA from './foodai.js';
import { LABELS } from './foodkb.js';
import * as N from './nutri.js';
import { toN8 } from './labelparse.js';
import { chatNotify, isNative, haptic, onBack, exitApp, onResume, takeReceiptPhoto, ocr, notifPermission, setupNotifications, reschedule, testNotification, statusBar, scheduleRunCues, cancelRunCues, analyzeFood, makeThumb, openExternal, onDeepLink } from './native.js';
import * as Strava from './strava.js';
import * as V2 from './screens2.js';
import * as W from './workouts.js';
import * as V3 from './screens3.js';
import * as SO from './social.js';
import { parseTrack } from './trackfile.js';

let notifPerm = 'unknown';
if (!S.profile.runStart) { S.profile.runStart = E.todayKey(); save(); }

/* ---------- Routen ---------- */
setRenderer(route => {
  const [path, qs] = route.replace(/^#\//, '').split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const [base, arg, arg2] = path.split('/');
  switch (base) {
    case 'heute': return V.heute();
    case 'plan': case 'woche': return V.plan();
    case 'rezepte': return V.rezepte();
    case 'training': return V.training();
    case 'einkauf': return V.einkauf();
    case 'bon': return V.bon();
    case 'ich': return V.ich();
    case 'dish': return V.dish(arg, q);
    case 'info': return V.info(arg);
    case 'run': return V.runDetail(arg);
    case 'workout': return V.workoutDetail(arg, q);
    case 'timer': prepareTimer(arg, arg2, q); return V.timerScreen();
    case 'review': return V.review();
    case 'receipt': return V.receipt(arg);
    case 'store': return V.store(arg);
    case 'ing': return V.ingredient(arg);
    case 'promos': return V.promos();
    case 'profile': return V.profile();
    case 'notif': return V.notif(notifPerm);
    case 'ratings': return V.ratings();
    case 'trinken': return V.trinken();
    case 'weight': return V.weight();
    case 'strava': return V.strava();
    case 'ex': return V2.exerciseDetail(arg);
    case 'wk': return V2.workoutDetail2(arg);
    case 'play': return V2.player();
    case 'plaene': return V2.plansScreen();
    case 'freunde': return V3.freunde();
    case 'chat': return V3.chat(path.slice(5));
    case 'gruppe': return V3.gruppe(arg);
    case 'sprofil': return V3.sprofil(arg || 'me');
    case 'duell': return V3.duell(arg);
    case 'sticker': return V3.stickerEditor();
    case 'foto': return V.foto();
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
  const m = $('meta[name=theme-color]'); if (m) m.content = dark ? '#0A0E13' : '#F3F5F7';
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

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
    const repl = from && S.plan[from] ? ' Ersetzt durch <b>' + esc(DISHES[S.plan[from].a].name) + '</b>.' : '';
    toast('🚫 <b>' + esc(DISHES[id].name) + '</b> fliegt raus – öfter unter 3 Sterne.' + repl, 'toast-warn');
    scheduleAll();
  } else if (res.low) { haptic.tap(); toast('Notiert. Noch einmal unter 3 ★ und es kommt automatisch was anderes.'); }
  else { haptic.ok(); if (v >= 4) toast(v === 5 ? 'Top! Kommt öfter dran 🎉' : 'Merk ich mir – kommt öfter dran 👍'); }
}
function setStarsUI(row, v) {
  $$('.star', row).forEach((s, i) => {
    const on = i === 0 ? v === 0 : v >= i;
    s.classList.toggle('on', on);
    if (on) { s.classList.remove('pop'); void s.offsetWidth; s.style.animationDelay = (i * 45) + 'ms'; s.classList.add('pop'); }
  });
}
function openRate(k) {
  if (!S.plan[k]) return;
  haptic.tap();
  sheet(V.rateSheetHTML(k), el => {
    el.addEventListener('click', e => {
      const st = e.target.closest('[data-act="star"]');
      if (st) { const row = st.closest('.stars-row'), v = +st.dataset.v; setStarsUI(row, v); doRate(row.dataset.id, row.dataset.k, row.dataset.slot, v, st); const ri = row.closest('.rate-item'); if (ri) $('.ml-add', ri).classList.add('on'); return; }
      const eat = e.target.closest('[data-act="eat"]');
      if (eat) { toggleEat(eat.dataset.k, eat.dataset.slot); eat.classList.toggle('on'); haptic.tap(); }
    });
    el.addEventListener('change', e => { const cb = e.target.closest('[data-act="cooked-cb"]'); if (cb) { logOf(cb.dataset.k).cooked = cb.checked; save(); haptic.tap(); } });
  });
  watchSheetClose();
}
function watchSheetClose() { const obs = new MutationObserver(() => { if (!$('.sheet-wrap')) { obs.disconnect(); refresh(); } }); obs.observe(document.body, { childList: true }); }
function toggleEat(k, slot) { const L = logOf(k); L.eaten = L.eaten || {}; L.eaten[slot] = !L.eaten[slot]; save(); }

/* ---------- Kassenbon ---------- */
async function startScan(src) {
  if (!isNative) { go('#/bon'); return; }
  let photo;
  try { photo = await takeReceiptPhoto(src); }
  catch (e) { if (!/cancel/i.test(String(e && e.message || e))) toast('Kamera: ' + esc(e.message || e), 'toast-warn'); return; }
  ui.review = { state: 'scan', img: photo.webPath };
  go('#/review');
  const t0 = Date.now();
  try {
    const a = analyse(await ocr(photo.path));
    await new Promise(r => setTimeout(r, Math.max(0, 1300 - (Date.now() - t0))));
    if (!a.items.length) { ui.review = { state: 'error', error: 'Auf dem Foto wurden keine Artikel mit Preis gefunden. Bon flach hinlegen, gutes Licht, ganz ins Bild – und nochmal.' }; refresh(false); return; }
    ui.review = { state: 'done', img: photo.webPath, ...a }; haptic.ok(); refresh(false);
  } catch (e) { ui.review = { state: 'error', error: String(e && e.message || e) }; refresh(false); }
}
function scanText(txt) {
  const a = analyse(txt.split(/\n/));
  if (!a.items.length) { toast('Keine Artikel mit Preis gefunden.', 'toast-warn'); return; }
  ui.review = { state: 'done', img: null, ...a }; go('#/review');
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
  S.receipts.push(r); E.invalidatePrices(); save(true);
  const fresh = Object.entries(E.learned().info).flatMap(([ing, per]) => Object.keys(per).map(s => ing + '|' + s)).filter(x => !before.has(x)).length;
  const learnedN = items.filter(i => i.ing).length, promosN = items.filter(i => i.promo).length;
  ui.review = null; haptic.ok();
  confetti(window.innerWidth / 2, window.innerHeight / 2, 40);
  go('#/bon');
  setTimeout(() => sheet(`<div class="learn-sum"><span class="ls-emo">🧾✨</span><h2 class="sh-t">Gelernt!</h2>
    <div class="ls-tiles"><div><b>${learnedN}</b><small>Preise</small></div><div><b>${fresh}</b><small>neu</small></div><div><b>${promosN}</b><small>Aktionen</small></div></div>
    <p class="sh-sub">${STORES[r.store].name} ist jetzt bekannter. Kosten, Einkaufsliste und Plan nutzen ab sofort diese Preise${promosN ? ' – und Gerichte mit Aktions-Zutaten kommen eher dran' : ''}.</p>
    <button class="btn wide tap" data-close>Super</button></div>`), 450);
  if (promosN) { E.replanFrom(E.addDays(E.todayKey(), 1)); scheduleAll(); }
}

/* =========================================================
   TIMER für Lauf & Workout
   ========================================================= */
let tick = null, audio = null;
document.addEventListener('pointerdown', () => { try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { /* kein Ton */ } }, { passive: true });
function beep(freq = 880, ms = 160, n = 1) {
  if (!audio) return;
  for (let i = 0; i < n; i++) {
    const o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + i * (ms / 1000 + 0.08);
    o.frequency.value = freq; o.type = 'sine'; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + ms / 1000 + 0.02);
  }
}
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function prepareTimer(kind, id, q) {
  const ref = kind === 'run' ? 'run|' + id : 'wo|' + id + '|' + (q.d || '');
  if (ui.timer && ui.timer.ref === ref) return;
  stopTick();
  let seq, title, emoji, hue, date;
  if (kind === 'run') {
    const r = SP.runSession(id);
    seq = [{ k: 'prep', sec: 10, z: 1, label: 'Gleich geht’s los' }, ...r.blocks];
    title = r.name; emoji = '🏃'; hue = 25; date = id;
  } else {
    const w = SP.WORKOUTS[id]; if (!w) return;
    seq = SP.workoutSeq(id); title = w.name; emoji = w.emoji; hue = w.hue; date = q.d || E.todayKey();
  }
  ui.timer = { ref, kind, id, date, seq, title, emoji, hue, idx: 0, end: Date.now() + seq[0].sec * 1000, paused: false, left: 0, started: Date.now(), done: false };
}
function blockInfo(b, T) {
  if (T.kind === 'run') {
    const z = SP.ZONES[b.z] || SP.ZONES[1];
    const phase = { prep: 'Bereit machen', warm: 'Aufwärmen', walk: 'Gehen', run: 'Laufen', fast: 'Zügig!', cool: 'Auslaufen' }[b.k];
    return { emoji: { prep: '⏳', warm: '🚶', walk: '🚶', run: '🏃', fast: '⚡', cool: '🧘' }[b.k], label: b.label, phase, how: [z.name + ': ' + z.txt], color: z.c };
  }
  const x = SP.EX[b.ex];
  if (b.k === 'work') return { emoji: x.emoji, label: x.name, phase: 'Runde ' + b.round + ' · los!', how: x.how, color: '#22C55E' };
  return { emoji: b.k === 'prep' ? '⏳' : '😮‍💨', label: b.k === 'prep' ? 'Gleich: ' + x.name : 'Pause', phase: b.k === 'prep' ? 'Bereit machen' : 'Durchatmen', how: ['Als Nächstes: ' + x.name, ...x.how.slice(0, 1)], color: '#64748B' };
}
function renderTimer(full) {
  const T = ui.timer; if (!T || !$('.timer')) return;
  const b = T.seq[T.idx]; if (!b) return;
  const now = Date.now(), left = T.paused ? T.left : Math.max(0, T.end - now) / 1000;
  const totalSec = T.seq.reduce((s, x) => s + x.sec, 0);
  const doneSec = T.seq.slice(0, T.idx).reduce((s, x) => s + x.sec, 0) + (b.sec - left);
  $('#tm-sec').textContent = mmss(left);
  $('#tm-total').textContent = mmss(doneSec) + ' / ' + mmss(totalSec);
  $('#tm-prog').style.width = (doneSec / totalSec * 100).toFixed(2) + '%';
  const fg = $('.tm-r .ring-fg'); if (fg) { const len = parseFloat(fg.getAttribute('stroke-dasharray')); fg.style.strokeDashoffset = len * (1 - left / b.sec); }
  if (full) {
    const bi = blockInfo(b, T);
    $('#tm-step').textContent = (T.idx + 1) + ' / ' + T.seq.length;
    $('#tm-e').textContent = bi.emoji;
    $('#tm-phase').textContent = T.paused ? 'Pausiert' : bi.phase;
    $('#tm-label').textContent = bi.label;
    $('#tm-how').innerHTML = bi.how.map(h => '<li>' + esc(h) + '</li>').join('');
    $('.timer').style.setProperty('--zc', bi.color);
    $('.timer').classList.toggle('is-rest', b.k === 'rest' || b.k === 'walk' || b.k === 'prep');
    const nb = T.seq[T.idx + 1];
    $('#tm-next').innerHTML = nb ? '<small>Als Nächstes</small><b>' + esc(blockInfo(nb, T).label) + '</b><span>' + mmss(nb.sec) + '</span>' : '<small>Danach</small><b>Geschafft! 🎉</b>';
    $('#tm-pp').innerHTML = ico(T.paused ? 'play' : 'pause');
    const c = $('.tm-c'); if (c) c.animate([{ transform: 'scale(.9)', opacity: .4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }
}
function step() {
  const T = ui.timer; if (!T || T.paused || T.done) return;
  const now = Date.now();
  let changed = false;
  while (now >= T.end && T.idx < T.seq.length) {
    T.idx++; changed = true;
    if (T.idx >= T.seq.length) break;
    T.end += T.seq[T.idx].sec * 1000;
  }
  if (T.idx >= T.seq.length) { finishTimer(); return; }
  const left = (T.end - now) / 1000;
  if (!changed && left <= 3.05 && left > 0 && Math.ceil(left) !== T.lastCount) { T.lastCount = Math.ceil(left); beep(660, 90); }
  if (changed) { T.lastCount = null; const b = T.seq[T.idx]; beep(b.k === 'work' || b.k === 'run' || b.k === 'fast' ? 990 : 520, 220, 2); haptic.med(); if (navigator.vibrate) navigator.vibrate([120, 80, 120]); }
  renderTimer(changed);
}
function startTick() { stopTick(); tick = setInterval(step, 200); }
function stopTick() { if (tick) clearInterval(tick); tick = null; }
function runCues() {
  const T = ui.timer; if (!T || T.kind !== 'run' || T.paused) { cancelRunCues(); return; }
  const cues = []; let at = T.end;
  for (let i = T.idx + 1; i < T.seq.length; i++) {
    const b = T.seq[i], bi = blockInfo(b, T);
    cues.push({ at, title: bi.emoji + ' Jetzt: ' + b.label, body: mmss(b.sec) + ' · ' + bi.how[0] });
    at += b.sec * 1000;
  }
  cues.push({ at, title: '🎉 Lauf geschafft!', body: 'Öffne die App und speichere deinen Lauf.' });
  scheduleRunCues(cues);
}
window.addEventListener('timer-mount', () => { if (ui.timer && !ui.timer.done) { renderTimer(true); startTick(); runCues(); } });
function finishTimer() {
  const T = ui.timer; if (!T) return;
  T.done = true; stopTick(); cancelRunCues();
  beep(1200, 160, 3); haptic.ok();
  confetti(window.innerWidth / 2, window.innerHeight / 3, 50);
  const min = Math.round(T.seq.reduce((s, b) => s + b.sec, 0) / 60);
  if (T.kind === 'run') {
    const r = SP.runSession(T.date);
    sheet(`<div class="learn-sum"><span class="ls-emo">🏃🎉</span><h2 class="sh-t">Lauf geschafft!</h2><p class="sh-sub">${esc(r.name)} · ${min} Min. Wie weit warst du ungefähr?</p>
      <div class="field-2"><label class="field"><span>Kilometer</span><input id="fin-km" type="text" inputmode="decimal" value="${E.lit(r.km)}"></label><label class="field"><span>Minuten</span><input id="fin-min" type="number" inputmode="numeric" value="${min}"></label></div>
      <button class="btn wide tap" id="fin-save">${ico('check')}Speichern</button></div>`, (el, close) => {
      $('#fin-save', el).addEventListener('click', () => {
        const km = parseFloat(($('#fin-km', el).value || '0').replace(',', '.')) || 0, m = parseInt($('#fin-min', el).value, 10) || min;
        SP.markRun(T.date, km, m, Math.round(r.kcal * m / r.min)); ui.timer = null; close(); scheduleAll(); go('#/training'); toast('Lauf gespeichert – ' + Math.round(r.kcal * m / r.min) + ' kcal verbrannt 🔥');
      });
    });
  } else {
    const kcal = SP.workoutKcal(T.id);
    SP.markWorkout(T.date, T.id, kcal, min);
    sheet(`<div class="learn-sum"><span class="ls-emo">💪🎉</span><h2 class="sh-t">Workout geschafft!</h2><div class="ls-tiles"><div><b>${min}</b><small>Minuten</small></div><div><b>${kcal}</b><small>kcal</small></div><div><b>${SP.streak()}</b><small>Serie 🔥</small></div></div><p class="sh-sub">Stark – auch ohne Laufen hast du heute was getan.</p><button class="btn wide tap" data-close>Fertig</button></div>`);
    ui.timer = null; scheduleAll(); setTimeout(() => go('#/training'), 300);
  }
}
function confirmStopTimer() {
  const T = ui.timer; if (!T) { back(); return; }
  const totalSec = T.seq.reduce((s, x) => s + x.sec, 0), doneSec = T.seq.slice(0, T.idx).reduce((s, x) => s + x.sec, 0);
  const far = doneSec / totalSec >= 0.6;
  const wasPaused = T.paused; if (!wasPaused) A['timer-toggle']();
  sheet(`<h2 class="sh-t">Training beenden?</h2><p class="sh-sub">${far ? 'Du hast schon über die Hälfte – zählt als erledigt, wenn du willst.' : 'Dein Fortschritt geht verloren.'}</p>
    <div class="sh-btns col"><button class="btn tap" id="st-go" data-close>Weitermachen</button>${far ? '<button class="btn ghost tap" id="st-save" data-close>Als erledigt speichern</button>' : ''}<button class="btn ghost tap" id="st-quit" data-close>Abbrechen</button></div>`, el => {
    $('#st-go', el).addEventListener('click', () => { if (!wasPaused && ui.timer && ui.timer.paused) A['timer-toggle'](); });
    $('#st-quit', el).addEventListener('click', () => { stopTick(); cancelRunCues(); ui.timer = null; back(); });
    const sv = $('#st-save', el); if (sv) sv.addEventListener('click', () => { T.idx = T.seq.length; T.paused = false; finishTimer(); });
  });
}

/* =========================================================
   BENACHRICHTIGUNGEN planen
   ========================================================= */
const at = (k, hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = E.dateOf(k); d.setHours(h, m || 0, 0, 0); return d; };
const dayIdx = k => E.daysBetween('2026-01-01', k);
export async function scheduleAll() {
  if (!isNative) return;
  E.ensurePlan();
  const N = S.notif, list = [], t = E.todayKey(), T = E.targets(), P = S.profile;
  for (let i = 0; i < 7; i++) {
    const k = E.addDays(t, i), p = S.plan[k]; if (!p) continue;
    const base = (dayIdx(k) % 80000) * 10;
    const f = DISHES[p.f], a = DISHES[p.a];
    if (N.f.on) list.push({ id: base + 1, at: at(k, N.f.t), title: 'Guten Morgen ☀️', body: 'Klein anfangen: ' + f.name + ' – nur ≈ ' + f.kcal + ' kcal. Ein paar Löffel reichen schon.', extra: { route: 'dish', id: p.f, date: k, slot: 'f' } });
    if (N.cook.on) list.push({ id: base + 2, at: at(k, N.cook.t), title: 'Zeit zum Kochen 🍳', body: 'Heute: ' + a.name + ' (≈ ' + a.min + ' Min). Hast du schon angefangen?', action: 'COOK', extra: { route: 'dish', id: p.a, date: k, slot: 'a' } });
    if (N.rate.on) list.push({ id: base + 3, at: at(k, N.rate.t), title: 'Schon gegessen? 🍽️', body: 'Wie war ' + a.name + '? Gib 0–5 Sterne – was öfter unter 3 bekommt, fliegt automatisch raus.', action: 'RATE', extra: { route: 'rate', date: k } });
    if (N.shop.on && E.wd(k) === N.shop.day) list.push({ id: base + 4, at: at(k, N.shop.t), title: 'Einkaufstag 🛒', body: 'Deine Liste ist fertig. Danach den Kassenbon scannen – die App lernt die Preise deines Markts.', action: 'SHOP', channel: 'tips', extra: { route: 'einkauf' } });
    if (N.water.on) (N.water.t || '10:00,15:30').split(',').slice(0, 2).forEach((tt, j) => list.push({ id: base + 5 + j, at: at(k, tt.trim()), title: 'Trinkpause 💧', body: 'Ein großes Glas Wasser. Heute-Ziel: ≈ ' + E.lit(T.water + (p.train || SP.isRunDay(k) ? 1 : 0)) + ' L.', channel: 'tips', extra: { route: 'heute' } }));
    const act = SP.plannedActivity(k);
    if (act && !act.done) {
      const wid = act.kind === 'workout' ? act.id : SP.workoutFor(k), w = SP.WORKOUTS[wid];
      if (N.run.on) {
        if (act.kind === 'run') list.push({ id: base + 7, at: at(k, P.runTime), title: 'Zeit zum Laufen 🏃', body: act.session.name + ': ' + act.session.min + ' Min, ' + SP.ZONES[act.session.zone].txt.toLowerCase() + '. Keine Lust? Dann ' + w.name + ' (' + SP.workoutMinutes(wid) + ' Min) – ohne Ausrede 😉', action: 'RUN', channel: 'run', extra: { route: 'run', date: k } });
        else list.push({ id: base + 7, at: at(k, P.runTime), title: 'Workout-Zeit 💪', body: w.name + ': ' + SP.workoutMinutes(wid) + ' Min, ohne Geräte. Der Timer sagt dir alles an.', action: 'WO', channel: 'run', extra: { route: 'workout', id: wid, date: k } });
      }
      if (N.runFollow.on) { const ft = at(k, P.runTime); ft.setHours(ft.getHours() + 2); if (ft.getHours() < 22) list.push({ id: base + 8, at: ft, title: act.kind === 'run' ? 'Noch nicht gelaufen? 🤔' : 'Workout noch offen 💪', body: 'Dann wenigstens ' + w.name + ': ' + SP.workoutMinutes(wid) + ' Min im Wohnzimmer. Die App zeigt dir jede Übung.', action: 'WO', channel: 'run', extra: { route: 'workout', id: wid, date: k } }); }
    }
  }
  return reschedule(list);
}
function onNotifAction(actionId, extra) {
  const k = extra.date || E.todayKey();
  const later = fn => { go('#/heute'); setTimeout(fn, 350); };
  if (actionId === 'eaten') { const L = logOf(k); L.eaten = { f: true, m: true, s: true, a: true }; save(); ui.day = k; later(() => openRate(k)); return; }
  if (actionId === 'cooked') { logOf(k).cooked = true; save(); ui.day = k; go('#/heute'); toast('Gekocht ✓ – Boxen innerhalb von 2 Stunden in den Kühlschrank!'); return; }
  if (actionId === 'list') { go('#/einkauf'); return; }
  if (actionId === 'scan') { go('#/bon'); return; }
  if (actionId === 'run-go') { if (SP.actOf(k) && SP.actOf(k).type === 'workout' && !SP.actOf(k).done) SP.undoAct(k); go('#/training'); setTimeout(() => go('#/timer/run/' + k), 350); return; }
  if (actionId === 'run-wo' || actionId === 'wo-go') { const wid = extra.id || SP.workoutFor(k); SP.chooseWorkout(k, wid); scheduleAll(); go('#/training'); setTimeout(() => go('#/timer/workout/' + wid + '?d=' + k), 350); return; }
  if (actionId === 'rate' || extra.route === 'rate') { ui.day = k; later(() => openRate(k)); return; }
  if (actionId === 'recipe' || extra.route === 'dish') { later(() => go('#/dish/' + extra.id + '?d=' + k + '&s=' + (extra.slot || 'a'))); return; }
  if (extra.route === 'run') { go('#/training'); setTimeout(() => go('#/run/' + k), 350); return; }
  if (extra.route === 'workout') { go('#/training'); setTimeout(() => go('#/workout/' + extra.id + '?d=' + k), 350); return; }
  if (extra.route === 'timer') { if (ui.timer) go('#/timer/' + (ui.timer.kind === 'run' ? 'run/' + ui.timer.date : 'workout/' + ui.timer.id + '?d=' + ui.timer.date)); return; }
  if (extra.route) go('#/' + extra.route);
}

/* =========================================================
   AKTIONEN
   ========================================================= */
/* =========================================================
   ESSEN FOTOGRAFIEREN – Foto → Barcode / Text / Tabelle / KI → Ergebnis → eintragen
   ========================================================= */
function foodReset(k) {
  const slot = FA.slotNow(), t = k || E.todayKey(), L = S.log[t] || {};
  ui.food = { state: 'scan', k: t, grams: 0, slot, replaces: !!(S.plan[t] && !(L.eaten && L.eaten[slot])), guesses: [], sel: null, q: '', results: [] };
}
const tableItem = (tab, name = 'Eigenes Produkt') => ({ k: 'c', key: 't:' + Date.now().toString(36), name, brand: '', e: '🏷️', cat: 'Aus Nährwerttabelle', n: toN8(tab.per100), g: tab.servG || (tab.ml ? 250 : 30), serving: tab.servG || 0, pack: 0, ml: !!tab.ml, ns: '', u: 'Portion', src: 'label', tmp: true, desc: 'Von der Packung abfotografiert.' });

/* Auswertung der nativen Analyse (oder eines Demo-Ergebnisses im Browser) */
async function applyAnalysis(res, mode, thumb) {
  const F = ui.food;
  F.thumb = thumb || F.thumb;
  const r = await FA.buildCandidates(res);
  F.packHint = r.packHint; F.unknownCode = r.unknownCode || (F.code || ''); F.table = r.table; F.barcode = r.barcode;
  const cands = r.cands.slice();
  if (r.table) {
    const th = r.textHits[0], t = tableItem(r.table, th && th.score >= 1.2 ? th.name : 'Eigenes Produkt');
    if (th && th.score >= 1.2) t.brand = th.brand;
    cands.unshift({ ...t, conf: 1, score: r.barcode ? 40 : 90, via: 'tabelle' });
  }
  cands.sort((a, b) => b.score - a.score);
  if (mode === 'label' && !r.table) {
    Object.assign(F, { state: 'label', form: null, formName: '', formBrand: '' });
    F.table = { per100: {}, hits: 0 };
    const rows = (res.lines || []).map(l => l.text);
    return;
  }
  if (!cands.length) {
    F.state = 'error';
    F.error = r.unknownCode ? 'Dieses Produkt kennt die App noch nicht und online war nichts zu finden. Fotografiere die Nährwerttabelle – dann merkt sie sich das Produkt samt Barcode.' : 'Auf dem Foto wurde nichts erkannt. Gutes Licht, Teller von oben – oder Barcode/Tabelle fotografieren, oder unten suchen.';
    return;
  }
  F.guesses = cands; F.sel = cands[0]; F.conf = cands[0].conf; F.grams = cands[0].g; F.state = 'done';
  F.firstGuess = cands[0];
}
async function startFoodCam(k, mode = 'food', src = 'camera', code = '') {
  haptic.med();
  if (!isNative) { foodReset(k); ui.food.state = 'pick'; ui.food.code = code; go('#/foto'); return; }
  let photo;
  try { photo = await takeReceiptPhoto(src); }
  catch (e) { if (!/cancel/i.test(String(e && e.message || e))) toast('Kamera: ' + esc(e.message || e), 'toast-warn'); return; }
  const keepQ = ui.food && current().startsWith('#/foto') ? ui.food.q : '';
  foodReset(k);
  Object.assign(ui.food, { img: photo.webPath, mode, code, q: keepQ });
  if (current().startsWith('#/foto')) refresh(false); else go('#/foto');
  const t0 = Date.now();
  try {
    const [res, thumb] = await Promise.all([analyzeFood(photo.path), makeThumb(photo.webPath)]);
    await applyAnalysis(res, mode, thumb);
    await new Promise(r => setTimeout(r, Math.max(0, 1100 - (Date.now() - t0))));
    haptic.ok(); refresh(false);
  } catch (e) { ui.food.state = 'error'; ui.food.error = String(e && e.message || e); refresh(false); }
}
/* Beispiele für den Browser: laufen durch dieselbe Auswertung wie ein echtes Foto */
const DEMOS = {
  haribo: { lines: [{ text: 'HARIBO', x: 40, y: 40, w: 300, h: 60 }, { text: 'Goldbären', x: 40, y: 120, w: 300, h: 50 }, { text: 'Fruchtgummi', x: 40, y: 190, w: 300, h: 40 }, { text: '200 g', x: 40, y: 250, w: 100, h: 30 }], labels: [], inet: [{ index: 899, conf: 0.4 }] },
  table: { lines: ['Durchschnittliche Nährwerte pro 100 g', 'Brennwert 1456 kJ / 343 kcal', 'Fett 0,5 g', 'davon gesättigte Fettsäuren 0,1 g', 'Kohlenhydrate 77 g', 'davon Zucker 46 g', 'Eiweiß 6,9 g', 'Salz 0,07 g'].map((t, i) => ({ text: t, x: 40, y: 40 + i * 50, w: 400, h: 30 })), labels: [], inet: [] },
  schnitzel: { lines: [], labels: [{ index: LABELS.indexOf('Schnitzel'), conf: 0.31 }, { index: LABELS.indexOf('Cordon bleu'), conf: 0.12 }, { index: LABELS.indexOf('Chicken fried steak'), conf: 0.07 }], inet: [{ index: 924, conf: 0.5 }] },
  banana: { lines: [], labels: [{ index: LABELS.indexOf('Banoffee pie'), conf: 0.05 }], inet: [{ index: 955, conf: 0.82 }, { index: 951, conf: 0.04 }] }
};
async function demoFood(kind) {
  foodReset(); const F = ui.food;
  if (!current().startsWith('#/foto')) go('#/foto'); else refresh(false);
  await new Promise(r => setTimeout(r, 900));
  await applyAnalysis({ barcodes: [], text: '', ...DEMOS[kind] }, kind === 'table' ? 'label' : 'food', null);
  refresh(false);
}
function foodSave() {
  const F = ui.food; if (!F || !F.sel) return;
  const it = F.sel, grams = Math.max(1, Math.round(F.grams || it.g)), nn = FA.nutr(it, grams);
  const p = S.plan[F.k];
  const replaces = !!(F.replaces && p && p[F.slot]);
  const r1 = v => (v == null ? null : Math.round(v * 10) / 10);
  FA.logExtra(F.k, { name: it.name, brand: it.brand || '', e: it.e, key: it.key, g: nn.g, ml: !!it.ml, kcal: nn.kcal, prot: r1(nn.prot), kh: r1(nn.kh), sugar: r1(nn.sugar), fat: r1(nn.fat), sat: r1(nn.sat), fiber: r1(nn.fiber), salt: nn.salt == null ? null : Math.round(nn.salt * 100) / 100, slot: F.slot, replaces, thumb: F.thumb || null, conf: F.conf ?? null, via: it.via || null });
  FA.remember(it, grams);
  if (F.firstGuess && it.via !== 'barcode') FA.learnChoice(F.firstGuess, it);
  for (const [d, list] of Object.entries(S.extra)) if (E.daysBetween(d, E.todayKey()) > 21) list.forEach(x => { x.thumb = null; });
  save(true); haptic.ok();
  const savedName = it.name, kc = nn.kcal;
  ui.day = F.k; ui.food = null;
  go('#/heute');
  setTimeout(() => { confetti(window.innerWidth / 2, window.innerHeight / 3, 36); toast('Eingetragen: <b>' + esc(savedName) + '</b> · ' + kc + ' kcal ✓'); }, 380);
}
const num = v => { const x = parseFloat(String(v || '').replace(',', '.')); return isNaN(x) ? null : x; };
function readLabelForm() {
  const F = ui.food, o = {};
  $$('[data-lf]').forEach(i => { o[i.dataset.lf] = num(i.value); });
  F.form = o; F.formName = ($('#lf-name') || {}).value || ''; F.formBrand = ($('#lf-brand') || {}).value || ''; F.formG = ($('#lf-g') || {}).value || '';
  return o;
}
let searchSeq = 0;
async function runSearch(q) {
  const F = ui.food; if (!F) return;
  const my = ++searchSeq;
  if (q.trim().length < 2) { F.results = []; F.loading = false; return; }
  if (!FA.dbReady()) { F.loading = true; refreshKeep(); try { await FA.loadProducts(); } catch (e) { /* nur lokale Treffer */ } F.loading = false; }
  if (my !== searchSeq) return;
  F.results = FA.searchLocal(q, 40);
}
function refreshKeep() {
  const q = $('#food-q'); const pos = q ? q.selectionStart : 0, focus = q && document.activeElement === q;
  refresh();
  const n = $('#food-q'); if (n && focus) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* egal */ } }
}

/* ---------- Workout-Player ---------- */
let plTimer = null;
function startPlay(wk) {
  if (!wk || !wk.items.length) { toast('Workout nicht gefunden.', 'toast-warn'); return; }
  V2.ui2.play = { wk, i: 0, set: 1, phase: 'ready', t0: Date.now(), log: [], kg: {}, reps: null, restEnd: 0, restLen: 0, workEnd: 0 };
  haptic.med(); go('#/play');
  clearInterval(plTimer); plTimer = setInterval(playTick, 250);
}
function playTick() {
  const P = V2.ui2.play; if (!P) { clearInterval(plTimer); return; }
  if (current() !== '#/play') return;
  const tEl = $('#pl-time'); if (tEl) tEl.textContent = V2.fmtTime((Date.now() - P.t0) / 1000);
  if (P.phase === 'rest') {
    const left = Math.max(0, (P.restEnd - Date.now()) / 1000), c = $('#pl-clock'); if (c) c.textContent = Math.ceil(left);
    const fg = $('#pl-ring .ring-fg'); if (fg) { const len = parseFloat(fg.getAttribute('stroke-dasharray')); fg.style.strokeDashoffset = len * (1 - left / Math.max(1, P.restLen)); }
    if (left <= 0) { P.phase = 'ready'; haptic.warn(); refresh(); }
  } else if (P.phase === 'work') {
    const left = Math.max(0, (P.workEnd - Date.now()) / 1000), c = $('#pl-clock'); if (c) c.textContent = Math.ceil(left);
    if (left <= 0) { haptic.ok(); playDone(); }
  }
}
function playDone() {
  const P = V2.ui2.play; if (!P) return;
  const it = P.wk.items[P.i], e = W.EXI[it.ex];
  const kgIn = $('#pl-kg'); if (kgIn && kgIn.value.trim()) P.kg[e.id] = parseFloat(kgIn.value.replace(',', '.')) || 0;
  P.log.push({ ex: e.id, reps: it.timed ? null : (P.reps ?? it.reps), kg: W.weighted(e) ? (P.kg[e.id] || 0) : 0, sec: it.timed ? it.work : 0 });
  P.reps = null; haptic.ok();
  if (P.set < it.sets) P.set++;
  else if (P.i < P.wk.items.length - 1) { P.i++; P.set = 1; }
  else { finishPlay(); return; }
  P.phase = 'rest'; P.restLen = it.rest; P.restEnd = Date.now() + it.rest * 1000;
  refresh();
}
function finishPlay() {
  const P = V2.ui2.play; if (!P) return;
  clearInterval(plTimer);
  const rec = W.saveSession(P.wk, P.log, (Date.now() - P.t0) / 1000);
  V2.ui2.play = null;
  try { if (window.__social) window.__social.shareWorkout(rec); } catch (e) { /* offline egal */ }
  go('#/training'); scheduleAll();
  setTimeout(() => { confetti(window.innerWidth / 2, window.innerHeight / 3, 60); sheet(V2.playSummaryHTML(rec)); }, 450);
}

const A = {
  foodcam(el) { const d = (el && el.dataset) || {}; startFoodCam(d.k, d.mode || 'food', d.src || 'camera', d.code || ''); },
  foodsearch() { foodReset(); ui.food.state = 'pick'; go('#/foto'); FA.loadProducts().catch(() => null); },
  barcode() { startFoodCam(null, 'barcode'); },
  'food-demo'(el) { demoFood(el.dataset.kind); },
  async 'food-choose'(el) {
    const info = FA.itemFromKey(el.dataset.key) || (ui.food.results || []).find(x => x.key === el.dataset.key); if (!info) return;
    haptic.tap();
    const F = ui.food; Object.assign(F, { state: 'done', sel: info, conf: null, grams: info.g, guesses: F.guesses && F.guesses.length ? F.guesses : [] });
    refresh(false);
  },
  'food-alt'(el) { const g = ui.food.guesses.find(x => x.key === el.dataset.key); if (!g) return; haptic.tap(); Object.assign(ui.food, { sel: g, conf: g.conf, grams: g.g }); refresh(); },
  'food-find'() { haptic.tap(); Object.assign(ui.food, { state: 'pick', sel: null, q: '', results: [] }); FA.loadProducts().catch(() => null); refresh(false); setTimeout(() => { const q = $('#food-q'); if (q) q.focus(); }, 80); },
  'food-size'(el) { ui.food.grams = +(el.dataset.g || el.dataset.v) || ui.food.grams; haptic.tap(); refresh(); },
  'food-step'(el) {
    const F = ui.food, g = Math.round(F.grams || F.sel.g), step = g >= 200 ? 25 : g >= 60 ? 10 : 5;
    F.grams = Math.max(1, g + (+el.dataset.v) * step); haptic.tap(); refresh();
  },
  'food-fav'() { const on = FA.toggleFav(ui.food.sel); haptic.tap(); toast(on ? '⭐ Als Favorit gespeichert' : 'Favorit entfernt'); refresh(); },
  'food-slot'(el) { const F = ui.food; F.slot = el.dataset.v; const L = S.log[F.k] || {}; F.replaces = !!(S.plan[F.k] && !(L.eaten && L.eaten[F.slot])); haptic.tap(); refresh(); },
  'food-save'() { foodSave(); },
  'food-savecustom'() {
    const F = ui.food, it = F.sel;
    sheet(`<h2 class="sh-t">Als Produkt speichern</h2><p class="sh-sub">Dann findet die App es beim nächsten Mal sofort${F.unknownCode ? ' – auch per Barcode' : ''}.</p>
      <label class="field"><span>Name</span><input id="sc-name" value="${esc(it.name === 'Eigenes Produkt' ? '' : it.name)}" placeholder="z. B. Haribo Goldbären" autocomplete="off"></label>
      <label class="field"><span>Marke (optional)</span><input id="sc-brand" value="${esc(it.brand || '')}" autocomplete="off"></label>
      <div class="sh-btns"><button class="btn ghost tap" data-close>Abbrechen</button><button class="btn tap" id="sc-save">${ico('check')}Speichern</button></div>`, (el, close) => {
      $('#sc-save', el).addEventListener('click', () => {
        const name = ($('#sc-name', el).value || '').trim(); if (!name) { toast('Bitte einen Namen eingeben.', 'toast-warn'); return; }
        const c = FA.saveCustom({ code: F.unknownCode || '', name, brand: ($('#sc-brand', el).value || '').trim(), n: it.n, g: it.g, serving: it.serving || 0, ml: !!it.ml, e: it.e, src: 'label' });
        Object.assign(F.sel, c, { via: it.via, tmp: false }); F.guesses = [F.sel, ...(F.guesses || []).filter(x => x.key !== it.key)];
        close(); haptic.ok(); toast('Gespeichert ✓ – ab jetzt in „Meine Produkte“'); refresh();
      });
    });
  },
  'lf-ml'(el) { readLabelForm(); ui.food.formMl = el.dataset.v === '1'; haptic.tap(); refresh(false); },
  'lf-use'() {
    const F = ui.food, o = readLabelForm();
    const filled = ['kcal', 'fat', 'kh', 'sugar', 'prot'].filter(k => o[k] != null).length;
    if (filled < 3) { toast('Mindestens Energie, Fett, Kohlenhydrate und Eiweiß eintragen.', 'toast-warn'); return; }
    if (o.sugar != null && o.kh != null && o.sugar > o.kh + 0.6) { toast('Zucker kann nicht mehr sein als Kohlenhydrate.', 'toast-warn'); return; }
    const g = num(F.formG) || (F.formMl ? 250 : 30);
    const it = { ...tableItem({ per100: o, servG: g, ml: F.formMl }, F.formName.trim() || 'Eigenes Produkt'), brand: F.formBrand.trim(), g, via: 'tabelle' };
    F.guesses = [it]; Object.assign(F, { sel: it, conf: 1, grams: g, state: 'done', firstGuess: null });
    haptic.ok(); refresh(false);
  },
  'extra-del'(el) {
    const k = el.dataset.k, id = el.dataset.id;
    const row = el.closest('.ml'); if (row) row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(40px)' }], { duration: 220 });
    setTimeout(() => { FA.removeExtra(k, id); haptic.tap(); refresh(); toast('Gelöscht.'); }, 200);
  },
  'extra-info'(el) {
    const x = FA.extrasOf(el.dataset.k).find(e => e.id === el.dataset.id); if (!x) return;
    sheet(`<div class="learn-sum">${x.thumb ? `<img class="ei-img" src="${x.thumb}" alt="">` : `<span class="ls-emo">${x.e}</span>`}<h2 class="sh-t">${esc(x.name)}</h2><p class="sh-sub">${x.g} g · ${new Date(x.t).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}${x.conf != null ? ' · KI ' + Math.round(x.conf * 100) + ' % sicher' : ''}</p>
      <div class="ls-tiles q4"><div><b>${x.kcal}</b><small>kcal</small></div><div class="m-prot"><b>${x.prot} g</b><small>Eiweiß</small></div><div class="m-kh"><b>${x.kh} g</b><small>KH</small></div><div class="m-fat"><b>${x.fat} g</b><small>Fett</small></div></div>
      <button class="btn wide tap" data-close>Schließen</button></div>`);
  },
  back() { haptic.tap(); if (current().startsWith('#/timer')) { confirmStopTimer(); return; } back(); },
  day(el) {
    haptic.tap(); ui.day = el.dataset.k;
    if (el.dataset.tab || !current().startsWith('#/heute')) { go('#/heute'); return; }
    refresh();
    $$('.screen:last-child .card').slice(0, 3).forEach((c, i) => c.animate([{ opacity: .3, transform: 'translateY(10px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: i * 40, easing: 'cubic-bezier(.2,.8,.2,1)' }));
  },
  amt(el) { haptic.tap(); ui.amt = el.dataset.v; refresh(); },
  eat(el) {
    toggleEat(el.dataset.k, el.dataset.slot); haptic.tap();
    const on = !el.classList.contains('on');
    el.classList.toggle('on'); if (on) { el.innerHTML = ico('check'); const r = el.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 10); }
    setTimeout(refresh, 280);
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
    $$('.star', el.parentElement).forEach((s, i) => { s.classList.toggle('on', i < v); if (i < v) { s.classList.remove('pop'); void s.offsetWidth; s.style.animationDelay = (i * 45) + 'ms'; s.classList.add('pop'); } });
    doRate(p.a, k, 'a', v, el);
    setTimeout(() => openRate(k), 650);
  },
  star(el) { const row = el.closest('.stars-row'), v = +el.dataset.v; setStarsUI(row, v); doRate(row.dataset.id, row.dataset.k, row.dataset.slot, v, el); setTimeout(refresh, 900); },
  water(el) {
    const L = logOf(el.dataset.k); const n0 = L.water || 0; L.water = Math.max(0, Math.min(30, n0 + (+el.dataset.v))); save(); haptic.tap();
    if (+el.dataset.v > 0) { const c = el.closest('.tile2'); if (c) { const cup = $('.cup', c); if (cup) cup.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 400 }); } }
    setTimeout(refresh, 150);
  },
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
    $$('.screen:last-child .dayc').forEach((c, i) => c.animate([{ transform: 'none' }, { transform: `translateX(${i % 2 ? 10 : -10}px) rotate(${i % 2 ? 1.2 : -1.2}deg)` }, { transform: 'none' }], { duration: 420, delay: i * 30 }));
    E.shuffleFuture(); scheduleAll();
    setTimeout(() => { refresh(); toast('Neu gemischt – ab morgen frischer Plan 🎲'); }, 500);
  },
  quick() {
    haptic.med();
    const orb = $('.scan-orb'); if (orb) orb.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(135deg)' }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' });
    sheet(V.quickSheetHTML(), (el, close) => {
      $$('.qt', el).forEach((q, i) => q.animate([{ opacity: 0, transform: 'translateY(16px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 60 + i * 40, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' }));
      el.addEventListener('click', e => {
        const q = e.target.closest('.qt'); if (!q) return;
        haptic.tap(); close(); const t = E.todayKey();
        setTimeout(() => {
          if (q.dataset.q === 'scan') startScan('camera');
          else if (q.dataset.q === 'foodcam') startFoodCam();
          else if (q.dataset.q === 'foodsearch') A.foodsearch();
          else if (q.dataset.q === 'rate') { ui.day = t; if (!current().startsWith('#/heute')) go('#/heute'); setTimeout(() => openRate(t), 300); }
          else if (q.dataset.q === 'water') { const L = logOf(t); L.water = (L.water || 0) + 1; save(); toast('💧 ' + E.lit(L.water * 0.25) + ' L heute'); refresh(); }
          else if (q.dataset.arg) go(q.dataset.arg);
        }, 200);
      });
    });
    const obs = new MutationObserver(() => { if (!$('.sheet-wrap')) { obs.disconnect(); if (orb) orb.animate([{ transform: 'rotate(135deg)' }, { transform: 'rotate(0)' }], { duration: 300, fill: 'forwards' }); } });
    obs.observe(document.body, { childList: true });
  },
  /* Training */
  'no-run'(el) {
    const k = el.dataset.k; let wid = SP.workoutFor(k);
    const r = SP.runSession(k);
    const card = id => { const w = SP.WORKOUTS[id]; return `<div class="nr-card" style="--h:${w.hue}"><span class="wo-e">${w.emoji}</span><div><b>${esc(w.name)}</b><small>${SP.workoutMinutes(id)} Min · ≈ ${SP.workoutKcal(id)} kcal · ${w.focus}</small><span class="ex-strip">${w.ex.map(e => SP.EX[e].emoji).join(' ')}</span></div></div>`; };
    sheet(`<h2 class="sh-t">Keine Lust zu laufen? 😮‍💨</h2><p class="sh-sub">Okay – aber ganz ohne Bewegung geht’s nicht 😉. Statt „${esc(r.name)}“ machst du heute dieses Mini-Workout. Ohne Geräte, der Timer sagt dir jede Übung an.</p>
      <div id="nr-pick">${card(wid)}</div>
      <div class="chips">${Object.entries(SP.WORKOUTS).map(([id, w]) => `<button class="chip tap${id === wid ? ' on' : ''}" data-w="${id}">${w.emoji} ${esc(w.name)}</button>`).join('')}</div>
      <div class="sh-btns col"><button class="btn big tap" id="nr-go">${ico('play')}Workout starten</button><button class="btn ghost tap" id="nr-look">Übungen ansehen</button><button class="btn ghost tap" data-close>Doch laufen</button></div>`, (sh, close) => {
      sh.addEventListener('click', e => {
        const c = e.target.closest('[data-w]');
        if (c) { wid = c.dataset.w; $$('[data-w]', sh).forEach(x => x.classList.toggle('on', x === c)); $('#nr-pick', sh).innerHTML = card(wid); $('#nr-pick .nr-card', sh).animate([{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: 300 }); haptic.tap(); }
        if (e.target.closest('#nr-go')) { SP.chooseWorkout(k, wid); scheduleAll(); close(); setTimeout(() => go('#/timer/workout/' + wid + '?d=' + k), 250); }
        if (e.target.closest('#nr-look')) { SP.chooseWorkout(k, wid); scheduleAll(); close(); setTimeout(() => go('#/workout/' + wid + '?d=' + k), 250); }
      });
    });
    watchSheetClose();
  },
  'run-done'(el) {
    const k = el.dataset.k, r = SP.runSession(k);
    sheet(`<h2 class="sh-t">Gelaufen? Super! 🏃</h2><p class="sh-sub">Trag ein, wie weit und wie lange – ungefähr reicht.</p>
      <div class="field-2"><label class="field"><span>Kilometer</span><input id="rd-km" type="text" inputmode="decimal" value="${E.lit(r.km)}"></label><label class="field"><span>Minuten</span><input id="rd-min" type="number" inputmode="numeric" value="${r.min}"></label></div>
      <button class="btn wide tap" id="rd-save">${ico('check')}Speichern</button>`, (sh, close) => {
      $('#rd-save', sh).addEventListener('click', () => {
        const km = parseFloat(($('#rd-km', sh).value || '0').replace(',', '.')) || 0, m = parseInt($('#rd-min', sh).value, 10) || r.min;
        const kcal = Math.round(r.kcal * m / r.min);
        SP.markRun(k, km, m, kcal); close(); haptic.ok(); confetti(window.innerWidth / 2, window.innerHeight / 2, 40); scheduleAll(); refresh(); toast('Lauf gespeichert – ' + kcal + ' kcal verbrannt 🔥');
      });
    });
  },
  'wo-done'(el) { const id = el.dataset.id, k = el.dataset.k; SP.markWorkout(k, id, SP.workoutKcal(id), SP.workoutMinutes(id)); haptic.ok(); confetti(window.innerWidth / 2, window.innerHeight / 2, 40); scheduleAll(); toast('Workout erledigt 💪'); refresh(); },
  'act-undo'(el) { SP.undoAct(el.dataset.k); haptic.tap(); scheduleAll(); refresh(); },
  'timer-toggle'() {
    const T = ui.timer; if (!T) return;
    if (T.paused) { T.end = Date.now() + T.left * 1000; T.paused = false; startTick(); }
    else { T.left = Math.max(0, T.end - Date.now()) / 1000; T.paused = true; stopTick(); }
    haptic.tap(); renderTimer(true); runCues();
  },
  'timer-skip'() { const T = ui.timer; if (!T) return; haptic.tap(); if (T.paused) { T.idx++; if (T.idx >= T.seq.length) { finishTimer(); return; } T.left = T.seq[T.idx].sec; renderTimer(true); } else { T.end = Date.now() - 1; step(); } runCues(); },
  'timer-prev'() { const T = ui.timer; if (!T) return; haptic.tap(); T.idx = Math.max(0, T.idx - (T.paused || (T.end - Date.now()) / 1000 < T.seq[T.idx].sec - 3 ? 0 : 1)); if (T.paused) T.left = T.seq[T.idx].sec; else T.end = Date.now() + T.seq[T.idx].sec * 1000; renderTimer(true); runCues(); },
  'timer-stop'() { confirmStopTimer(); },
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
    el.classList.toggle('on'); el.closest('.si').classList.toggle('done');
    setTimeout(refresh, 250);
  },
  'shop-reset'() { S.shop['w' + ui.shopFrom] = []; save(); haptic.tap(); refresh(); },
  'shop-from'(el) { ui.shopFrom = E.addDays(E.todayKey(), +el.dataset.v); haptic.tap(); refresh(); },
  /* Profil */
  pset(el) {
    const k = el.dataset.k, v = el.dataset.v;
    S.profile[k] = v === '' ? null : v;
    if (k === 'priceMode') E.invalidatePrices();
    save(); haptic.tap();
    $$('[data-act="pset"][data-k="' + k + '"]', el.parentElement).forEach(x => x.classList.toggle('on', x === el));
    if (k === 'runLevel') scheduleAll();
    if (!el.closest('.sheet')) refresh();
  },
  persons(el) { S.profile.persons = Math.max(1, Math.min(8, S.profile.persons + (+el.dataset.v))); save(); haptic.tap(); refresh(); },
  train(el) {
    const i = +el.dataset.v, s = new Set(S.profile.train || []);
    if (s.has(i)) s.delete(i); else s.add(i);
    S.profile.train = [...s].sort(); save(); haptic.tap(); E.ensurePlan();
    el.classList.toggle('on'); if (!el.closest('.sheet')) refresh();
  },
  runday(el) {
    const i = +el.dataset.v, s = new Set(S.profile.run || []);
    if (s.has(i)) s.delete(i); else s.add(i);
    S.profile.run = [...s].sort(); save(); haptic.tap(); scheduleAll();
    el.classList.toggle('on'); el.classList.toggle('run');
    if (!el.closest('.sheet')) refresh();
  },
  'run-restart'() { S.profile.runStart = E.todayKey(); save(); scheduleAll(); haptic.ok(); toast('Laufplan startet wieder bei Woche 1.'); refresh(); },
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
  /* Training 2.0 */
  ttab(el) { V2.ui2.ttab = el.dataset.v; haptic.tap(); refresh(false); },
  wcat(el) { V2.ui2.wcat[el.dataset.k] = el.dataset.k === 'lvl' ? +el.dataset.v : el.dataset.v; haptic.tap(); refresh(); },
  lib(el) {
    const f = V2.ui2.lib, k = el.dataset.k, v = el.dataset.v;
    if (k === 'l') f.l = +v; else if (k === 'm') f.m = v; else if (k === 'eq') f.eq = v; else if (k === 'type') f.type = v;
    haptic.tap(); refresh();
  },
  'fit-set'(el) { const f = W.fit(); f[el.dataset.k] = el.dataset.k === 'level' ? +el.dataset.v : el.dataset.v; save(); haptic.tap(); refresh(); },
  'fit-eq'(el) { const f = W.fit(); const v = el.dataset.v; if (W.BASE_EQ.includes(v)) return; f.eq = f.eq.includes(v) ? f.eq.filter(x => x !== v) : [...f.eq, v]; save(); haptic.tap(); toast(f.eq.includes(v) ? 'Klimmzugstange dabei – Klimmzüge & Dips kommen in deine Workouts 💪' : 'Ohne Stange – Workouts angepasst'); refresh(); },
  'fit-plan'(el) { const f = W.fit(); f.plan = el.dataset.v; f.planStart = E.todayKey(); save(); haptic.ok(); toast('Plan „' + W.PLANS[f.plan].n + '“ aktiv 💪'); refresh(); },
  'wk-start'(el) { startPlay(W.parseWid(el.dataset.wid)); },
  'ex-solo'(el) { const e = W.EXI[el.dataset.id]; startPlay({ id: 'solo', type: 'solo', n: e.n, e: '💪', lvl: W.userLevel(), place: W.fit().place, items: [{ ex: e.id, ...W.scheme(e, W.userLevel()) }], min: 5, kcal: 0 }); },
  'pl-go'() { const P = V2.ui2.play, it = P.wk.items[P.i]; P.phase = 'work'; P.workEnd = Date.now() + it.work * 1000; haptic.med(); refresh(); },
  'pl-done'() { playDone(); },
  'pl-skip'() { const P = V2.ui2.play; P.phase = 'ready'; haptic.tap(); refresh(); },
  'pl-more'() { const P = V2.ui2.play; P.restEnd += 15000; P.restLen += 15; haptic.tap(); },
  'pl-kg'(el) { const P = V2.ui2.play, e = W.EXI[P.wk.items[P.i].ex]; const cur = parseFloat(String(($('#pl-kg') || {}).value || '0').replace(',', '.')) || 0; P.kg[e.id] = Math.max(0, Math.round((cur + parseFloat(el.dataset.v)) * 4) / 4); haptic.tap(); refresh(); },
  'pl-reps'(el) { V2.ui2.play.reps = +el.dataset.v; haptic.tap(); refresh(); },
  'pl-quit'() {
    const P = V2.ui2.play; if (!P) { go('#/training'); return; }
    sheet(`<h2 class="sh-t">Workout beenden?</h2><p class="sh-sub">${P.log.length ? P.log.length + ' Sätze geschafft.' : 'Noch kein Satz geschafft.'}</p><div class="sh-btns col">${P.log.length ? '<button class="btn tap" id="pq-save">Speichern &amp; beenden</button>' : ''}<button class="btn ghost tap" id="pq-drop">Verwerfen</button><button class="btn ghost tap" data-close>Weitermachen</button></div>`, (sh, close) => {
      const s1 = $('#pq-save', sh); if (s1) s1.addEventListener('click', () => { close(); finishPlay(); });
      $('#pq-drop', sh).addEventListener('click', () => { close(); V2.ui2.play = null; go('#/training'); });
    });
  },
  /* Strava */
  'strava-open-api'() { openExternal('https://www.strava.com/settings/api').catch(() => toast('Browser konnte nicht geöffnet werden.', 'toast-warn')); },
  'strava-copy'(el) { navigator.clipboard.writeText(el.dataset.v).then(() => toast('„' + el.dataset.v + '“ kopiert'), () => toast('Bitte „' + el.dataset.v + '“ von Hand eintippen.')); haptic.tap(); },
  async 'strava-connect'() {
    if (!stravaKeys()) return;
    try { await Strava.startAuth(false); toast('Strava öffnet sich – dort „Autorisieren“ tippen.'); } catch (e) { toast(stravaMsg(e), 'toast-warn'); }
  },
  async 'strava-manual'() {
    if (!stravaKeys()) return;
    try { await Strava.startAuth(true); toast('Nach „Autorisieren“ kommt eine Fehlerseite – Adresse kopieren und hier einfügen.'); } catch (e) { toast(stravaMsg(e), 'toast-warn'); }
  },
  async 'strava-redeem'() {
    if (!stravaKeys()) return;
    await stravaFinish(Strava.parseAuth(($('#st-paste') || {}).value || ''));
  },
  async 'strava-connect-srv'() { try { toast('Strava öffnet sich …'); await Strava.startServerAuth(); } catch (e) { toast((e && e.message) || 'Das hat nicht geklappt.', 'toast-warn'); } },
  async 'strava-save-srv'() {
    const cid = ($('#sv-cid') || {}).value || '', sec = ($('#sv-sec') || {}).value || '';
    try { await SO.api('/api/admin/strava', { method: 'PUT', body: { clientId: cid, clientSecret: sec } }); await Strava.refreshServer(); haptic.ok(); toast('Strava ist eingerichtet ✓ – jetzt kann jeder „Mit Strava verbinden“ tippen.'); refresh(); } catch (e) { toast((e && e.message) || 'Das hat nicht geklappt.', 'toast-warn'); }
  },
  'strava-limit-info'() {
    sheet(`<h2 class="sh-t">Mehr als 1 Person bei Strava</h2><p class="sh-sub">Strava erlaubt einer neuen App zuerst nur den Besitzer selbst. Für deine Freunde musst du einmal eine Erhöhung beantragen:</p>
      <ol class="howto"><li>Seite „Rate Limits“ von Strava öffnen und unten das Formular ausfüllen.</li><li>Als Grund z. B.: „Private Trainingsgruppe mit 5 Freunden, nur Lesezugriff auf eigene Läufe.“</li><li>Die Prüfung dauert laut Strava etwa 5–7 Werktage. Bis dahin klappt Strava nur bei dir.</li></ol>
      <button class="btn wide tap" id="sl-open">Strava-Seite öffnen</button>`, (sh) => { $('#sl-open', sh).addEventListener('click', () => openExternal('https://developers.strava.com/docs/rate-limits/')); });
  },
  'strava-sync'() { haptic.tap(); stravaSync(true, 30); },
  'strava-file'() { const f = $('#st-file'); if (f) f.click(); },
  'strava-off'() {
    sheet(`<h2 class="sh-t">Verbindung trennen?</h2><p class="sh-sub">Die App vergisst die Strava-Anmeldung. Schon eingelesene Läufe bleiben. Client-ID und Secret bleiben gespeichert, dann geht „Verbinden“ mit einem Tipp.</p><div class="sh-btns"><button class="btn ghost tap" data-close>Abbrechen</button><button class="btn tap" id="st-off-yes">Trennen</button></div>`, (el, close) => {
      $('#st-off-yes', el).addEventListener('click', () => { Strava.disconnect(); close(); haptic.tap(); toast('Strava getrennt.'); });
    });
  },
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
          restoreState(d); E.invalidatePrices();
          close(); toast('Backup eingespielt ✓'); applyTheme(); scheduleAll(); go('#/heute');
        } catch (e) { toast('Das ist kein gültiges Backup.', 'toast-warn'); }
      });
    });
  },
  reset() {
    sheet(`<h2 class="sh-t">Wirklich alles löschen?</h2><p class="sh-sub">Plan, Kassenbons, Bewertungen, Läufe und Einstellungen werden gelöscht.</p><div class="sh-btns"><button class="btn ghost tap" data-close>Abbrechen</button><button class="btn danger tap" id="rst-yes" data-close>Alles löschen</button></div>`, el => {
      $('#rst-yes', el).addEventListener('click', () => { resetAll(); E.invalidatePrices(); ui.ob = 0; S.profile.runStart = E.todayKey(); applyTheme(); go('#/heute'); setTimeout(() => go('#/onboarding', { replace: true }), 50); });
    });
  },
  /* Onboarding */
  'ob-next'() {
    haptic.tap();
    const st = $('.screen:last-child .ob-step');
    const next = () => { ui.ob = Math.min(4, ui.ob + 1); refresh(false); const n = $('.screen:last-child .ob-step'); n && n.animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }); };
    if (st) st.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-40px)' }], { duration: 200, fill: 'forwards' }).onfinish = next; else next();
  },
  async 'ob-notif'() { notifPerm = await notifPermission(true); A['ob-done'](); },
  'ob-done'() {
    S.profile.onboarded = true; S.seen.v11 = true; S.seen.v20 = true; save(true);
    E.ensurePlan(); scheduleAll(); haptic.ok();
    go('#/heute');
    setTimeout(() => { confetti(window.innerWidth / 2, window.innerHeight / 3, 46); toast('Dein Plan steht! Tippe auf alles – überall gibt’s Erklärungen. ✨'); }, 450);
  }
};

/* ---------- Strava ---------- */
const stravaMsg = e => (e && e.code ? e.message : 'Keine Verbindung zu Strava – bist du online?');
function stravaAnnounce(added) {
  const l = added[added.length - 1];
  haptic.ok(); confetti(window.innerWidth / 2, window.innerHeight / 3, 36);
  toast(added.length === 1 ? `🏃 ${E.lit(l.km)} km von Strava eingelesen · ${l.kcal} kcal 🔥` : `🏃 ${added.length} Läufe von Strava eingelesen`);
}
async function stravaSync(manual, days) {
  if (!Strava.connected() || Strava.syncing()) return;
  if (manual) toast('Hole Läufe von Strava …');
  try {
    const r = await Strava.sync({ days });
    if (r.n) stravaAnnounce(r.added);
    else if (manual) toast(r.seen ? 'Keine neuen Läufe – alles ist schon eingelesen.' : 'Bei Strava ist kein neuer Lauf.');
    if (r.n) scheduleAll();
    refreshKeep();
  } catch (e) {
    if (manual || e.code === 'auth' || e.code === 'scope') toast(stravaMsg(e), 'toast-warn');
    refreshKeep();
  }
}
const stravaAuto = () => { if (S.profile.onboarded && Strava.connected() && S.strava.auto !== false && Date.now() - (S.strava.last || 0) > 120000) stravaSync(false); };
async function stravaFinish(p) {
  if (p.error) { toast(p.error === 'access_denied' ? 'Du hast die Freigabe abgebrochen.' : 'Strava: ' + p.error, 'toast-warn'); return; }
  if (!p.code) { toast('In der Adresse fehlt „code=…“ – bitte die ganze Adresse einfügen.', 'toast-warn'); return; }
  try {
    await Strava.redeem(p.code, p.scope);
    haptic.ok(); toast('Mit Strava verbunden ✓');
    if (current() !== '#/strava') go('#/strava'); else refresh();
    await stravaSync(false, 30);
  } catch (e) { toast(stravaMsg(e), 'toast-warn'); }          // Seite bleibt wie sie ist (Eingaben + aufgeklappter Bereich)
}
function stravaKeys() {
  const cid = ($('#st-cid') || {}).value, sec = ($('#st-sec') || {}).value;
  if (cid !== undefined) {
    if (!Strava.validKeys(cid, sec || '')) { toast('Client-ID (nur Zahlen) und Client-Secret (lange Buchstaben/Zahlen) bitte genau eintragen.', 'toast-warn'); return false; }
    Strava.setKeys(cid, sec);
  }
  if (!Strava.hasKeys()) { toast('Bitte erst Client-ID und Client-Secret eintragen.', 'toast-warn'); return false; }
  return true;
}
onDeepLink(url => {
  if (/^ybwye:\/\/join/i.test(url)) { V3.handleInvite(url); return; }
  if (!/^ybwye:/i.test(url) || !S.strava.pending) return;
  const p = Strava.parseAuth(url);
  S.strava.pending = 0; save(true);                      // jede Rückkehr nur einmal verarbeiten
  stravaFinish(p);
});

Object.assign(A, V3.actions());

/* ---------- Community: Live-Verbindung, Ungelesen-Zähler, Benachrichtigungen ---------- */
window.__social = SO;
function navBadge(n) { const b = $('#nav-badge'); if (!b) return; b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n || ''); }
SO.on((ev, d) => {
  if (ev === 'unread') navBadge(SO.live.unread);
  if (ev === 'follow' && d && d.from) { V3.ui3.cache.friends = null; haptic.ok(); toast(`<span class="tt-go" data-go="#/chat/dm.${d.from.id}">👋 <b>${esc(d.from.name)}</b> folgt dir jetzt – <u>Hallo sagen</u></span>`, 'tap'); }
  if (ev === 'strava') Strava.refreshServer().then(() => { toast('Mit Strava verbunden ✓'); stravaSync(false, 30); refresh(); });
});
SO.setNotifier(chatNotify);
let hiddenT = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearTimeout(hiddenT); hiddenT = setTimeout(() => { if (document.hidden && !isNative) SO.disconnect(); }, 120000); return; }   // Verdeckte Web-App schließt nach 2 Min. die Live-Verbindung (spart Gratis-Kontingent; Mitteilungen übernehmen)
  clearTimeout(hiddenT);
  if (!SO.online()) return;
  if (SO.live.status !== 'on') SO.connect();
  const r = current(); if (r.startsWith('#/chat/')) { const id = decodeURIComponent(r.slice(7)); SO.loadChat(id).then(real => SO.markRead(real)).catch(() => {}); }
});

/* ---------- Klicks & Eingaben ---------- */
document.addEventListener('click', e => {
  const mg = e.target.closest('.mm-pick .mm');
  if (mg && current() === '#/training') { V2.ui2.lib.m = V2.ui2.lib.m === mg.dataset.m ? '' : mg.dataset.m; haptic.tap(); refresh(); return; }
  const a = e.target.closest('[data-act]');
  const inSheet = a && a.closest('.sheet');
  if (a && !inSheet) { const fn = A[a.dataset.act]; if (fn) { e.preventDefault(); fn(a, e); } return; }
  if (a && inSheet && A[a.dataset.act] && !['star', 'eat', 'cooked-cb'].includes(a.dataset.act)) { A[a.dataset.act](a, e); return; }
  const g = e.target.closest('[data-go]');
  if (g && !g.closest('.sheet')) { e.preventDefault(); haptic.tap(); go(g.dataset.go); }
  else if (g) { window.__sheetClose && window.__sheetClose(); go(g.dataset.go); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'pl-kg' && V2.ui2.play) { const P = V2.ui2.play, ex = P.wk.items[P.i].ex; const v = parseFloat(e.target.value.replace(',', '.')); if (!isNaN(v)) P.kg[ex] = v; }
  if (e.target.id === 'lib-q') {
    V2.ui2.lib.q = e.target.value; clearTimeout(window.__lq);
    window.__lq = setTimeout(() => { const pos = e.target.selectionStart; refresh(); const n = $('#lib-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* egal */ } } }, 220);
  }
  if (e.target.id === 'food-q' && ui.food) {
    ui.food.q = e.target.value;
    clearTimeout(window.__fq);
    window.__fq = setTimeout(async () => { await runSearch(ui.food ? ui.food.q : ''); if (ui.food) refreshKeep(); }, 180);
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.p) {
    const k = el.dataset.p; let v = el.value.trim();
    if (['height', 'weight', 'age'].includes(k)) { v = parseFloat(v.replace(',', '.')); if (isNaN(v)) v = k === 'age' ? null : S.profile[k]; }
    if (k === 'height' && v) v = Math.max(120, Math.min(230, v));
    if (k === 'weight' && v) v = Math.max(35, Math.min(250, v));
    if (k === 'age' && v) v = Math.max(12, Math.min(100, Math.round(v)));
    if (k === 'runTime' && !/^\d{2}:\d{2}$/.test(v)) v = S.profile.runTime;
    S.profile[k] = v; save();
    if (k === 'runTime') scheduleAll();
    if (current().includes('onboarding')) setTimeout(() => refresh(false), 0);
  }
  if (el.id === 'food-g' && ui.food) { const v = parseInt(el.value, 10); if (v > 0 && v <= 3000) { ui.food.grams = v; refresh(); } return; }
  if (el.dataset.lf !== undefined && ui.food) { readLabelForm(); return; }
  if (el.dataset.act === 'food-replace' && ui.food) { ui.food.replaces = el.checked; haptic.tap(); refresh(); return; }
  if (el.dataset.soAuto !== undefined) { V3.onAutoToggle(el.checked); return; }
  if (el.dataset.stAuto !== undefined) { S.strava.auto = el.checked; save(); haptic.tap(); return; }
  if (el.id === 'st-file') {
    const f = el.files && el.files[0]; if (!f) return;
    f.text().then(text => {
      el.value = '';
      const r = parseTrack(text);
      if (!r.ok) { toast(r.error, 'toast-warn'); return; }
      const rec = r.rec; rec.kcal = rec.kcal || Math.round(S.profile.weight * rec.km);
      sheet(V.runImportHTML(rec, r.warn), (sh, close) => {
        $('#imp-yes', sh).addEventListener('click', () => {
          const added = Strava.addRun(rec); close();
          if (added) { haptic.ok(); confetti(window.innerWidth / 2, window.innerHeight / 2, 36); scheduleAll(); toast('Lauf eingelesen – ' + rec.kcal + ' kcal verbrannt 🔥'); }
          else toast('Diesen Lauf gibt es schon.', 'toast-warn');
          refresh();
        });
      });
    }, () => toast('Die Datei konnte nicht gelesen werden.', 'toast-warn'));
    return;
  }
  if (el.dataset.nt) { S.notif[el.dataset.nt].on = el.checked; save(); haptic.tap(); scheduleAll(); refresh(); }
  if (el.dataset.n) { const key = el.dataset.n; const rest = (S.notif[key].t || '').split(',').slice(1); S.notif[key].t = [el.value, ...rest].join(','); save(); scheduleAll(); }
  if (el.dataset.f && el.closest('.rv-item')) { readReviewInputs(); if (el.dataset.f === 'ing') el.closest('.rv-item').classList.toggle('matched', !!el.value); }
});

/* ---------- Start ---------- */
/* ---------- Web-App (iPhone/Browser): Zugangslink, Einladung, Hinweise ---------- */
let pendingGo = '';
function applyPreset(user, preset) {
  if (S.profile.onboarded) return;
  Object.assign(S.profile, { name: user.name, sex: (preset && preset.sex) || 'm', onboarded: true });
  S.seen.v11 = true; S.seen.v20 = true; save(true); E.ensurePlan();
}
async function launchParams() {
  if (isNative) return false;
  const q = new URLSearchParams(location.search), k = q.get('k'), c = q.get('c');
  await SO.detectCloud();
  const link = document.querySelector('link[rel=manifest]'); if (link && (k || c)) link.href = 'manifest.webmanifest?' + (k ? 'k=' + encodeURIComponent(k) : 'c=' + encodeURIComponent(c));
  let welcomed = false;
  if (k && (!SO.online() || SO.soc().token !== k)) {
    try { const r = await SO.loginWithToken(k); applyPreset(r.user, r.preset); if (!S.seen.welcome) { S.seen.welcome = 1; save(true); welcomed = r.user.name; } }
    catch (e) { toast('Dieser Zugangslink gilt nicht mehr. Bitte den Besitzer um einen neuen Link.', 'toast-warn'); }
  }
  if (c && !SO.online()) { V3.prepareInvite(c); pendingGo = '#/freunde'; }
  if (/^#\/chat\//.test(location.hash)) pendingGo = location.hash;
  if (SO.isStandalone() && (k || c)) history.replaceState(null, '', location.pathname + location.hash);   // im Safari-Tab bleibt der Link stehen, damit „Zum Home-Bildschirm“ ihn behält
  if (welcomed) setTimeout(() => V3.welcomeSheet(welcomed), 1200);
  return !!welcomed;
}
function iosBanner() {
  if (isNative || !SO.isIOS || SO.isStandalone() || S.seen.iosHide) return;
  const b = document.createElement('button'); b.className = 'ios-banner tap'; b.innerHTML = '📲 <span><b>Als App installieren</b><small>Teilen ⎙ → „Zum Home-Bildschirm“</small></span><i>✕</i>';
  b.addEventListener('click', e => { if (e.target.tagName === 'I') { S.seen.iosHide = 1; save(); b.remove(); return; } sheet(`<h2 class="sh-t">Auf den Home-Bildschirm</h2><ol class="howto"><li>Unten in Safari auf <b>Teilen ⎙</b> tippen (Quadrat mit Pfeil).</li><li>Nach unten scrollen und <b>„Zum Home-Bildschirm“</b> wählen.</li><li><b>„Hinzufügen“</b> tippen.</li><li>Ab jetzt die App <b>vom Home-Bildschirm</b> öffnen – nur dann gehen auch Mitteilungen.</li></ol><button class="btn wide tap" data-close>Verstanden</button>`); });
  document.body.appendChild(b);
}
function registerSW() {
  if (isNative || !('serviceWorker' in navigator) || !(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => {
    const d = e.data || {};
    if (d.type === 'go' && d.url) { const h = new URL(d.url, location.origin).hash; if (h) go(h); }
  });
}

async function boot() {
  applyTheme();
  E.ensurePlan();
  initRouter();
  registerSW();
  await launchParams();
  if (!S.profile.onboarded) setTimeout(() => go('#/onboarding', { replace: true }), 30);
  else if (!S.seen.v11) setTimeout(() => {
    sheet(`<div class="learn-sum"><span class="ls-emo">🏃✨</span><h2 class="sh-t">Neu: Laufen & Mini-Workouts</h2><p class="sh-sub">Die App plant jetzt Laufeinheiten und erinnert dich daran. Keine Lust zu laufen? Dann gibt’s ein kurzes Workout mit Anleitung und Timer. Stell kurz ein, wann du laufen willst:</p></div>${V.runSetupHTML()}<button class="btn wide tap" data-close>Passt so</button>`);
    S.seen.v11 = true; save();
    watchSheetClose();
  }, 900);
  else if (!S.seen.v20) setTimeout(() => {
    sheet(`<div class="learn-sum"><span class="ls-emo">💪🏆💬</span><h2 class="sh-t">Neu in 2.0</h2><p class="sh-sub">Die größte Version bisher:</p></div>
      <ul class="so-feat"><li><b>🤸</b>137 Übungen nur mit dem eigenen Körper – mit Fotos, Anleitung und Level von Einsteiger bis Profi</li><li><b>🫀</b>Muskel-Grafik: du siehst bei jeder Übung, was gerade arbeitet</li><li><b>🗓️</b>Trainingspläne für Frauen und Männer + Workout-Player mit Pausen-Timer</li><li><b>👥</b>Freunde, Gruppenchat mit Fotos & Stickern und eine Wochen-Rangliste</li></ul>
      <div class="rc-btns" style="margin-top:16px"><button class="btn tap" data-go="#/training">Training ansehen</button><button class="btn ghost tap" data-go="#/freunde">Freunde</button></div>`);
    S.seen.v20 = true; save();
  }, 900);
  onBack(() => {
    if (window.__sheetClose) { window.__sheetClose(); return; }
    if (current().startsWith('#/timer') && ui.timer) { confirmStopTimer(); return; }
    if (current() === '#/play' && V2.ui2.play) { A['pl-quit'](); return; }
    if (document.querySelector('.viewer')) { document.querySelector('.viewer').click(); return; }
    if (current().includes('onboarding')) { exitApp(); return; }
    if (!back()) exitApp();
  });
  let lastDay = E.todayKey();
  onResume(() => {
    if (E.todayKey() !== lastDay) { lastDay = E.todayKey(); ui.day = lastDay; E.ensurePlan(); scheduleAll(); }
    if (ui.timer && !ui.timer.done && current().startsWith('#/timer')) { step(); renderTimer(true); return; }
    if (['#/heute', '#/plan', '#/einkauf', '#/training'].includes(current()) || (current() === '#/strava' && Strava.connected())) refresh();   // Einrichtung nicht neu zeichnen (Eingaben bleiben)
    stravaAuto();
  });
  if (isNative) {
    await setupNotifications(onNotifAction);
    notifPerm = await notifPermission(false);
    if (S.profile.onboarded) scheduleAll();
  } else notifPerm = 'browser';
  stravaAuto();
  if (SO.online()) { SO.connect(); SO.refreshLists().catch(() => {}); SO.refreshPush(); Strava.refreshServer().then(() => stravaAuto()); }
  if (pendingGo && S.profile.onboarded) setTimeout(() => go(pendingGo), 400);
  iosBanner();
  setTimeout(() => document.body.classList.add('ready'), 50);
}
boot();
