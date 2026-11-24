/* Muskel-Grafik: Körper von vorn und hinten als SVG. Primär trainierte Muskeln leuchten, sekundäre sind heller.
   Auch als Wochen-Heatmap (0..1 je Muskel). Formen sind links gezeichnet und werden gespiegelt. */
export const MUSCLE_NAMES = {
  chest: 'Brust', shoulders: 'Schultern', traps: 'Trapez/Nacken', lats: 'Latissimus', midback: 'Mittlerer Rücken', lowerback: 'Unterer Rücken',
  biceps: 'Bizeps', triceps: 'Trizeps', forearms: 'Unterarme', abs: 'Bauch', obliques: 'Seitlicher Bauch', glutes: 'Po',
  quads: 'Oberschenkel vorn', hamstrings: 'Oberschenkel hinten', calves: 'Waden', adductors: 'Innenschenkel', abductors: 'Hüfte außen', neck: 'Hals'
};
export const MUSCLE_GROUPS = {
  brust: ['chest'], ruecken: ['lats', 'midback', 'lowerback', 'traps'], schultern: ['shoulders', 'traps'], arme: ['biceps', 'triceps', 'forearms'],
  bauch: ['abs', 'obliques'], po: ['glutes', 'abductors'], beine: ['quads', 'hamstrings', 'calves', 'adductors']
};
const ab = (y, h) => `M87.5 ${y}h11v${h}h-11z`;
const FRONT = {
  shoulders: ['M60 66c-9 1-15 9-15 19 0 6 3 11 7 14 3-8 8-15 16-19 2-7-1-12-8-14z'],
  chest: ['M99 72c-13-2-26 0-32 11-3 11 2 25 16 30 8 3 14 0 16-5z'],
  traps: ['M90 57c-6 6-15 10-24 12l13 3c6-2 10-6 12-10z'],
  biceps: ['M50 93c-6 9-7 24-3 36 3 5 9 5 11-1 3-11 2-25-2-33-2-3-4-4-6-2z'],
  forearms: ['M43 147c-5 14-6 34-2 52 2 7 9 7 11 0 3-16 3-35-1-50-2-5-6-6-8-2z'],
  abs: [ab(120, 16), ab(139, 16), ab(158, 16), 'M87.5 177h11v29c-4 4-8 3-11-4z'],
  obliques: ['M84 118c-8 6-12 22-11 42 1 18 5 32 12 40l1-24V120z'],
  abductors: ['M68 206c-5 9-5 22-1 34l5-20z'],
  quads: ['M70 216c-4 24-4 54 2 82 4 14 14 18 20 14 4-22 6-62 5-88-7-5-19-7-27-8z'],
  adductors: ['M97 226c2 16 2 34-1 52-4-16-7-36-8-50z'],
  calves: ['M72 326c-2 18 0 38 5 54h5c2-20 2-40 0-54z'],
  neck: ['M92 50h8v12h-8z']
};
const BACK = {
  traps: ['M100 53c-8 6-22 13-34 19 12 8 24 24 34 50z'],
  shoulders: ['M60 67c-9 1-15 9-15 19 0 6 3 11 7 14 3-8 8-15 16-19 2-7-1-12-8-14z'],
  midback: ['M99 97l-13 4 4 28 9 4z'],
  lats: ['M70 94c2 26 8 56 20 78 4-12 7-32 8-46-8-14-18-26-28-32z'],
  lowerback: ['M90 168c-1 14 0 28 3 38h6v-40z'],
  triceps: ['M50 92c-6 10-7 26-3 38 3 5 9 5 11-1 3-12 2-26-2-35-2-3-4-4-6-2z'],
  forearms: ['M43 147c-5 14-6 34-2 52 2 7 9 7 11 0 3-16 3-35-1-50-2-5-6-6-8-2z'],
  glutes: ['M70 210c-4 16 0 36 14 42 10 2 15-4 15-14v-24c-9-4-19-6-29-4z'],
  abductors: ['M66 204c-2-8 6-10 14-8l-10 14z'],
  hamstrings: ['M72 258c-2 22 2 42 8 56h12c4-18 5-38 4-56-8-2-16-2-24 0z'],
  adductors: ['M97 256l2 2-1 32-3-4z'],
  calves: ['M70 328c-4 16 0 32 8 40 8-6 12-22 10-40-6-6-12-6-18 0z'],
  neck: ['M92 50h8v12h-8z']
};
// Körperumriss (eine Seite, wird gespiegelt) + Kopf
const BODY = [
  'M100 12a20 20 0 1 0 .1 0z',
  'M90 48h20v18H90z',
  'M100 62c-14 0-30 2-40 6-9 4-13 12-13 22 0 10 3 18 5 26l-2 30c-2 14-4 36-4 54 0 8 2 14 6 16l6-2 4-46 6-30c0 20 2 40 4 58 1 10 0 20-2 30-3 30-6 66-2 100l2 14c-2 22-2 46 0 64l-4 10h16l1-10c3-22 4-44 2-66l2-14c4-28 6-60 8-98h6z',
];
function figure(map, cls, x0) {
  const side = (paths) => paths.map(d => `<path d="${d}"/>`).join('');
  let s = `<g transform="translate(${x0} 0)"><g class="mm-body">${BODY.map(d => `<path d="${d}"/>`).join('')}<g transform="matrix(-1 0 0 1 200 0)">${BODY.slice(2).map(d => `<path d="${d}"/>`).join('')}</g></g>`;
  for (const [m, paths] of Object.entries(map)) {
    const c = cls(m);
    s += `<g class="mm ${c}" data-m="${m}">${side(paths)}<g transform="matrix(-1 0 0 1 200 0)">${side(paths)}</g></g>`;
  }
  return s + '</g>';
}
const DEFS = `<defs><filter id="mmglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
/** Grafik für eine Übung: primäre und sekundäre Muskeln */
export function muscleSVG(prim = [], sec = [], o = {}) {
  const cls = m => prim.includes(m) ? 'mm-p' : sec.includes(m) ? 'mm-s' : '';
  const lab = o.labels === false ? '' : `<text x="100" y="418" class="mm-lab">vorne</text><text x="310" y="418" class="mm-lab">hinten</text>`;
  return `<svg class="musclemap${o.small ? ' sm' : ''}" viewBox="0 0 410 424" role="img" aria-label="Trainierte Muskeln">${DEFS}${figure(FRONT, cls, 0)}${figure(BACK, cls, 210)}${lab}</svg>`;
}
/** Heatmap: Werte 0..1 je Muskel (z. B. Trainingsvolumen der Woche) */
export function heatSVG(score = {}) {
  const cls = m => { const v = score[m] || 0; return v >= 0.75 ? 'mm-h4' : v >= 0.5 ? 'mm-h3' : v >= 0.25 ? 'mm-h2' : v > 0 ? 'mm-h1' : ''; };
  return `<svg class="musclemap heat" viewBox="0 0 410 424" role="img" aria-label="Muskel-Heatmap">${DEFS}${figure(FRONT, cls, 0)}${figure(BACK, cls, 210)}<text x="100" y="418" class="mm-lab">vorne</text><text x="310" y="418" class="mm-lab">hinten</text></svg>`;
}
