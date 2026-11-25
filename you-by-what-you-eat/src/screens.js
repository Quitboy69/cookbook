/* Alle Bildschirme – Design angelehnt an moderne Fitness-/Ernährungs-Apps */
import { ING, DISHES, STORES, CATS, W_REST, W_TRAIN } from './data.js';
import { S } from './store.js';
import * as E from './engine.js';
import * as SP from './sport.js';
import { ico, esc, ring, refresh, current } from './ui.js';
import { isNative } from './native.js';
import * as SO from './social.js';
import * as FA from './foodai.js';
import * as N from './nutri.js';
import * as Strava from './strava.js';
import * as V2 from './screens2.js';
import * as W from './workouts.js';

const { fmtInt, dec, eur, lit, DAYS, DS, MONTHS } = E;
export const ui = { day: null, amt: 'pp', review: null, drink: null, ob: 0, shopFrom: null, rz: 'alle', timer: null };

/* =========================================================
   Bausteine
   ========================================================= */
export const essenTabs = a => `<div class="seg wide etabs rise">${[['#/plan', 'plan', 'Wochenplan'], ['#/rezepte', 'rezepte', 'Rezepte'], ['#/einkauf', 'einkauf', 'Einkauf'], ['#/bon', 'bon', 'Bons']].map(([r, k, l]) => `<button class="tap${a === k ? ' on' : ''}" data-go="${r}">${l}</button>`).join('')}</div>`;
const dhead = (title, sub = '', right = '') => `<header class="dhead"><button class="iconbtn tap" data-act="back" aria-label="Zurück">${ico('back')}</button><div class="dhead-t"><b>${title}</b>${sub ? '<small>' + sub + '</small>' : ''}</div><span class="dhead-s">${right}</span></header>`;
const stars = (v, cls = '') => { if (v == null) return ''; let h = '<span class="stars-mini ' + cls + '" aria-label="' + dec(v, 1) + ' Sterne">'; for (let i = 1; i <= 5; i++) h += '<i class="' + (v >= i - 0.25 ? 'on' : v >= i - 0.75 ? 'half' : '') + '">★</i>'; return h + '</span>'; };
const tag = (price, l1) => `<span class="ptag"><span class="ptag-p">${dec(price)}</span><span class="ptag-u">€ ${l1}</span></span>`;
const storeDot = id => `<i class="sdot" style="--c:${(STORES[id] || STORES.sonst).color}"></i>`;
const storeName = id => (STORES[id] || STORES.sonst).name;
const dLabel = k => { const d = E.dateOf(k); return d.getDate() + '. ' + MONTHS[d.getMonth()]; };
const dShort = k => { const d = E.dateOf(k); return d.getDate() + '.' + (d.getMonth() + 1) + '.'; };
const relDay = k => { const n = E.daysBetween(E.todayKey(), k); return n === 0 ? 'Heute' : n === 1 ? 'Morgen' : n === -1 ? 'Gestern' : DAYS[E.wd(k)]; };
const slotLabel = { f: 'Frühstück', m: 'Mittagessen', s: 'Jause', a: 'Abendessen' };
const slotTime = { f: '07:00', m: '12:30', s: '16:00', a: '19:00' };
const pct = (a, b) => Math.max(0, Math.min(100, b ? a / b * 100 : 0)).toFixed(1) + '%';
const greeting = () => { const h = new Date().getHours(); return h < 11 ? 'Guten Morgen' : h < 14 ? 'Mahlzeit' : h < 18 ? 'Hallo' : 'Guten Abend'; };
const packTxt = g => g.unit === 'stk' ? g.pack + ' Stk' : g.pack < 1 ? fmtInt(g.pack * 1000) + (g.unit === 'kg' ? ' g' : ' ml') : lit(g.pack) + (g.unit === 'kg' ? ' kg' : ' L');

/* „Foto“ eines Gerichts: Teller mit Hauptgericht + verstreute Zutaten (Flatlay) */
const SPOTS = [[12, 18, -14], [80, 14, 12], [86, 70, -8], [10, 74, 16], [50, 88, 4], [92, 42, -20]];
export function photo(id, cls = '') {
  const d = DISHES[id];
  const extra = [...new Set(Object.keys(d.need).map(i => ING[i].e).filter(e => e && e !== d.emoji))].slice(0, 5);
  return `<div class="ph ${cls}" style="--h:${d.hue}"><i class="ph-tex"></i>${extra.map((e, i) => `<span class="ph-i" style="left:${SPOTS[i][0]}%;top:${SPOTS[i][1]}%;--r:${SPOTS[i][2]}deg">${e}</span>`).join('')}<span class="ph-plate"><span class="ph-e">${d.emoji}</span></span></div>`;
}
/* Runder Teller mit Fortschrittsring (für Listen) */
export const plate = (id, p = 0, cls = '') => { const d = DISHES[id]; return `<span class="fc ${cls}" style="--h:${d.hue};--p:${Math.max(0, Math.min(1, p))}"><span class="fc-in">${d.emoji}</span></span>`; };
function dishTags(id) {
  const d = DISHES[id], t = [];
  if (d.min <= 15) t.push('Schnell'); else if (d.min <= 30) t.push('Einfach');
  if (d.slot === 'a') t.push('Meal-Prep');
  if (d.prot >= 35) t.push('High-Protein');
  if (E.dishCost(id).portion < 1.0) t.push('Günstig');
  if (d.protein === 'veggie') t.push('Veggie');
  return t.slice(0, 3);
}
/* Wochen-Kreise (Mo–So) */
function weekCircles(sel) {
  const t = E.todayKey(), mon = E.addDays(t, -E.wd(t));
  let h = '<div class="wk">';
  for (let i = 0; i < 7; i++) {
    const k = E.addDays(mon, i), p = S.plan[k];
    const tot = p ? E.dayTotals(k) : null;
    const prog = tot && tot.kcal ? Math.min(1, tot.eaten / tot.kcal) : 0;
    const a = SP.actOf(k), run = SP.isRunDay(k);
    const done = prog >= 0.99;
    h += `<button class="wc tap${k === sel ? ' sel' : ''}${k === t ? ' today' : ''}${!p ? ' off' : ''}" ${p ? `data-act="day" data-k="${k}"` : 'disabled'} style="--p:${prog}"><small>${DS[i]}</small><span class="wc-r"><span class="wc-in">${done ? ico('check') : E.dateOf(k).getDate()}</span></span><i class="wc-a${run ? (a && a.done ? ' done' : ' plan') : ''}"></i></button>`;
  }
  return h + '</div>';
}
/* Halbkreis-Anzeige: Gegessen | Übrig | Verbrannt */
function gauge(eaten, goal, burned) {
  const total = goal + burned, left = total - eaten, p = Math.min(1, eaten / total);
  const L = Math.PI * 92;
  return `<div class="gauge">
    <svg viewBox="0 0 220 124" aria-hidden="true"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="var(--g1)"/><stop offset="1" stop-color="var(--g2)"/></linearGradient></defs>
      <path d="M18 112 A92 92 0 0 1 202 112" class="g-track" fill="none" stroke-width="14" stroke-linecap="round"/>
      <path d="M18 112 A92 92 0 0 1 202 112" class="ring-fg g-fg" fill="none" stroke="url(#gg)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${L.toFixed(2)}" data-p="${p}"/></svg>
    <button class="g-side l tap" data-go="#/info/kcal"><b data-count="${eaten}">0</b><small>Gegessen</small></button>
    <button class="g-mid tap" data-go="#/info/kcal"><b data-count="${Math.abs(left)}">0</b><small>${left >= 0 ? 'Übrig' : 'drüber'}</small></button>
    <button class="g-side r tap" data-go="#/info/verbrannt"><b data-count="${burned}">0</b><small>Verbrannt</small></button>
  </div>`;
}
function sugarRow(tot) {
  const v = tot.eatenSugar || 0, plan = tot.sugar || 0, cls = v >= 90 ? 'red' : v >= 50 ? 'warn' : '';
  return `<button class="sugar-row tap ${cls}" data-go="#/info/zucker"><span class="sr-l">🍬 Zucker</span><span class="mbar"><i class="plan" style="width:${pct(plan, 90)}"></i><i data-w="${pct(v, 90)}"></i></span><b>${fmtInt(v)} / 90 g</b></button>`;
}
function macroBars(tot, T) {
  const m = [['kh', 'Kohlenhydrate', tot.eatenKh, T.kh, tot.kh], ['prot', 'Eiweiß', tot.eatenProt, T.prot, tot.prot], ['fat', 'Fett', tot.eatenFat, T.fat, tot.fat]];
  return `<div class="macros">${m.map(([k, l, v, t, pl]) => `<button class="mac tap m-${k}" data-go="#/info/makros"><small>${l}</small><span class="mbar"><i class="plan" style="width:${pct(pl, t)}"></i><i data-w="${pct(v, t)}"></i></span><b>${fmtInt(v)} / ${fmtInt(t)} g</b></button>`).join('')}</div>`;
}

/* =========================================================
   HEUTE
   ========================================================= */
export function heute() {
  E.ensurePlan();
  const t = E.todayKey();
  if (!ui.day || !S.plan[ui.day]) ui.day = t;
  const k = ui.day, p = S.plan[k];
  const T = E.targets(), tot = E.dayTotals(k);
  const isToday = k === t;
  const log = S.log[k] || {};
  const burned = SP.burned(k);
  const name = S.profile.name ? ', ' + esc(S.profile.name) : '';
  const a = p && DISHES[p.a];
  const cost = a ? E.dishCost(p.a) : null;
  const act = SP.plannedActivity(k);
  const promos = topPromos(3);
  const evening = isToday && new Date().getHours() >= 18;
  const unrated = p && E.ratingOf(p.a, k, 'a') == null;

  // „Als Nächstes“
  const skip = log.skip || {};
  const nextSl = p ? ['f', 'm', 's', 'a'].find(sl => !(log.eaten && log.eaten[sl]) && !skip[sl]) : null;
  let next = '';
  if (nextSl) {
    const d = DISHES[p[nextSl]];
    next += `<div class="nx m"><i class="nx-bar"></i><button class="nx-main tap" data-go="#/dish/${p[nextSl]}?d=${k}&s=${nextSl}">${plate(p[nextSl], 0, 'sm')}<span><small>${isToday ? 'Nächste Mahlzeit' : slotLabel[nextSl]} · ${slotTime[nextSl]}</small><b>${esc(d.name)}</b><em>Eiweiß <u>${d.prot} g</u> · KH <u>${d.kh} g</u> · Fett <u>${d.fat} g</u></em></span></button><button class="nx-btn tap" data-act="eat" data-k="${k}" data-slot="${nextSl}" aria-label="gegessen">${ico('plus')}</button></div>`;
  }
  if (act && !act.done) {
    if (act.kind === 'run') {
      const r = act.session;
      next += `<div class="nx r"><i class="nx-bar"></i><button class="nx-main tap" data-go="#/run/${k}"><span class="nx-ico run">${ico('run')}</span><span><small>Nächste Aktivität · ${S.profile.runTime}</small><b>${esc(r.name)}</b><em>${ico('clock', 'xs')}${r.min} Min · <span class="zdot" style="--c:${SP.ZONES[r.zone].c}"></span>Z${r.zone} · ≈ ${lit(r.km)} km</em></span></button><button class="nx-btn play tap" data-go="#/timer/run/${k}" aria-label="Lauf starten">${ico('play')}</button></div>`;
    } else {
      const w = SP.WORKOUTS[act.id];
      next += `<div class="nx w"><i class="nx-bar"></i><button class="nx-main tap" data-go="#/workout/${act.id}?d=${k}"><span class="nx-ico wo">${w.emoji}</span><span><small>Statt Laufen · Mini-Workout</small><b>${esc(w.name)}</b><em>${ico('clock', 'xs')}${act.min} Min · ≈ ${act.kcal} kcal</em></span></button><button class="nx-btn play tap" data-go="#/timer/workout/${act.id}?d=${k}" aria-label="Workout starten">${ico('play')}</button></div>`;
    }
  } else if (act && act.done) {
    next += `<div class="nx d"><i class="nx-bar"></i><span class="nx-main"><span class="nx-ico ok">${ico('check')}</span><span><small>Aktivität erledigt</small><b>${act.kind === 'run' ? 'Gelaufen' + (act.km ? ' · ' + lit(act.km) + ' km' : '') : esc(SP.WORKOUTS[act.id].name)}</b><em>${act.min} Min · ${act.kcal} kcal verbrannt 🔥</em></span></span></div>`;
  }
  if (isToday) {
    const sw = W.workoutOfDay(k), dw = W.wlog().filter(x => x.d === k).slice(-1)[0];
    if (dw) next += `<div class="nx d"><i class="nx-bar"></i><span class="nx-main"><span class="nx-ico ok">${ico('check')}</span><span><small>Krafttraining erledigt</small><b>${esc(dw.n)}</b><em>${dw.min} Min · +${dw.pts} Punkte 💪</em></span></span></div>`;
    else if (sw) next += `<div class="nx k"><i class="nx-bar"></i><button class="nx-main tap" data-go="#/wk/${encodeURIComponent(sw.id)}"><span class="nx-ico kraft">${sw.e}</span><span><small>Krafttraining heute · ${W.LEVEL[sw.lvl].n}</small><b>${esc(sw.n)}</b><em>${ico('clock', 'xs')}${sw.min} Min · ${sw.items.length} Übungen</em></span></button><button class="nx-btn play tap" data-act="wk-start" data-wid="${sw.id}" aria-label="Workout starten">${ico('play')}</button></div>`;
  }
  if (!next) next = `<div class="nx d"><i class="nx-bar"></i><span class="nx-main"><span class="nx-ico ok">${ico('check')}</span><span><small>${relDay(k)}</small><b>Alles erledigt – stark! 🎉</b></span></span></div>`;

  const per = S.profile.persons;
  const meals = p ? ['f', 'm', 's', 'a'].map(sl => {
    const id = p[sl], d = DISHES[id], eaten = log.eaten && log.eaten[sl];
    if (skip[sl]) { const ex = FA.extrasOf(k).find(x => x.replaces && x.slot === sl); return `<li class="ml skipped"><button class="ml-main tap" data-go="#/dish/${id}?d=${k}&s=${sl}">${plate(id, 0)}<span class="ml-t"><b>${slotLabel[sl]} <span class="flag flag-box">ersetzt</span></b><span>${esc(d.name)}</span><small>stattdessen: ${ex ? esc(ex.name) : 'eigenes Essen'}</small></span></button></li>`; }
    const amt = sl === 'a' ? (ui.amt === 'all' ? '1 Topf · ' + per * 2 + ' Portionen' : '1 Portion') : sl === 'm' && p.mBox ? (ui.amt === 'all' ? per + ' Boxen' : '1 Box') + ' vom Vorabend' : Object.entries(d.need).slice(0, 3).map(([ing, x]) => E.fmtIng(ing, x * (ui.amt === 'all' ? per : 1))).join(' · ');
    return `<li class="ml${eaten ? ' eaten' : ''}"><button class="ml-main tap" data-go="#/dish/${id}?d=${k}&s=${sl}">${plate(id, eaten ? 1 : 0)}<span class="ml-t"><b>${slotLabel[sl]}${sl === 'f' ? ' <span class="flag flag-small">klein</span>' : ''}${sl === 'm' && p.mBox ? ' <span class="flag flag-box">Box</span>' : ''}${sl === 'a' ? ' <span class="flag flag-cook">kochen</span>' : ''}</b><span>${esc(d.name)}</span><small>${eaten ? fmtInt(d.kcal) : 0} / ${fmtInt(d.kcal)} kcal · ${amt}</small></span></button><button class="ml-add tap${eaten ? ' on' : ''}" data-act="eat" data-k="${k}" data-slot="${sl}" aria-label="${eaten ? 'gegessen' : 'als gegessen markieren'}">${ico(eaten ? 'check' : 'plus')}</button></li>`;
  }).join('') : '';

  return { html: `
  <div class="page home">
    <div class="mesh" aria-hidden="true"></div>
    <header class="top rise">
      <div><p class="kicker">${greeting()}${name}</p><h1 class="h1">${isToday ? 'Heute' : relDay(k)}</h1><p class="sub">${DAYS[E.wd(k)]}, ${dLabel(k)}${p && p.train ? ' · <span class="ok">Krafttraining</span>' : ''}${SP.isRunDay(k) ? ' · <span class="run-c">Lauftag</span>' : ''}</p></div>
      <div class="top-btns"><button class="iconbtn tap" data-act="quick" aria-label="Schnell-Aktionen">${ico('grid')}</button><button class="avatar tap" data-go="#/ich" aria-label="Profil">${S.profile.name ? esc(S.profile.name[0].toUpperCase()) : ico('user')}</button></div>
    </header>
    <div class="rise">${weekCircles(k)}</div>

    <article class="card next rise"><div class="row-b"><h2 class="c-h">Als Nächstes</h2><button class="link tap" data-go="#/plan">Wochenplan ${ico('chev', 'xs')}</button></div>${next}</article>

    <article class="card rise">
      ${gauge(tot.eaten, T.kcal, burned)}
      ${macroBars(tot, T)}
      ${sugarRow(tot)}
      <p class="plan-note">${ico('book', 'xs')} Plan: ${fmtInt(tot.kcal)} kcal · ${tot.prot} g Eiweiß · ${eur(tot.eur)} pro Person</p>
    </article>

    <article class="card rise"><div class="row-b"><h2 class="c-h">Mahlzeiten</h2><div class="seg sm"><button class="tap${ui.amt === 'pp' ? ' on' : ''}" data-act="amt" data-v="pp">1 Pers.</button><button class="tap${ui.amt === 'all' ? ' on' : ''}" data-act="amt" data-v="all">für ${per}</button></div></div><ul class="mlist">${meals}${FA.extrasOf(k).map(x => `<li class="ml extra"><button class="ml-main tap" data-act="extra-info" data-k="${k}" data-id="${x.id}">${x.thumb ? `<span class="fc photo" style="--p:1"><img src="${x.thumb}" alt=""></span>` : `<span class="fc" style="--h:30;--p:1"><span class="fc-in">${x.e}</span></span>`}<span class="ml-t"><b>📸 ${slotLabel[x.slot] || 'Snack'}${x.replaces ? '' : ' <span class="flag flag-small">extra</span>'}</b><span>${esc(x.name)}</span><small>${fmtInt(x.kcal)} kcal${x.sugar != null ? ' · 🍬 ' + dec(x.sugar, x.sugar < 10 ? 1 : 0) + ' g' : ''} · ${x.g} ${x.ml ? 'ml' : 'g'} · ${new Date(x.t).toTimeString().slice(0, 5)}</small></span></button><button class="ml-del tap" data-act="extra-del" data-k="${k}" data-id="${x.id}" aria-label="Löschen">${ico('close')}</button></li>`).join('')}</ul>
      <button class="photo-cta tap" data-act="foodcam" data-k="${k}"><span class="pc-ico">${ico('camera')}</span><span><b>Was anderes gegessen?</b><small>Foto machen – die KI erkennt’s und zählt die Kalorien</small></span>${ico('chev')}</button></article>

    ${a ? `
    <article class="card cook rise">
      <button class="cook-ph tap" data-go="#/dish/${p.a}?d=${k}&s=a">${photo(p.a)}<span class="ph-over"><small>${isToday ? 'Heute Abend kochen' : DAYS[E.wd(k)] + 'abend kochen'}${log.cooked ? ' · gekocht ✓' : ''}</small><b>${esc(a.name)}</b></span></button>
      <div class="stats3"><span>${ico('bolt')}<b>${fmtInt(a.kcal)} kcal</b></span><span>${ico('clock')}<b>${a.min} Min</b></span><span>${ico('people')}<b>${per * 2} Portionen</b></span></div>
      <div class="pills">${dishTags(p.a).map(x => '<span class="pill">' + x + '</span>').join('')}<button class="pill ghost tap" data-go="#/info/box">${ico('box', 'xs')}${per} Boxen → morgen</button></div>
      <div class="cook-actions">
        <button class="btn tap" data-go="#/dish/${p.a}?d=${k}&s=a">${ico('book')}Rezept</button>
        <button class="btn ghost tap${log.cooked ? ' on' : ''}" data-act="cooked" data-k="${k}">${ico('check')}${log.cooked ? 'Gekocht' : 'Gekocht?'}</button>
        <button class="iconbtn tap" data-act="reroll" data-slot="a" aria-label="Anderes Gericht">${ico('shuffle')}</button>
        ${tag(cost.portion, 'pro<br>Portion')}
      </div>
    </article>` : ''}

    ${p && (evening || (unrated && E.daysBetween(k, t) > 0)) ? `
    <article class="card rate-card rise">
      <p class="kicker">${isToday ? 'Schon gegessen?' : relDay(k) + ' bewerten'}</p><h3>Wie war ${esc(a.name)}?</h3>
      <div class="rate-inline">${[1, 2, 3, 4, 5].map(i => `<button class="star tap${(E.ratingOf(p.a, k, 'a') || 0) >= i ? ' on' : ''}" data-act="quick-rate" data-k="${k}" data-v="${i}" aria-label="${i} Sterne">★</button>`).join('')}</div>
      <button class="link tap" data-act="rate-open" data-k="${k}">Alle Mahlzeiten bewerten →</button>
    </article>` : ''}

    <div class="duo rise">${waterTile(k)}${moveTile(k, act)}</div>

    ${promos.length ? `<article class="card rise"><div class="row-b"><h2 class="c-h">${ico('tag', 'xs')} Gerade in Aktion</h2><button class="link tap" data-go="#/promos">Alle ${ico('chev', 'xs')}</button></div>
      ${promos.map(pr => `<button class="promo-row tap" data-go="#/ing/${pr.ing}"><span class="pr-e">${ING[pr.ing].e}</span><span><b>${esc(ING[pr.ing].name)}</b><small>${storeDot(pr.store)}${storeName(pr.store)} · seit ${dShort(pr.d)}</small></span><em>${pr.pct ? '−' + pr.pct + ' %' : eur(pr.price)}</em></button>`).join('')}</article>`
      : `<button class="card hint-card rise tap" data-go="#/bon"><span class="hint-ico">${ico('scan')}</span><span><b>Kassenbon scannen</b><small>Dann lernt die App die Preise und Aktionen deines Supermarkts.</small></span>${ico('chev')}</button>`}
  </div>` };
}

function waterGoal(k) { const T = E.targets(); const L = S.log[k] || {}; const mode = L.waterMode || ((S.plan[k] || {}).train || SP.isRunDay(k) ? 'train' : 'rest'); return { mode, glasses: Math.round((T.water + (mode === 'train' ? 1 : 0)) / 0.25) }; }
function waterTile(k) {
  const L = S.log[k] || {}, n = L.water || 0, g = waterGoal(k);
  return `<article class="card tile2 water">
    <button class="t2-h tap" data-go="#/trinken"><span class="t2-ico">${ico('drop')}</span><b>Wasser</b></button>
    <div class="t2-v"><b>${lit(n * 0.25)}</b> / ${lit(g.glasses * 0.25)} L</div>
    <div class="cup" style="--p:${Math.min(1, n / g.glasses).toFixed(3)}"><i class="wave"></i></div>
    <div class="t2-act"><button class="mini-btn tap" data-act="water" data-k="${k}" data-v="-1" aria-label="Glas weniger">${ico('minus')}</button><button class="mini-btn on tap" data-act="water" data-k="${k}" data-v="1" aria-label="Glas mehr">${ico('plus')}</button></div>
  </article>`;
}
function moveTile(k, act) {
  const doneMin = act && act.done ? act.min : 0, planMin = act ? act.min : 0;
  return `<article class="card tile2 move">
    <button class="t2-h tap" data-go="#/training"><span class="t2-ico">${ico('run')}</span><b>Bewegung</b></button>
    <div class="t2-v"><b>${doneMin}</b> / ${planMin || '–'} Min</div>
    <div class="cup run" style="--p:${planMin ? Math.min(1, doneMin / planMin).toFixed(3) : 0}"><i class="wave"></i><span>${act ? (act.kind === 'run' ? '🏃' : SP.WORKOUTS[act.id].emoji) : '🧘'}</span></div>
    <button class="btn sm wide tap" data-go="${act && !act.done ? (act.kind === 'run' ? '#/run/' + k : '#/workout/' + act.id + '?d=' + k) : '#/training'}">${act && !act.done ? (act.kind === 'run' ? 'Lauf · ' + S.profile.runTime : 'Workout') : act ? 'Erledigt ✓' : 'Training'}</button>
  </article>`;
}
function topPromos(n) {
  const L = E.learned().info, out = [];
  for (const [ing, per] of Object.entries(L)) for (const [store, x] of Object.entries(per)) if (x.promoNow) out.push({ ing, store, d: x.promoNow.d, pct: x.promoNow.pct, price: x.promoNow.per });
  return out.sort((a, b) => b.d < a.d ? -1 : 1).slice(0, n);
}

/* =========================================================
   PLAN (Woche) & REZEPTE
   ========================================================= */
const planSeg = on => `<div class="seg wide top-seg rise"><button class="tap${on === 'plan' ? ' on' : ''}" data-go="#/plan">Wochenplan</button><button class="tap${on === 'rezepte' ? ' on' : ''}" data-go="#/rezepte">Rezepte</button></div>`;
export function plan() {
  E.ensurePlan();
  const t = E.todayKey(), T = E.targets();
  const days = []; for (let i = 0; i < 7; i++) days.push(E.addDays(t, i));
  const tots = days.map(E.dayTotals);
  const avgK = tots.reduce((s, x) => s + x.kcal, 0) / 7, avgP = tots.reduce((s, x) => s + x.prot, 0) / 7, sumE = tots.reduce((s, x) => s + x.eur, 0);
  const v = E.varietyScore(t);
  const max = Math.max(T.kcal * 1.15, ...tots.map(x => x.kcal));
  return { html: `
  <div class="page">
    <div class="mesh m2" aria-hidden="true"></div>
    <header class="top rise"><div><p class="kicker">${dLabel(days[0])} – ${dLabel(days[6])}</p><h1 class="h1">Plan</h1></div></header>
    ${essenTabs('plan')}
    
    <div class="tiles4">
      <button class="tile tap rise" data-go="#/info/kcal">${ico('bolt')}<b data-count="${avgK}">0</b><small>Ø kcal / Tag</small></button>
      <button class="tile tap rise" data-go="#/info/eiweiss">${ico('muscle')}<b data-count="${avgP}" data-suf=" g">0</b><small>Ø Eiweiß / Tag</small></button>
      <button class="tile tap rise" data-go="#/info/kosten">${ico('euro')}<b data-count="${sumE}" data-dec="2" data-suf=" €">0</b><small>pro Person / Woche</small></button>
      <button class="tile tap rise" data-go="#/info/abwechslung">${ico('spark')}<b data-count="${v.distinct}">0</b><small>verschiedene Gerichte</small></button>
    </div>
    <article class="card rise">
      <h3 class="c-h">Kalorien pro Tag</h3>
      <div class="chart">
        <i class="target" style="bottom:${(T.kcal / max * 140 + 38).toFixed(1)}px"><span>Ziel ${fmtInt(T.kcal)}</span></i>
        ${tots.map((x, i) => `<button class="col tap${i === 0 ? ' today' : ''}" data-act="day" data-k="${days[i]}" data-tab="1"><span class="cv">${dec(x.kcal / 1000, 1)}k</span><span class="cb"><i data-h="${(x.kcal / max * 100).toFixed(1)}%"></i></span><small>${DS[E.wd(days[i])]}</small><em class="col-run">${SP.isRunDay(days[i]) ? '🏃' : ''}</em></button>`).join('')}
      </div>
    </article>
    ${days.map((k, i) => { const p = S.plan[k], act = SP.plannedActivity(k); return `
    <article class="card dayc rise${i === 0 ? ' is-today' : ''}">
      <button class="dc-h tap" data-act="day" data-k="${k}" data-tab="1"><span class="dc-d"><small>${DS[E.wd(k)]}</small><b>${E.dateOf(k).getDate()}</b></span><span class="dc-t"><b>${relDay(k)}</b><small>${fmtInt(tots[i].kcal)} kcal · ${tots[i].prot} g Eiweiß · ${eur(tots[i].eur)}</small></span>${ico('chev')}</button>
      <div class="dc-macros"><i class="m-kh" style="flex:${tots[i].kh * 4}"></i><i class="m-prot" style="flex:${tots[i].prot * 4}"></i><i class="m-fat" style="flex:${tots[i].fat * 9}"></i></div>
      <div class="dc-meals">${['f', 'm', 's', 'a'].map(sl => `<button class="dm tap" data-go="#/dish/${p[sl]}?d=${k}&s=${sl}">${plate(p[sl], 0, 'xs')}<span><small>${slotLabel[sl]}</small>${esc(DISHES[p[sl]].name)}</span></button>`).join('')}</div>
      ${act || p.train ? `<div class="dc-act">${act ? `<button class="chip tap act-${act.kind}${act.done ? ' done' : ''}" data-go="${act.kind === 'run' ? '#/run/' + k : '#/workout/' + act.id + '?d=' + k}">${act.kind === 'run' ? ico('run') + esc(act.session.name) + ' · ' + act.min + ' Min' : SP.WORKOUTS[act.id].emoji + ' ' + esc(SP.WORKOUTS[act.id].name)}${act.done ? ' ✓' : ''}</button>` : ''}${p.train ? `<span class="chip act-gym">${ico('dumbbell')}Krafttraining</span>` : ''}</div>` : ''}
    </article>`; }).join('')}
    <button class="btn ghost wide rise tap" data-act="shuffle">${ico('shuffle')}Ab morgen neu mischen</button>
  </div>` };
}

const RZ_CATS = [
  ['f', 'Frühstück', 'miniporridge'], ['s', 'Jause', 'thunfischbrot'], ['a', 'Abendtopf', 'chili'],
  ['veggie', 'Ohne Fleisch', 'kichererbsen'], ['schnell', 'Schnell', 'smoothie'], ['protein', 'High-Protein', 'ofenhendl']
];
function rzFilter(f) {
  return Object.entries(DISHES).filter(([, d]) => f === 'alle' ? true : f === 'veggie' ? (d.protein === 'veggie' || (d.slot !== 'a' && !Object.keys(d.need).some(i => ING[i].cat === 'Fleisch & Fisch'))) : f === 'schnell' ? d.min <= 15 : f === 'protein' ? d.prot >= 35 : d.slot === f);
}
export function rezepte() {
  const t = E.todayKey(), f = ui.rz || 'alle';
  const recId = (S.plan[t] || {}).a || 'chili';
  const popular = Object.keys(DISHES).filter(id => !E.isBlocked(id)).map(id => ({ id, s: (E.avgRating(id) ?? 3.5) + DISHES[id].prot / 40 })).sort((a, b) => b.s - a.s).slice(0, 8);
  const list = rzFilter(f);
  const rec = DISHES[recId];
  return { html: `
  <div class="page">
    <div class="mesh m2" aria-hidden="true"></div>
    <header class="top rise"><div><p class="kicker">${Object.keys(DISHES).length} Gerichte</p><h1 class="h1">Rezepte</h1></div></header>
    ${essenTabs('rezepte')}
    
    <h2 class="sec rise">Empfohlen</h2>
    <button class="rec-hero tap rise" data-go="#/dish/${recId}?d=${t}&s=a">${photo(recId, 'big')}<span class="ph-over"><small>Heute Abend</small><b>${esc(rec.name)}</b><span class="ph-meta">${ico('bolt', 'xs')}${fmtInt(rec.kcal)} kcal · ${ico('clock', 'xs')}${rec.min} Min · ${ico('muscle', 'xs')}${rec.prot} g</span></span></button>
    <h2 class="sec rise">Kategorien</h2>
    <div class="cats rise">${RZ_CATS.map(([v, l, id]) => `<button class="cat tap${f === v ? ' on' : ''}" data-act="rz-filter" data-v="${f === v ? 'alle' : v}">${photo(id, 'cat-ph')}<b>${l}</b></button>`).join('')}</div>
    <h2 class="sec rise">Beliebt</h2>
    <div class="hscroll rise">${popular.map(({ id }) => `<button class="pop tap" data-go="#/dish/${id}">${photo(id, 'pop-ph')}<b>${esc(DISHES[id].name)}</b><small>${fmtInt(DISHES[id].kcal)} kcal · ${DISHES[id].min} Min</small>${stars(E.avgRating(id))}</button>`).join('')}</div>
    <div class="row-b rise"><h2 class="sec">${f === 'alle' ? 'Alle Rezepte' : (RZ_CATS.find(c => c[0] === f) || [0, 'Alle'])[1]}</h2>${f !== 'alle' ? '<button class="link tap" data-act="rz-filter" data-v="alle">Alle zeigen</button>' : ''}</div>
    <div class="rz-list">${list.map(([id, d]) => `<button class="rz-row tap rise${E.isBlocked(id) ? ' blocked' : ''}" data-go="#/dish/${id}">${photo(id, 'row-ph')}<span><b>${esc(d.name)}</b><small>${d.min} Min · ${fmtInt(d.kcal)} kcal · ${d.prot} g Eiweiß</small><span class="pills sm">${dishTags(id).map(x => '<span class="pill">' + x + '</span>').join('')}</span></span>${ico('chev')}</button>`).join('')}</div>
  </div>` };
}

/* =========================================================
   GERICHT
   ========================================================= */
export function dish(id, q) {
  const d = DISHES[id]; if (!d) return notFound();
  const k = q.d || null, sl = q.s || d.slot;
  const c = E.dishCost(id);
  const avg = E.avgRating(id), rs = S.ratings[id] || [];
  const isPot = d.slot === 'a';
  const per = S.profile.persons;
  const fac = isPot ? (ui.amt === 'all' ? E.potFactor() : 1 / 6) : (ui.amt === 'all' ? per : 1);
  const why = k ? E.whyDish(id, k) : [];
  const blocked = E.isBlocked(id), low = E.lowCount(id);
  const ing = Object.entries(d.need).map(([ig, a]) => {
    const row = c.rows.find(r => r.ing === ig);
    return `<li class="tap" data-go="#/ing/${ig}"><span class="ie">${ING[ig].e || '•'}</span><span class="n">${esc(ING[ig].name)}${row.p.promo ? ' <span class="flag flag-promo">Aktion</span>' : ''}<small>${E.fmtAmount(ig, a * fac)}</small></span><span class="c">${row.p.src === 'bon' ? storeDot(row.p.store) : '≈'}${dec(row.cost * fac)} €</span></li>`;
  }).join('');
  const hist = rs.slice(-8).map(r => `<span class="hdot">${r.st}★</span>`).join('');
  const kcalTot = d.prot * 4 + d.kh * 4 + d.fat * 9 || 1;
  return { html: `
  <div class="page detail no-head">
    <section class="d-hero">${photo(id, 'hero-ph')}<button class="iconbtn glass-btn tap" data-act="back" aria-label="Zurück">${ico('back')}</button>${avg >= 4 ? '<span class="heart">♥</span>' : ''}</section>
    <section class="d-sheet">
      <p class="kicker">${slotLabel[sl] || 'Gericht'}${k ? ' · ' + relDay(k) + ', ' + dLabel(k) : ''}</p>
      <h1 class="d-name">${esc(d.name)}</h1>
      <div class="stats3 lg"><button class="tap" data-go="#/info/kcal">${ico('bolt')}<b>${fmtInt(d.kcal)} kcal</b></button><button class="tap" data-go="#/info/zeit">${ico('clock')}<b>${d.min} Min</b></button><button class="tap" data-go="#/info/box">${ico('people')}<b>${isPot ? per * 2 + ' Portionen' : '1 Person'}</b></button></div>
      <div class="pills">${dishTags(id).map(x => '<span class="pill">' + x + '</span>').join('')}</div>

      <article class="card macro-card rise">
        <button class="donut tap" data-go="#/info/makros" style="--a:${(d.kh * 4 / kcalTot * 360).toFixed(0)}deg;--b:${((d.kh * 4 + d.prot * 4) / kcalTot * 360).toFixed(0)}deg"><span><b>${fmtInt(d.kcal)}</b><small>kcal</small></span></button>
        <ul class="mlegend"><li class="m-kh"><i></i>Kohlenhydrate <b>${d.kh} g</b></li><li class="m-prot"><i></i>Eiweiß <b>${d.prot} g</b></li><li class="m-fat"><i></i>Fett <b>${d.fat} g</b></li><li class="m-sugar"><i></i>davon Zucker <b>${d.sugar != null ? d.sugar : '–'} g</b></li><li class="cost"><i></i>Kosten <b>${eur(c.portion)}</b></li></ul>
        <p class="fine full">${isPot ? 'pro Portion' : 'pro Person'} · ${Math.round(d.kcal / E.targets().kcal * 100)} % deines Tagesbedarfs</p>
      </article>
      ${d.sugar != null ? `<article class="card rise"><h3 class="c-h">${ico('info', 'xs')} Nährwerte ${isPot ? 'pro Portion' : 'pro Person'}</h3>${dishTable(d)}</article>` : ''}

      ${blocked ? `<article class="card warn rise">${ico('ban')}<div><b>Vorerst aussortiert</b><p>Du hast es ${low}× unter 3 Sterne bewertet – darum plant die App automatisch was anderes ein.</p><button class="btn sm tap" data-act="unblock" data-id="${id}">Doch wieder einplanen</button></div></article>` : ''}
      ${why.length ? `<article class="card rise"><h3 class="c-h">${ico('spark', 'xs')} Warum ${k === E.todayKey() ? 'heute' : 'an dem Tag'}?</h3><ul class="facts">${why.map(w => '<li>' + esc(w) + '</li>').join('')}</ul></article>` : ''}

      <article class="card rise">
        <div class="row-b"><h3 class="c-h">${ico('star', 'xs')} Bewertung</h3><button class="link tap" data-go="#/info/sterne">Wie funktioniert das?</button></div>
        <div class="rate-big"><div class="rb-avg"><b>${avg != null ? dec(avg, 1) : '–'}</b>${stars(avg)}<small>${rs.length ? rs.length + '× bewertet' : 'noch nicht bewertet'}</small></div>
          ${k ? `<div class="rb-now"><small>${relDay(k)}:</small><div class="stars-row" data-id="${id}" data-k="${k}" data-slot="${sl}">${starRow(E.ratingOf(id, k, sl))}</div></div>` : ''}</div>
        ${hist ? '<div class="hist">' + hist + '</div>' : ''}
        ${low === 1 && !blocked ? '<p class="fine">1× unter 3 Sternen – noch einmal, dann kommt es automatisch nicht mehr.</p>' : ''}
      </article>

      <article class="card rise">
        <div class="row-b"><h3 class="c-h">${ico('cart', 'xs')} Zutaten</h3><div class="seg sm"><button class="tap${ui.amt === 'pp' ? ' on' : ''}" data-act="amt" data-v="pp">${isPot ? '1 Portion' : '1 Person'}</button><button class="tap${ui.amt === 'all' ? ' on' : ''}" data-act="amt" data-v="all">${isPot ? 'Topf' : 'für ' + per}</button></div></div>
        <ul class="ing">${ing}</ul>
        ${d.extra ? '<p class="fine">Dazu: ' + esc(d.extra) + '</p>' : ''}
        <div class="cost-sum"><span>Kosten ${isPot ? (ui.amt === 'all' ? 'Topf' : 'Portion') : (ui.amt === 'all' ? 'für ' + per : 'pro Person')}</span><b>${eur(c.total * fac)}</b></div>
        <p class="fine">${c.learnedShare > 0 ? Math.round(c.learnedShare * 100) + ' % der Preise von deinen Kassenbons' : '≈ geschätzte Preise – scanne Bons, dann wird’s genau'}</p>
      </article>

      <article class="card rise">
        <h3 class="c-h">${ico('pot', 'xs')} Zubereitung <small class="hint">tippen zum Abhaken</small></h3>
        <ol class="steps">${d.steps.map((s, i) => `<li class="tap" data-act="step"><span class="st-n">${i + 1}</span><span>${esc(s)}</span></li>`).join('')}</ol>
        <p class="tip">💡 ${esc(d.tip)}</p>
      </article>

      <div class="actions-row rise">
        ${k && S.plan[k] && (sl !== 'm' || !S.plan[k].mBox) ? `<button class="btn ghost tap" data-act="reroll" data-slot="${sl}" data-k="${k}" data-back="1">${ico('shuffle')}Anderes Gericht</button>` : ''}
        ${!blocked ? `<button class="btn ghost tap" data-act="block" data-id="${id}">${ico('ban')}Nie mehr</button>` : ''}
      </div>
    </section>
  </div>` };
}
export function starRow(v) {
  let h = `<button class="star zero tap${v === 0 ? ' on' : ''}" data-act="star" data-v="0" aria-label="0 Sterne">0</button>`;
  for (let i = 1; i <= 5; i++) h += `<button class="star tap${v != null && v >= i ? ' on' : ''}" data-act="star" data-v="${i}" aria-label="${i} Sterne">★</button>`;
  return h;
}
export function rateSheetHTML(k) {
  const p = S.plan[k]; if (!p) return '<p>Kein Plan für diesen Tag.</p>';
  const L = S.log[k] || {};
  return `<h2 class="sh-t">${relDay(k)}: Wie war’s?</h2>
  <p class="sh-sub">0–5 Sterne. Bekommt ein Gericht öfter unter 3, plant die App automatisch was anderes.</p>
  <label class="switch-row tap"><span>${ico('pot')}Gekocht</span><input type="checkbox" data-act="cooked-cb" data-k="${k}"${L.cooked ? ' checked' : ''}><i class="sw"></i></label>
  ${['a', 'm', 'f', 's'].map(sl => { const d = DISHES[p[sl]]; if (!d) return ''; const eaten = L.eaten && L.eaten[sl]; return `
  <div class="rate-item">${plate(p[sl], eaten ? 1 : 0, 'sm')}
    <div class="ri-b"><small>${slotLabel[sl]}${sl === 'm' && p.mBox ? ' · Box' : ''}</small><b>${esc(d.name)}</b>
      <div class="stars-row" data-id="${p[sl]}" data-k="${k}" data-slot="${sl}">${starRow(E.ratingOf(p[sl], k, sl))}</div></div>
    <button class="ml-add tap${eaten ? ' on' : ''}" data-act="eat" data-k="${k}" data-slot="${sl}" aria-label="gegessen">${ico('check')}</button>
  </div>`; }).join('')}
  <button class="btn wide tap" data-close>Fertig</button>`;
}

/* =========================================================
   TRAINING – Laufen & Mini-Workouts
   ========================================================= */
function zoneBar(blocks) {
  const tot = blocks.reduce((s, b) => s + b.sec, 0);
  return `<div class="zbar">${blocks.map(b => `<i style="flex:${b.sec};--c:${SP.ZONES[b.z].c};--hh:${10 + b.z * 9}px" title="${esc(b.label)}"></i>`).join('')}</div><div class="zbar-l"><span>0′</span><span>${Math.round(tot / 120)}′</span><span>${Math.round(tot / 60)}′</span></div>`;
}

/* ---------- Läufe: Pace/Quelle ---------- */
const paceStr = p => { let m = Math.floor(p), sc = Math.round((p - m) * 60); if (sc === 60) { m++; sc = 0; } return m + ':' + String(sc).padStart(2, '0'); };
function actDetail(a) {
  if (!a || !a.done || a.type !== 'run') return '';
  const bits = [];
  if (a.pace) bits.push('Ø ' + paceStr(a.pace) + ' /km');
  if (a.hr) bits.push('♥ ' + a.hr);
  if (a.elev) bits.push('↗ ' + a.elev + ' m');
  const src = a.src === 'strava' ? '🧡 Von Strava' : a.src === 'file' ? '📄 Aus Datei' : '';
  const line = [src, ...bits].filter(Boolean).join(' · ');
  return line ? `<p class="src-line">${esc(line)}${a.name && a.src ? ' · ' + esc(a.name) : ''}</p>` : '';
}
function weekRow(k, t) {
  const a = SP.plannedActivity(k), x = !a && S.act[k] && S.act[k].done && S.act[k].type === 'run' ? S.act[k] : null, gym = !a && !x && E.isTrain(k), past = k < t;
  return `<button class="wr tap${k === t ? ' today' : ''}" ${a ? `data-go="${a.kind === 'run' ? '#/run/' + k : '#/workout/' + a.id + '?d=' + k}"` : ''}><span class="wr-d"><small>${DS[E.wd(k)]}</small><b>${E.dateOf(k).getDate()}</b></span>
    <span class="wr-t">${x ? `<b>Extra-Lauf${x.src === 'strava' ? ' 🧡' : ''}</b><small>${lit(x.km)} km · ${x.min} Min${x.pace ? ' · ' + paceStr(x.pace) + ' /km' : ''}</small>` : a ? (a.kind === 'run' ? `<b>${esc(a.session.name)}</b><small>${a.min} Min · Z${a.session.zone} · ≈ ${lit(a.session.km)} km</small>` : `<b>${SP.WORKOUTS[a.id].emoji} ${esc(SP.WORKOUTS[a.id].name)}</b><small>Mini-Workout statt Lauf · ${a.min} Min</small>`) : gym ? '<b>Krafttraining</b><small>dein Trainingstag</small>' : '<b class="mute">Ruhetag</b><small>Regeneration ist Training</small>'}</span>
    <span class="wr-s">${x ? '<i class="st ok">' + ico('check') + '</i>' : a ? (a.done ? '<i class="st ok">' + ico('check') + '</i>' : past ? '<i class="st miss">–</i>' : '<i class="st plan">' + ico(a.kind === 'run' ? 'run' : 'dumbbell') + '</i>') : ''}</span></button>`;
}
export function training() {
  if (V2.ui2.ttab === 'workouts') return { html: V2.workoutsTab() };
  if (V2.ui2.ttab === 'uebungen') return { html: V2.libraryTab() };
  if (V2.ui2.ttab === 'fortschritt') return { html: V2.progressTab() };
  const t = E.todayKey(), P = S.profile;
  const act = SP.plannedActivity(t);
  const mon = E.addDays(t, -E.wd(t));
  const ws = SP.weekStats(mon), st = SP.streak();
  let nextRun = null; for (let i = 1; i <= 7; i++) { const k = E.addDays(t, i); if (SP.isRunDay(k)) { nextRun = k; break; } }
  let today;
  if (act && act.kind === 'run') {
    const r = act.session, A = act.done ? SP.actOf(t) : null;
    today = `<article class="card run-card rise">
      <div class="rc-top"><span class="rc-emo">${r.emoji}</span><div><p class="kicker">Heute · ${P.runTime} · Woche ${r.week}</p><h2>${esc(r.name)}</h2></div>${act.done ? '<span class="badge ok">✓ erledigt</span>' : ''}</div>
      <div class="stats3"><span>${ico('clock')}<b>${A ? A.min : r.min} Min</b></span><span>${ico('run')}<b>${A && A.km ? lit(A.km) : '≈ ' + lit(r.km)} km</b></span><span>${ico('fire')}<b>${A ? '' : '≈ '}${A ? A.kcal : r.kcal} kcal</b></span></div>
      ${actDetail(A)}
      ${A && A.src ? `<p class="rc-desc">Geplant war „${esc(r.name)}“. Dein echter Lauf ist eingetragen – die Serie läuft weiter 🔥</p>` : `<button class="tap zwrap" data-go="#/run/${t}">${zoneBar(r.blocks)}</button>
      <p class="rc-desc">${esc(r.desc)}</p>`}
      ${act.done ? `<button class="btn ghost wide tap" data-act="act-undo" data-k="${t}">Rückgängig</button>` : `
      <div class="rc-btns"><button class="btn big tap" data-go="#/timer/run/${t}">${ico('play')}Lauf starten</button><button class="btn ghost tap" data-act="run-done" data-k="${t}">${ico('check')}Gelaufen</button></div>
      <button class="nope tap" data-act="no-run" data-k="${t}">😮‍💨 Keine Lust zu laufen? <b>Dann Mini-Workout</b></button>`}
    </article>`;
  } else if (act && act.kind === 'workout') {
    const w = SP.WORKOUTS[act.id];
    today = `<article class="card run-card wo rise" style="--h:${w.hue}">
      <div class="rc-top"><span class="rc-emo">${w.emoji}</span><div><p class="kicker">Heute statt Laufen</p><h2>${esc(w.name)}</h2></div>${act.done ? '<span class="badge ok">✓ erledigt</span>' : ''}</div>
      <div class="stats3"><span>${ico('clock')}<b>${act.min} Min</b></span><span>${ico('dumbbell')}<b>${w.ex.length} Übungen</b></span><span>${ico('fire')}<b>≈ ${act.kcal} kcal</b></span></div>
      <p class="rc-desc">${esc(w.desc)} Kein Laufen heißt nicht nix tun – ${act.min} Minuten, ohne Geräte, der Timer sagt dir alles an.</p>
      ${act.done ? `<button class="btn ghost wide tap" data-act="act-undo" data-k="${t}">Rückgängig</button>` : `
      <div class="rc-btns"><button class="btn big tap" data-go="#/timer/workout/${act.id}?d=${t}">${ico('play')}Workout starten</button><button class="btn ghost tap" data-go="#/workout/${act.id}?d=${t}">${ico('book')}Übungen</button></div>
      <button class="nope tap" data-act="act-undo" data-k="${t}">Doch lieber laufen? <b>Zurück zum Lauf</b></button>`}
    </article>`;
  } else if (S.act[t] && S.act[t].done && S.act[t].type === 'run') {
    const A = S.act[t];
    today = `<article class="card run-card rise">
      <div class="rc-top"><span class="rc-emo">🏃</span><div><p class="kicker">Heute · zusätzlich</p><h2>Extra-Lauf</h2></div><span class="badge ok">✓ erledigt</span></div>
      <div class="stats3"><span>${ico('clock')}<b>${A.min} Min</b></span><span>${ico('run')}<b>${lit(A.km)} km</b></span><span>${ico('fire')}<b>${A.kcal} kcal</b></span></div>
      ${actDetail(A)}
      <p class="rc-desc">Heute war eigentlich kein Lauf geplant – umso besser. Die Kalorien zählen zu deinem Tagesziel dazu.</p>
      <button class="btn ghost wide tap" data-act="act-undo" data-k="${t}">Rückgängig</button></article>`;
  } else {
    const nr = nextRun ? SP.runSession(nextRun) : null;
    today = `<article class="card run-card rest rise"><div class="rc-top"><span class="rc-emo">${E.isTrain(t) ? '🏋️' : '🧘'}</span><div><p class="kicker">Heute</p><h2>${E.isTrain(t) ? 'Krafttraining-Tag' : 'Kein Lauf geplant'}</h2></div></div>
      <p class="rc-desc">${nr ? 'Nächster Lauf: ' + relDay(nextRun) + ' um ' + P.runTime + ' – ' + esc(nr.name) + ' (' + nr.min + ' Min).' : 'Stell unten deine Lauftage ein.'} Lust auf mehr? Ein Mini-Workout geht immer.</p>
      <button class="btn ghost wide tap" data-go="#/workout/${SP.workoutFor(t)}?d=${t}">${ico('dumbbell')}Freiwilliges Mini-Workout</button></article>`;
  }
  const rows = []; for (let i = 0; i < 7; i++) rows.push(weekRow(E.addDays(mon, i), t));
  return { html: `
  <div class="page">
    <div class="mesh m3" aria-hidden="true"></div>
    <header class="top rise"><div><p class="kicker">Kraft · Laufen · Workouts</p><h1 class="h1">Training</h1></div><button class="iconbtn tap" data-go="#/plaene" aria-label="Plan & Level">${ico('edit')}</button></header>
    <div class="tstats rise">
      <button class="ts tap" data-go="#/info/laufen"><span>🔥</span><b>${st}</b><small>Serie</small></button>
      <button class="ts tap" data-go="#/info/laufen"><span>🏃</span><b>${ws.done}/${ws.planned}</b><small>Woche</small></button>
      <button class="ts tap" data-go="#/info/laufen"><span>📍</span><b>${lit(ws.km)}</b><small>km</small></button>
      <button class="ts tap" data-go="#/info/verbrannt"><span>⚡</span><b>${fmtInt(ws.kcal)}</b><small>kcal</small></button>
    </div>
    ${V2.tabs('heute')}
    ${V2.todayStrength()}
    ${today}
    <h2 class="sec rise">Diese Woche</h2>
    <article class="card wrows rise">${rows.join('')}</article>
    <h2 class="sec rise">Mini-Workouts <small>· ohne Geräte</small></h2>
    <div class="wo-grid rise">${Object.entries(SP.WORKOUTS).map(([id, w]) => `<button class="wo-card tap" style="--h:${w.hue}" data-go="#/workout/${id}"><span class="wo-e">${w.emoji}</span><b>${esc(w.name)}</b><small>${SP.workoutMinutes(id)} Min · ${w.focus}</small></button>`).join('')}</div>
    <div class="list rise">
      <button class="list-row tap" data-go="#/profile"><span class="lr-ico">${ico('week')}</span><span><b>Lauftage & Niveau</b><small>${(P.run || []).map(i => DS[i]).join(', ') || 'keine'} · ${P.runTime} · ${SP.LEVELS[P.runLevel || 'einsteiger'].name}</small></span>${ico('chev')}</button>
      <button class="list-row tap" data-go="#/strava"><span class="lr-ico st-ico">${ico('run')}</span><span><b>Strava</b><small>${Strava.connected() ? 'Verbunden · Läufe nach dem Laufen einlesen' : 'Läufe von Strava oder aus einer Datei einlesen'}</small></span>${ico('chev')}</button>
      <button class="list-row tap" data-go="#/info/zonen"><span class="lr-ico">${ico('heart')}</span><span><b>Pulszonen erklärt</b><small>Wie schnell ist „locker“?</small></span>${ico('chev')}</button>
    </div>
  </div>` };
}

export function runDetail(k) {
  if (!SP.isRunDay(k)) return { html: `<div class="page detail">${dhead('Lauf')}<p class="empty">An diesem Tag ist kein Lauf geplant.</p></div>` };
  const r = SP.runSession(k), a = SP.actOf(k), done = a && a.done && a.type === 'run';
  const list = []; let tsum = 0;
  r.blocks.forEach(b => { list.push(`<li><span class="bl-t">${Math.floor(tsum / 60)}′</span><i style="--c:${SP.ZONES[b.z].c}"></i><span class="bl-l"><b>${esc(b.label)}</b><small>${b.sec >= 60 ? lit(Math.round(b.sec / 6) / 10) + ' Min' : b.sec + ' s'} · ${SP.ZONES[b.z].name}</small></span></li>`); tsum += b.sec; });
  const wid = SP.workoutFor(k);
  return { html: `
  <div class="page detail">
    ${dhead('Lauf', relDay(k) + ', ' + dLabel(k))}
    <section class="info-hero rise" style="--h:25"><span class="ih-emo float">${r.emoji}</span><h1>${esc(r.name)}</h1><p>${SP.LEVELS[r.level].name} · Woche ${r.week} · ${S.profile.runTime}</p></section>
    <div class="stats3 lg rise"><span>${ico('clock')}<b>${r.min} Min</b></span><span>${ico('run')}<b>≈ ${lit(r.km)} km</b></span><span>${ico('fire')}<b>≈ ${r.kcal} kcal</b></span></div>
    <article class="card rise"><h3 class="c-h">Ablauf</h3>${zoneBar(r.blocks)}<p class="lede">${esc(r.desc)}</p><ol class="blocks">${list.join('')}</ol></article>
    <article class="card rise"><h3 class="c-h">${ico('heart', 'xs')} So fühlt sich das an</h3><ul class="facts">${[...new Set(r.blocks.map(b => b.z))].sort().map(z => `<li><b style="color:${SP.ZONES[z].c}">${SP.ZONES[z].name}:</b> ${SP.ZONES[z].txt}</li>`).join('')}</ul></article>
    <article class="card rise"><h3 class="c-h">Tipps</h3><ul class="facts"><li>0,3–0,5 L Wasser 1–2 h vorher, danach nachtrinken.</li><li>Nicht mit vollem Bauch – 2 h nach dem Essen ist ideal, sonst eine Banane vorher.</li><li>Lieber zu langsam als zu schnell: Wenn du nicht mehr reden kannst, Tempo raus.</li><li>Seitenstechen? Gehen, tief ausatmen, dann weiter.</li><li>Danach: Mahlzeit mit Eiweiß innerhalb von 2 h.</li></ul></article>
    ${done ? `<article class="card ok-card rise">${ico('check')}<div><b>Erledigt</b><p>${a.km ? lit(a.km) + ' km · ' : ''}${a.min} Min · ${a.kcal} kcal</p>${actDetail(a)}<button class="btn sm ghost tap" data-act="act-undo" data-k="${k}">Rückgängig</button></div></article>` : `
    <div class="rc-btns rise"><button class="btn big tap" data-go="#/timer/run/${k}">${ico('play')}Lauf starten</button><button class="btn ghost tap" data-act="run-done" data-k="${k}">${ico('check')}Gelaufen</button></div>
    <button class="nope tap rise" data-act="no-run" data-k="${k}">😮‍💨 Keine Lust? <b>Dann ${esc(SP.WORKOUTS[wid].name)} (${SP.workoutMinutes(wid)} Min)</b></button>`}
  </div>` };
}

export function workoutDetail(id, q) {
  const w = SP.WORKOUTS[id]; if (!w) return notFound();
  const k = q.d || null;
  const a = k ? SP.actOf(k) : null, done = a && a.done && a.type === 'workout' && a.workout === id;
  return { html: `
  <div class="page detail">
    ${dhead('Mini-Workout', k ? relDay(k) : 'ohne Geräte')}
    <section class="info-hero rise" style="--h:${w.hue}"><span class="ih-emo float">${w.emoji}</span><h1>${esc(w.name)}</h1><p>${esc(w.desc)}</p></section>
    <div class="stats3 lg rise"><span>${ico('clock')}<b>${SP.workoutMinutes(id)} Min</b></span><span>${ico('dumbbell')}<b>${w.rounds} Runden</b></span><span>${ico('fire')}<b>≈ ${SP.workoutKcal(id)} kcal</b></span></div>
    <article class="card rise"><h3 class="c-h">So geht’s</h3><p class="lede">${w.rounds} Runden mit je ${w.ex.length} Übungen: <b>${w.work} s Übung</b>, <b>${w.rest} s Pause</b>. Der Timer sagt dir alles an – Handy hinlegen, mitmachen. Tippe auf eine Übung für die Anleitung.</p></article>
    <div class="ex-list">${w.ex.map((e, i) => { const x = SP.EX[e]; return `
      <details class="card ex rise"><summary class="tap"><span class="ex-n">${i + 1}</span><span class="ex-e">${x.emoji}</span><span class="ex-t"><b>${esc(x.name)}</b><small>${w.work} s · tippen für Anleitung</small></span>${ico('chev', 'ex-c')}</summary>
        <ol class="steps sm">${x.how.map((s, j) => `<li><span class="st-n">${j + 1}</span><span>${esc(s)}</span></li>`).join('')}</ol>
        <p class="tip">🪶 <b>Leichter:</b> ${esc(x.easy)}</p></details>`; }).join('')}</div>
    ${done ? `<article class="card ok-card rise">${ico('check')}<div><b>Erledigt</b><p>${a.min} Min · ${a.kcal} kcal</p></div></article>` : `
    <div class="sticky-save"><button class="btn big tap" data-go="#/timer/workout/${id}${k ? '?d=' + k : ''}">${ico('play')}Workout starten</button><button class="btn ghost tap" data-act="wo-done" data-id="${id}" data-k="${k || E.todayKey()}">${ico('check')}Erledigt</button></div>`}
  </div>` };
}

/* Timer-Bildschirm (Lauf oder Workout) – der Inhalt wird live von main.js aktualisiert */
export function timerScreen() {
  const T = ui.timer;
  if (!T) return { html: `<div class="page detail">${dhead('Timer')}<p class="empty">Kein Training aktiv.</p></div>` };
  return { html: `
  <div class="page timer" style="--h:${T.hue}">
    <div class="tm-bg"></div>
    <header class="tm-top"><button class="iconbtn glass-btn tap" data-act="timer-stop" aria-label="Beenden">${ico('close')}</button><div><small>${esc(T.title)}</small><b id="tm-step">1 / ${T.seq.length}</b></div><span class="tm-total" id="tm-total">0:00</span></header>
    <div class="tm-prog"><i id="tm-prog"></i></div>
    <div class="tm-main">
      <div class="tm-ring">${ring(0, 260, 16, 'tm-r')}<div class="tm-c"><span class="tm-e" id="tm-e">${T.emoji}</span><b id="tm-sec">0:00</b><small id="tm-phase">Bereit</small></div></div>
      <h2 id="tm-label">…</h2>
      <ol id="tm-how" class="tm-how"></ol>
    </div>
    <div class="tm-next" id="tm-next"></div>
    <div class="tm-ctrl"><button class="iconbtn big glass-btn tap" data-act="timer-prev" aria-label="Zurück">${ico('prev')}</button><button class="play-btn tap" data-act="timer-toggle" aria-label="Pause"><span id="tm-pp">${ico('pause')}</span></button><button class="iconbtn big glass-btn tap" data-act="timer-skip" aria-label="Weiter">${ico('next')}</button></div>
  </div>`, cls: 'timer-screen', mount: () => window.dispatchEvent(new Event('timer-mount')) };
}

/* =========================================================
   INFO-SEITEN
   ========================================================= */
export function info(topic) {
  const T = E.targets(), P = S.profile, t = E.todayKey(), k = ui.day || t;
  const tot = E.dayTotals(k), p = S.plan[k];
  const G = (title, emoji, hue, body) => ({ html: `<div class="page detail">${dhead('Erklärt')}<section class="info-hero rise" style="--h:${hue}"><span class="ih-emo float">${emoji}</span><h1>${title}</h1></section>${body}</div>` });
  const mealsBars = (field, unit, target) => p ? `<article class="card rise"><h3 class="c-h">${relDay(k)} – pro Mahlzeit</h3>${['f', 'm', 's', 'a'].map(sl => { const d = DISHES[p[sl]]; const v = field === 'eur' ? E.dishCost(p[sl]).portion : d[field]; const max = field === 'eur' ? 2.5 : field === 'kcal' ? 1100 : 50; return `<button class="bar-row tap" data-go="#/dish/${p[sl]}?d=${k}&s=${sl}"><span class="br-l">${d.emoji} ${slotLabel[sl]}</span><span class="br-t"><i data-w="${pct(v, max)}"></i></span><b>${field === 'eur' ? eur(v) : fmtInt(v) + unit}</b></button>`; }).join('')}
      <div class="cost-sum"><span>Summe</span><b>${field === 'eur' ? eur(tot.eur) : fmtInt(tot[field]) + unit}${target ? ' / ' + fmtInt(target) + unit : ''}</b></div></article>` : '';
  switch (topic) {
    case 'kcal': {
      const diff = T.kcal + SP.burned(k) - tot.kcal;
      return G('Kalorien', '🔥', 18, `
      <article class="card rise"><p class="lede">Die Anzeige auf „Heute“ zeigt: <b>Gegessen</b> (abgehakte Mahlzeiten), <b>Übrig</b> (Ziel + Verbranntes − Gegessenes) und <b>Verbrannt</b> (Lauf oder Workout).</p>
        <div class="big-num"><b data-count="${T.kcal}">0</b><span>kcal pro Tag – dein Ziel (ohne Laufen)</span></div></article>
      <article class="card rise"><h3 class="c-h">So wird gerechnet</h3>
        <div class="calc">
          <div><span>Grundumsatz</span><small>10 × ${P.weight} kg + 6,25 × ${P.height} cm − 5 × ${P.age || '25*'} J. ${P.sex === 'w' ? '− 161' : P.sex === 'm' ? '+ 5' : '− 78'}</small><b>${fmtInt(T.bmr)}</b></div>
          <div><span>× Aktivität</span><small>${(P.train || []).length} Krafttrainings-Tage pro Woche</small><b>× ${dec(T.pal, 2)}</b></div>
          <div><span>= Verbrauch</span><small>was du am Tag ungefähr verbrennst</small><b>${fmtInt(T.tdee)}</b></div>
          <div><span>${T.goal.add >= 0 ? '+' : '−'} Ziel: ${T.goal.name}</span><small>${esc(T.goal.desc)}</small><b>${T.goal.add >= 0 ? '+' : '−'} ${Math.abs(T.goal.add)}</b></div>
          <div class="calc-sum"><span>Dein Tagesziel</span><b>${fmtInt(T.kcal)} kcal</b></div>
          <div><span>+ Laufen / Workout</span><small>kommt an dem Tag dazu, an dem du es machst</small><b>+ ${SP.burned(k)}</b></div>
        </div>
        ${T.estimatedAge || T.estimatedSex ? `<p class="fine">* ${T.estimatedAge ? 'Alter' : ''}${T.estimatedAge && T.estimatedSex ? ' und ' : ''}${T.estimatedSex ? 'Geschlecht' : ''} geschätzt – <button class="link tap" data-go="#/profile">im Profil eintragen</button>.</p>` : ''}
      </article>
      ${mealsBars('kcal', ' kcal', T.kcal)}
      <article class="card rise"><h3 class="c-h">${diff > 150 ? 'Laut Plan fehlen ≈ ' + fmtInt(diff) + ' kcal' : diff < -250 ? 'Plan liegt über dem Ziel' : 'Plan passt'}</h3>
        <ul class="facts">${diff > 150 ? '<li>+ 1 großes Glas Milch (0,3 L) ≈ +190 kcal</li><li>+ 1 Banane ≈ +110 kcal</li><li>+ 1 EL Erdnussbutter ≈ +90 kcal</li><li>Abends etwas mehr Reis/Nudeln nehmen</li>' : '<li>Weiter so – genau so baust du langsam und sauber auf.</li>'}<li>In der Früh bewusst wenig – der Rest ist auf Mittag, Jause und Abend verteilt.</li></ul></article>`);
    }
    case 'zucker': {
      const eat = tot.eatenSugar || 0, extras = FA.extrasOf(k).slice().sort((a, b) => (b.sugar || 0) - (a.sugar || 0));
      const src = [];
      if (p) ['f', 'm', 's', 'a'].forEach(sl => { const d = DISHES[p[sl]]; const L = S.log[k] || {}; if (d && L.eaten && L.eaten[sl] && !(L.skip && L.skip[sl])) src.push([d.name, d.sugar || 0, d.emoji]); });
      extras.forEach(x => src.push([x.name, x.sugar || 0, x.e]));
      src.sort((a, b) => b[1] - a[1]);
      const sg = N.sugarInfo(eat);
      return G('Zucker', '🍬', 330, `
      <article class="card rise"><p class="lede">Hier siehst du, wie viel Zucker du <b>${relDay(k).toLowerCase()}</b> gegessen hast – von Obst und Milch (natürlich) bis Haribo und Cola (zugesetzt).</p>
        <div class="big-num"><b data-count="${eat}" data-suf=" g">0</b><span>≈ ${dec(eat / N.SUGAR_CUBE, 0)} Zuckerwürfel · Plan für den ganzen Tag: ${fmtInt(tot.sugar || 0)} g</span></div>
        <div class="mbar big"><i data-w="${pct(eat, 90)}"></i></div><p class="fine">Skala: 90 g = Referenzmenge für Gesamtzucker (EU). WHO: höchstens 50 g <b>freie</b> Zucker (zugesetzt, in Saft und Honig) – ideal unter 25 g.</p></article>
      ${src.length ? `<article class="card rise"><h3 class="c-h">Woher kommt der Zucker?</h3>${src.map(([n, v, e]) => `<div class="bar-row"><span class="br-l">${e || '🍽️'} ${esc(n).slice(0, 22)}</span><span class="br-t"><i data-w="${pct(v, Math.max(1, src[0][1]))}" style="--c:var(--fat)"></i></span><b>${dec(v, v < 10 ? 1 : 0)} g</b></div>`).join('')}</article>` : '<article class="card rise"><p class="fine">Noch nichts gegessen – hak Mahlzeiten ab oder fotografiere dein Essen.</p></article>'}
      <article class="card rise"><h3 class="c-h">Gut zu wissen</h3><ul class="facts"><li><b>1 Zuckerwürfel = 3 g.</b> Eine Dose Cola (330 ml) hat ≈ 35 g = 12 Würfel.</li><li><b>Natürlicher Zucker</b> in ganzen Früchten und Milch wirkt anders als freier Zucker – er kommt mit Ballaststoffen bzw. Eiweiß.</li><li><b>Ampel (je 100 g):</b> Zucker grün bis 5 g, gelb bis 22,5 g, rot darüber. Bei Getränken (je 100 ml) grün bis 2,5 g, rot ab 11,25 g.</li><li>Auf der Packung steht Zucker unter „Kohlenhydrate – davon Zucker“.</li></ul>
        <button class="btn tap" data-act="foodcam">${ico('camera')}Etwas fotografieren</button></article>`);
    }
    case 'makros':
      return G('Makros', '🥗', 140, `
      <article class="card rise"><p class="lede">Makronährstoffe sind die drei Energielieferanten: <b>Kohlenhydrate</b> (Treibstoff fürs Training und Laufen), <b>Eiweiß</b> (Baustoff für Muskeln) und <b>Fett</b> (Hormone, Vitamine).</p></article>
      <article class="card rise"><h3 class="c-h">Deine Ziele pro Tag</h3><div class="calc">
        <div class="m-kh"><span><i class="lg"></i>Kohlenhydrate</span><small>der Rest der Energie · 4 kcal/g</small><b>${T.kh} g</b></div>
        <div class="m-prot"><span><i class="lg"></i>Eiweiß</span><small>${dec(T.goal.protein, 1)} g × ${P.weight} kg · 4 kcal/g</small><b>${T.prot} g</b></div>
        <div class="m-fat"><span><i class="lg"></i>Fett</span><small>≈ 28 % der Kalorien · 9 kcal/g</small><b>${T.fat} g</b></div></div>
        <p class="fine">Die Balken auf „Heute“ füllen sich, wenn du Mahlzeiten abhakst. Der blasse Teil zeigt, was laut Plan heute insgesamt kommt.</p></article>
      ${mealsBars('prot', ' g', T.prot)}`);
    case 'eiweiss':
      return G('Eiweiß', '💪', 150, `
      <article class="card rise"><p class="lede">Eiweiß ist der Baustoff für deine Muskeln. Ohne genug Eiweiß bringt auch das beste Training wenig.</p>
        <div class="big-num"><b data-count="${T.prot}" data-suf=" g">0</b><span>pro Tag = ${dec(T.goal.protein, 1)} g × ${P.weight} kg</span></div></article>
      ${mealsBars('prot', ' g', T.prot)}
      <article class="card rise"><h3 class="c-h">Gute, billige Eiweiß-Quellen</h3><ul class="facts">
        <li><b>Magertopfen</b> – 250 g ≈ 30 g Eiweiß für ≈ 1 €</li><li><b>Eier</b> – 1 Ei ≈ 7,5 g</li><li><b>Rote Linsen</b> – 100 g trocken ≈ 25 g</li><li><b>Thunfisch natur</b> – 1 Dose ≈ 20 g</li><li><b>Milch</b> – 0,5 L ≈ 17 g</li><li><b>Hendl/Pute</b> – 100 g ≈ 23 g</li></ul></article>`);
    case 'verbrannt': {
      const ws = SP.weekStats(E.addDays(t, -E.wd(t)));
      return G('Verbrannt', '⚡', 30, `
      <article class="card rise"><p class="lede">„Verbrannt“ sind die Kalorien von deinem Lauf oder Mini-Workout. Die kommen an dem Tag zu deinem Ziel dazu – wer läuft, darf (und soll) mehr essen.</p>
        <div class="big-num"><b data-count="${ws.kcal}">0</b><span>kcal diese Woche durch Laufen & Workouts</span></div></article>
      <article class="card rise"><h3 class="c-h">So wird geschätzt</h3><ul class="facts"><li>MET-Wert × ${P.weight} kg × Dauer (lockeres Laufen ≈ 8,3 MET, Gehen ≈ 3,8 MET).</li><li>Läufe: Aufwärmen, Laufen, Gehpausen und Auslaufen getrennt gerechnet.</li><li>Workouts: Übungs- und Pausenzeiten getrennt.</li><li>Richtwerte – Uhren mit Puls messen genauer.</li></ul></article>`);
    }
    case 'laufen': {
      const L = SP.LEVELS[P.runLevel || 'einsteiger'];
      return G('Dein Laufplan', '🏃', 25, `
      <article class="card rise"><p class="lede">${(P.run || []).length}× pro Woche: ${(P.run || []).map(i => DAYS[i]).join(', ') || '–'} um ${P.runTime}. Niveau: <b>${L.name}</b> – ${esc(L.desc)}</p></article>
      <article class="card rise"><h3 class="c-h">Aufbau</h3><ul class="facts"><li><b>Lockerer Lauf</b> – Zone 2, Grundlage für alles.</li><li><b>Intervalle</b> – kurze zügige Stücke, machen schneller.</li><li><b>Langer Lauf</b> – ruhig, aber länger.</li><li>Als Einsteiger: 8 Wochen Laufen/Gehen im Wechsel, jede Woche mehr Laufen – danach 30 Min am Stück.</li></ul></article>
      <article class="card rise"><h3 class="c-h">Keine Lust?</h3><p class="lede">Kein Problem – aber nix tun gilt nicht 😉. Tippe auf „Keine Lust zu laufen“ und du bekommst ein Mini-Workout (10–13 Min, ohne Geräte) mit Timer und Anleitung. Die Serie bleibt erhalten.</p></article>
      <article class="card rise"><h3 class="c-h">Serie 🔥</h3><p class="lede">Jeder geplante Lauftag, an dem du läufst oder das Workout machst, zählt zur Serie. Aktuell: <b>${SP.streak()}</b>.</p></article>`);
    }
    case 'strava':
      return G('Strava', '🧡', 20, `
      <article class="card rise"><p class="lede">Die App holt deine Läufe aus Strava, <b>nachdem du gelaufen bist</b>: Strava-App oder Uhr aufzeichnen lassen, danach die App öffnen – der Lauf steht im Training, die verbrannten Kalorien zählen zum Tagesziel und die Serie läuft weiter.</p></article>
      <article class="card rise"><h3 class="c-h">So funktioniert’s</h3><ul class="facts"><li>Du legst <b>einmalig</b> bei Strava eine eigene kleine „API-Anwendung“ an (kostenlos, 3 Minuten) und trägst Client-ID und Secret in der App ein.</li><li>Die App fragt Strava nur nach <b>deinen eigenen Aktivitäten</b> (Lesezugriff). Sie ändert nichts bei Strava.</li><li>Übernommen werden Läufe, Trail- und virtuelle Läufe: Strecke, Zeit, Pace, Puls, Höhenmeter und Kalorien.</li><li>Gleiche Läufe werden nie doppelt gezählt. Mit „Rückgängig“ nimmst du einen Lauf wieder raus.</li></ul></article>
      <article class="card rise"><h3 class="c-h">Privat & sicher</h3><ul class="facts"><li>Schlüssel und Zugangs-Token bleiben nur auf diesem Handy und kommen nicht ins Backup.</li><li>Es gibt keinen Server dazwischen: Die App spricht direkt mit Strava.</li><li>Unter „Trennen“ löschst du die Verbindung. Bei Strava selbst kannst du den Zugriff unter Einstellungen → Meine Apps entziehen.</li></ul></article>
      <article class="card rise"><h3 class="c-h">Ohne Strava-Zugang</h3><p class="lede">Du kannst auch eine <b>GPX- oder TCX-Datei</b> einlesen (bei Strava im Browser: Aktivität → ⋯ → „GPX exportieren“). Die App rechnet Strecke, Zeit, Pace und Höhenmeter selbst aus.</p></article>
      <article class="card rise"><h3 class="c-h">Grenzen</h3><ul class="facts"><li>Strava erlaubt nur eine begrenzte Zahl von Abfragen (100 pro 15 Minuten) – für dich reicht das locker.</li><li>Kalorien kommen von Strava. Fehlen sie, schätzt die App ≈ 1 kcal je kg und km.</li><li>Die App holt Läufe nur, wenn du sie öffnest (oder mit „Jetzt Läufe holen“) – nicht im Hintergrund.</li></ul></article>`);
    case 'zonen':
      return G('Pulszonen', '❤️', 0, `
      <article class="card rise"><p class="lede">Ohne Pulsuhr hilft der <b>Sprechtest</b>: Wie gut kannst du beim Laufen noch reden?</p>
        <ul class="zlist">${Object.values(SP.ZONES).map(z => `<li><i style="--c:${z.c}"></i><b>${z.name}</b><span>${z.txt}</span></li>`).join('')}</ul></article>
      <article class="card rise"><h3 class="c-h">Warum so langsam?</h3><p class="lede">80 % deiner Läufe sollten in Zone 2 sein. Das trainiert Herz und Ausdauer, ohne dich kaputt zu machen – und du hast noch Kraft fürs Krafttraining.</p></article>`);
    case 'bmi': {
      const b = E.bmi(), pos = Math.max(0, Math.min(100, (b - 15) / 20 * 100));
      return G('BMI', '⚖️', 200, `
      <article class="card rise"><div class="big-num"><b data-count="${b}" data-dec="1">0</b><span>${E.bmiLabel(b)} · ${P.height} cm, ${P.weight} kg</span></div>
        <div class="bmi-scale"><i style="left:${pos}%"></i><span>15</span><span>18,5</span><span>25</span><span>30</span><span>35</span></div>
        <p class="lede">BMI = Gewicht ÷ (Größe in m)² = ${P.weight} ÷ ${dec(P.height / 100, 2)}² = ${dec(b, 1)}.</p></article>
      <article class="card rise"><h3 class="c-h">Was heißt das?</h3><ul class="facts">
        <li>Bei ${P.height} cm liegt Normalgewicht zwischen ${dec(18.5 * Math.pow(P.height / 100, 2), 0)} und ${dec(25 * Math.pow(P.height / 100, 2), 0)} kg.</li>
        <li>Der BMI kennt keine Muskeln – bei viel Training nur ein grober Richtwert.</li><li>1× pro Woche in der Früh wiegen, immer gleich.</li></ul>
        <button class="btn tap" data-go="#/weight">${ico('scale')}Gewicht eintragen</button></article>`);
    }
    case 'training':
      return G('Krafttraining', '🏋️', 210, `<article class="card rise"><p class="lede">An Krafttrainings-Tagen gibt’s den Masse-Shake als Jause, mehr Wasser und eiweißreiche Abendgerichte. Laufen plant die App separat an deinen Lauftagen.</p><button class="btn ghost tap" data-go="#/profile">${ico('edit')}Tage ändern</button></article>`);
    case 'box':
      return G('Einmal kochen, zweimal essen', '🍱', 160, `
      <article class="card rise"><p class="lede">Jeden Abend kochst du doppelt: Die Hälfte wird gleich gegessen, die andere Hälfte kommt in Boxen – das ist morgen dein Mittagessen.</p>
      <ul class="facts"><li>Spart Zeit: nur 1× pro Tag kochen.</li><li>Spart Geld: große Packungen, nix wird schlecht.</li><li><b>Wichtig:</b> Boxen innerhalb von 2 Stunden in den Kühlschrank. Mittags 2–3 Min Mikrowelle.</li><li>Nudeln und Sauce getrennt einpacken.</li></ul></article>`);
    case 'abwechslung': {
      const v = E.varietyScore(t);
      return G('Abwechslung', '🌈', 280, `
      <article class="card rise"><div class="big-num"><b data-count="${v.distinct}">0</b><span>verschiedene Gerichte in den nächsten 7 Tagen (von ${v.slots} Mahlzeiten)</span></div><div class="mbar big"><i data-w="${(v.pct * 100).toFixed(0)}%"></i></div></article>
      <article class="card rise"><h3 class="c-h">So sorgt die App für Abwechslung</h3><ul class="facts">
        <li>Ein Abendgericht kommt frühestens nach 8 Tagen wieder.</li><li>Nicht 2 Tage hintereinander dieselbe Beilage oder dasselbe Fleisch.</li><li>Neue Gerichte werden bevorzugt.</li><li>Gut bewertete kommen öfter, schlecht bewertete fliegen raus.</li><li>Was gerade in Aktion ist, kommt eher auf den Plan.</li></ul>
        <button class="btn ghost tap" data-act="shuffle">${ico('shuffle')}Ab morgen neu mischen</button></article>`);
    }
    case 'sterne':
      return G('Sterne & Austausch', '⭐', 45, `
      <article class="card rise"><p class="lede">Nach dem Essen fragt dich die App, wie es war: 0 bis 5 Sterne.</p><ul class="facts">
        <li><b>4–5 ★</b> – kommt öfter dran.</li><li><b>3 ★</b> – bleibt normal im Plan.</li><li><b>0–2 ★</b> – passiert das <b>2× oder öfter</b>, wird das Gericht automatisch aussortiert und ersetzt.</li><li>In „Meine Bewertungen“ kannst du es zurückholen.</li></ul>
        <button class="btn tap" data-go="#/ratings">${ico('star')}Meine Bewertungen</button></article>`);
    case 'fruehstueck':
      return G('Kleines Frühstück', '🌅', 38, `
      <article class="card rise"><p class="lede">In der Früh geht wenig rein – darum ist das Frühstück bewusst klein (≈ 230–440 kcal).</p><ul class="facts"><li><b>Trinken statt kauen:</b> Smoothie oder Kakao.</li><li><b>Warm statt kalt:</b> Porridge.</li><li><b>Kleine Schüssel</b> – wirkt weniger.</li><li><b>Aufteilen:</b> halb um 7, halb um 10.</li></ul></article>`);
    case 'zeit':
      return G('Zubereitungszeit', '⏱️', 190, `<article class="card rise"><p class="lede">Ungefähre Gesamtzeit inkl. Kochen. Aufwändige Gerichte (über 1 Stunde) plant die App nur am Wochenende ein.</p></article>`);
    case 'aktionen':
      return G('Preise & Aktionen lernen', '🏷️', 100, `
      <article class="card rise"><p class="lede">Jeder gescannte Kassenbon macht die App schlauer: Sie merkt sich, was wo wie viel kostet und wann etwas in Aktion ist.</p><ul class="facts"><li><b>Echte Kosten</b> für Gerichte und Einkaufsliste.</li><li><b>Markt-Vergleich</b> für deinen Wocheneinkauf.</li><li><b>Aktionen nutzen:</b> Gerichte mit Aktions-Zutaten kommen eher dran.</li><li><b>Aktions-Rhythmus:</b> wann etwas wieder billiger wird.</li></ul>
        <p class="fine">Alles bleibt auf deinem Handy – die Texterkennung läuft offline.</p><button class="btn tap" data-go="#/bon">${ico('scan')}Bon scannen</button></article>`);
    case 'kosten': {
      let sum = 0; for (let i = 0; i < 7; i++) sum += E.dayTotals(E.addDays(t, i)).eur;
      return G('Kosten', '💶', 48, `
      <article class="card rise"><p class="lede">Alle Preise <b>pro Person</b>, gerechnet mit dem ${S.profile.priceMode === 'cheapest' ? 'günstigsten Markt, den die App von deinen Bons kennt' : 'Stamm-Markt ' + storeName(S.profile.priceMode)} – sonst mit Schätzpreisen (≈).</p>
        <div class="big-num"><b data-count="${sum}" data-dec="2" data-suf=" €">0</b><span>pro Person für 7 Tage · alle ${S.profile.persons}: ${eur(sum * S.profile.persons)}</span></div></article>
      ${mealsBars('eur', '', 0)}`);
    }
    default: return notFound();
  }
}

/* =========================================================
   EINKAUF & KASSENBON
   ========================================================= */
const shopSeg = on => `<div class="seg wide top-seg rise"><button class="tap${on === 'liste' ? ' on' : ''}" data-go="#/einkauf">Einkaufsliste</button><button class="tap${on === 'bon' ? ' on' : ''}" data-go="#/bon">Bons & Preise</button></div>`;
export function einkauf() {
  E.ensurePlan();
  const t = E.todayKey();
  if (!ui.shopFrom || ui.shopFrom < t) ui.shopFrom = t;
  const from = ui.shopFrom;
  const L = E.shoppingList(from, 7);
  const checked = new Set(S.shop['w' + from] || []);
  const groups = CATS.map(c => ({ c, items: L.items.filter(i => ING[i.ing].cat === c) })).filter(g => g.items.length);
  const n = L.items.filter(i => checked.has(i.ing)).length;
  const maxC = L.compare.length ? Math.max(...L.compare.map(c => c.sum)) : 1;
  return { html: `
  <div class="page">
    <div class="mesh m4" aria-hidden="true"></div>
    <header class="top rise"><div><p class="kicker">${relDay(from)} + 6 Tage · ${S.profile.persons} Personen</p><h1 class="h1">Einkauf</h1></div><button class="iconbtn tap" data-go="#/bon" aria-label="Bon scannen">${ico('scan')}</button></header>
    ${essenTabs('einkauf')}
    ${shopSeg('liste')}
    <div class="seg wide rise"><button class="tap${from === t ? ' on' : ''}" data-act="shop-from" data-v="0">ab heute</button><button class="tap${from === E.addDays(t, 1) ? ' on' : ''}" data-act="shop-from" data-v="1">ab morgen</button></div>
    ${L.compare.length ? `<article class="card rise"><h3 class="c-h">${ico('store', 'xs')} Wo am günstigsten?</h3>${L.compare.map((c, i) => `<button class="bar-row tap" data-go="#/store/${c.store}"><span class="br-l">${storeDot(c.store)}${storeName(c.store)}${i === 0 ? ' 🏆' : ''}</span><span class="br-t"><i data-w="${pct(c.sum, maxC)}" style="--c:${(STORES[c.store] || STORES.sonst).color}"></i></span><b>${eur(c.sum)}</b></button>`).join('')}<p class="fine">Mit deinen Bon-Preisen; fehlende Artikel geschätzt.</p></article>`
      : `<button class="card hint-card rise tap" data-go="#/bon"><span class="hint-ico">${ico('scan')}</span><span><b>Preise noch geschätzt</b><small>Scanne nach dem Einkauf den Bon – dann siehst du, welcher Markt am günstigsten ist.</small></span>${ico('chev')}</button>`}
    <div class="card shop-prog rise"><span>${n === L.items.length ? 'Alles im Wagerl! 🎉' : n + ' / ' + L.items.length + ' im Wagerl'}</span><div class="mbar big"><i data-w="${pct(n, L.items.length)}"></i></div></div>
    ${groups.map(g => `<article class="card shop-g rise"><h3 class="c-h">${g.c}</h3>${g.items.map(it => { const G = ING[it.ing]; const on = checked.has(it.ing); return `
      <div class="si${on ? ' done' : ''}"><button class="si-cb tap${on ? ' on' : ''}" data-act="shop-check" data-id="${it.ing}" aria-label="abhaken">${ico('check')}</button><span class="si-e">${G.e || '•'}</span>
      <button class="si-t tap" data-go="#/ing/${it.ing}"><b>${esc(G.name)}${it.price.promo ? ' <span class="flag flag-promo">Aktion</span>' : ''}</b><small>${it.loose ? '≈ ' + lit(it.loose) + ' kg lose' : it.packs + ' × ' + packTxt(G)}${G.pantry ? ' · Vorrat?' : ''}${it.price.src === 'bon' ? ' · ' + storeName(it.price.store) : ''}</small></button>
      <span class="si-p">${it.price.src === 'bon' ? '✓' : '≈'} ${dec(it.cost)}</span></div>`; }).join('')}</article>`).join('')}
    <article class="card total-card rise"><div class="tc-row"><span>Summe</span><b>${eur(L.total)}</b></div><div class="tc-row sm"><span>Verbrauch diese Woche</span><span>${eur(L.use)}</span></div><div class="tc-row"><span>= pro Person</span><b class="ok">${eur(L.use / S.profile.persons)}</b></div><p class="fine">✓ Preis von deinem Bon · ≈ geschätzt. Vorrat (Öl, Mehl …) nur kaufen, wenn aus.</p></article>
    <button class="btn ghost wide tap rise" data-act="shop-reset">Häkchen zurücksetzen</button>
  </div>` };
}

export function bon() {
  const L = E.learned();
  const nPrices = Object.values(L.info).reduce((s, per) => s + Object.keys(per).length, 0);
  const nPromo = S.receipts.reduce((s, r) => s + r.items.filter(i => i.promo || i.disc > 0).length, 0);
  const stores = {};
  S.receipts.forEach(r => { const s = (stores[r.store] = stores[r.store] || { n: 0, sum: 0, last: r.date }); s.n++; s.sum += r.total || r.items.reduce((a, i) => a + i.price - (i.disc || 0), 0); if (r.date > s.last) s.last = r.date; });
  const promos = topPromos(6);
  const recent = [...S.receipts].sort((a, b) => b.date < a.date ? -1 : b.date > a.date ? 1 : b.id < a.id ? -1 : 1).slice(0, 8);
  return { html: `
  <div class="page">
    <div class="mesh m4" aria-hidden="true"></div>
    <header class="top rise"><div><p class="kicker">Preise lernen</p><h1 class="h1">Einkauf</h1></div></header>
    ${essenTabs('bon')}
    ${shopSeg('bon')}
    <article class="card scan-hero rise">
      <div class="paper-anim" aria-hidden="true"><div class="paper"><i></i><i></i><i></i><i class="s"></i><i></i><i class="s"></i><i></i></div><div class="beam"></div></div>
      <h2>Nach jedem Einkauf: Bon scannen</h2>
      <p>Die App liest Artikel, Preise und Aktionen – und gewöhnt sich an die Preise deines Supermarkts.</p>
      ${isNative ? `<div class="scan-btns"><button class="btn big tap" data-act="scan" data-src="camera">${ico('camera')}Foto machen</button><button class="btn ghost big tap" data-act="scan" data-src="gallery">${ico('image')}Galerie</button></div>
      <p class="fine">Tipp: Bon flach hinlegen, gutes Licht, ganzer Bon im Bild.</p>` :
      `<textarea id="bon-text" class="ta" rows="5" placeholder="Bon-Text hier einfügen (im Browser ohne Kamera-Texterkennung)"></textarea>
      <div class="scan-btns"><button class="btn tap" data-act="scan-text">${ico('scan')}Text auswerten</button><button class="btn ghost tap" data-act="scan-demo">Beispiel-Bon</button></div>`}
    </article>
    <div class="tiles4">
      <button class="tile tap rise" data-go="#/info/aktionen">${ico('scan')}<b data-count="${S.receipts.length}">0</b><small>Bons</small></button>
      <button class="tile tap rise" data-go="#/info/aktionen">${ico('tag')}<b data-count="${nPrices}">0</b><small>Preise gelernt</small></button>
      <button class="tile tap rise" data-go="#/promos">${ico('spark')}<b data-count="${nPromo}">0</b><small>Aktionen erkannt</small></button>
      <button class="tile tap rise" data-go="#/info/kosten">${ico('store')}<b data-count="${Object.keys(stores).length}">0</b><small>Märkte</small></button>
    </div>
    ${Object.keys(stores).length ? `<h2 class="sec rise">Deine Märkte</h2><div class="hscroll rise">${Object.entries(stores).map(([id, s]) => `<button class="store-card tap" data-go="#/store/${id}" style="--c:${(STORES[id] || STORES.sonst).color}"><b>${storeName(id)}</b><small>${s.n} Bon${s.n > 1 ? 's' : ''} · Ø ${eur(s.sum / s.n)}</small><small>zuletzt ${dShort(s.last)}</small></button>`).join('')}</div>` : ''}
    ${promos.length ? `<h2 class="sec rise">Gerade in Aktion</h2><article class="card rise">${promos.map(pr => `<button class="promo-row tap" data-go="#/ing/${pr.ing}"><span class="pr-e">${ING[pr.ing].e}</span><span><b>${esc(ING[pr.ing].name)}</b><small>${storeDot(pr.store)}${storeName(pr.store)} · ${dShort(pr.d)}</small></span><em>${pr.pct ? '−' + pr.pct + ' %' : eur(pr.price)}</em></button>`).join('')}</article>` : ''}
    <h2 class="sec rise">Letzte Bons</h2>
    ${recent.length ? recent.map(r => `<button class="card rc-row tap rise" data-go="#/receipt/${r.id}">${storeDot(r.store)}<span><b>${storeName(r.store)}</b><small>${dLabel(r.date)} · ${r.items.length} Artikel${r.items.some(i => i.promo) ? ' · ' + r.items.filter(i => i.promo).length + ' Aktionen' : ''}</small></span><em>${eur(r.total || r.items.reduce((a, i) => a + i.price - (i.disc || 0), 0))}</em>${ico('chev')}</button>`).join('') : '<p class="empty rise">Noch keine Bons. Der erste Scan dauert nur ein paar Sekunden.</p>'}
  </div>` };
}

export function review() {
  const R = ui.review;
  if (!R) return { html: `<div class="page detail">${dhead('Bon prüfen')}<p class="empty">Kein Bon geladen.</p></div>` };
  if (R.state === 'scan') return { html: `<div class="page detail">${dhead('Bon wird gelesen …')}
    <div class="scan-view rise">${R.img ? `<img src="${R.img}" alt="Kassenbon">` : '<div class="paper big"><i></i><i></i><i></i><i></i><i></i><i></i></div>'}<div class="beam"></div></div>
    <p class="scan-msg rise"><span class="dots"><i></i><i></i><i></i></span> Texterkennung läuft – offline auf deinem Handy</p></div>` };
  if (R.state === 'error') return { html: `<div class="page detail">${dhead('Bon prüfen')}<article class="card warn rise">${ico('info')}<div><b>Das hat nicht geklappt</b><p>${esc(R.error)}</p><button class="btn tap" data-act="back">Nochmal versuchen</button></div></article></div>` };
  const sum = R.items.reduce((s, i) => s + (+i.price || 0) - (+i.disc || 0), 0) - (R.extraDisc || 0);
  const ok = R.total != null && Math.abs(sum - R.total) < 0.05;
  const opts = '<option value="">— nicht im Plan —</option>' + CATS.map(c => '<optgroup label="' + c + '">' + Object.entries(ING).filter(([, g]) => g.cat === c).map(([id, g]) => '<option value="' + id + '">' + esc(g.name) + '</option>').join('') + '</optgroup>').join('');
  return { html: `
  <div class="page detail">
    ${dhead('Bon prüfen', R.items.length + ' Artikel erkannt')}
    ${R.img ? `<img class="rv-img rise" src="${R.img}" alt="Kassenbon">` : ''}
    <article class="card rise">
      <h3 class="c-h">${ico('store', 'xs')} Markt</h3>
      <div class="chips">${Object.entries(STORES).map(([id, s]) => `<button class="chip tap${R.store === id ? ' on' : ''}" data-act="rv-store" data-v="${id}">${storeDot(id)}${s.name}</button>`).join('')}</div>
      <label class="field"><span>Datum</span><input type="date" id="rv-date" value="${R.date || E.todayKey()}"></label>
      <div class="sumcheck ${R.total == null ? '' : ok ? 'ok' : 'bad'}">${R.total == null ? 'Summe am Bon nicht gefunden' : ok ? ico('check') + 'Summe stimmt: ' + eur(R.total) + (R.extraDisc ? ' (inkl. Bon-Rabatt −' + dec(R.extraDisc) + ')' : '') : 'Erkannt ' + eur(sum) + ' · laut Bon ' + eur(R.total) + ' – bitte kurz prüfen'}</div>
    </article>
    <p class="fine rise">Prüf kurz die Zuordnung. Grün = Zutat erkannt. Aktion an/aus mit dem Etikett.</p>
    <div id="rv-items">${R.items.map((it, i) => `
      <div class="rv-item rise${it.ing ? ' matched' : ''}" data-i="${i}">
        <div class="rv-top"><input class="rv-name" data-f="name" value="${esc(it.name)}" aria-label="Artikel"><input class="rv-price" data-f="price" inputmode="decimal" value="${dec(it.price)}" aria-label="Preis"><button class="iconbtn sm tap" data-act="rv-del" aria-label="Löschen">${ico('trash')}</button></div>
        <div class="rv-bot"><select data-f="ing" aria-label="Zutat">${opts.replace('value="' + (it.ing || '') + '"', 'value="' + (it.ing || '') + '" selected')}</select>
          <button class="promo-tg tap${it.promo ? ' on' : ''}" data-act="rv-promo">${ico('tag')}${it.promo ? (it.disc ? '−' + dec(it.disc) : 'Aktion') + (it.pct ? ' (' + it.pct + ' %)' : '') : 'Aktion?'}</button>
          ${it.qty > 1 ? '<span class="chip-s">' + it.qty + ' Stk</span>' : ''}${it.kg ? '<span class="chip-s">' + lit(it.kg) + ' kg</span>' : ''}</div>
      </div>`).join('')}</div>
    <button class="btn ghost wide tap rise" data-act="rv-add">${ico('plus')}Zeile hinzufügen</button>
    <div class="sticky-save"><button class="btn ghost tap" data-act="back">Abbrechen</button><button class="btn tap" data-act="rv-save">${ico('check')}Speichern & lernen</button></div>
  </div>` };
}

export function receipt(id) {
  const r = S.receipts.find(x => x.id === id); if (!r) return notFound();
  const sum = r.items.reduce((a, i) => a + i.price - (i.disc || 0), 0);
  return { html: `
  <div class="page detail">
    ${dhead(storeName(r.store), dLabel(r.date))}
    <div class="receipt rise">
      <div class="rc-head"><span>${storeName(r.store).toUpperCase()}</span><span>${r.date.split('-').reverse().join('.')}</span></div>
      ${r.items.map(i => `<button class="rc-item tap" ${i.ing ? 'data-go="#/ing/' + i.ing + '"' : ''}><span class="rc-txt"><span class="rc-name">${esc(i.name)}</span><span class="rc-pack">${i.ing ? '→ ' + esc(ING[i.ing].name) : 'nicht im Plan'}${i.qty > 1 ? ' · ' + i.qty + ' Stk' : ''}${i.kg ? ' · ' + lit(i.kg) + ' kg' : ''}</span></span><span class="rc-price">${dec(i.price)}</span></button>${i.disc ? `<div class="rc-disc"><span>${i.pct ? 'Aktion −' + i.pct + ' %' : 'Rabatt'}</span><span>−${dec(i.disc)}</span></div>` : ''}`).join('')}
      <div class="rc-total"><span>SUMME</span><span>${dec(r.total || sum)}</span></div>
      <div class="rc-foot">gescannt mit You By What You Eat</div>
    </div>
    <button class="btn ghost wide tap rise" data-act="rc-del" data-id="${r.id}">${ico('trash')}Bon löschen</button>
  </div>` };
}

export function store(id) {
  const st = STORES[id] || STORES.sonst;
  const rs = S.receipts.filter(r => r.store === id);
  const L = E.learned();
  const rows = Object.entries(L.info).filter(([, per]) => per[id]).map(([ing, per]) => {
    const x = per[id];
    const others = Object.entries(per).filter(([s]) => s !== id && per[s].regular != null);
    return { ing, x, cheapest: others.length > 0 && others.every(([, o]) => x.regular <= o.regular + 0.005) };
  }).sort((a, b) => ING[a.ing].name.localeCompare(ING[b.ing].name));
  const other = Object.entries(L.other[id] || {}).slice(0, 30);
  const spent = rs.reduce((s, r) => s + (r.total || r.items.reduce((a, i) => a + i.price - (i.disc || 0), 0)), 0);
  return { html: `
  <div class="page detail">
    ${dhead(st.name, rs.length + ' Bons')}
    <section class="store-hero rise" style="--c:${st.color}"><b>${st.name}</b><span>${eur(spent)} insgesamt · Ø ${eur(rs.length ? spent / rs.length : 0)} pro Einkauf</span></section>
    ${rows.filter(r => r.cheapest).length ? `<article class="card rise"><h3 class="c-h">${ico('spark', 'xs')} Hier am günstigsten</h3><div class="chips">${rows.filter(r => r.cheapest).map(r => `<button class="chip tap" data-go="#/ing/${r.ing}">${ING[r.ing].e} ${esc(ING[r.ing].name)}</button>`).join('')}</div></article>` : ''}
    <article class="card rise"><h3 class="c-h">${ico('tag', 'xs')} Gelernte Preise</h3>
      ${rows.length ? rows.map(r => `<button class="price-row tap" data-go="#/ing/${r.ing}"><span class="pr-e">${ING[r.ing].e}</span><span><b>${esc(ING[r.ing].name)}</b><small>${r.x.n}× gekauft${r.x.promoN ? ' · ' + r.x.promoN + '× Aktion' : ''}${r.x.rhythm ? ' · Aktion ca. alle ' + r.x.rhythm.every + ' Tage' : ''}</small></span><em>${r.x.promoNow ? '<span class="flag flag-promo">Aktion</span>' : ''}${eur(r.x.regular ?? r.x.eff)}</em></button>`).join('') : '<p class="fine">Noch keine Zutaten erkannt.</p>'}</article>
    ${other.length ? `<article class="card rise"><h3 class="c-h">Weitere Artikel</h3>${other.map(([n, l]) => `<div class="price-row"><span><b>${esc(n)}</b><small>${l.length}× gekauft${l.some(x => x.promo) ? ' · auch in Aktion' : ''}</small></span><em>${eur(l[l.length - 1].price)}</em></div>`).join('')}</article>` : ''}
  </div>` };
}

export function ingredient(id) {
  const g = ING[id]; if (!g) return notFound();
  const per = E.learned().info[id] || {};
  const p = E.price(id);
  const vals = Object.values(per).map(x => x.regular).filter(x => x != null);
  const max = Math.max(g.base, ...vals) * 1.15;
  const hist = Object.entries(per).flatMap(([s, x]) => x.obs.map(o => ({ ...o, s }))).sort((a, b) => b.d < a.d ? -1 : 1).slice(0, 12);
  const used = Object.entries(DISHES).filter(([, d]) => d.need[id]);
  return { html: `
  <div class="page detail">
    ${dhead(esc(g.name), g.cat)}
    <section class="info-hero rise" style="--h:120"><span class="ih-emo float">${g.e || '🛒'}</span><h1>${eur(p.price)}</h1><p>je ${packTxt(g)} · ${p.src === 'bon' ? 'günstigster bekannter Preis: ' + storeName(p.store) + (p.promo ? ' (Aktion)' : '') : 'geschätzt – noch auf keinem Bon'}</p></section>
    <article class="card rise"><h3 class="c-h">${ico('store', 'xs')} Preis je Markt</h3>
      ${Object.keys(per).length ? Object.entries(per).map(([s, x]) => `<div class="bar-row"><span class="br-l">${storeDot(s)}${storeName(s)}</span><span class="br-t"><i data-w="${pct(x.regular ?? x.eff, max)}" style="--c:${(STORES[s] || STORES.sonst).color}"></i></span><b>${eur(x.regular ?? x.eff)}</b></div>${x.promoNow ? `<p class="fine promo-l">${ico('tag', 'xs')}gerade in Aktion: ${eur(x.promoNow.per)}${x.promoNow.pct ? ' (−' + x.promoNow.pct + ' %)' : ''} seit ${dShort(x.promoNow.d)}</p>` : ''}${x.rhythm ? `<p class="fine">Aktion bei ${storeName(s)} etwa alle ${x.rhythm.every} Tage – nächste vermutlich um den ${dLabel(x.rhythm.next)}.</p>` : ''}`).join('') : '<p class="fine">Noch keine Daten. Sobald der Artikel auf einem gescannten Bon steht, siehst du hier die Preise je Markt.</p>'}
      <div class="bar-row base"><span class="br-l">≈ Schätzung</span><span class="br-t"><i data-w="${pct(g.base, max)}"></i></span><b>${eur(g.base)}</b></div></article>
    ${g.n ? `<article class="card rise"><h3 class="c-h">Nährwerte je ${g.unit === 'stk' ? 'Stück' : '100 ' + (g.unit === 'l' ? 'ml' : 'g')}</h3><div class="nutrow"><span><b>${g.n[0]}</b><small>kcal</small></span><span class="m-prot"><b>${dec(g.n[1], 1)} g</b><small>Eiweiß</small></span><span class="m-kh"><b>${dec(g.n[2], 1)} g</b><small>KH</small></span><span class="m-fat"><b>${dec(g.n[3], 1)} g</b><small>Fett</small></span></div></article>` : ''}
    ${hist.length ? `<article class="card rise"><h3 class="c-h">${ico('clock', 'xs')} Verlauf</h3>${hist.map(o => `<div class="price-row"><span><b>${dShort(o.d)} · ${storeName(o.s)}</b><small>${esc(o.name || '')}</small></span><em>${o.promo ? '<span class="flag flag-promo">' + (o.pct ? '−' + o.pct + ' %' : 'Aktion') + '</span>' : ''}${eur(o.per)}</em></div>`).join('')}</article>` : ''}
    <article class="card rise"><h3 class="c-h">${ico('pot', 'xs')} Steckt in</h3><div class="chips">${used.map(([did, d]) => `<button class="chip tap" data-go="#/dish/${did}">${d.emoji} ${esc(d.name)}</button>`).join('') || '<span class="fine">–</span>'}</div></article>
  </div>` };
}

export function promos() {
  const L = E.learned().info, now = [], rhythm = [];
  for (const [ing, per] of Object.entries(L)) for (const [s, x] of Object.entries(per)) { if (x.promoNow) now.push({ ing, s, x }); if (x.rhythm) rhythm.push({ ing, s, x }); }
  rhythm.sort((a, b) => a.x.rhythm.next < b.x.rhythm.next ? -1 : 1);
  return { html: `
  <div class="page detail">
    ${dhead('Aktionen')}
    <article class="card rise"><h3 class="c-h">${ico('tag', 'xs')} Gerade in Aktion</h3>${now.length ? now.map(n => `<button class="promo-row tap" data-go="#/ing/${n.ing}"><span class="pr-e">${ING[n.ing].e}</span><span><b>${esc(ING[n.ing].name)}</b><small>${storeDot(n.s)}${storeName(n.s)} · ${dShort(n.x.promoNow.d)} · normal ${eur(n.x.regular ?? n.x.promoNow.reg)}</small></span><em>${eur(n.x.promoNow.per)}</em></button>`).join('') : '<p class="fine">Keine aktuellen Aktionen erkannt. Scanne deinen nächsten Bon!</p>'}</article>
    <article class="card rise"><h3 class="c-h">${ico('clock', 'xs')} Aktions-Rhythmus</h3>${rhythm.length ? rhythm.map(n => `<button class="promo-row tap" data-go="#/ing/${n.ing}"><span class="pr-e">${ING[n.ing].e}</span><span><b>${esc(ING[n.ing].name)}</b><small>${storeName(n.s)} · ca. alle ${n.x.rhythm.every} Tage</small></span><em>~${dShort(n.x.rhythm.next)}</em></button>`).join('') : '<p class="fine">Braucht mindestens 2 Aktionen desselben Artikels im selben Markt.</p>'}</article>
  </div>` };
}

/* =========================================================
   ICH – Profil, Fortschritt, Einstellungen
   ========================================================= */
function lineChart(pts, h = 110) {
  if (pts.length < 2) return '<p class="fine">Mindestens 2 Einträge nötig.</p>';
  const mn = Math.min(...pts) - 0.5, mx = Math.max(...pts) + 0.5;
  const xy = pts.map((v, i) => [(i / (pts.length - 1) * 300), (h - 12 - (v - mn) / (mx - mn) * (h - 24))]);
  const d = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<svg class="lchart" viewBox="0 0 300 ${h}" preserveAspectRatio="none"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><path d="${d} L300 ${h} L0 ${h}Z" fill="url(#lg)"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
export function ich() {
  const P = S.profile, T = E.targets(), b = E.bmi(), t = E.todayKey();
  const nRated = Object.keys(S.ratings).length, nBlocked = Object.keys(S.blocked).length;
  const days = []; for (let i = 6; i >= 0; i--) days.push(E.addDays(t, -i));
  const comp = days.map(k => { const x = S.plan[k] ? E.dayTotals(k) : null; return x && x.kcal ? Math.min(1, x.eaten / x.kcal) : 0; });
  const actMin = days.map(k => { const a = S.act[k]; return a && a.done ? a.min || 0 : 0; });
  const maxMin = Math.max(30, ...actMin);
  const row = (go, icon, title, sub, act) => `<button class="list-row tap rise" ${act ? 'data-act="' + act + '"' : 'data-go="' + go + '"'}><span class="lr-ico">${ico(icon)}</span><span><b>${title}</b><small>${sub}</small></span>${ico('chev')}</button>`;
  return { html: `
  <div class="page detail">
    ${dhead('Ich', 'Profil & Fortschritt')}
    <article class="card me rise">
      <span class="me-av">${P.name ? esc(P.name[0].toUpperCase()) : '🙂'}</span>
      <div><b>${P.name ? esc(P.name) : 'Du'}</b><small>${P.height} cm · ${lit(P.weight)} kg${P.age ? ' · ' + P.age + ' J.' : ''} · ${T.goal.name}</small></div>
      <div class="me-chips"><button class="chip tap" data-go="#/info/bmi">BMI ${dec(b, 1)}</button><button class="chip tap" data-go="#/info/kcal">${fmtInt(T.kcal)} kcal</button><button class="chip tap" data-go="#/info/makros">${T.prot} g Eiweiß</button></div>
    </article>
    <h2 class="sec rise">Fortschritt</h2>
    <article class="card rise"><div class="row-b"><h3 class="c-h">${ico('scale', 'xs')} Gewicht</h3><button class="link tap" data-go="#/weight">Eintragen ${ico('chev', 'xs')}</button></div>${S.weights.length ? lineChart(S.weights.slice(-12).map(w => w.kg)) : '<p class="fine">Noch keine Einträge – 1× pro Woche wiegen.</p>'}</article>
    <div class="duo rise">
      <article class="card mini-chart"><h3 class="c-h">Mahlzeiten</h3><div class="bars7">${comp.map((v, i) => `<span><i data-h="${(v * 100).toFixed(0)}%"></i><small>${DS[E.wd(days[i])][0]}</small></span>`).join('')}</div><p class="fine">vom Plan gegessen</p></article>
      <article class="card mini-chart run"><h3 class="c-h">Aktivität</h3><div class="bars7">${actMin.map((v, i) => `<span><i data-h="${(v / maxMin * 100).toFixed(0)}%"></i><small>${DS[E.wd(days[i])][0]}</small></span>`).join('')}</div><p class="fine">Minuten Lauf/Workout</p></article>
    </div>
    <h2 class="sec rise">Einstellungen</h2>
    <div class="list">
      ${row('#/profile', 'user', 'Profil, Ziel & Laufen', (P.run || []).length + '× Laufen · ' + (P.train || []).length + '× Kraft · ' + P.persons + ' Personen')}
      ${row('#/strava', 'run', 'Strava', Strava.connected() ? 'Verbunden · ' + Strava.visible().length + ' Läufe eingelesen' : 'Läufe nach dem Laufen einlesen')}
      ${row('#/notif', 'bell', 'Erinnerungen', 'Kochen, Essen bewerten, Laufen, Einkauf')}
      ${row('#/ratings', 'star', 'Meine Bewertungen', nRated + ' Gerichte bewertet' + (nBlocked ? ' · ' + nBlocked + ' aussortiert' : ''))}
      ${row('#/trinken', 'drop', 'Trinkplan', 'Ruhetag ≈ ' + lit(T.water) + ' L · Training ≈ ' + lit(T.water + 1) + ' L')}
      ${row('#/promos', 'tag', 'Aktionen & Preise', S.receipts.length + ' Bons gescannt')}
      ${row('#/info/fruehstueck', 'sun', 'Kleines Frühstück', 'Tricks, wenn in der Früh nix reingeht')}
    </div>
    <h2 class="sec rise">Darstellung</h2>
    <div class="seg wide rise">${[['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, l]) => `<button class="tap${P.theme === v ? ' on' : ''}" data-act="theme" data-v="${v}">${l}</button>`).join('')}</div>
    <h2 class="sec rise">Daten</h2>
    <div class="list">
      ${row('', 'copy', 'Backup kopieren', 'Alles als Text in die Zwischenablage', 'backup')}
      ${row('', 'edit', 'Backup einspielen', 'Text aus einem Backup einfügen', 'restore')}
      ${row('', 'trash', 'Alles zurücksetzen', 'Plan, Bons, Bewertungen löschen', 'reset')}
    </div>
    <p class="about rise">You By What You Eat · Version 2.1.0<br>Alle Daten bleiben auf deinem Handy – nur was du mit Freunden teilst, liegt auf eurem eigenen Server.</p>
  </div>` };
}

export function runSetupHTML() {
  const P = S.profile;
  return `<span class="flabel">Lauftage</span>
    <div class="chips">${DS.map((d, i) => `<button class="chip tap${(P.run || []).includes(i) ? ' on run' : ''}" data-act="runday" data-v="${i}">${d}</button>`).join('')}</div>
    <label class="field"><span>Uhrzeit (Erinnerung)</span><input type="time" data-p="runTime" value="${P.runTime}"></label>
    <span class="flabel">Niveau</span>
    <div class="goal-list">${Object.entries(SP.LEVELS).map(([v, l]) => `<button class="goal tap${(P.runLevel || 'einsteiger') === v ? ' on' : ''}" data-act="pset" data-k="runLevel" data-v="${v}"><b>${l.name}</b><small>${esc(l.desc)}</small></button>`).join('')}</div>`;
}
export function profile() {
  const P = S.profile;
  const stores = [...new Set(S.receipts.map(r => r.store))];
  return { html: `
  <div class="page detail">
    ${dhead('Profil, Ziel & Laufen')}
    <article class="card rise">
      <label class="field"><span>Name (optional)</span><input data-p="name" value="${esc(P.name)}" placeholder="z. B. Max" autocomplete="off"></label>
      <div class="field-2"><label class="field"><span>Größe (cm)</span><input data-p="height" type="number" inputmode="numeric" value="${P.height}"></label>
      <label class="field"><span>Gewicht (kg)</span><input data-p="weight" type="text" inputmode="decimal" value="${String(P.weight).replace('.', ',')}"></label></div>
      <label class="field"><span>Alter</span><input data-p="age" type="number" inputmode="numeric" value="${P.age || ''}" placeholder="für genauere kcal"></label>
      <span class="flabel">Geschlecht (für die Kalorien-Formel)</span>
      <div class="chips">${[['m', 'Mann'], ['w', 'Frau'], ['', 'keine Angabe']].map(([v, l]) => `<button class="chip tap${(P.sex || '') === v ? ' on' : ''}" data-act="pset" data-k="sex" data-v="${v}">${l}</button>`).join('')}</div>
    </article>
    <article class="card rise"><h3 class="c-h">Ziel</h3>
      <div class="goal-list">${Object.entries(E.GOALS).map(([v, g]) => `<button class="goal tap${P.goal === v ? ' on' : ''}" data-act="pset" data-k="goal" data-v="${v}"><b>${g.name}</b><small>${esc(g.desc)}</small></button>`).join('')}</div></article>
    <article class="card rise"><h3 class="c-h">${ico('run', 'xs')} Laufen</h3>${runSetupHTML()}
      <button class="btn ghost wide tap" data-act="run-restart">${ico('shuffle')}Laufplan bei Woche 1 neu starten</button></article>
    <article class="card rise"><h3 class="c-h">${ico('dumbbell', 'xs')} Krafttraining</h3>
      <div class="chips">${DS.map((d, i) => `<button class="chip tap${(P.train || []).includes(i) ? ' on' : ''}" data-act="train" data-v="${i}">${d}</button>`).join('')}</div>
      <p class="fine">An diesen Tagen: Shake als Jause, mehr Wasser, mehr Eiweiß.</p></article>
    <article class="card rise"><h3 class="c-h">Haushalt</h3>
      <div class="stepper"><button class="iconbtn tap" data-act="persons" data-v="-1">${ico('minus')}</button><b>${P.persons} ${P.persons === 1 ? 'Person' : 'Personen'}</b><button class="iconbtn tap" data-act="persons" data-v="1">${ico('plus')}</button></div></article>
    <article class="card rise"><h3 class="c-h">Preise rechnen mit</h3>
      <div class="chips"><button class="chip tap${P.priceMode === 'cheapest' ? ' on' : ''}" data-act="pset" data-k="priceMode" data-v="cheapest">günstigstem Markt</button>${stores.map(s => `<button class="chip tap${P.priceMode === s ? ' on' : ''}" data-act="pset" data-k="priceMode" data-v="${s}">${storeDot(s)}${storeName(s)}</button>`).join('')}</div></article>
  </div>` };
}

export function notif(perm) {
  const N = S.notif;
  const row = (key, icon, title, sub, time = true) => `<div class="nrow rise"><span class="lr-ico">${ico(icon)}</span><span class="nr-t"><b>${title}</b><small>${sub}</small></span>
    ${time ? `<input type="time" data-n="${key}" value="${(N[key].t || '').split(',')[0]}" ${N[key].on ? '' : 'disabled'}>` : ''}
    <label class="switch"><input type="checkbox" data-nt="${key}"${N[key].on ? ' checked' : ''}><i class="sw"></i></label></div>`;
  return { html: `
  <div class="page detail">
    ${dhead('Erinnerungen')}
    <article class="card rise perm ${perm === 'granted' || perm === 'browser' ? 'ok' : ''}">${ico('bell')}<div><b>${perm === 'granted' ? 'Benachrichtigungen sind an' : perm === 'browser' ? 'Im Browser keine Benachrichtigungen' : 'Benachrichtigungen sind aus'}</b><p>${perm === 'granted' ? 'Die App erinnert dich zu den Zeiten unten – mit Gericht und Lauf des Tages.' : perm === 'browser' ? 'In der installierten App funktioniert das.' : 'Erlaube Benachrichtigungen, damit dich die App erinnert.'}</p>
      ${perm !== 'granted' && perm !== 'browser' ? `<button class="btn sm tap" data-act="notif-ask">Erlauben</button>` : ''}</div></article>
    <div class="list">
      ${row('f', 'sun', 'Frühstück', 'Kleiner Start in den Tag')}
      ${row('cook', 'pot', 'Kochen', '„Zeit zum Kochen – schon angefangen?“')}
      ${row('rate', 'star', 'Essen bewerten', '„Schon gegessen? Wie war’s?“')}
      ${row('run', 'run', 'Laufen', 'An Lauftagen um ' + S.profile.runTime, false)}
      ${row('runFollow', 'dumbbell', 'Nachfragen', '2 h später: „Nicht gelaufen? Dann Mini-Workout“', false)}
      ${row('water', 'drop', 'Trinken', 'Vormittag + Nachmittag')}
      ${row('shop', 'cart', 'Einkaufstag', DAYS[N.shop.day] + ' – danach Bon scannen')}
    </div>
    <article class="card rise"><h3 class="c-h">Einkaufstag</h3><div class="chips">${DS.map((d, i) => `<button class="chip tap${N.shop.day === i ? ' on' : ''}" data-act="shopday" data-v="${i}">${d}</button>`).join('')}</div></article>
    <button class="btn ghost wide tap rise" data-act="notif-test">${ico('bell')}Test-Benachrichtigung (in 5 Sek.)</button>
  </div>` };
}

export function ratings() {
  const rated = Object.keys(S.ratings).filter(id => DISHES[id] && S.ratings[id].length).map(id => ({ id, avg: E.avgRating(id), n: S.ratings[id].length })).sort((a, b) => b.avg - a.avg);
  const blocked = Object.keys(S.blocked).filter(id => DISHES[id]);
  return { html: `
  <div class="page detail">
    ${dhead('Meine Bewertungen')}
    ${blocked.length ? `<h2 class="sec rise">Aussortiert</h2>${blocked.map(id => `<div class="card rrow rise">${plate(id, 0, 'sm')}<button class="tap rr-b" data-go="#/dish/${id}"><b>${esc(DISHES[id].name)}</b><small>${S.blocked[id].auto ? 'automatisch – öfter unter 3 ★' : 'von dir aussortiert'} · seit ${dShort(S.blocked[id].since)}</small></button><button class="btn sm ghost tap" data-act="unblock" data-id="${id}">Zurück</button></div>`).join('')}` : ''}
    <h2 class="sec rise">Bewertet</h2>
    ${rated.length ? rated.map(r => `<button class="card rrow tap rise" data-go="#/dish/${r.id}">${plate(r.id, r.avg / 5, 'sm')}<span class="rr-b"><b>${esc(DISHES[r.id].name)}</b><small>${r.n}× bewertet</small></span><span class="rr-s">${stars(r.avg)}<b>${dec(r.avg, 1)}</b></span></button>`).join('') : '<p class="empty rise">Noch nichts bewertet. Nach dem Essen kommt eine Erinnerung.</p>'}
    <button class="btn ghost wide tap rise" data-go="#/info/sterne">${ico('info')}Wie funktioniert das?</button>
  </div>` };
}

export function trinken() {
  const T = E.targets();
  const mode = ui.drink || ((S.plan[E.todayKey()] || {}).train ? 'train' : 'rest');
  const list = mode === 'train' ? W_TRAIN : W_REST;
  const sum = list.reduce((s, x) => s + x.l, 0);
  return { html: `
  <div class="page detail">
    ${dhead('Trinkplan', 'pro Person')}
    <section class="info-hero rise" style="--h:210"><span class="ih-emo float">💧</span><h1>≈ ${lit(mode === 'train' ? T.water + 1 : T.water)} L am Tag</h1></section>
    <div class="seg wide rise"><button class="tap${mode === 'rest' ? ' on' : ''}" data-act="drink" data-v="rest">Ruhetag</button><button class="tap${mode === 'train' ? ' on' : ''}" data-act="drink" data-v="train">Trainings-/Lauftag</button></div>
    <article class="card rise"><ol class="drink-list">${list.map(x => `<li class="drink${x.tr ? ' tr' : ''}"><span class="d-time">${x.t}</span><span class="d-what">${x.what}<span class="d-bar"><i data-w="${(x.l / 0.6 * 100).toFixed(0)}%"></i></span></span><b>${lit(x.l)} L</b></li>`).join('')}</ol>
      <div class="cost-sum"><span>Gesamt</span><b>≈ ${lit(Math.round(sum * 10) / 10)} L</b></div></article>
    <article class="card rise"><h3 class="c-h">Faustregeln</h3><ul class="facts water"><li><b>Check:</b> Harn hellgelb = passt.</li><li><b>Beim Laufen</b> ab 60 Min: alle 15–20 Min ein paar Schluck.</li><li><b>Danach:</b> pro 0,5 kg Gewichtsverlust 0,6–0,75 L nachtrinken.</li><li>1 Stunde vorm Schlafen Schluss.</li></ul></article>
  </div>` };
}

export function weight() {
  const W = S.weights, P = S.profile;
  let advice = 'Trag 1× pro Woche dein Gewicht ein – dann sagt dir die App, ob du mehr oder weniger essen solltest.';
  if (W.length >= 3) {
    const a = W[W.length - 3], b = W[W.length - 1], perWeek = (b.kg - a.kg) / Math.max(1, E.daysBetween(a.d, b.d)) * 7;
    if (P.goal === 'muskel') advice = perWeek < 0.1 ? 'Du nimmst kaum zu (' + dec(perWeek, 2) + ' kg/Woche). Abends etwas mehr Reis/Nudeln oder ein Glas Milch extra.' : perWeek > 0.6 ? 'Du nimmst schnell zu (' + dec(perWeek, 2) + ' kg/Woche). Jause etwas kleiner.' : 'Perfekt: ' + dec(perWeek, 2) + ' kg pro Woche – genau im Ziel.';
    else if (P.goal === 'abnehmen') advice = perWeek > -0.2 ? 'Es geht kaum runter – Jause etwas kleiner machen.' : 'Läuft: ' + dec(perWeek, 2) + ' kg pro Woche.';
    else advice = Math.abs(perWeek) < 0.2 ? 'Gewicht stabil – passt.' : 'Gewicht ändert sich um ' + dec(perWeek, 2) + ' kg/Woche.';
  }
  return { html: `
  <div class="page detail">
    ${dhead('Gewicht')}
    <article class="card rise"><div class="big-num"><b>${lit(P.weight)} kg</b><span>aktuell · ${P.height} cm · BMI ${dec(E.bmi(), 1)}</span></div>${W.length >= 2 ? lineChart(W.slice(-12).map(w => w.kg)) : ''}
      <div class="w-add"><input id="w-in" type="text" inputmode="decimal" autocomplete="off" placeholder="z. B. ${lit(P.weight)}"><button class="btn tap" data-act="w-add">${ico('plus')}Eintragen</button></div></article>
    <article class="card rise"><h3 class="c-h">${ico('spark', 'xs')} Einschätzung</h3><p>${advice}</p></article>
    ${W.length ? `<article class="card rise">${[...W].reverse().slice(0, 15).map(x => `<div class="price-row"><span><b>${dLabel(x.d)}</b></span><em>${lit(x.kg)} kg</em></div>`).join('')}</article>` : ''}
  </div>` };
}

/* Schnell-Aktionen (Plus-Knopf in der Mitte) */
export function quickSheetHTML() {
  const t = E.todayKey(), act = SP.plannedActivity(t);
  const tiles = [
    ['camera', 'foodcam', 'Essen fotografieren'],
    ['scan', 'scan', 'Bon scannen'],
    ['star', 'rate', 'Essen bewerten'],
    act && !act.done ? ['run', 'go', act.kind === 'run' ? 'Lauf starten' : 'Workout starten', act.kind === 'run' ? '#/timer/run/' + t : '#/timer/workout/' + act.id + '?d=' + t] : ['dumbbell', 'go', 'Mini-Workout', '#/workout/' + SP.workoutFor(t) + '?d=' + t],
    ['drop', 'water', '+ Glas Wasser'],
    ['scale', 'go', 'Gewicht', '#/weight'],
    ['book', 'go', 'Rezepte', '#/rezepte'],
    ['edit', 'foodsearch', 'Essen / Snack suchen'],
    ['tag', 'barcode', 'Barcode scannen'],
    ['cart', 'go', 'Einkauf', '#/einkauf']
  ];
  return `<h2 class="sh-t">Schnell erledigt</h2><div class="qgrid">${tiles.map(([icon, kind, label, arg]) => `<button class="qt tap" data-q="${kind}" ${arg ? 'data-arg="' + arg + '"' : ''}><span class="qt-i">${ico(icon)}</span><b>${label}</b></button>`).join('')}</div>`;
}

/* =========================================================
   ONBOARDING
   ========================================================= */
export function onboarding() {
  const P = S.profile, s = ui.ob;
  const dots = [0, 1, 2, 3, 4].map(i => `<i class="${i === s ? 'on' : ''}"></i>`).join('');
  let body = '';
  if (s === 0) body = `
    <div class="ob-hero"><span class="ob-e e1">🥣</span><span class="ob-e e2">🍛</span><span class="ob-e e3">🥦</span><span class="ob-e e4">🏃</span><span class="ob-e e5">🍌</span><div class="ob-plate">🍽️</div></div>
    <h1 class="ob-title">You By<br><span>What You Eat</span></h1>
    <p class="ob-p">Dein Speiseplan, der mitdenkt: kleines Frühstück, jeden Tag Abwechslung, Preise von deinem Supermarkt, Laufplan – und Erinnerungen an alles.</p>
    <button class="btn big wide tap" data-act="ob-next">Los geht’s</button>`;
  if (s === 1) body = `
    <h2 class="ob-h">Das bist du</h2><p class="ob-p">Schon eingetragen – stimmt das so?</p>
    <div class="field-2"><label class="field"><span>Größe (cm)</span><input data-p="height" type="number" inputmode="numeric" value="${P.height}"></label>
    <label class="field"><span>Gewicht (kg)</span><input data-p="weight" type="text" inputmode="decimal" value="${String(P.weight).replace('.', ',')}"></label></div>
    <label class="field"><span>Alter</span><input data-p="age" type="number" inputmode="numeric" value="${P.age || ''}" placeholder="z. B. 24"></label>
    <span class="flabel">Geschlecht (für die Kalorien-Formel)</span>
    <div class="chips">${[['m', 'Mann'], ['w', 'Frau'], ['', 'keine Angabe']].map(([v, l]) => `<button class="chip tap${(P.sex || '') === v ? ' on' : ''}" data-act="pset" data-k="sex" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="ob-bmi">BMI <b>${dec(E.bmi(), 1)}</b> · ${E.bmiLabel(E.bmi())} · Ziel ≈ <b>${fmtInt(E.targets().kcal)} kcal</b></div>
    <button class="btn big wide tap" data-act="ob-next">Weiter</button>`;
  if (s === 2) body = `
    <h2 class="ob-h">Ziel & Haushalt</h2>
    <div class="goal-list">${Object.entries(E.GOALS).map(([v, g]) => `<button class="goal tap${P.goal === v ? ' on' : ''}" data-act="pset" data-k="goal" data-v="${v}"><b>${g.name}</b><small>${esc(g.desc)}</small></button>`).join('')}</div>
    <span class="flabel">Für wie viele Personen kochst du?</span>
    <div class="stepper"><button class="iconbtn tap" data-act="persons" data-v="-1">${ico('minus')}</button><b>${P.persons} ${P.persons === 1 ? 'Person' : 'Personen'}</b><button class="iconbtn tap" data-act="persons" data-v="1">${ico('plus')}</button></div>
    <span class="flabel">Krafttraining</span>
    <div class="chips">${DS.map((d, i) => `<button class="chip tap${(P.train || []).includes(i) ? ' on' : ''}" data-act="train" data-v="${i}">${d}</button>`).join('')}</div>
    <button class="btn big wide tap" data-act="ob-next">Weiter</button>`;
  if (s === 3) body = `<div class="ob-icon">🏃</div><h2 class="ob-h">Laufen</h2><p class="ob-p">An welchen Tagen willst du laufen? Keine Lust an einem Tag? Dann gibt’s stattdessen ein kurzes Workout mit Anleitung.</p>${runSetupHTML()}<button class="btn big wide tap" data-act="ob-next">Weiter</button>`;
  if (s === 4) body = `
    <div class="ob-bell">${ico('bell')}</div>
    <h2 class="ob-h">Erinnerungen</h2>
    <p class="ob-p">Die App fragt dich, ob du schon gekocht und gegessen hast und wie es war (0–5 Sterne) – und erinnert dich ans Laufen.</p>
    <ul class="facts"><li>07:00 – kleines Frühstück</li><li>18:00 – Zeit zum Kochen</li><li>20:30 – Schon gegessen? Wie war’s?</li><li>${P.runTime} an Lauftagen – Laufen (oder Mini-Workout)</li></ul>
    <button class="btn big wide tap" data-act="ob-notif">${ico('bell')}Erinnerungen erlauben</button>
    <button class="btn ghost wide tap" data-act="ob-done">Später</button>`;
  return { html: `<div class="page ob"><div class="mesh" aria-hidden="true"></div><div class="ob-dots">${dots}</div><div class="ob-step ob-s${s}">${body}</div></div>`, cls: 'ob-screen' };
}

function notFound() { return { html: `<div class="page detail">${dhead('Hoppla')}<p class="empty">Nicht gefunden.</p></div>` }; }

/* =========================================================
   Nährwerte: Tabelle wie auf der Packung, Ampel, Zuckerwürfel
   ========================================================= */
const dotT = (k, v, ml) => { const l = N.light(k, v, ml); return l ? `<i class="tl ${l}" title="${N.LIGHT_TXT[l]}"></i>` : ''; };
export function nutriTable(it, grams) {
  const ml = !!it.ml, u = ml ? 'ml' : 'g', per = N.scale(it.n, grams);
  const rows = N.ROWS.map(r => {
    const v100 = it.n[N.K[r.k]], vp = per[r.k];
    const first = r.k === 'kcal' ? (v100 == null ? '–' : `${fmtInt(v100)} kcal<small>${fmtInt(N.kJ(v100))} kJ</small>`) : v100 == null ? '–' : `${N.fmtV(r.k, v100)} ${r.unit}`;
    const second = r.k === 'kcal' ? (vp == null ? '–' : `${fmtInt(vp)} kcal<small>${fmtInt(N.kJ(vp))} kJ</small>`) : vp == null ? '–' : `${N.fmtV(r.k, vp)} ${r.unit}`;
    const rm = vp == null ? '' : Math.round(vp / r.ri * 100) + ' %';
    return `<tr class="${r.sub ? 'sub' : ''}${r.bold ? ' b' : ''}"><th>${r.label}</th><td>${dotT(r.k, v100, ml)}${first}</td><td>${second}</td><td class="rm">${rm}</td></tr>`;
  }).join('');
  return `<table class="ntab"><thead><tr><th>Nährwerte</th><th>je 100 ${u}</th><th>je ${fmtInt(grams)} ${u}</th><th>% RM*</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="fine ntab-n">* RM = Referenzmenge für einen durchschnittlichen Erwachsenen (8.400 kJ / 2.000 kcal). <span class="tl-leg"><i class="tl g"></i>wenig <i class="tl y"></i>mittel <i class="tl r"></i>viel</span></p>`;
}
function dishTable(d) {
  const n = [d.kcal, d.prot, d.kh, d.sugar, d.fat, d.sat, d.fiber, d.salt].map(v => (v === undefined ? null : v));
  const rows = N.ROWS.map(r => {
    const v = n[N.K[r.k]];
    return `<tr class="${r.sub ? 'sub' : ''}${r.bold ? ' b' : ''}"><th>${r.label}</th><td>${r.k === 'kcal' ? (v == null ? '–' : `${fmtInt(v)} kcal<small>${fmtInt(N.kJ(v))} kJ</small>`) : v == null ? '–' : `${N.fmtV(r.k, v)} ${r.unit}`}</td><td class="rm">${v == null ? '' : Math.round(v / r.ri * 100) + ' %'}</td></tr>`;
  }).join('');
  return `<table class="ntab two"><thead><tr><th>Nährwerte</th><th>pro Portion</th><th>% RM*</th></tr></thead><tbody>${rows}</tbody></table><p class="fine ntab-n">* Referenzmenge für Erwachsene · aus den Zutaten berechnet</p>`;
}
function cubesHTML(g) {
  const full = Math.floor(g / N.SUGAR_CUBE), part = g / N.SUGAR_CUBE - full, show = Math.min(full, 36);
  let h = ''; for (let i = 0; i < show; i++) h += `<i class="cube" style="--d:${i * 28}ms"></i>`;
  if (full < 36 && part > 0.1) h += `<i class="cube half" style="--f:${Math.round(part * 100)}%;--d:${show * 28}ms"></i>`;
  return h + (full > 36 ? `<b class="cube-more">+${full - 36}</b>` : '');
}
function sugarCard(it, grams, dayEaten) {
  const sg = it.n[N.K.sugar];
  if (sg == null) return `<article class="card sugar-card rise"><h3 class="c-h">🍬 Zucker</h3><p class="lede">Auf diesem Produkt ist keine Zucker-Angabe hinterlegt.</p></article>`;
  const g = sg * grams / 100, I = N.sugarInfo(g), nd = dayEaten + g;
  const tsp = g / 4;
  return `<article class="card sugar-card lvl-${I.lvl} rise">
    <div class="row-b"><h3 class="c-h">🍬 Zucker</h3><button class="link tap" data-go="#/info/zucker">Mehr ${ico('chev', 'xs')}</button></div>
    <div class="sg-top"><b>${N.fmtV('sugar', g)} g</b><span>in dieser Menge<small>${N.fmtV('sugar', sg)} g je 100 ${it.ml ? 'ml' : 'g'} ${dotT('sugar', sg, it.ml)}</small></span></div>
    <div class="cubes" aria-label="${dec(I.cubes, 1)} Zuckerwürfel">${cubesHTML(g)}</div>
    <p class="sg-line">≈ <b>${dec(I.cubes, I.cubes < 10 ? 1 : 0)} Zuckerwürfel</b> · ${dec(tsp, tsp < 10 ? 1 : 0)} Teelöffel</p>
    <div class="who"><span class="mbar"><i data-w="${pct(g, N.WHO_SUGAR)}"></i></span><small><b>${Math.round(g / N.WHO_SUGAR * 100)} %</b> der WHO-Höchstmenge (50 g/Tag) – ${I.txt}</small></div>
    <p class="fine">Heute bisher ${dec(dayEaten, 0)} g Zucker → mit diesem Essen ${dec(nd, 0)} g (Referenzmenge 90 g).</p></article>`;
}
function nsBadge(ns, est) {
  if (!ns) return '';
  return `<div class="nsb${est ? ' est' : ''}" title="Nutri-Score ${ns.toUpperCase()}${est ? ' (geschätzt)' : ''}">${['a', 'b', 'c', 'd', 'e'].map(x => `<i class="${x}${x === ns ? ' on' : ''}">${x.toUpperCase()}</i>`).join('')}${est ? '<small>≈</small>' : ''}</div>`;
}
const viaTxt = { barcode: '📦 Barcode', text: '🔤 Packungstext', ki: '🧠 Foto-KI', gelernt: '🎓 gelernt', tabelle: '🏷️ Tabelle' };

/* =========================================================
   ESSEN FOTOGRAFIEREN / SUCHEN
   ========================================================= */
const SLOT_CH = [['f', 'Frühstück'], ['m', 'Mittag'], ['s', 'Jause'], ['a', 'Abend']];
const itemRow = it => {
  const sg = it.n[N.K.sugar], l = it.n[0];
  return `<button class="fl tap" data-act="food-choose" data-key="${esc(it.key)}"><span class="fl-e">${it.e}</span><span><b>${it.brand ? '<i class="fl-b">' + esc(it.brand) + '</i> ' : ''}${esc(it.name)}</b><small>${l == null ? '–' : fmtInt(l)} kcal${sg != null ? ' · <u class="sg ' + (N.light('sugar', sg, it.ml) || '') + '">🍬 ' + N.fmtV('sugar', sg) + ' g</u>' : ''} <em>/100 ${it.ml ? 'ml' : 'g'}</em> · ${esc(it.cat || '')}</small></span>${ico('chev')}</button>`;
};
export function foto() {
  const F = ui.food;
  if (!F) return { html: `<div class="page detail">${dhead('Essen')}<p class="empty">Kein Foto.</p></div>` };
  if (F.state === 'scan') return { html: `
  <div class="page fscan">
    <div class="fs-img">${F.img ? `<img src="${F.img}" alt="">` : '<div class="fs-demo">🍽️</div>'}<div class="fs-grid"></div><div class="beam"></div><span class="fs-c tl"></span><span class="fs-c tr"></span><span class="fs-c bl"></span><span class="fs-c br"></span></div>
    <div class="fs-msg"><span class="fs-brain">🧠</span><b>KI schaut genau hin …</b><small>Barcode · Packungstext · Nährwerttabelle · Gericht – alles offline am Handy</small><span class="dots"><i></i><i></i><i></i></span></div>
  </div>`, cls: 'dark-screen' };
  if (F.state === 'label') return labelForm(F);
  if (F.state === 'pick' || F.state === 'error' || !F.sel) return pickScreen(F);
  return resultScreen(F);
}
function pickScreen(F) {
  const q = F.q || '', res = q.trim().length >= 2 ? (F.results || []) : [];
  const hist = (S.food.hist || []).slice(0, 8), favs = S.food.fav || [], cust = (S.food.cust || []).filter(c => !c.code || c.src === 'label').slice(0, 6);
  const loading = F.loading ? '<p class="fine">Produktdatenbank wird geladen …</p>' : '';
  return { html: `
  <div class="page detail">
    ${dhead('Essen eintragen', 'fotografieren oder suchen')}
    ${F.state === 'error' ? `<article class="card warn rise">${ico('info')}<div><b>${F.unknownCode ? 'Barcode ' + esc(F.unknownCode) + ' nicht gefunden' : 'Nichts erkannt'}</b><p>${esc(F.error || '')}</p>${F.unknownCode ? `<button class="btn sm tap" data-act="foodcam" data-mode="label" data-code="${esc(F.unknownCode)}">${ico('camera')}Nährwerttabelle fotografieren</button>` : `<button class="btn sm tap" data-act="foodcam">${ico('camera')}Nochmal fotografieren</button>`}</div></article>` : ''}
    ${isNative ? `    <div class="fmodes rise">
      <button class="fm tap" data-act="foodcam"><span>📸</span><b>Essen</b><small>Teller, Obst, Snack</small></button>
      <button class="fm tap" data-act="foodcam" data-mode="barcode"><span>📦</span><b>Barcode</b><small>Packung scannen</small></button>
      <button class="fm tap" data-act="foodcam" data-mode="label"><span>🏷️</span><b>Tabelle</b><small>Nährwerte lesen</small></button>
    </div>` : `<article class="card rise"><h3 class="c-h">${ico('camera', 'xs')} Foto, Barcode &amp; Tabelle</h3><p class="fine">Essen fotografieren, Barcodes scannen und Nährwerttabellen lesen gibt es in der Android-App. Hier kannst du Essen <b>suchen</b> – 54.000 Produkte und 200 Grundnahrungsmittel sind dabei.</p></article>`}
    <div class="fsearch rise"><span>${ico('edit')}</span><input id="food-q" type="search" placeholder="Haribo, Beef Tatar, Cola, Spaghetti …" value="${esc(q)}" autocomplete="off"></div>
    ${loading}
    ${res.length ? `<div class="flist rise">${res.map(itemRow).join('')}</div>` : q.trim().length >= 2 && !F.loading ? `<p class="empty">Nix gefunden. Fotografiere die Packung (Barcode oder Tabelle) – dann lernt die App das Produkt.</p>` : ''}
    ${!isNative && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !res.length ? `<article class="card rise"><h3 class="c-h">🧪 Im Browser testen</h3><p class="fine">Hier gibt’s keine Kamera-KI. Beispiele laufen durch dieselbe Auswertung wie ein echtes Foto:</p><div class="chips"><button class="chip tap" data-act="food-demo" data-kind="haribo">📦 Haribo-Packung</button><button class="chip tap" data-act="food-demo" data-kind="table">🏷️ Nährwerttabelle</button><button class="chip tap" data-act="food-demo" data-kind="schnitzel">🥩 Schnitzel</button><button class="chip tap" data-act="food-demo" data-kind="banana">🍌 Banane</button></div></article>` : ''}
    ${!res.length && q.trim().length < 2 ? `${favs.length ? `<h2 class="sec sm rise">⭐ Favoriten</h2><div class="flist rise">${favs.slice(0, 6).map(itemRow).join('')}</div>` : ''}${hist.length ? `<h2 class="sec sm rise">Zuletzt gegessen</h2><div class="flist rise">${hist.map(itemRow).join('')}</div>` : ''}${cust.length ? `<h2 class="sec sm rise">Meine Produkte</h2><div class="flist rise">${cust.map(c => itemRow(FA.customItem(c))).join('')}</div>` : ''}
    <h2 class="sec sm rise">Schnell auswählen</h2><div class="fquick rise">${['Banane', 'Apfel', 'Semmel / Kaisersemmel', 'Cola', 'Gummibärchen / Fruchtgummi', 'Vollmilchschokolade', 'Kartoffelchips (gesalzen)', 'Magertopfen', 'Ei, gekocht', 'Kaffee schwarz', 'Bier (Lager/Hell)', 'Nuss-Nougat-Creme (Nutella)'].map(n => { const gi = FA.genIndex(n); if (gi < 0) return ''; const i = FA.genItem(gi); return `<button class="fq tap" data-act="food-choose" data-key="${i.key}"><span>${i.e}</span><b>${esc(i.name.split(' (')[0].split(' / ')[0])}</b></button>`; }).join('')}</div>` : ''}
    <p class="fine src-note">Daten: Open Food Facts (ODbL) · USDA FoodData Central · eigene Richtwerte</p>
  </div>` };
}
function resultScreen(F) {
  const it = F.sel, grams = F.grams || it.g, per = FA.nutr(it, grams);
  const T = E.targets(), k = F.k || E.todayKey(), tot = E.dayTotals(k), burned = SP.burned(k);
  const leftAfter = T.kcal + burned - tot.eaten - per.kcal;
  const p = S.plan[k], planned = p && DISHES[p[F.slot]];
  const conf = F.conf != null ? Math.round(F.conf * 100) : null;
  const vd = N.verdict(it.n.map(v => (v == null ? 0 : v)), { prot: per.prot || 0, fiber: per.fiber || 0, sugar: per.sugar, kcal: per.kcal }, it.ml);
  const unit = it.ml ? 'ml' : 'g';
  const ns = it.ns || ((it.k === 'c' || it.k === 'p') && it.n.every(v => v != null) ? N.nutriScore(it.n, it.ml) : '');
  const opts = FA.portionOptions(it);
  const alts = (F.guesses || []).filter(g => g.key !== it.key).slice(0, 5);
  const fav = FA.isFav(it.key);
  const viaBadge = it.via ? `<span class="conf ${it.via === 'barcode' ? 'hi' : conf >= 50 ? 'hi' : conf >= 20 ? 'mid' : 'lo'}">${viaTxt[it.via] || ''}${conf != null && it.via !== 'barcode' && it.via !== 'tabelle' ? ' · ' + conf + ' %' : ''}</span>` : '<span class="conf hi">✓ ausgewählt</span>';
  return { html: `
  <div class="page detail no-head food-res">
    <section class="fr-hero">${F.img ? `<img src="${F.img}" alt="">` : `<div class="fr-emo"><span>${it.e}</span></div>`}<button class="iconbtn glass-btn tap" data-act="back" aria-label="Zurück">${ico('back')}</button>
      <button class="iconbtn glass-btn fav-btn tap${fav ? ' on' : ''}" data-act="food-fav" aria-label="Favorit">${fav ? '★' : '☆'}</button>
      <div class="fr-over">${viaBadge}<h1>${it.brand ? '<small>' + esc(it.brand) + '</small>' : ''}${it.e} ${esc(it.name)}</h1><p>${[it.k === 'd' && it.label && it.label !== it.name ? 'KI: „' + esc(it.label) + '“' : '', it.cat && it.k !== 'd' ? esc(it.cat) : '', it.src === 'avg' ? 'Werte geschätzt' : '', it.code ? 'EAN ' + esc(it.code) : ''].filter(Boolean).join(' · ')}</p></div></section>
    <section class="d-sheet">
      ${alts.length ? `<div class="alts-h rise"><small>Oder ist es …</small></div><div class="alts rise">${alts.map(g => { const bn = g.brand && !FA.norm(g.name).startsWith(FA.norm(g.brand)) ? g.brand + ' ' + g.name : g.name; return `<button class="chip tap" data-act="food-alt" data-key="${esc(g.key)}">${g.e} ${esc(bn.length > 26 ? bn.slice(0, 25) + '…' : bn)}${g.via === 'barcode' ? '' : ' <small>' + Math.round((g.conf || 0) * 100) + ' %</small>'}</button>`; }).join('')}<button class="chip tap" data-act="food-find">${ico('edit')}Suchen</button></div>` : `<div class="alts rise"><button class="chip tap" data-act="food-find">${ico('edit')}Was anderes suchen</button></div>`}
      ${F.packHint && !it.code && it.via !== 'barcode' ? `<article class="card hint-card rise"><span class="hint-ico">📦</span><span><b>Sieht nach einer Packung aus</b><small>Für genaue Werte: Barcode oder Nährwerttabelle fotografieren.</small></span><button class="btn sm tap" data-act="foodcam" data-mode="barcode">${ico('camera')}</button></article>` : ''}
      <div class="fr-kcal rise"><b data-count="${per.kcal}">0</b><span>kcal<small>für ${fmtInt(per.g)} ${unit}</small></span>${nsBadge(ns, !it.ns)}</div>
      <div class="fr-mac rise">
        <div class="m-prot"><small>Eiweiß</small><b>${per.prot == null ? '–' : N.fmtV('prot', per.prot) + ' g'}</b><span class="mbar"><i data-w="${pct(per.prot || 0, T.prot)}"></i></span><em>${per.prot == null ? '' : Math.round(per.prot / T.prot * 100) + ' % vom Tag'}</em></div>
        <div class="m-kh"><small>Kohlenhydrate</small><b>${per.kh == null ? '–' : N.fmtV('kh', per.kh) + ' g'}</b><span class="mbar"><i data-w="${pct(per.kh || 0, T.kh)}"></i></span><em>${per.kh == null ? '' : Math.round(per.kh / T.kh * 100) + ' % vom Tag'}</em></div>
        <div class="m-fat"><small>Fett</small><b>${per.fat == null ? '–' : N.fmtV('fat', per.fat) + ' g'}</b><span class="mbar"><i data-w="${pct(per.fat || 0, T.fat)}"></i></span><em>${per.fat == null ? '' : Math.round(per.fat / T.fat * 100) + ' % vom Tag'}</em></div>
      </div>
      ${vd.length ? `<div class="vd rise">${vd.map(([e, t, c]) => `<span class="vchip ${c}">${e} ${t}</span>`).join('')}</div>` : ''}

      <article class="card amount rise"><h3 class="c-h">${ico('scale', 'xs')} Wie viel?</h3>
        <div class="stepper2"><button class="iconbtn tap" data-act="food-step" data-v="-1" aria-label="weniger">${ico('minus')}</button><label><input id="food-g" type="number" inputmode="numeric" value="${Math.round(grams)}" min="1" max="3000"><span>${unit}</span></label><button class="iconbtn tap" data-act="food-step" data-v="1" aria-label="mehr">${ico('plus')}</button></div>
        <div class="sizes">${opts.map(o => `<button class="sz tap${Math.round(grams) === o.g ? ' on' : ''}" data-act="food-size" data-g="${o.g}"><b>${o.l || o.g + ' ' + unit}</b>${o.l ? `<small>${o.g} ${unit}</small>` : ''}</button>`).join('')}</div></article>

      <article class="card rise"><h3 class="c-h">${ico('info', 'xs')} Nährwertangaben</h3>${nutriTable(it, grams)}</article>
      ${sugarCard(it, grams, tot.eatenSugar || 0)}

      <article class="card rise"><h3 class="c-h">${ico('info', 'xs')} Was ist das?</h3>${it.desc ? `<p class="lede">${esc(it.desc)}</p>` : ''}
        <p class="fine">${it.src === 'off' ? 'Werte von der Packung (Open Food Facts, von Nutzern erfasst) – bei Rezepturänderungen können sie abweichen.' : it.src === 'label' ? 'Werte, die du von der Packung abfotografiert hast.' : it.src === 'usda' ? 'Werte: USDA FoodData Central – Durchschnitt für dieses Lebensmittel.' : it.src === 'avg' ? 'Dieses Gericht kennt die App nicht genau – die Werte sind ein Durchschnitt. Über „Suchen“ geht’s genauer.' : it.src === 'cat' ? 'Typische Werte für ' + esc(it.cat) + ' – je nach Rezept ± 20 %.' : 'Richtwerte für ein typisches Gericht – je nach Rezept ± 20 %.'}</p>
        ${it.tmp ? `<button class="btn ghost wide tap" data-act="food-savecustom">${ico('plus')}Als eigenes Produkt speichern</button>` : ''}</article>

      <article class="card rise"><h3 class="c-h">${ico('book', 'xs')} Eintragen als</h3>
        <div class="chips">${SLOT_CH.map(([v, l]) => `<button class="chip tap${F.slot === v ? ' on' : ''}" data-act="food-slot" data-v="${v}">${l}</button>`).join('')}</div>
        ${planned && !(S.log[k] && S.log[k].eaten && S.log[k].eaten[F.slot]) ? `<label class="switch-row tap"><span>Statt Plan: ${esc(planned.name)}</span><input type="checkbox" data-act="food-replace"${F.replaces ? ' checked' : ''}><i class="sw"></i></label><p class="fine">${F.replaces ? 'Das geplante Gericht zählt dann nicht mehr.' : 'Wird zusätzlich zum Plan gezählt.'}</p>` : ''}
        <div class="left-after ${leftAfter < 0 ? 'over' : ''}"><span>Danach heute noch übrig</span><b>${leftAfter < 0 ? '−' + fmtInt(-leftAfter) + ' kcal (drüber)' : fmtInt(leftAfter) + ' kcal'}</b></div></article>
      <p class="fine src-note">Daten: Open Food Facts (ODbL) · USDA FoodData Central · Nutri-Score/Ampel nach offiziellen Schwellen</p>
      <div class="sticky-save"><button class="btn ghost tap" data-act="foodcam">${ico('camera')}Nochmal</button><button class="btn big tap" data-act="food-save">${ico('check')}Eintragen</button></div>
    </section>
  </div>` };
}
function labelForm(F) {
  const t = F.table || { per100: {}, hits: 0 }, p = F.form || t.per100 || {};
  const fld = (k, label, unit) => `<label class="lf"><span>${label}</span><input data-lf="${k}" type="text" inputmode="decimal" value="${p[k] == null ? '' : String(p[k]).replace('.', ',')}" placeholder="–"><em>${unit}</em></label>`;
  return { html: `
  <div class="page detail">
    ${dhead('Nährwerte übernehmen', F.unknownCode ? 'EAN ' + F.unknownCode : '')}
    ${F.img ? `<img class="rv-img rise" src="${F.img}" alt="">` : ''}
    <article class="card rise"><p class="lede">${t.hits >= 4 ? `<b>${t.hits} Werte erkannt.</b> Prüf kurz, ob sie stimmen – Korrekturen einfach eintippen.` : 'Die Tabelle konnte nur teilweise gelesen werden. Trag die Werte von der Packung ein (alles <b>je 100 ' + (F.formMl ? 'ml' : 'g') + '</b>).'}</p></article>
    <article class="card rise">
      <label class="field"><span>Name</span><input id="lf-name" value="${esc(F.formName || '')}" placeholder="z. B. Haribo Goldbären" autocomplete="off"></label>
      <label class="field"><span>Marke (optional)</span><input id="lf-brand" value="${esc(F.formBrand || '')}" placeholder="z. B. Haribo" autocomplete="off"></label>
      <div class="seg wide"><button class="tap${!F.formMl ? ' on' : ''}" data-act="lf-ml" data-v="0">Lebensmittel (je 100 g)</button><button class="tap${F.formMl ? ' on' : ''}" data-act="lf-ml" data-v="1">Getränk (je 100 ml)</button></div>
      <div class="lgrid">${fld('kcal', 'Energie', 'kcal')}${fld('fat', 'Fett', 'g')}${fld('sat', 'ges. Fettsäuren', 'g')}${fld('kh', 'Kohlenhydrate', 'g')}${fld('sugar', 'davon Zucker', 'g')}${fld('fiber', 'Ballaststoffe', 'g')}${fld('prot', 'Eiweiß', 'g')}${fld('salt', 'Salz', 'g')}</div>
      <label class="field"><span>Eine Portion / Packung wiegt (g oder ml)</span><input id="lf-g" type="text" inputmode="numeric" value="${F.formG || (t.servG || '')}" placeholder="z. B. 30"></label>
    </article>
    <div class="sticky-save"><button class="btn ghost tap" data-act="foodcam" data-mode="label">${ico('camera')}Nochmal</button><button class="btn big tap" data-act="lf-use">${ico('check')}Weiter</button></div>
  </div>` };
}


/* ---------- Strava ---------- */
export function strava() {
  const s = S.strava, on = Strava.connected(), runs = Strava.visible().slice(0, 12);
  const srv = Strava.server, online = SO.online(), owner = online && SO.soc().owner, useServer = online && (!isNative || (srv.enabled && !Strava.hasKeys())), athlete = s.athlete || srv.athlete;
  const when = ms => { const d = new Date(ms); return relDay(E.keyOf(d)) + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const runLi = r => `<li><span class="sr-d"><small>${DS[E.wd(r.date)]}</small><b>${E.dateOf(r.date).getDate()}</b></span><span class="sr-t"><b>${lit(r.km)} km · ${r.min} Min</b><small>${r.sec && r.km ? 'Ø ' + paceStr(r.sec / 60 / r.km) + ' /km' : ''}${r.hr ? ' · ♥ ' + r.hr : ''}${r.elev ? ' · ↗ ' + r.elev + ' m' : ''} · ${r.kcal} kcal</small><small>${r.src === 'strava' ? '🧡' : '📄'} ${esc(r.name || 'Lauf')}</small></span></li>`;
  const connectedCard = `
    <article class="card st-card rise">
      <div class="st-top"><span class="st-ok">${ico('check')}</span><div><b>Mit Strava verbunden${athlete ? ' · ' + esc(athlete) : ''}</b><small>Zuletzt abgeglichen: ${s.last ? when(s.last) : 'noch nie'}</small></div></div>
      <button class="btn wide tap" data-act="strava-sync">${ico('shuffle')}Jetzt Läufe holen</button>
      <label class="switch-row tap"><span>Beim Öffnen der App automatisch holen</span><input type="checkbox" data-st-auto${s.auto !== false ? ' checked' : ''}><i class="sw"></i></label>
      <button class="link tap st-off" data-act="strava-off">Verbindung trennen</button>
    </article>
    <h2 class="sec rise">Eingelesene Läufe</h2>
    ${runs.length ? `<article class="card rise"><ul class="srun">${runs.map(runLi).join('')}</ul></article>` : '<article class="card rise"><p class="empty sm">Noch keine Läufe eingelesen. Tippe oben auf „Jetzt Läufe holen“.</p></article>'}`;
  const setupCard = `
    <article class="card rise">
      <h3 class="c-h">${ico('run', 'xs')} Einmalig verbinden <small>· ca. 3 Minuten</small></h3>
      <ol class="steps sm">
        <li><span class="st-n">1</span><span>Strava-Einstellungen öffnen und dich anmelden.<br><button class="btn sm ghost tap" data-act="strava-open-api">${ico('chev')}strava.com/settings/api</button></span></li>
        <li><span class="st-n">2</span><span>Dort eine <b>Anwendung anlegen</b>: Name z. B. „You By What You Eat“, Kategorie „Training“, Website <b>https://localhost</b>. Wichtig bei <b>Autorisierungs-Callback-Domain</b>: <button class="chip tap" data-act="strava-copy" data-v="localhost">localhost ${ico('copy', 'xs')}</button></span></li>
        <li><span class="st-n">3</span><span>Danach zeigt Strava <b>Client-ID</b> (Zahl) und <b>Client-Secret</b> (lange Buchstaben/Zahlen). Hier eintragen:</span></li>
      </ol>
      <label class="field"><span>Client-ID</span><input id="st-cid" inputmode="numeric" autocomplete="off" value="${esc(s.cid || '')}" placeholder="z. B. 123456"></label>
      <label class="field"><span>Client-Secret</span><input id="st-sec" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(s.secret || '')}" placeholder="40 Zeichen"></label>
      <button class="btn big wide tap" data-act="strava-connect">${ico('run')}Mit Strava verbinden</button>
      <p class="fine">Strava öffnet sich, dort <b>„Autorisieren“</b> tippen – danach landest du automatisch wieder hier.</p>
      <details class="st-manual"><summary class="tap">Klappt die Rückkehr nicht? Manuell verbinden</summary>
        <ol class="steps sm">
          <li><span class="st-n">1</span><span>Freigabe im Browser öffnen und <b>Autorisieren</b> tippen.<br><button class="btn sm ghost tap" data-act="strava-manual">${ico('chev')}Im Browser öffnen</button></span></li>
          <li><span class="st-n">2</span><span>Danach zeigt der Browser eine Fehlerseite („Seite nicht erreichbar“) – das ist normal. Kopiere die <b>Adresse oben</b> (sie enthält <b>code=…</b>) und füge sie hier ein:</span></li>
        </ol>
        <textarea id="st-paste" class="ta" rows="3" placeholder="http://localhost/exchange_token?state=&code=…"></textarea>
        <button class="btn ghost wide tap" data-act="strava-redeem">${ico('check')}Code einlösen</button>
      </details>
    </article>`;
  const host = online ? new URL(SO.soc().url).host : '';
  const serverCard = !online ? `<article class="card rise"><h3 class="c-h">${ico('run', 'xs')} Erst anmelden</h3><p class="rc-desc">Melde dich zuerst unter <b>Freunde</b> an – dann kannst du Strava mit einem Tipp verbinden.</p><button class="btn wide tap" data-go="#/freunde">Zu „Freunde“</button></article>`
    : srv.enabled ? `<article class="card rise"><h3 class="c-h">${ico('run', 'xs')} Mit Strava verbinden</h3>
      <ol class="steps sm"><li><span class="st-n">1</span><span>Auf den Knopf tippen.</span></li><li><span class="st-n">2</span><span>Bei Strava auf <b>„Autorisieren“</b> tippen.</span></li><li><span class="st-n">3</span><span>Danach auf <b>„Zurück zur App“</b> – fertig. Deine Läufe kommen dann von allein.</span></li></ol>
      <button class="btn big wide tap" data-act="strava-connect-srv">${ico('run')}Mit Strava verbinden</button></article>`
    : `<article class="card rise"><h3 class="c-h">${ico('info', 'xs')} Strava ist noch nicht freigeschaltet</h3><p class="rc-desc">${owner ? 'Trag unten die Strava-Schlüssel ein.' : 'Der Besitzer des Servers muss Strava erst einrichten. Sag ihm Bescheid.'}</p></article>`;
  const ownerCard = owner ? `<details class="st-manual rise"${srv.enabled ? '' : ' open'}><summary class="tap">Strava für alle einrichten (nur Besitzer)</summary>
      <ol class="steps sm"><li><span class="st-n">1</span><span>Auf strava.com/settings/api eine <b>Anwendung anlegen</b>.<br><button class="btn sm ghost tap" data-act="strava-open-api">${ico('chev')}strava.com/settings/api</button></span></li>
      <li><span class="st-n">2</span><span>Bei <b>Autorisierungs-Callback-Domain</b> genau das eintragen: <button class="chip tap" data-act="strava-copy" data-v="${esc(host)}">${esc(host)} ${ico('copy', 'xs')}</button></span></li>
      <li><span class="st-n">3</span><span>Client-ID und Client-Secret hier eintragen:</span></li></ol>
      <label class="field"><span>Client-ID</span><input id="sv-cid" inputmode="numeric" autocomplete="off" placeholder="z. B. 123456"></label>
      <label class="field"><span>Client-Secret</span><input id="sv-sec" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="40 Zeichen"></label>
      <button class="btn wide tap" data-act="strava-save-srv">${ico('check')}Speichern</button>
      <p class="fine">⚠️ Eine neue Strava-App darf zuerst nur <b>1 Person</b> verbinden (dich). Damit auch deine Freunde sich verbinden können, musst du bei Strava einmal eine Erhöhung beantragen (Prüfung dauert ca. 1 Woche).<br><button class="link tap" data-act="strava-limit-info">So beantragst du das</button></p></details>` : '';
  return { mount: () => { Strava.refreshServer().then(ch => { if (ch && current() === '#/strava') refresh(); }); }, html: `
  <div class="page detail">
    ${dhead('Strava', 'Läufe nach dem Laufen einlesen')}
    <section class="info-hero rise" style="--h:20"><span class="ih-emo float">🧡</span><h1>Strava</h1><p>${on ? 'Deine Läufe kommen automatisch in die App.' : 'Lauf aufzeichnen, App öffnen, fertig – Strecke, Zeit, Puls und Kalorien kommen von Strava.'}</p></section>
    ${on ? connectedCard : (useServer ? serverCard : setupCard)}
    ${useServer ? ownerCard : ''}
    <article class="card rise">
      <h3 class="c-h">${ico('copy', 'xs')} Datei einlesen</h3>
      <p class="lede">Geht auch <b>ohne Strava-Zugang</b>: Eine <b>GPX- oder TCX-Datei</b> eines Laufs auswählen – von Strava (im Browser: Aktivität → ⋯ → GPX exportieren), von deiner Uhr oder einer anderen Lauf-App.</p>
      <button class="btn ghost wide tap" data-act="strava-file">${ico('image')}Datei auswählen</button>
      <input id="st-file" type="file" hidden>
    </article>
    <button class="list-row tap rise" data-go="#/info/strava"><span class="lr-ico">${ico('info')}</span><span><b>Wie funktioniert das genau?</b><small>Datenschutz, Grenzen, Tipps</small></span>${ico('chev')}</button>
    <p class="about rise">Läufe von Strava (nur Lesezugriff) · Powered by Strava</p>
  </div>` };
}

/* Vorschau, bevor ein Lauf aus einer Datei gespeichert wird */
export function runImportHTML(r, warn) {
  const bits = [r.sec && r.km ? 'Ø ' + paceStr(r.sec / 60 / r.km) + ' /km' : '', r.hr ? '♥ ' + r.hr : '', r.elev ? '↗ ' + r.elev + ' m' : ''].filter(Boolean).join(' · ');
  const t = r.start.slice(11, 16);
  return `<h2 class="sh-t">Lauf einlesen?</h2><p class="sh-sub">${relDay(r.date)}, ${dLabel(r.date)} · ${t} Uhr${r.name ? ' · ' + esc(r.name) : ''}</p>
    <div class="stats3 lg"><span>${ico('run')}<b>${lit(r.km)} km</b></span><span>${ico('clock')}<b>${r.min} Min</b></span><span>${ico('fire')}<b>${r.kcal} kcal</b></span></div>
    <p class="fine">${bits}</p>
    ${warn ? `<p class="warn-line">⚠️ ${esc(warn)}. Trotzdem als Lauf speichern?</p>` : ''}
    <div class="sh-btns"><button class="btn ghost tap" data-close>Abbrechen</button><button class="btn tap" id="imp-yes">${ico('check')}Speichern</button></div>`;
}
