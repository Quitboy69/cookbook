/* Oberflächen-Werkzeuge: Router mit animierten Übergängen, Icons, Effekte */
import { haptic } from './native.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Icons (eigene Linien-Icons) ---------- */
const P = {
  home: '<path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
  week: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="8" cy="14" r="1" fill="currentColor"/><circle cx="12" cy="14" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/><circle cx="8" cy="17.3" r="1" fill="currentColor"/>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 9h8M8 12h8M8 15h5"/>',
  cart: '<path d="M3 4h2.2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L21 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  user: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  fire: '<path d="M12 3c.5 3 3.5 4.5 3.5 8.5a3.5 3.5 0 0 1-7 0c0-1.4.6-2.5 1.5-3.4C10 10 11 11 11.5 11.5 11 8 12 5.5 12 3z"/><path d="M6 14.5A6 6 0 0 0 18 15c0-2-.6-3.5-1.5-4.8"/>',
  muscle: '<path d="M12 3.5c3.4 0 6.5 5.6 6.5 10a6.5 6.5 0 0 1-13 0c0-4.4 3.1-10 6.5-10z"/><circle cx="12" cy="14" r="2.6" fill="currentColor" stroke="none"/>',
  euro: '<path d="M17.5 6.5A6.5 6.5 0 1 0 17.5 17.5"/><path d="M4.5 10h8M4.5 14h7"/>',
  drop: '<path d="M12 3.5s6 6.4 6 10.9a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/><path d="M9.2 14.6a2.8 2.8 0 0 0 2.6 2.6"/>',
  star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20 15.5l-4.5-4.5L7 19.5"/>',
  shuffle: '<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.6-1.6 3.4-3.4M13.1 10.4c.8-1.8 1.8-3.4 3.4-3.4H20"/><path d="M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  book: '<path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h10"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 10a5.5 5.5 0 0 1 8 0"/><path d="M12 10.5l1.4-2.3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
  pot: '<path d="M4.5 11h15v5.5a3.5 3.5 0 0 1-3.5 3.5H8a3.5 3.5 0 0 1-3.5-3.5z"/><path d="M2.5 11h19M9 7.6c0-1.2 1.2-1.3 1.2-2.6M13.8 7.6c0-1.2 1.2-1.3 1.2-2.6"/>',
  box: '<rect x="4" y="9" width="16" height="10.5" rx="2.5"/><rect x="3" y="5.5" width="18" height="4" rx="1.5"/>',
  plate: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.5"/>',
  store: '<path d="M4 9.5 5.5 4.5h13L20 9.5M4 9.5h16v1a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.3 0zM5.5 13v7h13v-7"/><path d="M10 20v-4h4v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.5 4.5 0 0 1 12 7.5 4.5 4.5 0 0 1 19.5 10C19.5 15.5 12 20 12 20z"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  people: '<circle cx="9" cy="9" r="3.2"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 19.5c.8-3 2.9-4.5 5.5-4.5s4.7 1.5 5.5 4.5M15 15.2c2.6-.3 4.6 1 5.5 3.8"/>',
  leaf: '<path d="M5 19c0-8 5-13.5 14-14-.5 9-6 14-14 14z"/><path d="M5 19c3-4 6-6.5 9.5-8"/>',
  run: '<circle cx="14.5" cy="4.3" r="1.9"/><path d="M8.2 9.6l3.6-1.4 3 2.2 2.6 3"/><path d="M11.8 8.2l-1.9 5.3 3.4 2.7-1.1 5"/><path d="M9.9 13.5l-1.8 3.3-4 .7"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<rect x="6.5" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.7" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  next: '<path d="M6 6l8.5 6L6 18z" fill="currentColor"/><path d="M18 6v12"/>',
  prev: '<path d="M18 6L9.5 12 18 18z" fill="currentColor"/><path d="M6 6v12"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  bolt: '<path d="M13 3L5.5 13.5h6L10.5 21 18.5 10.5h-6z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  send: '<path d="M4.5 12 20 4.5 13.5 20l-2.2-6.3z"/><path d="M11.3 13.7 20 4.5"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.2c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2"/><path d="M9 9.6v.6M15 9.6v.6"/>',
  share: '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="m8.7 10.8 6.6-4M8.7 13.2l6.6 4"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18v2M17 17h3v3h-3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M9.5 17h5"/>',
  chat: '<path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4.5 19.5l1.4-4.2A7.5 7.5 0 1 1 20 11.5z"/>'
};
export const ico = (n, cls = '') => '<svg class="ic ' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || '') + '</svg>';

/* ---------- Router ---------- */
const stack = [];
let renderFn = null, lastTap = null, busy = false;
export const TABS = ['heute', 'plan', 'rezepte', 'training', 'einkauf', 'bon', 'freunde'];
const TAB_OF = { heute: 'heute', plan: 'essen', rezepte: 'essen', training: 'training', einkauf: 'essen', bon: 'essen', freunde: 'freunde', gruppe: 'freunde', sprofil: 'freunde', duell: 'freunde', sticker: 'freunde' };
export function setRenderer(fn) { renderFn = fn; }
export const current = () => stack[stack.length - 1] || '#/heute';
export function go(route, opts = {}) {
  const tabRoot = TABS.includes(route.replace('#/', ''));
  if (tabRoot) { stack.length = 0; stack.push(route); show(route, opts.mode || 'tab'); history.replaceState(null, '', route); return; }
  stack.push(route);
  history.pushState(null, '', route);
  show(route, opts.replace ? 'none' : 'push');
}
export function back() {
  if (stack.length > 1) { history.back(); return true; }
  const r = current();
  if (r !== '#/heute') { go('#/heute'); return true; }
  return false;
}
export function refresh(keepScroll = true) {
  const el = $('#screens .screen:last-child');
  const y = el ? el.scrollTop : 0;
  show(current(), 'none');
  if (keepScroll) { const n = $('#screens .screen:last-child'); if (n) n.scrollTop = y; }
}
window.addEventListener('popstate', () => {
  if (stack.length > 1) { stack.pop(); show(current(), 'pop'); }
  else { const h = location.hash || '#/heute'; stack.length = 0; stack.push(h); show(h, 'tab'); }
});
export function initRouter() {
  const h = '#/heute';   // App startet immer bei „Heute“ (keine alten Deep-Links nach Neustart)
  const root = TABS.includes(h.replace('#/', '')) ? h : '#/heute';
  stack.push(root); history.replaceState(null, '', root);
  if (root !== h) { stack.push(h); history.pushState(null, '', h); }
  show(h, 'tab');
}

function show(route, mode) {
  const host = $('#screens');
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  const old = host.querySelector('.screen:last-child');
  const olds = $$('.screen', host);   // nur diese räumt dieser Wechsel später weg
  const el = document.createElement('section');
  el.className = 'screen';
  const out = renderFn(route);
  el.innerHTML = out.html;
  el.dataset.route = route;
  if (out.cls) el.classList.add(...out.cls.split(' '));
  host.appendChild(el);
  updateNav(route);
  stagger(el, mode !== 'none');
  if (out.mount) out.mount(el);
  countUps(el); rings(el, mode !== 'none');
  const done = () => { olds.forEach(s => { if (s !== el && s.parentNode) { try { s.remove(); } catch (e) { /* schon weg */ } } }); busy = false; };
  if (!old || mode === 'none' || reduced()) { done(); return; }
  busy = true;
  const tap = lastTap && Date.now() - lastTap.t < 900 ? lastTap : null;
  if (mode === 'push') {
    old.animate([{ transform: 'none', filter: 'brightness(1)' }, { transform: 'scale(.94) translateX(-6%)', filter: 'brightness(.7)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    if (tap) {
      el.animate([{ clipPath: `circle(0px at ${tap.x}px ${tap.y}px)` }, { clipPath: `circle(150vmax at ${tap.x}px ${tap.y}px)` }], { duration: 520, easing: 'cubic-bezier(.3,.7,.1,1)' }).onfinish = done;
    } else {
      el.animate([{ transform: 'translateX(100%)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = done;
    }
  } else if (mode === 'pop') {
    host.insertBefore(el, old);
    el.animate([{ transform: 'scale(.94) translateX(-6%)', filter: 'brightness(.7)' }, { transform: 'none', filter: 'brightness(1)' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    old.style.zIndex = 3;
    old.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(100%)', opacity: .6 }], { duration: 360, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }).onfinish = done;
  } else {
    old.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.985)' }], { duration: 180, fill: 'forwards' });
    el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = done;
  }
}

function updateNav(route) {
  const base = route.replace('#/', '').split(/[/?]/)[0];
  const tab = TAB_OF[base] || null;
  const nav = $('#nav');
  nav.classList.toggle('hidden', ['onboarding', 'review', 'timer', 'foto', 'play', 'chat'].includes(base));
  $$('.nav-btn', nav).forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const on = $('.nav-btn.on', nav);
  const pill = $('#nav-pill');
  if (on && pill) {
    const r = on.getBoundingClientRect(), pr = nav.getBoundingClientRect();
    pill.style.transform = `translateX(${r.left - pr.left + r.width / 2 - 28}px)`;
    pill.style.opacity = 1;
  } else if (pill) pill.style.opacity = 0;
}
window.addEventListener('resize', () => updateNav(current()));

/* ---------- Effekte ---------- */
function stagger(el, anim) {
  $$('.rise', el).forEach((n, i) => { n.style.setProperty('--i', Math.min(i, 14)); if (!anim) n.style.animation = 'none'; });
}
function countUps(el) {
  $$('[data-count]', el).forEach(n => {
    const to = parseFloat(n.dataset.count), d = +(n.dataset.dec || 0), suf = n.dataset.suf || '';
    const fmt = v => (d ? v.toFixed(d).replace('.', ',') : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')) + suf;
    if (reduced()) { n.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 900;   // p nie unter 0: das erste Bild kann einen älteren Zeitstempel haben
    const step = t => { const p = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 4); n.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function rings(el, anim) {
  $$('.ring-fg', el).forEach(c => {
    const p = Math.max(0, Math.min(1, parseFloat(c.dataset.p || 0)));
    const len = parseFloat(c.getAttribute('stroke-dasharray'));
    c.style.strokeDashoffset = len;
    const set = () => { c.style.strokeDashoffset = len * (1 - p); };
    if (anim && !reduced()) requestAnimationFrame(() => requestAnimationFrame(set)); else set();
  });
  $$('[data-w]', el).forEach(b => {
    const set = () => { b.style.width = b.dataset.w; };
    if (anim && !reduced()) { b.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(set)); } else set();
  });
  $$('[data-h]', el).forEach(b => {
    const set = () => { b.style.height = b.dataset.h; };
    if (anim && !reduced()) { b.style.height = '0'; requestAnimationFrame(() => requestAnimationFrame(set)); } else set();
  });
}
export function ring(p, size = 64, stroke = 7, cls = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${stroke}" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" data-p="${p}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

/* Ripple + Tap-Position für den Kreis-Übergang */
document.addEventListener('pointerdown', e => {
  const t = e.target.closest('.tap, .btn, .nav-btn, .chip, .star');
  lastTap = { x: e.clientX, y: e.clientY, t: Date.now() };
  if (!t || reduced()) return;
  const r = t.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'ripple';
  const d = Math.max(r.width, r.height) * 2.2;
  s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  t.appendChild(s);
  setTimeout(() => s.remove(), 650);
}, { passive: true });

export function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.innerHTML = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3600);
}
export function confetti(x, y, n = 28) {
  if (reduced()) return;
  const colors = ['#12B886', '#FFD43B', '#FF8A3D', '#4DABF7', '#F06595', '#94D82D'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = x + 'px'; c.style.top = y + 'px';
    c.style.background = colors[i % colors.length];
    document.body.appendChild(c);
    const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 160;
    c.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * v}px, ${Math.sin(a) * v - 60}px) rotate(${Math.random() * 720}deg)`, opacity: 1, offset: .7 },
      { transform: `translate(${Math.cos(a) * v * 1.1}px, ${Math.sin(a) * v + 120}px) rotate(${Math.random() * 900}deg)`, opacity: 0 }
    ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => c.remove();
  }
}
export function sheet(html, mount) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = '<div class="sheet-bg" data-close></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>' + html + '</div>';
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 380); window.__sheetClose = null; };
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) { haptic.tap(); close(); } });
  window.__sheetClose = close;
  if (mount) mount(wrap.querySelector('.sheet'), close);
  return close;
}
export const isBusy = () => busy;
