/* Alle Bildschirme der App */
import { ING, DISHES, SLOTS, STORES, CATS, W_REST, W_TRAIN } from './data.js';
import { S } from './store.js';
import * as E from './engine.js';
import { ico, esc, ring } from './ui.js';
import { isNative } from './native.js';

const { fmtInt, dec, eur, lit, DAYS, DS, MONTHS } = E;
export const ui = { day: null, amt: 'pp', review: null, drink: null, ob: 0, shopFrom: null };

/* ---------- kleine Bausteine ---------- */
const dhead = (title, sub = '') => `<header class="dhead"><button class="iconbtn tap" data-act="back" aria-label="Zurück">${ico('back')}</button><div class="dhead-t"><b>${title}</b>${sub ? '<small>' + sub + '</small>' : ''}</div><span class="dhead-s"></span></header>`;
const emo = (d, cls = '') => `<span class="emo ${cls}" style="--h:${d.hue || 140}">${d.emoji}</span>`;
const stars = (v, cls = '') => { if (v == null) return ''; let h = '<span class="stars-mini ' + cls + '" aria-label="' + dec(v, 1) + ' Sterne">'; for (let i = 1; i <= 5; i++) h += '<i class="' + (v >= i - 0.25 ? 'on' : v >= i - 0.75 ? 'half' : '') + '">★</i>'; return h + '</span>'; };
const tag = (price, l1, l2) => `<span class="ptag"><span class="ptag-p">${dec(price)}</span><span class="ptag-u">€ ${l1}</span>${l2 ? '<span class="ptag-g">' + l2 + '</span>' : ''}</span>`;
const storeDot = id => `<i class="sdot" style="--c:${(STORES[id] || STORES.sonst).color}"></i>`;
const storeName = id => (STORES[id] || STORES.sonst).name;
const dLabel = k => { const d = E.dateOf(k); return d.getDate() + '. ' + MONTHS[d.getMonth()]; };
const relDay = k => { const n = E.daysBetween(E.todayKey(), k); return n === 0 ? 'Heute' : n === 1 ? 'Morgen' : n === -1 ? 'Gestern' : DAYS[E.wd(k)]; };
const slotLabel = { f: 'Früh', m: 'Mittag', s: 'Jause', a: 'Abend' };
const slotTime = { f: '07:00', m: '12:30', s: '16:00', a: '19:00' };
const pct = (a, b) => Math.max(0, Math.min(100, b ? a / b * 100 : 0)).toFixed(1) + '%';

function greeting() { const h = new Date().getHours(); return h < 11 ? 'Guten Morgen' : h < 14 ? 'Mahlzeit' : h < 18 ? 'Schönen Nachmittag' : 'Guten Abend'; }

/* =========================================================
   HEUTE
   ========================================================= */
export function heute() {
  E.ensurePlan();
  const t = E.todayKey();
  if (!ui.day || E.daysBetween(t, ui.day) < -2 || E.daysBetween(t, ui.day) > 6) ui.day = t;
  const k = ui.day, p = S.plan[k];
  const T = E.targets(), tot = E.dayTotals(k);
  const isToday = k === t;
  const log = S.log[k] || {};
  const name = S.profile.name ? ', ' + esc(S.profile.name) : '';

  let days = '';
  for (let i = -2; i <= 6; i++) {
    const dk = E.addDays(t, i);
    if (!S.plan[dk]) continue;
    const L = S.log[dk] || {};
    const rated = ['f', 'm', 's', 'a'].some(sl => E.ratingOf(S.plan[dk][sl], dk, sl) != null);
    days += `<button class="day tap${dk === k ? ' on' : ''}${dk === t ? ' today' : ''}" data-act="day" data-k="${dk}"><small>${DS[E.wd(dk)]}</small><b>${E.dateOf(dk).getDate()}</b><i class="ddot${L.cooked || rated ? ' done' : ''}${S.plan[dk].train ? ' tr' : ''}"></i></button>`;
  }

  const meals = p ? SLOTS.map((s, i) => mealCard(k, s.k, p, log)).join('') : '';
  const a = p && DISHES[p.a];
  const cost = a ? E.dishCost(p.a) : null;
  const why = a ? E.whyDish(p.a, k) : [];
  const ratePrompt = isToday && new Date().getHours() >= 18 || E.daysBetween(k, t) > 0;
  const unrated = p && E.ratingOf(p.a, k, 'a') == null;
  const W = waterCard(k);
  const promos = topPromos(3);

  return { html: `
  <div class="page">
    <header class="top rise">
      <div class="top-t">
        <p class="kicker">${greeting()}${name} · ${dLabel(t)}</p>
        <h1 class="brand">You By <span>What You Eat</span></h1>
      </div>
      <button class="avatar tap" data-go="#/ich" aria-label="Profil">${S.profile.name ? esc(S.profile.name[0].toUpperCase()) : ico('user')}</button>
    </header>

    <nav class="days rise" aria-label="Tag wählen">${days}</nav>

    <article class="card hero rise">
      <div class="hero-head">
        <div><p class="kicker">${relDay(k)} · ${DAYS[E.wd(k)]}</p><h2 class="h-day">${isToday ? 'Dein Tag' : relDay(k)}</h2></div>
        <button class="flag ${p && p.train ? 'flag-train' : 'flag-rest'} tap" data-go="#/info/training">${ico(p && p.train ? 'dumbbell' : 'leaf')}${p && p.train ? 'Trainingstag' : 'Ruhetag'}</button>
      </div>
      <div class="hero-body">
        <button class="ring-wrap tap" data-go="#/info/kcal" aria-label="Kalorien erklärt">
          ${ring(tot.kcal / T.kcal, 128, 12, 'ring-kcal')}
          <span class="ring-c"><b data-count="${tot.kcal}">0</b><small>von ${fmtInt(T.kcal)} kcal</small></span>
        </button>
        <div class="hero-tiles">
          <button class="mini tap" data-go="#/info/eiweiss">${ico('muscle')}<span><b data-count="${tot.prot}" data-suf=" g">0</b><small>Eiweiß · Ziel ${T.prot} g</small></span></button>
          <button class="mini tap" data-go="#/info/kosten">${ico('euro')}<span><b data-count="${tot.eur}" data-dec="2" data-suf=" €">0</b><small>pro Person</small></span></button>
          <button class="mini tap" data-go="#/info/abwechslung">${ico('spark')}<span><b>${E.varietyScore(t).distinct}</b><small>Gerichte diese Woche</small></span></button>
        </div>
      </div>
      ${isToday ? `<button class="eaten tap" data-act="rate-open" data-k="${k}"><span>Heute gegessen</span><span class="bar"><i data-w="${pct(tot.eaten, T.kcal)}"></i></span><b>${fmtInt(tot.eaten)} kcal</b></button>` : ''}
    </article>

    ${a ? `
    <article class="card cook rise" style="--h:${a.hue}">
      <div class="cook-glow"></div>
      <div class="cook-top">
        <p class="kicker">${isToday ? 'Heute Abend kochen' : DAYS[E.wd(k)] + 'abend kochen'}${log.cooked ? ' · <span class="ok">gekocht ✓</span>' : ''}</p>
        <button class="iconbtn sm tap" data-act="reroll" data-slot="a" aria-label="Anderes Gericht">${ico('shuffle')}</button>
      </div>
      <button class="cook-main tap" data-go="#/dish/${p.a}?d=${k}&s=a">
        <span class="cook-emo float">${a.emoji}</span>
        <span class="cook-txt"><b class="cook-name">${esc(a.name)}</b><small>≈ ${a.min} Min · ${fmtInt(a.kcal)} kcal · ${a.prot} g Eiweiß</small>${stars(E.avgRating(p.a))}</span>
      </button>
      <button class="portions tap" data-go="#/info/box">
        <span class="p-g">${ico('plate').repeat(Math.min(S.profile.persons, 4))}<small>${S.profile.persons} Teller jetzt</small></span>
        <span class="p-g box">${ico('box').repeat(Math.min(S.profile.persons, 4))}<small>${S.profile.persons} ${S.profile.persons === 1 ? 'Box' : 'Boxen'} → ${DAYS[E.wd(E.addDays(k, 1))]} Mittag</small></span>
      </button>
      ${why.length ? '<div class="why">' + why.slice(0, 3).map(w => '<span class="chip-s">' + esc(w) + '</span>').join('') + '</div>' : ''}
      <div class="cook-actions">
        <button class="btn tap" data-go="#/dish/${p.a}?d=${k}&s=a">${ico('book')}Rezept</button>
        <button class="btn ghost tap${log.cooked ? ' on' : ''}" data-act="cooked" data-k="${k}">${ico('check')}${log.cooked ? 'Gekocht' : 'Hab gekocht'}</button>
        ${tag(cost.portion, 'pro<br>Portion', 'Topf ' + eur(cost.total * E.potFactor()))}
      </div>
    </article>` : ''}

    ${p && (ratePrompt || unrated && E.daysBetween(k, t) > 0) ? `
    <article class="card rate-card rise">
      <div><p class="kicker">${isToday ? 'Schon gegessen?' : relDay(k) + ' bewerten'}</p><h3>Wie war ${esc(a.name)}?</h3></div>
      <div class="rate-inline">${[1, 2, 3, 4, 5].map(i => `<button class="star tap${(E.ratingOf(p.a, k, 'a') || 0) >= i ? ' on' : ''}" data-act="quick-rate" data-k="${k}" data-v="${i}" aria-label="${i} Sterne">★</button>`).join('')}</div>
      <button class="link tap" data-act="rate-open" data-k="${k}">Alle Mahlzeiten bewerten →</button>
    </article>` : ''}

    <div class="sec-h rise"><h2>Tagesplan</h2><div class="seg" role="group"><button class="tap${ui.amt === 'pp' ? ' on' : ''}" data-act="amt" data-v="pp">pro Person</button><button class="tap${ui.amt === 'all' ? ' on' : ''}" data-act="amt" data-v="all">für ${S.profile.persons}</button></div></div>
    <ol class="meals">${meals}</ol>

    ${W}

    ${promos.length ? `<article class="card promo-card rise">
      <div class="row-b"><h3 class="c-t">${ico('tag')}Gerade in Aktion</h3><button class="link tap" data-go="#/promos">Alle →</button></div>
      ${promos.map(pr => `<button class="promo-row tap" data-go="#/ing/${pr.ing}">${storeDot(pr.store)}<span><b>${esc(ING[pr.ing].name)}</b><small>${storeName(pr.store)} · seit ${dLabel(pr.d)}</small></span><em>${pr.pct ? '−' + pr.pct + ' %' : eur(pr.price)}</em></button>`).join('')}
    </article>` : `<button class="card hint-card rise tap" data-go="#/bon"><span class="hint-ico">${ico('scan')}</span><span><b>Kassenbon scannen</b><small>Dann lernt die App die Preise und Aktionen deines Supermarkts.</small></span>${ico('chev')}</button>`}
  </div>` };
}

function mealCard(k, sl, p, log) {
  const id = p[sl], d = DISHES[id]; if (!d) return '';
  const c = E.dishCost(id);
  const eaten = log.eaten && log.eaten[sl];
  const r = E.ratingOf(id, k, sl);
  let amt;
  const per = S.profile.persons;
  if (sl === 'm' && p.mBox) amt = (ui.amt === 'all' ? per + ' Boxen' : '1 Box') + ' vom Vorabend · 2–3 Min aufwärmen';
  else if (sl === 'a') amt = ui.amt === 'all' ? '1 Topf = ' + (per * 2) + ' Portionen: ' + per + ' Teller + ' + per + ' Boxen' : '1 Portion · Rest in Boxen für morgen';
  else amt = Object.entries(d.need).map(([ing, a]) => E.fmtIng(ing, a * (ui.amt === 'all' ? per : 1))).join(' · ');
  const flags = (sl === 'm' && p.mBox ? '<span class="flag flag-box">Box</span>' : '') + (sl === 'a' ? '<span class="flag flag-cook">kochen</span>' : '') + (sl === 'f' ? '<span class="flag flag-small">klein</span>' : '') + (d.train && p.train ? '<span class="flag flag-train">nach Training</span>' : '');
  return `<li class="meal rise${eaten ? ' eaten' : ''}">
    <button class="meal-main tap" data-go="#/dish/${id}?d=${k}&s=${sl}">
      ${emo(d)}
      <span class="m-body"><span class="m-top"><span class="m-slot">${slotLabel[sl]} · ${slotTime[sl]}</span>${flags}</span>
      <b class="m-name">${esc(d.name)}</b>
      <span class="m-amt">${amt}</span>
      <span class="m-meta">${fmtInt(d.kcal)} kcal · ${d.prot} g Eiweiß · ${eur(c.portion)}${r != null ? ' · ' + stars(r) : ''}</span></span>
    </button>
    <button class="eat tap${eaten ? ' on' : ''}" data-act="eat" data-k="${k}" data-slot="${sl}" aria-label="${eaten ? 'gegessen' : 'als gegessen markieren'}">${ico('check')}</button>
  </li>`;
}

function waterGoal(k) { const T = E.targets(); const L = S.log[k] || {}; const mode = L.waterMode || ((S.plan[k] || {}).train ? 'train' : 'rest'); return { mode, glasses: Math.round((T.water + (mode === 'train' ? 1 : 0)) / 0.25) }; }
function waterCard(k) {
  const L = S.log[k] || {}, n = L.water || 0, g = waterGoal(k);
  let gl = '';
  for (let i = 0; i < g.glasses; i++) gl += `<button class="glass tap${i < n ? ' full' : ''}" data-act="glass" data-k="${k}" data-i="${i}" aria-label="Glas ${i + 1}"><svg viewBox="0 0 24 30"><defs><clipPath id="gc${i}"><path d="M5 4h14l-1.6 21a2 2 0 0 1-2 1.9H8.6a2 2 0 0 1-2-1.9z"/></clipPath></defs><g clip-path="url(#gc${i})"><rect class="gw" x="0" y="0" width="24" height="30"/></g><path d="M5 4h14l-1.6 21a2 2 0 0 1-2 1.9H8.6a2 2 0 0 1-2-1.9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>`;
  return `<article class="card water rise">
    <div class="row-b"><button class="w-title tap" data-go="#/trinken">${ico('drop')}Wasser ${k === E.todayKey() ? 'heute' : ''} ${ico('chev', 'sm')}</button>
      <div class="seg"><button class="tap${g.mode === 'rest' ? ' on' : ''}" data-act="wmode" data-k="${k}" data-v="rest">Ruhetag</button><button class="tap${g.mode === 'train' ? ' on' : ''}" data-act="wmode" data-k="${k}" data-v="train">Training</button></div></div>
    <div class="w-amount"><b>${lit(n * 0.25)}</b><span>von ${lit(g.glasses * 0.25)} L</span></div>
    <div class="meter water-m"><i data-w="${pct(n, g.glasses)}"></i></div>
    <div class="glasses">${gl}</div>
    <div class="w-actions"><button class="btn ghost sm tap" data-act="water" data-k="${k}" data-v="-1">${ico('minus')}Glas</button><button class="btn sm tap" data-act="water" data-k="${k}" data-v="1">${ico('plus')}Glas (0,25 L)</button></div>
  </article>`;
}

function topPromos(n) {
  const L = E.learned().info, out = [];
  for (const [ing, per] of Object.entries(L)) for (const [store, x] of Object.entries(per)) if (x.promoNow) out.push({ ing, store, d: x.promoNow.d, pct: x.promoNow.pct, price: x.promoNow.per });
  return out.sort((a, b) => b.d < a.d ? -1 : 1).slice(0, n);
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
  const blocked = E.isBlocked(id);
  const low = E.lowCount(id);
  const ing = Object.entries(d.need).map(([ig, a]) => {
    const row = c.rows.find(r => r.ing === ig);
    return `<li class="tap" data-go="#/ing/${ig}"><span class="q">${E.fmtAmount(ig, a * fac)}</span><span class="n">${esc(ING[ig].name)}${row.p.promo ? ' <span class="flag flag-promo">Aktion</span>' : ''}</span><span class="c">${row.p.src === 'bon' ? storeDot(row.p.store) : '≈'}${dec(row.cost * fac * (isPot ? 1 : 1))}</span></li>`;
  }).join('');
  const hist = rs.slice(-8).map(r => `<span class="hdot" title="${r.d}">${r.st}★</span>`).join('');
  return { html: `
  <div class="page detail">
    ${dhead(slotLabel[sl] || 'Gericht', k ? relDay(k) + ', ' + dLabel(k) : '')}
    <section class="dish-hero rise" style="--h:${d.hue}">
      <div class="dh-bg"></div>
      <span class="dh-emo float">${d.emoji}</span>
      <h1 class="dh-name">${esc(d.name)}</h1>
      <div class="dh-chips">
        <button class="chip tap" data-go="#/info/zeit">${ico('clock')}${d.min} Min</button>
        <button class="chip tap" data-go="#/info/kcal">${ico('fire')}${fmtInt(d.kcal)} kcal</button>
        <button class="chip tap" data-go="#/info/eiweiss">${ico('muscle')}${d.prot} g</button>
        <button class="chip tap" data-go="#/info/kosten">${ico('euro')}${eur(c.portion)}</button>
      </div>
      <p class="dh-sub">${isPot ? 'pro Portion · 1 Topf = ' + per * 2 + ' Portionen' : 'pro Person'}</p>
    </section>

    ${blocked ? `<article class="card warn rise">${ico('ban')}<div><b>Vorerst aussortiert</b><p>Du hast es ${low}× unter 3 Sterne bewertet – darum plant die App automatisch was anderes ein.</p><button class="btn sm tap" data-act="unblock" data-id="${id}">Doch wieder einplanen</button></div></article>` : ''}

    ${why.length ? `<article class="card rise"><h3 class="c-t">${ico('spark')}Warum ${k === E.todayKey() ? 'heute' : 'an dem Tag'}?</h3><ul class="facts">${why.map(w => '<li>' + esc(w) + '</li>').join('')}</ul></article>` : ''}

    <article class="card rise">
      <div class="row-b"><h3 class="c-t">${ico('star')}Deine Bewertung</h3><button class="link tap" data-go="#/info/sterne">Wie funktioniert das?</button></div>
      <div class="rate-big">
        <div class="rb-avg"><b>${avg != null ? dec(avg, 1) : '–'}</b>${stars(avg)}<small>${rs.length ? rs.length + '× bewertet' : 'noch nicht bewertet'}</small></div>
        ${k ? `<div class="rb-now"><small>${relDay(k)}:</small><div class="stars-row" data-id="${id}" data-k="${k}" data-slot="${sl}">${starRow(E.ratingOf(id, k, sl))}</div></div>` : ''}
      </div>
      ${hist ? '<div class="hist">' + hist + '</div>' : ''}
      ${low === 1 && !blocked ? '<p class="fine">1× unter 3 Sternen – noch einmal, dann kommt es automatisch nicht mehr.</p>' : ''}
    </article>

    <article class="card rise">
      <div class="row-b"><h3 class="c-t">${ico('cart')}Zutaten</h3><div class="seg"><button class="tap${ui.amt === 'pp' ? ' on' : ''}" data-act="amt" data-v="pp">${isPot ? '1 Portion' : '1 Person'}</button><button class="tap${ui.amt === 'all' ? ' on' : ''}" data-act="amt" data-v="all">${isPot ? 'ganzer Topf' : 'für ' + per}</button></div></div>
      <ul class="ing">${ing}</ul>
      ${d.extra ? '<p class="fine">Dazu: ' + esc(d.extra) + '</p>' : ''}
      <div class="cost-sum"><span>Kosten ${isPot ? (ui.amt === 'all' ? 'Topf' : 'Portion') : (ui.amt === 'all' ? 'für ' + per : 'pro Person')}</span><b>${eur((isPot ? c.total : c.portion) * fac)}</b></div>
      <p class="fine">${c.learnedShare > 0 ? Math.round(c.learnedShare * 100) + ' % der Preise von deinen Kassenbons' : '≈ geschätzte Preise – scanne Bons, dann wird’s genau'} · tippe auf eine Zutat für Details</p>
    </article>

    <article class="card rise">
      <h3 class="c-t">${ico('pot')}So geht’s <small class="hint">tippen zum Abhaken</small></h3>
      <ol class="steps">${d.steps.map((s, i) => `<li class="tap" data-act="step"><span class="st-n">${i + 1}</span><span>${esc(s)}</span></li>`).join('')}</ol>
      <p class="tip"><b>Tipp:</b> ${esc(d.tip)}</p>
    </article>

    <div class="actions-row rise">
      ${k && S.plan[k] && (sl !== 'm' || !S.plan[k].mBox) ? `<button class="btn ghost tap" data-act="reroll" data-slot="${sl}" data-k="${k}" data-back="1">${ico('shuffle')}Anderes Gericht</button>` : ''}
      ${!blocked ? `<button class="btn ghost tap" data-act="block" data-id="${id}">${ico('ban')}Nie mehr planen</button>` : ''}
    </div>
  </div>` };
}
export function starRow(v) {
  let h = `<button class="star zero tap${v === 0 ? ' on' : ''}" data-act="star" data-v="0" aria-label="0 Sterne">0</button>`;
  for (let i = 1; i <= 5; i++) h += `<button class="star tap${v != null && v >= i ? ' on' : ''}" data-act="star" data-v="${i}" aria-label="${i} Sterne">★</button>`;
  return h;
}

/* Bewertungs-Sheet (aus Benachrichtigung oder Heute) */
export function rateSheetHTML(k) {
  const p = S.plan[k]; if (!p) return '<p>Kein Plan für diesen Tag.</p>';
  const L = S.log[k] || {};
  return `<h2 class="sh-t">${relDay(k)}: Wie war’s?</h2>
  <p class="sh-sub">0–5 Sterne. Bekommt ein Gericht öfter unter 3, plant die App automatisch was anderes.</p>
  <label class="switch-row tap"><span>${ico('pot')}Gekocht</span><input type="checkbox" data-act="cooked-cb" data-k="${k}"${L.cooked ? ' checked' : ''}><i class="sw"></i></label>
  ${['a', 'm', 'f', 's'].map(sl => { const d = DISHES[p[sl]]; if (!d) return ''; const eaten = L.eaten && L.eaten[sl]; return `
  <div class="rate-item">
    ${emo(d, 'sm')}
    <div class="ri-b"><small>${slotLabel[sl]}${sl === 'm' && p.mBox ? ' · Box' : ''}</small><b>${esc(d.name)}</b>
      <div class="stars-row" data-id="${p[sl]}" data-k="${k}" data-slot="${sl}">${starRow(E.ratingOf(p[sl], k, sl))}</div></div>
    <button class="eat tap${eaten ? ' on' : ''}" data-act="eat" data-k="${k}" data-slot="${sl}" aria-label="gegessen">${ico('check')}</button>
  </div>`; }).join('')}
  <button class="btn wide tap" data-close>Fertig</button>`;
}

/* =========================================================
   INFO-SEITEN – „tippen und genauer erklärt bekommen“
   ========================================================= */
export function info(topic) {
  const T = E.targets(), P = S.profile, t = E.todayKey(), k = ui.day || t;
  const tot = E.dayTotals(k), p = S.plan[k];
  const G = (title, emoji, hue, body) => ({ html: `<div class="page detail">${dhead('Erklärt', '')}<section class="info-hero rise" style="--h:${hue}"><span class="ih-emo float">${emoji}</span><h1>${title}</h1></section>${body}</div>` });
  const mealsBars = (field, unit, target) => p ? `<article class="card rise"><h3 class="c-t">${relDay(k)} – pro Mahlzeit</h3>${['f', 'm', 's', 'a'].map(sl => { const d = DISHES[p[sl]]; const v = field === 'eur' ? E.dishCost(p[sl]).portion : d[field]; const max = field === 'eur' ? 2.5 : field === 'kcal' ? 1100 : 50; return `<button class="bar-row tap" data-go="#/dish/${p[sl]}?d=${k}&s=${sl}"><span class="br-l">${d.emoji} ${slotLabel[sl]}</span><span class="br-t"><i data-w="${pct(v, max)}"></i></span><b>${field === 'eur' ? eur(v) : fmtInt(v) + unit}</b></button>`; }).join('')}
      <div class="cost-sum"><span>Summe</span><b>${field === 'eur' ? eur(tot.eur) : fmtInt(tot[field]) + unit}${target ? ' / ' + fmtInt(target) + unit : ''}</b></div></article>` : '';

  switch (topic) {
    case 'kcal': {
      const diff = T.kcal - tot.kcal;
      return G('Kalorien', '🔥', 18, `
      <article class="card rise"><p class="lede">Kalorien (kcal) sind die Energie aus dem Essen. Dein Körper braucht sie fürs Leben, Bewegen und – bei deinem Ziel – zum Aufbauen von Muskeln.</p>
        <div class="big-num"><b data-count="${T.kcal}">0</b><span>kcal pro Tag – dein Ziel</span></div></article>
      <article class="card rise"><h3 class="c-t">So wird gerechnet</h3>
        <div class="calc">
          <div><span>Grundumsatz</span><small>10 × ${P.weight} kg + 6,25 × ${P.height} cm − 5 × ${P.age || '25*'} J. ${P.sex === 'w' ? '− 161' : P.sex === 'm' ? '+ 5' : '− 78'}</small><b>${fmtInt(T.bmr)}</b></div>
          <div><span>× Aktivität</span><small>${(P.train || []).length} Trainingstage pro Woche</small><b>× ${dec(T.pal, 2)}</b></div>
          <div><span>= Verbrauch</span><small>was du am Tag ungefähr verbrennst</small><b>${fmtInt(T.tdee)}</b></div>
          <div><span>${T.goal.add >= 0 ? '+' : '−'} Ziel: ${T.goal.name}</span><small>${esc(T.goal.desc)}</small><b>${T.goal.add >= 0 ? '+' : '−'} ${Math.abs(T.goal.add)}</b></div>
          <div class="calc-sum"><span>Dein Tagesziel</span><b>${fmtInt(T.kcal)} kcal</b></div>
        </div>
        ${T.estimatedAge || T.estimatedSex ? `<p class="fine">* ${T.estimatedAge ? 'Alter' : ''}${T.estimatedAge && T.estimatedSex ? ' und ' : ''}${T.estimatedSex ? 'Geschlecht' : ''} geschätzt – <button class="link tap" data-go="#/profile">im Profil eintragen</button> für genauere Werte.</p>` : ''}
      </article>
      ${mealsBars('kcal', ' kcal', T.kcal)}
      <article class="card rise"><h3 class="c-t">${diff > 150 ? 'Dir fehlen heute ≈ ' + fmtInt(diff) + ' kcal' : diff < -250 ? 'Heute etwas über dem Ziel' : 'Passt ziemlich genau'}</h3>
        <ul class="facts">${diff > 150 ? '<li>+ 1 großes Glas Milch (0,3 L) ≈ +190 kcal</li><li>+ 1 Banane ≈ +110 kcal</li><li>+ 1 EL Erdnussbutter aufs Brot ≈ +90 kcal</li><li>Beim Abendessen einfach etwas mehr Reis/Nudeln nehmen</li>' : diff < -250 ? '<li>Kein Stress – über die Woche gleicht sich das aus.</li><li>Bei der Jause eine kleinere Portion nehmen.</li>' : '<li>Weiter so – genau so baust du langsam und sauber auf.</li>'}
        <li>In der Früh bewusst wenig – der Rest ist auf Mittag, Jause und Abend verteilt.</li></ul></article>`);
    }
    case 'eiweiss':
      return G('Eiweiß', '💪', 150, `
      <article class="card rise"><p class="lede">Eiweiß (Protein) ist der Baustoff für deine Muskeln. Ohne genug Eiweiß bringt auch das beste Training wenig.</p>
        <div class="big-num"><b data-count="${T.prot}" data-suf=" g">0</b><span>pro Tag = ${dec(T.goal.protein, 1)} g × ${P.weight} kg</span></div></article>
      ${mealsBars('prot', ' g', T.prot)}
      <article class="card rise"><h3 class="c-t">Gute, billige Eiweiß-Quellen</h3><ul class="facts">
        <li><b>Magertopfen</b> – 250 g ≈ 30 g Eiweiß für ≈ 1 €</li><li><b>Eier</b> – 1 Ei ≈ 6,5 g</li><li><b>Rote Linsen</b> – 100 g trocken ≈ 24 g</li><li><b>Thunfisch natur</b> – 1 Dose ≈ 19 g</li><li><b>Milch</b> – 0,5 L ≈ 17 g</li><li><b>Hendl/Pute</b> – 100 g ≈ 23 g</li></ul>
        <p class="fine">Verteilt über den Tag ist besser als alles auf einmal: jede Mahlzeit 20–40 g.</p></article>`);
    case 'kosten': {
      const wk = []; for (let i = 0; i < 7; i++) wk.push(E.dayTotals(E.addDays(t, i)).eur);
      const sum = wk.reduce((s, x) => s + x, 0);
      const nb = S.receipts.length;
      return G('Kosten', '💶', 48, `
      <article class="card rise"><p class="lede">Alle Preise sind <b>pro Person</b>. Gerechnet wird mit dem ${S.profile.priceMode === 'cheapest' ? 'günstigsten Markt, den die App von deinen Bons kennt' : 'Stamm-Markt ' + storeName(S.profile.priceMode)} – und wo noch kein Bon da ist, mit geschätzten Diskont-Preisen (≈).</p>
        <div class="big-num"><b data-count="${sum}" data-dec="2" data-suf=" €">0</b><span>pro Person für die nächsten 7 Tage · alle ${S.profile.persons}: ${eur(sum * S.profile.persons)}</span></div></article>
      ${mealsBars('eur', '', 0)}
      <article class="card rise"><h3 class="c-t">Wie die App Preise lernt</h3><ul class="facts">
        <li>Du fotografierst den Kassenbon → die App liest jede Zeile.</li><li>Artikel werden Zutaten zugeordnet (z. B. „S-BUDGET VOLLMILCH“ → Milch).</li><li>Rabatte und „Aktion −25 %“ werden erkannt und gemerkt.</li><li>Pro Markt entsteht ein Normalpreis – und die App erkennt, wie oft etwas in Aktion ist.</li></ul>
        <p class="fine">${nb ? nb + ' Bon' + (nb > 1 ? 's' : '') + ' gescannt.' : 'Noch kein Bon gescannt.'}</p>
        <button class="btn tap" data-go="#/bon">${ico('scan')}Bon scannen</button></article>`);
    }
    case 'bmi': {
      const b = E.bmi();
      const pos = Math.max(0, Math.min(100, (b - 15) / 20 * 100));
      return G('BMI', '⚖️', 200, `
      <article class="card rise"><div class="big-num"><b data-count="${b}" data-dec="1">0</b><span>${E.bmiLabel(b)} · ${P.height} cm, ${P.weight} kg</span></div>
        <div class="bmi-scale"><i style="left:${pos}%"></i><span>15</span><span>18,5</span><span>25</span><span>30</span><span>35</span></div>
        <p class="lede">BMI = Gewicht ÷ (Größe in m)² = ${P.weight} ÷ ${dec(P.height / 100, 2)}² = ${dec(b, 1)}.</p></article>
      <article class="card rise"><h3 class="c-t">Was heißt das für dich?</h3><ul class="facts">
        <li>Bei ${P.height} cm liegt Normalgewicht zwischen ${dec(18.5 * Math.pow(P.height / 100, 2), 0)} und ${dec(25 * Math.pow(P.height / 100, 2), 0)} kg.</li>
        <li>Mit ${P.weight} kg bist du mitten drin – ideal, um sauber Muskeln aufzubauen.</li>
        <li>Der BMI kennt keine Muskeln: Bei viel Training ist er nur ein grober Richtwert.</li>
        <li>Wiege dich 1× pro Woche in der Früh nach dem Klo – immer unter gleichen Bedingungen.</li></ul>
        <button class="btn tap" data-go="#/weight">${ico('scale')}Gewicht eintragen</button></article>`);
    }
    case 'training':
      return G('Trainingstag', '🏋️', 210, `
      <article class="card rise"><p class="lede">An Trainingstagen brauchst du mehr Energie, mehr Eiweiß und mehr Wasser. Die App plant darum automatisch anders.</p></article>
      <article class="card rise"><h3 class="c-t">Was sich ändert</h3><ul class="facts">
        <li><b>Masse-Shake</b> als Jause – innerhalb 1–2 h nach dem Training.</li><li><b>+1 L Wasser</b> – das Ziel im Wasser-Zähler geht hoch.</li><li>Abendgerichte mit viel Eiweiß werden bevorzugt.</li></ul></article>
      <article class="card rise"><h3 class="c-t">Deine Trainingstage</h3><div class="chips">${DS.map((d, i) => `<span class="chip${(P.train || []).includes(i) ? ' on' : ''}">${d}</span>`).join('')}</div><button class="btn ghost tap" data-go="#/profile">${ico('edit')}Ändern</button></article>`);
    case 'box':
      return G('Einmal kochen, zweimal essen', '🍱', 160, `
      <article class="card rise"><p class="lede">Jeden Abend kochst du einen Topf mit doppelter Menge: Die Hälfte wird gleich gegessen, die andere Hälfte kommt in Boxen – das ist morgen dein Mittagessen.</p></article>
      <article class="card rise"><div class="box-demo"><div>${ico('pot')}<small>1 Topf</small></div><span>→</span><div>${ico('plate')}<small>${S.profile.persons}× jetzt</small></div><span>+</span><div>${ico('box')}<small>${S.profile.persons}× morgen</small></div></div>
      <ul class="facts"><li>Spart Zeit: nur 1× pro Tag kochen.</li><li>Spart Geld: große Packungen, nix wird schlecht.</li><li><b>Wichtig:</b> Boxen abkühlen lassen und innerhalb von 2 Stunden in den Kühlschrank. Mittags 2–3 Min in die Mikrowelle.</li><li>Nudeln und Sauce getrennt einpacken – sonst werden sie matschig.</li></ul></article>`);
    case 'abwechslung': {
      const v = E.varietyScore(t);
      return G('Abwechslung', '🌈', 280, `
      <article class="card rise"><div class="big-num"><b data-count="${v.distinct}">0</b><span>verschiedene Gerichte in den nächsten 7 Tagen (von ${v.slots} Mahlzeiten)</span></div>
        <div class="meter"><i data-w="${(v.pct * 100).toFixed(0)}%"></i></div></article>
      <article class="card rise"><h3 class="c-t">So sorgt die App für Abwechslung</h3><ul class="facts">
        <li>Ein Abendgericht kommt frühestens nach 8 Tagen wieder.</li><li>Nicht 2 Tage hintereinander dieselbe Beilage (Reis, Nudeln, Erdäpfel) oder dasselbe Fleisch.</li><li>Gerichte, die du noch nie hattest, werden bevorzugt.</li><li>Frühstück wechselt täglich – 9 kleine Varianten.</li><li>Gut bewertete Gerichte kommen öfter, schlecht bewertete fliegen raus.</li><li>Was gerade in Aktion ist, kommt eher auf den Plan.</li></ul>
        <button class="btn ghost tap" data-act="shuffle">${ico('shuffle')}Restliche Woche neu mischen</button></article>`);
    }
    case 'sterne':
      return G('Sterne & Austausch', '⭐', 45, `
      <article class="card rise"><p class="lede">Nach dem Essen fragt dich die App per Benachrichtigung, wie es war. Du gibst 0 bis 5 Sterne.</p></article>
      <article class="card rise"><h3 class="c-t">Was passiert mit den Sternen?</h3><ul class="facts">
        <li><b>4–5 ★</b> – das Gericht kommt öfter dran.</li><li><b>3 ★</b> – bleibt normal im Plan.</li><li><b>0–2 ★</b> – wird gemerkt. Passiert das <b>2× oder öfter</b>, wird das Gericht automatisch aussortiert und durch ein anderes ersetzt.</li><li>Aussortierte Gerichte kannst du in „Meine Bewertungen“ jederzeit zurückholen.</li></ul>
        <button class="btn tap" data-go="#/ratings">${ico('star')}Meine Bewertungen</button></article>`);
    case 'fruehstueck':
      return G('Kleines Frühstück', '🌅', 38, `
      <article class="card rise"><p class="lede">In der Früh geht bei euch wenig rein – darum ist das Frühstück bewusst klein (≈ 230–440 kcal). Der Rest kommt über den Tag.</p></article>
      <article class="card rise"><h3 class="c-t">Tricks, wenn nix reingeht</h3><ul class="facts"><li><b>Trinken statt kauen:</b> Smoothie oder Kakao geht oft leichter.</li><li><b>Warm statt kalt:</b> Porridge oder Kakao.</li><li><b>Kleine Schüssel</b> – wirkt weniger.</li><li><b>Aufteilen:</b> halbe Portion um 7, halbe um 10.</li><li>Erst 1 Glas Wasser, 15 Min später essen.</li></ul></article>`);
    case 'zeit':
      return G('Zubereitungszeit', '⏱️', 190, `<article class="card rise"><p class="lede">Die Minuten sind die ungefähre Gesamtzeit inkl. Kochen. Aufwändige Gerichte (über 1 Stunde) plant die App nur am Wochenende ein.</p></article>`);
    case 'aktionen':
      return G('Preise & Aktionen lernen', '🏷️', 100, `
      <article class="card rise"><p class="lede">Jeder gescannte Kassenbon macht die App schlauer: Sie merkt sich, was wo wie viel kostet und wann etwas in Aktion ist.</p></article>
      <article class="card rise"><h3 class="c-t">Was die App daraus macht</h3><ul class="facts"><li><b>Echte Kosten</b> für jedes Gericht und die Einkaufsliste.</li><li><b>Markt-Vergleich:</b> wo dein Wocheneinkauf am günstigsten ist.</li><li><b>Aktionen nutzen:</b> Ist Faschiertes in Aktion, kommt eher Chili oder Burrito-Bowl auf den Plan.</li><li><b>Aktions-Rhythmus:</b> nach ein paar Bons schätzt die App, wann etwas wieder billiger wird.</li></ul>
        <p class="fine">Alles bleibt auf deinem Handy – die Texterkennung läuft offline.</p>
        <button class="btn tap" data-go="#/bon">${ico('scan')}Bon scannen</button></article>`);
    default: return notFound();
  }
}

/* =========================================================
   WOCHE
   ========================================================= */
export function woche() {
  E.ensurePlan();
  const t = E.todayKey(), T = E.targets();
  const days = []; for (let i = 0; i < 7; i++) days.push(E.addDays(t, i));
  const tots = days.map(E.dayTotals);
  const avgK = tots.reduce((s, x) => s + x.kcal, 0) / 7, avgP = tots.reduce((s, x) => s + x.prot, 0) / 7, sumE = tots.reduce((s, x) => s + x.eur, 0);
  const v = E.varietyScore(t);
  const max = Math.max(T.kcal * 1.15, ...tots.map(x => x.kcal));
  return { html: `
  <div class="page">
    <header class="ptitle rise"><p class="kicker">${dLabel(days[0])} – ${dLabel(days[6])}</p><h1>Deine Woche</h1></header>
    <div class="tiles4">
      <button class="tile tap rise" data-go="#/info/kcal">${ico('fire')}<b data-count="${avgK}">0</b><small>Ø kcal / Tag</small></button>
      <button class="tile tap rise" data-go="#/info/eiweiss">${ico('muscle')}<b data-count="${avgP}" data-suf=" g">0</b><small>Ø Eiweiß / Tag</small></button>
      <button class="tile tap rise" data-go="#/info/kosten">${ico('euro')}<b data-count="${sumE}" data-dec="2" data-suf=" €">0</b><small>pro Person / Woche</small></button>
      <button class="tile tap rise" data-go="#/info/abwechslung">${ico('spark')}<b data-count="${v.distinct}">0</b><small>verschiedene Gerichte</small></button>
    </div>
    <article class="card rise">
      <h3 class="c-t">Kalorien pro Tag</h3>
      <div class="chart">
        <i class="target" style="bottom:${(T.kcal / max * 100).toFixed(1)}%"><span>Ziel ${fmtInt(T.kcal)}</span></i>
        ${tots.map((x, i) => `<button class="col tap${i === 0 ? ' today' : ''}" data-act="day" data-k="${days[i]}" data-tab="1"><span class="cv">${fmtInt(x.kcal / 100) / 10}k</span><span class="cb"><i data-h="${(x.kcal / max * 100).toFixed(1)}%"></i></span><small>${DS[E.wd(days[i])]}</small></button>`).join('')}
      </div>
    </article>
    ${days.map((k, i) => { const p = S.plan[k]; return `
    <article class="card wday rise${i === 0 ? ' is-today' : ''}">
      <button class="wd-h tap" data-act="day" data-k="${k}" data-tab="1"><b>${relDay(k)}</b><small>${DAYS[E.wd(k)]}, ${dLabel(k)}</small>${p.train ? '<span class="flag flag-train">Training</span>' : ''}<span class="mini-n">${fmtInt(tots[i].kcal)} kcal · ${eur(tots[i].eur)}</span></button>
      <div class="wd-meals">${['f', 'm', 's', 'a'].map(sl => { const d = DISHES[p[sl]]; return `<button class="wm tap" data-go="#/dish/${p[sl]}?d=${k}&s=${sl}">${emo(d, 'xs')}<span><small>${slotLabel[sl]}</small>${esc(d.name)}</span></button>`; }).join('')}</div>
    </article>`; }).join('')}
    <button class="btn ghost wide rise tap" data-act="shuffle">${ico('shuffle')}Ab morgen neu mischen</button>
  </div>` };
}

/* =========================================================
   KASSENBON
   ========================================================= */
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
    <header class="ptitle rise"><p class="kicker">Preise lernen</p><h1>Kassenbon</h1></header>
    <article class="card scan-hero rise">
      <div class="paper-anim" aria-hidden="true"><div class="paper"><i></i><i></i><i></i><i class="s"></i><i></i><i class="s"></i><i></i></div><div class="beam"></div></div>
      <h2>Nach jedem Einkauf: Bon scannen</h2>
      <p>Die App liest Artikel, Preise und Aktionen – und gewöhnt sich an die Preise deines Supermarkts.</p>
      ${isNative ? `<div class="scan-btns"><button class="btn big tap" data-act="scan" data-src="camera">${ico('camera')}Foto machen</button><button class="btn ghost big tap" data-act="scan" data-src="gallery">${ico('image')}Aus Galerie</button></div>
      <p class="fine">Tipp: Bon flach hinlegen, gutes Licht, ganzer Bon im Bild. Lange Bons in 2 Fotos.</p>` :
      `<textarea id="bon-text" class="ta" rows="5" placeholder="Bon-Text hier einfügen (im Browser ohne Kamera-Texterkennung)"></textarea>
      <div class="scan-btns"><button class="btn tap" data-act="scan-text">${ico('scan')}Text auswerten</button><button class="btn ghost tap" data-act="scan-demo">Beispiel-Bon</button></div>`}
    </article>
    <div class="tiles4">
      <button class="tile tap rise" data-go="#/info/aktionen">${ico('scan')}<b data-count="${S.receipts.length}">0</b><small>Bons</small></button>
      <button class="tile tap rise" data-go="#/info/aktionen">${ico('tag')}<b data-count="${nPrices}">0</b><small>Preise gelernt</small></button>
      <button class="tile tap rise" data-go="#/promos">${ico('spark')}<b data-count="${nPromo}">0</b><small>Aktionen erkannt</small></button>
      <button class="tile tap rise" data-go="#/info/kosten">${ico('store')}<b data-count="${Object.keys(stores).length}">0</b><small>Märkte</small></button>
    </div>
    ${Object.keys(stores).length ? `<h2 class="sec rise">Deine Märkte</h2><div class="hscroll rise">${Object.entries(stores).map(([id, s]) => `<button class="store-card tap" data-go="#/store/${id}" style="--c:${(STORES[id] || STORES.sonst).color}"><b>${storeName(id)}</b><small>${s.n} Bon${s.n > 1 ? 's' : ''} · Ø ${eur(s.sum / s.n)}</small><small>zuletzt ${dLabel(s.last)}</small></button>`).join('')}</div>` : ''}
    ${promos.length ? `<h2 class="sec rise">Gerade in Aktion</h2><article class="card rise">${promos.map(pr => `<button class="promo-row tap" data-go="#/ing/${pr.ing}">${storeDot(pr.store)}<span><b>${esc(ING[pr.ing].name)}</b><small>${storeName(pr.store)} · ${dLabel(pr.d)}</small></span><em>${pr.pct ? '−' + pr.pct + ' %' : eur(pr.price)}</em></button>`).join('')}</article>` : ''}
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
      <h3 class="c-t">${ico('store')}Markt</h3>
      <div class="chips">${Object.entries(STORES).map(([id, s]) => `<button class="chip tap${R.store === id ? ' on' : ''}" data-act="rv-store" data-v="${id}" style="--c:${s.color}">${storeDot(id)}${s.name}</button>`).join('')}</div>
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
    const cheapest = others.every(([, o]) => x.regular <= o.regular + 0.005);
    return { ing, x, cheapest: others.length > 0 && cheapest };
  }).sort((a, b) => ING[a.ing].name.localeCompare(ING[b.ing].name));
  const other = Object.entries(L.other[id] || {}).slice(0, 30);
  const spent = rs.reduce((s, r) => s + (r.total || r.items.reduce((a, i) => a + i.price - (i.disc || 0), 0)), 0);
  return { html: `
  <div class="page detail">
    ${dhead(st.name, rs.length + ' Bons')}
    <section class="store-hero rise" style="--c:${st.color}"><b>${st.name}</b><span>${eur(spent)} insgesamt · Ø ${eur(rs.length ? spent / rs.length : 0)} pro Einkauf</span></section>
    ${rows.filter(r => r.cheapest).length ? `<article class="card rise"><h3 class="c-t">${ico('spark')}Hier am günstigsten</h3><div class="chips">${rows.filter(r => r.cheapest).map(r => `<button class="chip tap" data-go="#/ing/${r.ing}">${esc(ING[r.ing].name)}</button>`).join('')}</div></article>` : ''}
    <article class="card rise"><h3 class="c-t">${ico('tag')}Gelernte Preise</h3>
      ${rows.length ? rows.map(r => `<button class="price-row tap" data-go="#/ing/${r.ing}"><span><b>${esc(ING[r.ing].name)}</b><small>${r.x.n}× gekauft${r.x.promoN ? ' · ' + r.x.promoN + '× Aktion' : ''}${r.x.rhythm ? ' · Aktion ca. alle ' + r.x.rhythm.every + ' Tage' : ''}</small></span><em>${r.x.promoNow ? '<span class="flag flag-promo">Aktion</span>' : ''}${eur(r.x.regular ?? r.x.eff)}</em></button>`).join('') : '<p class="fine">Noch keine Zutaten erkannt.</p>'}
      <p class="fine">Preise je Packung (${'z. B. Milch 1 L, Reis 1 kg'}).</p></article>
    ${other.length ? `<article class="card rise"><h3 class="c-t">Weitere Artikel von deinen Bons</h3>${other.map(([n, l]) => `<div class="price-row"><span><b>${esc(n)}</b><small>${l.length}× gekauft${l.some(x => x.promo) ? ' · auch in Aktion' : ''}</small></span><em>${eur(l[l.length - 1].price)}</em></div>`).join('')}</article>` : ''}
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
  const packTxt = g.unit === 'stk' ? g.pack + ' Stk' : (g.pack < 1 ? fmtInt(g.pack * 1000) + (g.unit === 'kg' ? ' g' : ' ml') : lit(g.pack) + (g.unit === 'kg' ? ' kg' : ' L'));
  return { html: `
  <div class="page detail">
    ${dhead(esc(g.name), g.cat)}
    <article class="card rise"><div class="big-num"><b>${eur(p.price)}</b><span>je ${packTxt} · ${p.src === 'bon' ? 'günstigster bekannter Preis: ' + storeName(p.store) + (p.promo ? ' (Aktion)' : '') : 'geschätzt – noch auf keinem Bon'}</span></div></article>
    <article class="card rise"><h3 class="c-t">${ico('store')}Preis je Markt</h3>
      ${Object.keys(per).length ? Object.entries(per).map(([s, x]) => `<div class="bar-row"><span class="br-l">${storeDot(s)}${storeName(s)}</span><span class="br-t"><i data-w="${pct(x.regular ?? x.eff, max)}" style="--c:${(STORES[s] || STORES.sonst).color}"></i></span><b>${eur(x.regular ?? x.eff)}</b></div>${x.promoNow ? `<p class="fine promo-l">${ico('tag')}gerade in Aktion: ${eur(x.promoNow.per)}${x.promoNow.pct ? ' (−' + x.promoNow.pct + ' %)' : ''} seit ${dLabel(x.promoNow.d)}</p>` : ''}${x.rhythm ? `<p class="fine">Aktion bei ${storeName(s)} etwa alle ${x.rhythm.every} Tage – nächste vermutlich um den ${dLabel(x.rhythm.next)}.</p>` : ''}`).join('') : '<p class="fine">Noch keine Daten. Sobald der Artikel auf einem gescannten Bon steht, siehst du hier die Preise je Markt.</p>'}
      <div class="bar-row base"><span class="br-l">≈ Schätzung</span><span class="br-t"><i data-w="${pct(g.base, max)}"></i></span><b>${eur(g.base)}</b></div>
    </article>
    ${hist.length ? `<article class="card rise"><h3 class="c-t">${ico('clock')}Verlauf</h3>${hist.map(o => `<div class="price-row"><span><b>${dLabel(o.d)} · ${storeName(o.s)}</b><small>${esc(o.name || '')}</small></span><em>${o.promo ? '<span class="flag flag-promo">' + (o.pct ? '−' + o.pct + ' %' : 'Aktion') + '</span>' : ''}${eur(o.per)}</em></div>`).join('')}</article>` : ''}
    <article class="card rise"><h3 class="c-t">${ico('pot')}Steckt in</h3><div class="chips">${used.map(([did, d]) => `<button class="chip tap" data-go="#/dish/${did}">${d.emoji} ${esc(d.name)}</button>`).join('') || '<span class="fine">–</span>'}</div></article>
  </div>` };
}

export function promos() {
  const L = E.learned().info, now = [], rhythm = [];
  for (const [ing, per] of Object.entries(L)) for (const [s, x] of Object.entries(per)) {
    if (x.promoNow) now.push({ ing, s, x });
    if (x.rhythm) rhythm.push({ ing, s, x });
  }
  rhythm.sort((a, b) => a.x.rhythm.next < b.x.rhythm.next ? -1 : 1);
  return { html: `
  <div class="page detail">
    ${dhead('Aktionen')}
    <article class="card rise"><h3 class="c-t">${ico('tag')}Gerade in Aktion (letzte 7 Tage)</h3>${now.length ? now.map(n => `<button class="promo-row tap" data-go="#/ing/${n.ing}">${storeDot(n.s)}<span><b>${esc(ING[n.ing].name)}</b><small>${storeName(n.s)} · ${dLabel(n.x.promoNow.d)} · normal ${eur(n.x.regular ?? n.x.promoNow.reg)}</small></span><em>${eur(n.x.promoNow.per)}</em></button>`).join('') : '<p class="fine">Keine aktuellen Aktionen erkannt. Scanne deinen nächsten Bon!</p>'}</article>
    <article class="card rise"><h3 class="c-t">${ico('clock')}Aktions-Rhythmus</h3>${rhythm.length ? rhythm.map(n => `<button class="promo-row tap" data-go="#/ing/${n.ing}">${storeDot(n.s)}<span><b>${esc(ING[n.ing].name)}</b><small>${storeName(n.s)} · ca. alle ${n.x.rhythm.every} Tage</small></span><em>~${dLabel(n.x.rhythm.next)}</em></button>`).join('') : '<p class="fine">Braucht mindestens 2 Aktionen desselben Artikels im selben Markt. Je mehr Bons, desto besser die Vorhersage.</p>'}</article>
  </div>` };
}

/* =========================================================
   EINKAUF
   ========================================================= */
export function einkauf() {
  E.ensurePlan();
  const t = E.todayKey();
  if (!ui.shopFrom || ui.shopFrom < t) ui.shopFrom = t;
  const from = ui.shopFrom;
  const L = E.shoppingList(from, 7);
  const wk = 'w' + from;
  const checked = new Set(S.shop[wk] || []);
  const groups = CATS.map(c => ({ c, items: L.items.filter(i => ING[i.ing].cat === c) })).filter(g => g.items.length);
  const n = L.items.filter(i => checked.has(i.ing)).length;
  const maxC = L.compare.length ? Math.max(...L.compare.map(c => c.sum)) : 1;
  return { html: `
  <div class="page">
    <header class="ptitle rise"><p class="kicker">${relDay(from)} + 6 Tage · ${S.profile.persons} Personen</p><h1>Einkauf</h1></header>
    <div class="seg wide rise"><button class="tap${from === t ? ' on' : ''}" data-act="shop-from" data-v="0">ab heute</button><button class="tap${from === E.addDays(t, 1) ? ' on' : ''}" data-act="shop-from" data-v="1">ab morgen</button></div>
    ${L.compare.length ? `<article class="card rise"><h3 class="c-t">${ico('store')}Wo am günstigsten?</h3>${L.compare.map((c, i) => `<button class="bar-row tap" data-go="#/store/${c.store}"><span class="br-l">${storeDot(c.store)}${storeName(c.store)}${i === 0 ? ' 🏆' : ''}</span><span class="br-t"><i data-w="${pct(c.sum, maxC)}" style="--c:${(STORES[c.store] || STORES.sonst).color}"></i></span><b>${eur(c.sum)}</b></button>`).join('')}<p class="fine">Gerechnet mit deinen Bon-Preisen; fehlende Artikel mit Schätzpreis. Bekannt: ${L.compare.map(c => storeName(c.store) + ' ' + c.known + '/' + c.of).join(' · ')}</p></article>`
      : `<button class="card hint-card rise tap" data-go="#/bon"><span class="hint-ico">${ico('scan')}</span><span><b>Preise noch geschätzt</b><small>Scanne nach dem Einkauf den Bon – dann siehst du hier, welcher Markt am günstigsten ist.</small></span>${ico('chev')}</button>`}
    <div class="card shop-prog rise"><span>${n === L.items.length ? 'Alles im Wagerl! 🎉' : n + ' / ' + L.items.length + ' im Wagerl'}</span><div class="meter green"><i data-w="${pct(n, L.items.length)}"></i></div></div>
    <div class="receipt rise">
      <div class="rc-head"><span>WOCHENEINKAUF</span><span>${S.profile.persons} PERS.</span></div>
      <div class="rc-sub">✓ = Preis von deinem Bon · ≈ = geschätzt</div>
      ${groups.map(g => `<h3 class="rc-g">${g.c}</h3>${g.items.map(it => { const G = ING[it.ing]; const on = checked.has(it.ing); return `
        <div class="rc-item${on ? ' done' : ''}"><button class="rc-cb tap${on ? ' on' : ''}" data-act="shop-check" data-id="${it.ing}" aria-label="abhaken">${ico('check')}</button>
        <button class="rc-txt tap" data-go="#/ing/${it.ing}"><span class="rc-name">${esc(G.name)}${it.price.promo ? ' <span class="flag flag-promo">Aktion</span>' : ''}</span><span class="rc-pack">${it.loose ? '≈ ' + E.lit(it.loose) + ' kg lose' : it.packs + ' × ' + (G.unit === 'stk' ? G.pack + ' Stk' : G.pack < 1 ? fmtInt(G.pack * 1000) + (G.unit === 'kg' ? ' g' : ' ml') : lit(G.pack) + (G.unit === 'kg' ? ' kg' : ' L'))} · brauchst ${E.fmtAmount(it.ing, it.amt).replace(/ \(.*\)/, '')}${G.pantry ? ' · Vorrat?' : ''}${it.price.src === 'bon' ? ' · ' + storeName(it.price.store) : ''}</span></button>
        <span class="rc-price">${it.price.src === 'bon' ? '✓' : '≈'}${dec(it.cost)}</span></div>`; }).join('')}`).join('')}
      <div class="rc-total"><span>SUMME</span><span>${eur(L.total)}</span></div>
      <div class="rc-line"><span>davon Verbrauch diese Woche</span><span>${dec(L.use)}</span></div>
      <div class="rc-line strong"><span>= pro Person</span><span>${dec(L.use / S.profile.persons)}</span></div>
      <div class="rc-foot">Vorrat (Öl, Mehl, Zucker …) nur kaufen, wenn aus.<br>DANKE FÜR IHREN EINKAUF</div>
    </div>
    <button class="btn ghost wide tap rise" data-act="shop-reset">Häkchen zurücksetzen</button>
  </div>` };
}

/* =========================================================
   ICH / PROFIL & EINSTELLUNGEN
   ========================================================= */
export function ich() {
  const P = S.profile, T = E.targets(), b = E.bmi();
  const nRated = Object.keys(S.ratings).length, nBlocked = Object.keys(S.blocked).length;
  const row = (go, icon, title, sub, act) => `<button class="list-row tap rise" ${act ? 'data-act="' + act + '"' : 'data-go="' + go + '"'}><span class="lr-ico">${ico(icon)}</span><span><b>${title}</b><small>${sub}</small></span>${ico('chev')}</button>`;
  return { html: `
  <div class="page">
    <header class="ptitle rise"><p class="kicker">Profil & Einstellungen</p><h1>Ich</h1></header>
    <article class="card me rise">
      <span class="me-av">${P.name ? esc(P.name[0].toUpperCase()) : '🙂'}</span>
      <div><b>${P.name ? esc(P.name) : 'Du'}</b><small>${P.height} cm · ${P.weight} kg${P.age ? ' · ' + P.age + ' J.' : ''}</small></div>
      <div class="me-chips"><button class="chip tap" data-go="#/info/bmi">BMI ${dec(b, 1)}</button><button class="chip tap" data-go="#/info/kcal">${fmtInt(T.kcal)} kcal</button><button class="chip tap" data-go="#/info/eiweiss">${T.prot} g Eiweiß</button></div>
    </article>
    <div class="list">
      ${row('#/profile', 'user', 'Profil & Ziel', T.goal.name + ' · ' + P.persons + ' Personen · ' + (P.train || []).map(i => DS[i]).join(', '))}
      ${row('#/notif', 'bell', 'Erinnerungen', 'Kochen, Essen bewerten, Trinken, Einkauf')}
      ${row('#/ratings', 'star', 'Meine Bewertungen', nRated + ' Gerichte bewertet' + (nBlocked ? ' · ' + nBlocked + ' aussortiert' : ''))}
      ${row('#/rezepte', 'book', 'Alle Rezepte', Object.keys(DISHES).length + ' Gerichte')}
      ${row('#/trinken', 'drop', 'Trinkplan', 'Ruhetag ≈ ' + lit(T.water) + ' L · Training ≈ ' + lit(T.water + 1) + ' L')}
      ${row('#/weight', 'scale', 'Gewicht', S.weights.length ? 'zuletzt ' + lit(S.weights[S.weights.length - 1].kg) + ' kg' : '1× pro Woche eintragen')}
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
    <p class="about rise">You By What You Eat · Version 1.0.0<br>Alle Daten bleiben auf deinem Handy.</p>
  </div>` };
}

export function profile() {
  const P = S.profile;
  const stores = [...new Set(S.receipts.map(r => r.store))];
  return { html: `
  <div class="page detail">
    ${dhead('Profil & Ziel')}
    <article class="card rise">
      <label class="field"><span>Name (optional)</span><input data-p="name" value="${esc(P.name)}" placeholder="z. B. Max" autocomplete="off"></label>
      <div class="field-2"><label class="field"><span>Größe (cm)</span><input data-p="height" type="number" inputmode="numeric" value="${P.height}"></label>
      <label class="field"><span>Gewicht (kg)</span><input data-p="weight" type="text" inputmode="decimal" value="${String(P.weight).replace('.', ',')}"></label></div>
      <label class="field"><span>Alter</span><input data-p="age" type="number" inputmode="numeric" value="${P.age || ''}" placeholder="für genauere kcal"></label>
      <span class="flabel">Geschlecht (für die Kalorien-Formel)</span>
      <div class="chips">${[['m', 'Mann'], ['w', 'Frau'], ['', 'keine Angabe']].map(([v, l]) => `<button class="chip tap${(P.sex || '') === v ? ' on' : ''}" data-act="pset" data-k="sex" data-v="${v}">${l}</button>`).join('')}</div>
    </article>
    <article class="card rise"><h3 class="c-t">Ziel</h3>
      <div class="goal-list">${Object.entries(E.GOALS).map(([v, g]) => `<button class="goal tap${P.goal === v ? ' on' : ''}" data-act="pset" data-k="goal" data-v="${v}"><b>${g.name}</b><small>${esc(g.desc)}</small></button>`).join('')}</div></article>
    <article class="card rise"><h3 class="c-t">Haushalt</h3>
      <div class="stepper"><button class="iconbtn tap" data-act="persons" data-v="-1">${ico('minus')}</button><b>${P.persons} ${P.persons === 1 ? 'Person' : 'Personen'}</b><button class="iconbtn tap" data-act="persons" data-v="1">${ico('plus')}</button></div>
      <p class="fine">Die Topf-Mengen und die Einkaufsliste werden automatisch angepasst.</p></article>
    <article class="card rise"><h3 class="c-t">Trainingstage</h3>
      <div class="chips">${DS.map((d, i) => `<button class="chip tap${(P.train || []).includes(i) ? ' on' : ''}" data-act="train" data-v="${i}">${d}</button>`).join('')}</div>
      <p class="fine">An diesen Tagen: Shake als Jause, mehr Wasser, mehr Eiweiß.</p></article>
    <article class="card rise"><h3 class="c-t">Preise rechnen mit</h3>
      <div class="chips"><button class="chip tap${P.priceMode === 'cheapest' ? ' on' : ''}" data-act="pset" data-k="priceMode" data-v="cheapest">günstigstem Markt</button>${stores.map(s => `<button class="chip tap${P.priceMode === s ? ' on' : ''}" data-act="pset" data-k="priceMode" data-v="${s}">${storeDot(s)}${storeName(s)}</button>`).join('')}</div>
      ${!stores.length ? '<p class="fine">Sobald du Bons gescannt hast, kannst du hier deinen Stamm-Markt wählen.</p>' : ''}</article>
  </div>` };
}

export function notif(perm) {
  const N = S.notif;
  const row = (key, icon, title, sub) => `<div class="nrow rise"><span class="lr-ico">${ico(icon)}</span><span class="nr-t"><b>${title}</b><small>${sub}</small></span>
    <input type="time" data-n="${key}" value="${(N[key].t || '').split(',')[0]}" ${N[key].on ? '' : 'disabled'}>
    <label class="switch"><input type="checkbox" data-nt="${key}"${N[key].on ? ' checked' : ''}><i class="sw"></i></label></div>`;
  return { html: `
  <div class="page detail">
    ${dhead('Erinnerungen')}
    <article class="card rise perm ${perm === 'granted' || perm === 'browser' ? 'ok' : ''}">${ico('bell')}<div><b>${perm === 'granted' ? 'Benachrichtigungen sind an' : perm === 'browser' ? 'Im Browser keine Benachrichtigungen' : 'Benachrichtigungen sind aus'}</b><p>${perm === 'granted' ? 'Die App erinnert dich zu den Zeiten unten – mit dem Gericht des Tages.' : perm === 'browser' ? 'In der installierten App funktioniert das.' : 'Erlaube Benachrichtigungen, damit dich die App ans Kochen und Bewerten erinnert.'}</p>
      ${perm !== 'granted' && perm !== 'browser' ? `<button class="btn sm tap" data-act="notif-ask">Erlauben</button>` : ''}</div></article>
    <div class="list">
      ${row('f', 'sun', 'Frühstück', 'Kleiner Start in den Tag')}
      ${row('cook', 'pot', 'Kochen', '„Zeit zum Kochen – hast du schon angefangen?“')}
      ${row('rate', 'star', 'Essen bewerten', '„Schon gegessen? Wie war’s?“ – 0–5 Sterne')}
      ${row('water', 'drop', 'Trinken', 'Vormittag + Nachmittag')}
      ${row('shop', 'cart', 'Einkaufstag', DAYS[N.shop.day] + ' – danach Bon scannen')}
    </div>
    <article class="card rise"><h3 class="c-t">Einkaufstag</h3><div class="chips">${DS.map((d, i) => `<button class="chip tap${N.shop.day === i ? ' on' : ''}" data-act="shopday" data-v="${i}">${d}</button>`).join('')}</div></article>
    <button class="btn ghost wide tap rise" data-act="notif-test">${ico('bell')}Test-Benachrichtigung (in 5 Sek.)</button>
  </div>` };
}

export function ratings() {
  const rated = Object.keys(S.ratings).filter(id => DISHES[id] && S.ratings[id].length).map(id => ({ id, avg: E.avgRating(id), n: S.ratings[id].length })).sort((a, b) => b.avg - a.avg);
  const blocked = Object.keys(S.blocked).filter(id => DISHES[id]);
  return { html: `
  <div class="page detail">
    ${dhead('Meine Bewertungen')}
    ${blocked.length ? `<h2 class="sec rise">Aussortiert</h2>${blocked.map(id => `<div class="card rrow rise">${emo(DISHES[id], 'sm')}<button class="tap rr-b" data-go="#/dish/${id}"><b>${esc(DISHES[id].name)}</b><small>${S.blocked[id].auto ? 'automatisch – öfter unter 3 ★' : 'von dir aussortiert'} · seit ${dLabel(S.blocked[id].since)}</small></button><button class="btn sm ghost tap" data-act="unblock" data-id="${id}">Zurückholen</button></div>`).join('')}` : ''}
    <h2 class="sec rise">Bewertet</h2>
    ${rated.length ? rated.map(r => `<button class="card rrow tap rise" data-go="#/dish/${r.id}">${emo(DISHES[r.id], 'sm')}<span class="rr-b"><b>${esc(DISHES[r.id].name)}</b><small>${r.n}× bewertet</small></span><span class="rr-s">${stars(r.avg)}<b>${dec(r.avg, 1)}</b></span></button>`).join('') : '<p class="empty rise">Noch nichts bewertet. Nach dem Essen kommt eine Erinnerung – oder tippe bei „Heute“ auf die Sterne.</p>'}
    <button class="btn ghost wide tap rise" data-go="#/info/sterne">${ico('info')}Wie funktioniert das?</button>
  </div>` };
}

export function rezepte(filter) {
  const f = filter || 'alle';
  const list = Object.entries(DISHES).filter(([, d]) => f === 'alle' || (f === 'veggie' ? d.protein === 'veggie' || (d.slot !== 'a' && !Object.keys(d.need).some(i => ING[i].cat === 'Fleisch & Fisch')) : d.slot === f));
  return { html: `
  <div class="page detail">
    ${dhead('Alle Rezepte', list.length + ' Gerichte')}
    <div class="chips rise">${[['alle', 'Alle'], ['f', 'Frühstück'], ['s', 'Jause'], ['a', 'Abendtopf'], ['veggie', 'Ohne Fleisch']].map(([v, l]) => `<button class="chip tap${f === v ? ' on' : ''}" data-act="rz-filter" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="grid">${list.map(([id, d]) => `<button class="rz-card tap rise${E.isBlocked(id) ? ' blocked' : ''}" data-go="#/dish/${id}" style="--h:${d.hue}"><span class="rz-emo">${d.emoji}</span><b>${esc(d.name)}</b><small>${d.min} Min · ${fmtInt(d.kcal)} kcal · ${eur(E.dishCost(id).portion)}</small>${stars(E.avgRating(id))}</button>`).join('')}</div>
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
    <div class="seg wide rise"><button class="tap${mode === 'rest' ? ' on' : ''}" data-act="drink" data-v="rest">Ruhetag</button><button class="tap${mode === 'train' ? ' on' : ''}" data-act="drink" data-v="train">Trainingstag</button></div>
    <article class="card rise"><ol class="drink-list">${list.map(x => `<li class="drink${x.tr ? ' tr' : ''}"><span class="d-time">${x.t}</span><span class="d-what">${x.what}<span class="d-bar"><i data-w="${(x.l / 0.6 * 100).toFixed(0)}%"></i></span></span><b>${lit(x.l)} L</b></li>`).join('')}</ol>
      <div class="cost-sum"><span>Gesamt</span><b>≈ ${lit(Math.round(sum * 10) / 10)} L</b></div>
      <p class="fine">Dein persönliches Ziel: ≈ 35 ml pro kg = ${lit(T.water)} L, an Trainingstagen +1 L.</p></article>
    <article class="card rise"><h3 class="c-t">Faustregeln</h3><ul class="facts water">
      <li><b>Check:</b> Harn hellgelb = passt. Dunkelgelb = nachtrinken.</li><li><b>Beim Training</b> ab ca. 60 Min: alle 15–20 Min ein paar Schluck.</li><li><b>Danach:</b> pro 0,5 kg, die du beim Training verlierst, 0,6–0,75 L nachtrinken.</li><li><b>1 Stunde vorm Schlafen</b> Schluss – sonst musst du nachts raus.</li><li>Leitungswasser reicht völlig – spart Geld und Schlepperei.</li></ul></article>
  </div>` };
}

export function weight() {
  const W = S.weights, P = S.profile;
  const last = W.slice(-12);
  let spark = '';
  if (last.length >= 2) {
    const mn = Math.min(...last.map(x => x.kg)) - 0.5, mx = Math.max(...last.map(x => x.kg)) + 0.5;
    const pts = last.map((x, i) => `${(i / (last.length - 1) * 300).toFixed(1)},${(90 - (x.kg - mn) / (mx - mn) * 80).toFixed(1)}`).join(' ');
    spark = `<svg class="spark" viewBox="0 0 300 100" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  }
  let advice = 'Trag 1× pro Woche dein Gewicht ein – dann sagt dir die App, ob du mehr oder weniger essen solltest.';
  if (W.length >= 3) {
    const a = W[W.length - 3], b = W[W.length - 1], days = Math.max(1, E.daysBetween(a.d, b.d)), perWeek = (b.kg - a.kg) / days * 7;
    if (P.goal === 'muskel') advice = perWeek < 0.1 ? 'Du nimmst kaum zu (' + dec(perWeek, 2) + ' kg/Woche). Nimm abends etwas mehr Reis/Nudeln (+250 g pro Topf) oder ein Glas Milch extra.' : perWeek > 0.6 ? 'Du nimmst schnell zu (' + dec(perWeek, 2) + ' kg/Woche). Etwas kleinere Portionen bei der Jause.' : 'Perfekt: ' + dec(perWeek, 2) + ' kg pro Woche – genau im Ziel.';
    else if (P.goal === 'abnehmen') advice = perWeek > -0.2 ? 'Es geht kaum runter – Jause etwas kleiner machen.' : 'Läuft: ' + dec(perWeek, 2) + ' kg pro Woche.';
    else advice = Math.abs(perWeek) < 0.2 ? 'Gewicht stabil – passt.' : 'Gewicht ändert sich um ' + dec(perWeek, 2) + ' kg/Woche.';
  }
  return { html: `
  <div class="page detail">
    ${dhead('Gewicht')}
    <article class="card rise"><div class="big-num"><b>${lit(P.weight)} kg</b><span>aktuell · ${P.height} cm · BMI ${dec(E.bmi(), 1)}</span></div>${spark}
      <div class="w-add"><input id="w-in" type="text" inputmode="decimal" autocomplete="off" placeholder="z. B. ${lit(P.weight)}"><button class="btn tap" data-act="w-add">${ico('plus')}Eintragen</button></div></article>
    <article class="card rise"><h3 class="c-t">${ico('spark')}Einschätzung</h3><p>${advice}</p></article>
    ${W.length ? `<article class="card rise">${[...W].reverse().slice(0, 15).map(x => `<div class="price-row"><span><b>${dLabel(x.d)}</b></span><em>${lit(x.kg)} kg</em></div>`).join('')}</article>` : ''}
  </div>` };
}

/* =========================================================
   ONBOARDING
   ========================================================= */
export function onboarding() {
  const P = S.profile, s = ui.ob;
  const dots = [0, 1, 2, 3].map(i => `<i class="${i === s ? 'on' : ''}"></i>`).join('');
  let body = '';
  if (s === 0) body = `
    <div class="ob-hero"><span class="ob-e e1">🥣</span><span class="ob-e e2">🍛</span><span class="ob-e e3">🥦</span><span class="ob-e e4">🍳</span><span class="ob-e e5">🍌</span><div class="ob-plate">🍽️</div></div>
    <h1 class="ob-title">You By<br><span>What You Eat</span></h1>
    <p class="ob-p">Dein Speiseplan, der mitdenkt: kleines Frühstück, jeden Tag Abwechslung, Preise von deinem Supermarkt – und Erinnerungen ans Kochen und Bewerten.</p>
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
    <span class="flabel">Trainingstage</span>
    <div class="chips">${DS.map((d, i) => `<button class="chip tap${(P.train || []).includes(i) ? ' on' : ''}" data-act="train" data-v="${i}">${d}</button>`).join('')}</div>
    <button class="btn big wide tap" data-act="ob-next">Weiter</button>`;
  if (s === 3) body = `
    <div class="ob-bell">${ico('bell')}</div>
    <h2 class="ob-h">Erinnerungen</h2>
    <p class="ob-p">Die App fragt dich, ob du schon gekocht und gegessen hast – und wie es war (0–5 Sterne). Was öfter unter 3 Sterne bekommt, wird automatisch ersetzt.</p>
    <ul class="facts"><li>07:00 – kleines Frühstück</li><li>18:00 – Zeit zum Kochen</li><li>20:30 – Schon gegessen? Wie war’s?</li><li>${DAYS[S.notif.shop.day]} – Einkaufstag + Bon scannen</li></ul>
    <button class="btn big wide tap" data-act="ob-notif">${ico('bell')}Erinnerungen erlauben</button>
    <button class="btn ghost wide tap" data-act="ob-done">Später</button>`;
  return { html: `<div class="page ob"><div class="ob-dots">${dots}</div><div class="ob-step ob-s${s}">${body}</div></div>`, cls: 'ob-screen' };
}

function notFound() { return { html: `<div class="page detail">${dhead('Hoppla')}<p class="empty">Nicht gefunden.</p></div>` }; }
