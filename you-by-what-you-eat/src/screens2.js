/* Training 2.0: Reiter, Workout-Katalog, Übungsbibliothek, Übungsdetail, Workout-Detail, Player, Fortschritt, Pläne */
import { S } from './store.js';
import * as E from './engine.js';
import * as W from './workouts.js';
import { muscleSVG, heatSVG, MUSCLE_NAMES, MUSCLE_GROUPS } from './muscles.js';
import { ico, esc, ring } from './ui.js';

export const ui2 = { ttab: 'heute', lib: { q: '', m: '', l: 0, eq: '', type: '' }, wcat: { lvl: 0, place: '' }, play: null };
const dhead = (title, sub = '', right = '') => `<header class="dhead"><button class="iconbtn tap" data-act="back" aria-label="Zurück">${ico('back')}</button><div class="dhead-t"><b>${title}</b>${sub ? '<small>' + sub + '</small>' : ''}</div><span class="dhead-s">${right}</span></header>`;
const lit = n => String(Math.round(n * 10) / 10).replace('.', ',');
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const exImg = (e, i = 0) => e.imgs > i ? `ex/${e.id}/${i}.webp` : '';
const lvlDots = l => `<span class="lvl" style="--c:${W.LEVEL[l].c}" title="${W.LEVEL[l].n}">${[1, 2, 3, 4].map(i => `<i class="${i <= l ? 'on' : ''}"></i>`).join('')}</span>`;
const lvlBadge = l => `<span class="lvl-b" style="--c:${W.LEVEL[l].c}">${W.LEVEL[l].n}</span>`;
const TCOL = { ganzkoerper: 168, oberkoerper: 215, unterkoerper: 265, push: 22, pull: 190, po: 330, bauch: 45, arme: 0, ruecken: 140, hiit: 8, mobil: 155, beine: 280 };
const wid = w => encodeURIComponent(w.id);

/* ---------- Reiter oben im Training ---------- */
export function tabs(active) {
  const T = [['heute', 'Heute'], ['workouts', 'Workouts'], ['uebungen', 'Übungen'], ['fortschritt', 'Fortschritt']];
  return `<div class="seg wide ttabs rise">${T.map(([k, l]) => `<button class="tap${active === k ? ' on' : ''}" data-act="ttab" data-v="${k}">${l}</button>`).join('')}</div>`;
}
const head = () => `<header class="top rise"><div><p class="kicker">Kraft · Laufen · Workouts</p><h1 class="h1">Training</h1></div><button class="iconbtn tap" data-go="#/plaene" aria-label="Plan & Level">${ico('edit')}</button></header>`;

/* Karte für das heutige Krafttraining (im Reiter „Heute“) */
export function todayStrength() {
  const k = E.todayKey(), w = W.workoutOfDay(k), done = W.wlog().filter(x => x.d === k);
  const p = W.PLANS[W.activePlan()];
  if (done.length) { const d = done[done.length - 1]; return `<article class="card wk-today done rise" style="--h:${TCOL[d.type] ?? 168}"><div class="wkt-top"><span class="wkt-e">${d.e}</span><div><p class="kicker">Krafttraining erledigt ✓</p><h2>${esc(d.n)}</h2></div></div><div class="stats3"><span>${ico('clock')}<b>${d.min} Min</b></span><span>${ico('dumbbell')}<b>${d.sets.length} Sätze</b></span><span>${ico('star')}<b>+${d.pts} Pkt</b></span></div>${d.prs.length ? `<p class="pr-line">🏆 ${d.prs.length} neue${d.prs.length > 1 ? '' : 'r'} Rekord${d.prs.length > 1 ? 'e' : ''}!</p>` : ''}</article>`; }
  if (!w) return `<article class="card wk-today rest rise"><div class="wkt-top"><span class="wkt-e">${p.e}</span><div><p class="kicker">Plan: ${esc(p.n)}</p><h2>Heute kein Krafttraining</h2></div></div><p class="rc-desc">Lust auf mehr? Wähle ein Workout aus dem Katalog – 96 Einheiten für jedes Level.</p><button class="btn ghost wide tap" data-act="ttab" data-v="workouts">${ico('dumbbell')}Workouts ansehen</button></article>`;
  return `<article class="card wk-today rise" style="--h:${TCOL[w.type] ?? 168}">
    <div class="wkt-top"><span class="wkt-e">${w.e}</span><div><p class="kicker">Heute · ${esc(p.n)}</p><h2>${esc(w.n)}</h2></div>${lvlBadge(w.lvl)}</div>
    <div class="stats3"><span>${ico('clock')}<b>${w.min} Min</b></span><span>${ico('dumbbell')}<b>${w.items.length} Übungen</b></span><span>${ico('fire')}<b>≈ ${w.kcal} kcal</b></span></div>
    <div class="wkt-ex">${w.items.slice(0, 6).map(it => { const e = W.EXI[it.ex]; return `<img src="${exImg(e)}" alt="" loading="lazy">`; }).join('')}</div>
    <div class="rc-btns"><button class="btn big tap" data-act="wk-start" data-wid="${w.id}">${ico('play')}Workout starten</button><button class="btn ghost tap" data-go="#/wk/${wid(w)}">${ico('book')}Details</button></div></article>`;
}

/* ---------- Workout-Katalog ---------- */
function wkCard(w) {
  return `<button class="wk-card tap" style="--h:${TCOL[w.type] ?? 168}" data-go="#/wk/${wid(w)}"><span class="wk-e">${w.e}</span><b>${esc(w.n)}</b><small>${w.min} Min · ${w.items.length} Übungen</small><span class="wk-imgs">${w.items.slice(0, 3).map(it => `<img src="${exImg(W.EXI[it.ex])}" alt="" loading="lazy">`).join('')}</span></button>`;
}
export function workoutsTab() {
  const lvl = ui2.wcat.lvl || W.userLevel(), place = ui2.wcat.place || W.fit().place;
  const list = W.catalog(lvl, place);
  const p = W.PLANS[W.activePlan()];
  return `<div class="page">${head()}${tabs('workouts')}
    <button class="card plan-card tap rise" data-go="#/plaene"><span class="pc-e">${p.e}</span><span><small>Dein Plan · ${(S.profile.train || []).length}× pro Woche</small><b>${esc(p.n)}</b><em>${esc(p.d)}</em></span>${ico('chev')}</button>
    <div class="filt rise"><div class="seg">${[1, 2, 3, 4].map(l => `<button class="tap${lvl === l ? ' on' : ''}" data-act="wcat" data-k="lvl" data-v="${l}">${W.LEVEL[l].n}</button>`).join('')}</div></div>
    <div class="eq-line rise"><span>💪 Nur Eigengewicht · 🪑 Stuhl/Bank reicht</span><button class="chip tap${W.hasBar() ? ' on' : ''}" data-act="fit-eq" data-v="stange">${W.hasBar() ? '✓ ' : '+ '}Klimmzugstange</button></div>
    <p class="fine rise">${list.length} Workouts für <b>${W.LEVEL[lvl].n}</b> · jede Woche neue Übungs-Kombinationen</p>
    <div class="wk-grid rise">${list.map(wkCard).join('')}</div>
    <h2 class="sec rise">Lauf-Ersatz: Mini-Workouts</h2>
    <p class="fine rise">Die 12-Minuten-Workouts ohne Geräte findest du im Reiter „Heute“ unter „Keine Lust zu laufen?“.</p>
  </div>`;
}

/* ---------- Übungsbibliothek ---------- */
function exRow(e) {
  return `<button class="ex-row tap" data-go="#/ex/${e.id}"><img src="${exImg(e)}" alt="" loading="lazy"><span class="exr-t"><b>${esc(e.n)}</b><small>${e.p.map(m => MUSCLE_NAMES[m]).join(' · ')}</small><small class="exr-m">${lvlDots(e.l)} ${W.EQUIP[e.eq]}</small></span>${ico('chev')}</button>`;
}
export function libraryTab() {
  const f = ui2.lib, list = W.filterEx({ q: f.q, muscle: f.m, level: f.l, eq: f.eq, type: f.type });
  const groups = [['', 'Alle'], ...Object.keys(MUSCLE_NAMES).filter(m => m !== 'neck').map(m => [m, MUSCLE_NAMES[m]])];
  return `<div class="page">${head()}${tabs('uebungen')}
    <article class="card mm-pick rise"><div class="row-b"><h3 class="c-h">Tippe auf einen Muskel</h3>${f.m ? `<button class="link tap" data-act="lib" data-k="m" data-v="">Alle ${ico('close', 'xs')}</button>` : ''}</div>${muscleSVG(f.m ? [f.m] : [], [], { labels: true })}</article>
    <label class="search rise">${ico('edit')}<input id="lib-q" placeholder="Übung suchen, z. B. Kniebeuge" value="${esc(f.q)}" autocomplete="off"></label>
    <div class="hscroll rise">${groups.map(([m, l]) => `<button class="chip tap${f.m === m ? ' on' : ''}" data-act="lib" data-k="m" data-v="${m}">${l}</button>`).join('')}</div>
    <div class="hscroll rise">${[[0, 'Jedes Level'], [1, 'Einsteiger'], [2, 'Amateur'], [3, 'Fortgeschritten'], [4, 'Profi']].map(([l, n]) => `<button class="chip tap${f.l === l ? ' on' : ''}" data-act="lib" data-k="l" data-v="${l}">${n}</button>`).join('')}</div>
    <div class="hscroll rise">${[['', 'Alle Arten'], ...Object.entries(W.TYPE)].map(([v, n]) => `<button class="chip tap${(f.type || '') === v ? ' on' : ''}" data-act="lib" data-k="type" data-v="${v}">${n}</button>`).join('')}</div>
    <div class="hscroll rise">${[['', 'Alle Hilfsmittel'], ...Object.entries(W.EQUIP)].map(([v, n]) => `<button class="chip tap${(f.eq || '') === v ? ' on' : ''}" data-act="lib" data-k="eq" data-v="${v}">${n}</button>`).join('')}</div>
    <p class="fine rise"><b>${list.length}</b> von ${W.filterEx().length} Übungen · alle mit dem eigenen Körpergewicht</p>
    <div class="ex-list2 rise">${list.slice(0, 80).map(exRow).join('') || '<p class="empty">Keine Übung passt zu diesen Filtern.</p>'}</div>
    ${list.length > 80 ? `<p class="fine">… und ${list.length - 80} weitere – filtere genauer.</p>` : ''}
    <p class="about">Übungsfotos: free-exercise-db (Public Domain)</p>
  </div>`;
}

/* ---------- Übungsdetail ---------- */
export function exerciseDetail(id) {
  const e = W.EXI[id]; if (!e) return { html: `<div class="page detail">${dhead('Übung')}<p class="empty">Nicht gefunden.</p></div>` };
  const lvl = W.userLevel(), sc = W.scheme(e, lvl), best = W.bestOf(e.id), last = W.lastSets(e.id);
  return { html: `<div class="page detail">${dhead(esc(e.n), W.TYPE[e.t] + ' · ' + W.EQUIP[e.eq])}
    <div class="ex-anim rise">${e.imgs ? `<img src="${exImg(e, 0)}" alt="Startposition"><img src="${exImg(e, 1) || exImg(e, 0)}" alt="Endposition">` : ''}<span class="ex-lv">${lvlBadge(e.l)}</span></div>
    <article class="card rise"><div class="row-b"><h3 class="c-h">${ico('heart', 'xs')} Diese Muskeln arbeiten</h3></div>
      ${muscleSVG(e.p, e.s2)}
      <div class="mchips">${e.p.map(m => `<span class="mc p">${MUSCLE_NAMES[m]}</span>`).join('')}${e.s2.map(m => `<span class="mc s">${MUSCLE_NAMES[m]}</span>`).join('')}</div></article>
    <article class="card rise"><h3 class="c-h">So geht’s</h3><ol class="steps">${e.s.map((s, i) => `<li><span class="st-n">${i + 1}</span><span>${esc(s)}</span></li>`).join('')}</ol><p class="tip">💡 ${esc(e.tip)}</p></article>
    <article class="card rise"><h3 class="c-h">Für dich (${W.LEVEL[lvl].n})</h3><div class="stats3"><span>${ico('dumbbell')}<b>${W.schemeText(e, sc)}</b></span><span>${ico('clock')}<b>${sc.rest} s Pause</b></span><span>${ico('fire')}<b>${W.TYPE[e.t]}</b></span></div>
      ${best ? `<p class="pr-line">🏆 Dein Rekord: <b>${lit(best.kg)} kg × ${best.reps}</b> (${E.dateOf(best.d).toLocaleDateString('de-AT')})</p>` : ''}${last.length ? `<p class="fine">Zuletzt: ${last.map(s => s.kg ? lit(s.kg) + '×' + s.reps : (s.reps ? s.reps + ' Wdh.' : s.sec + ' s')).join(' · ')}</p>` : ''}</article>
    <div class="sticky-save"><button class="btn big tap" data-act="ex-solo" data-id="${e.id}">${ico('play')}Jetzt trainieren</button></div>
  </div>` };
}

/* ---------- Workout-Detail ---------- */
export function workoutDetail2(widRaw) {
  const w = W.parseWid(decodeURIComponent(widRaw)); if (!w) return { html: `<div class="page detail">${dhead('Workout')}<p class="empty">Nicht gefunden.</p></div>` };
  const prim = {}; w.items.forEach(it => { const e = W.EXI[it.ex]; e.p.forEach(m => prim[m] = 1); });
  const sec = []; w.items.forEach(it => W.EXI[it.ex].s2.forEach(m => { if (!prim[m]) sec.push(m); }));
  return { html: `<div class="page detail">${dhead(esc(w.n), W.LEVEL[w.lvl].n + ' · nur Eigengewicht')}
    <section class="wk-hero rise" style="--h:${TCOL[w.type] ?? 168}"><span class="wk-he float">${w.e}</span><h1>${esc(w.n)}</h1><p>${esc(w.d)}</p></section>
    <div class="stats3 lg rise"><span>${ico('clock')}<b>${w.min} Min</b></span><span>${ico('dumbbell')}<b>${w.items.length} Übungen</b></span><span>${ico('fire')}<b>≈ ${w.kcal} kcal</b></span></div>
    <article class="card rise"><h3 class="c-h">Trainierte Muskeln</h3>${muscleSVG(Object.keys(prim), sec)}</article>
    <h2 class="sec rise">Ablauf</h2>
    <div class="ex-list2 rise">${w.items.map((it, i) => { const e = W.EXI[it.ex]; return `<button class="ex-row tap" data-go="#/ex/${e.id}"><span class="exr-n">${i + 1}</span><img src="${exImg(e)}" alt="" loading="lazy"><span class="exr-t"><b>${esc(e.n)}</b><small>${W.schemeText(e, it)} · ${it.rest} s Pause</small><small class="exr-m">${e.p.map(m => MUSCLE_NAMES[m]).join(' · ')}</small></span>${ico('chev')}</button>`; }).join('')}</div>
    <div class="sticky-save"><button class="btn big tap" data-act="wk-start" data-wid="${w.id}">${ico('play')}Workout starten</button></div>
  </div>` };
}

/* ---------- Player ---------- */
export function player() {
  const P = ui2.play; if (!P) return { html: `<div class="page detail">${dhead('Workout')}<p class="empty">Kein Workout aktiv.</p></div>` };
  const w = P.wk, it = w.items[P.i], e = W.EXI[it.ex];
  const tot = w.items.reduce((s, x) => s + x.sets, 0), doneSets = P.log.length;
  const next = P.set < it.sets ? null : w.items[P.i + 1] ? W.EXI[w.items[P.i + 1].ex] : null;
  const kg = P.kg[e.id] ?? (W.lastSets(e.id).slice(-1)[0] || {}).kg ?? '';
  const restLeft = Math.max(0, Math.ceil((P.restEnd - Date.now()) / 1000));
  const body = P.phase === 'rest' ? `
      <div class="pl-rest"><p class="kicker">Pause</p><div class="pl-ring" id="pl-ring">${ring(restLeft / Math.max(1, P.restLen), 210, 12, 'pl')}<b id="pl-clock">${restLeft}</b></div>
        <p class="pl-next">Als Nächstes: <b>${esc(next ? next.n : e.n)}</b>${next ? '' : ` · Satz ${P.set + 1}/${it.sets}`}</p>
        <div class="rc-btns"><button class="btn ghost tap" data-act="pl-more">+15 s</button><button class="btn tap" data-act="pl-skip">Weiter ${ico('next')}</button></div></div>`
    : `<div class="ex-anim pl rise">${e.imgs ? `<img src="${exImg(e, 0)}" alt=""><img src="${exImg(e, 1) || exImg(e, 0)}" alt="">` : ''}</div>
      <div class="pl-info"><p class="kicker">Übung ${P.i + 1}/${w.items.length} · Satz ${P.set}/${it.sets}</p><h2>${esc(e.n)}</h2>
        <p class="pl-target">${it.timed ? `<b id="pl-clock">${P.phase === 'work' ? Math.max(0, Math.ceil((P.workEnd - Date.now()) / 1000)) : it.work}</b> s${e.uni ? ' je Seite' : ''}` : `<b>${it.reps}</b> Wiederholungen${e.uni ? ' je Seite' : ''}`}</p>
        ${W.weighted(e) ? `<div class="pl-kg"><button class="iconbtn tap" data-act="pl-kg" data-v="-2.5">${ico('minus')}</button><label><input id="pl-kg" type="text" inputmode="decimal" value="${kg === '' ? '' : String(kg).replace('.', ',')}" placeholder="kg"><span>kg</span></label><button class="iconbtn tap" data-act="pl-kg" data-v="2.5">${ico('plus')}</button></div>` : ''}
        ${!it.timed ? `<div class="pl-reps"><span>Geschafft:</span>${[-2, -1, 0, 1, 2].map(d => `<button class="chip tap${(P.reps ?? it.reps) === it.reps + d ? ' on' : ''}" data-act="pl-reps" data-v="${it.reps + d}">${it.reps + d}</button>`).join('')}</div>` : ''}
        <div class="pl-mini">${muscleSVG(e.p, e.s2, { labels: false, small: true })}</div>
        <p class="tip">💡 ${esc(e.tip)}</p></div>
      <div class="sticky-save">${it.timed && P.phase !== 'work' ? `<button class="btn big tap" data-act="pl-go">${ico('play')}Los (${it.work} s)</button>` : it.timed ? `<button class="btn big tap" data-act="pl-done">${ico('check')}Fertig</button>` : `<button class="btn big tap" data-act="pl-done">${ico('check')}Satz erledigt</button>`}</div>`;
  return { html: `<div class="page player">
    <header class="dhead"><button class="iconbtn tap" data-act="pl-quit" aria-label="Beenden">${ico('close')}</button><div class="dhead-t"><b>${esc(w.n)}</b><small id="pl-time">${fmtTime((Date.now() - P.t0) / 1000)}</small></div><span class="dhead-s"></span></header>
    <div class="pl-prog"><i style="width:${(doneSets / tot * 100).toFixed(1)}%"></i></div>
    ${body}
  </div>`, cls: 'noscroll-nav' };
}
export const fmtTime = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export function playSummaryHTML(rec) {
  return `<div class="learn-sum"><span class="ls-emo">🏆💪</span><h2 class="sh-t">Workout geschafft!</h2>
    <div class="ls-tiles"><div><b>${rec.min}</b><small>Minuten</small></div><div><b>${rec.sets.length}</b><small>Sätze</small></div><div><b>${fmt(rec.vol)}</b><small>kg bewegt</small></div><div><b>+${rec.pts}</b><small>Punkte</small></div></div>
    ${rec.prs.length ? `<p class="pr-line">🏆 Neue Rekorde: ${rec.prs.map(p => esc(W.EXI[p.ex].n) + ' ' + lit(p.kg) + ' kg × ' + p.reps).join(', ')}</p>` : ''}
    <p class="sh-sub">≈ ${rec.kcal} kcal verbrannt – zählen zu deinem Tagesziel.</p></div><button class="btn wide tap" data-close>Super!</button>`;
}

/* ---------- Fortschritt ---------- */
export function progressTab() {
  const ws = W.weekSummary(), weeks = W.weeksBack(8), heat = W.muscleHeat(7), maxP = Math.max(30, ...weeks.map(w => w.pts));
  const prs = Object.values(W.wlog().reduce((acc, w) => { w.prs.forEach(p => { acc[p.ex] = { ...p, d: w.d }; }); return acc; }, {})).slice(-8).reverse();
  const hist = W.wlog().slice(-12).reverse();
  return `<div class="page">${head()}${tabs('fortschritt')}
    <div class="tstats rise"><span class="ts"><span>⭐</span><b>${fmt(ws.pts)}</b><small>Punkte</small></span><span class="ts"><span>🏋️</span><b>${ws.workouts}</b><small>Workouts</small></span><span class="ts"><span>🏃</span><b>${lit(ws.km)}</b><small>km</small></span><span class="ts"><span>🔥</span><b>${W.streakDays()}</b><small>Tage Serie</small></span></div>
    <article class="card rise"><div class="row-b"><h3 class="c-h">Diese Woche trainiert</h3><span class="fine">letzte 7 Tage</span></div>${heatSVG(heat)}
      <div class="heat-leg"><span><i class="h1"></i>wenig</span><span><i class="h2"></i></span><span><i class="h3"></i></span><span><i class="h4"></i>viel</span></div>
      ${Object.keys(heat).length ? '' : '<p class="fine">Noch kein Krafttraining diese Woche – starte ein Workout und sieh, wie sich der Körper füllt.</p>'}</article>
    <article class="card rise"><h3 class="c-h">Punkte pro Woche</h3><div class="wbars">${weeks.map(w => `<span><i style="--h:${(w.pts / maxP * 100).toFixed(0)}%"></i><small>${E.dateOf(w.k).getDate()}.${E.dateOf(w.k).getMonth() + 1}.</small></span>`).join('')}</div>
      <p class="fine">Punkte: Workout 10 + 1 je Minute (max. 60) + 5 je Rekord · Lauf 10 + 10 je km</p></article>
    ${prs.length ? `<article class="card rise"><h3 class="c-h">🏆 Rekorde</h3>${prs.map(p => `<div class="pr-row"><b>${esc(W.EXI[p.ex].n)}</b><span>${lit(p.kg)} kg × ${p.reps}</span></div>`).join('')}</article>` : ''}
    <h2 class="sec rise">Verlauf</h2>
    ${hist.length ? `<div class="ex-list2 rise">${hist.map(h => `<div class="ex-row"><span class="h-e">${h.e}</span><span class="exr-t"><b>${esc(h.n)}</b><small>${E.dateOf(h.d).toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'numeric' })} · ${h.min} Min · ${h.sets.length} Sätze${h.vol ? ' · ' + fmt(h.vol) + ' kg' : ''}</small></span><em class="h-pts">+${h.pts}</em></div>`).join('')}</div>` : '<p class="empty rise">Noch keine Workouts gespeichert.</p>'}
  </div>`;
}

/* ---------- Plan, Level, Ort, Geräte ---------- */
export function plansScreen() {
  const f = W.fit(), lvl = W.userLevel(), act = W.activePlan();
  return { html: `<div class="page detail">${dhead('Plan & Level', 'Wie willst du trainieren?')}
    <article class="card rise"><h3 class="c-h">Dein Level</h3><div class="goal-list">${[1, 2, 3, 4].map(l => `<button class="goal tap${lvl === l ? ' on' : ''}" data-act="fit-set" data-k="level" data-v="${l}"><b>${W.LEVEL[l].n}</b><small>${['Neu im Training oder lange Pause.', 'Trainierst seit ein paar Monaten.', 'Regelmäßig seit über einem Jahr, saubere Technik.', 'Jahre Erfahrung, schwere Grundübungen.'][l - 1]}</small></button>`).join('')}</div></article>
    <article class="card rise"><h3 class="c-h">Was hast du zu Hause?</h3><p class="lede">Alle Übungen gehen mit dem eigenen Körpergewicht. Ein Stuhl, eine Bank oder Stufe reicht für fast alles.</p>
      <div class="chips"><span class="chip on">✓ Boden / Matte</span><span class="chip on">✓ Stuhl, Bank, Stufe</span><button class="chip tap${W.hasBar() ? ' on' : ''}" data-act="fit-eq" data-v="stange">${W.hasBar() ? '✓ ' : '+ '}Klimmzugstange / Barren</button></div>
      <p class="fine">Mit Klimmzugstange kommen Klimmzüge, Dips und Hänge-Übungen dazu.</p></article>
    <h2 class="sec rise">Trainingsplan</h2>
    <div class="list">${Object.entries(W.PLANS).map(([k, p]) => `<button class="plan-row tap rise${act === k ? ' on' : ''}" data-act="fit-plan" data-v="${k}"><span class="pc-e">${p.e}</span><span><b>${esc(p.n)}</b><small>${esc(p.for)} · ${esc(p.d)}</small><small class="pl-seq">${p.seq.map(t => W.WTYPES[t].e + ' ' + W.WTYPES[t].n).join(' → ')}</small></span>${act === k ? `<i class="st ok">${ico('check')}</i>` : ''}</button>`).join('')}</div>
    <p class="fine rise">Krafttrainingstage stellst du unter Ich → Profil ein (aktuell ${(S.profile.train || []).length}× pro Woche). Die Workouts kommen der Reihe nach an diesen Tagen.</p>
  </div>` };
}
