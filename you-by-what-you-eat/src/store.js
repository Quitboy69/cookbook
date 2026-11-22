/* Persistenter Zustand (localStorage der App) */
const KEY = 'ybwye.v1';

const DEFAULT = () => ({
  v: 1,
  profile: {
    name: '', height: 172, weight: 64, age: null, sex: null,
    goal: 'muskel', persons: 3, train: [0, 2, 4, 5], priceMode: 'cheapest',
    onboarded: false, theme: 'system'
  },
  plan: {},        // 'YYYY-MM-DD' -> { f, m, mBox, s, a, train }
  ratings: {},     // dishId -> [{ d, st, slot }]
  blocked: {},     // dishId -> { since, auto }
  unblocked: {},   // dishId -> 'YYYY-MM-DD' (manuell wieder erlaubt)
  log: {},         // date -> { cooked, eaten:{f,m,s,a}, water, waterMode }
  receipts: [],    // { id, store, date, total, items:[...] }
  shop: {},        // weekKey -> [ingIds]
  weights: [],     // { d, kg }
  notif: {
    f:    { on: true,  t: '07:00' },
    cook: { on: true,  t: '18:00' },
    rate: { on: true,  t: '20:30' },
    water:{ on: false, t: '10:00,15:30' },
    shop: { on: true,  day: 5, t: '09:00' }
  },
  seen: {}         // kleine Hinweise schon gezeigt
});

function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = Array.isArray(base) ? [] : { ...base };
  for (const k of Object.keys(over)) {
    out[k] = base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])
      ? merge(base[k], over[k]) : over[k];
  }
  return out;
}

let state;
try {
  const raw = localStorage.getItem(KEY);
  state = raw ? merge(DEFAULT(), JSON.parse(raw)) : DEFAULT();
} catch (e) { state = DEFAULT(); }

let saveTimer = null;
export const S = state;
export function save(now = false) {
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* voll/blockiert */ } };
  clearTimeout(saveTimer);
  if (now) write(); else saveTimer = setTimeout(write, 120);
}
export function resetAll() {
  try { localStorage.removeItem(KEY); } catch (e) { /* egal */ }
  const fresh = DEFAULT();
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, fresh);
  save(true);
}
export function exportJSON() { return JSON.stringify(state, null, 1); }
