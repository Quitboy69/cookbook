/* Sticker: fertige Packs (SVG im Sticker-Look mit weißem Rand) + eigene Sticker aus Fotos (Editor) */
export const PACKS = [
  { id: 'gym', n: 'Gym', items: [['beast', '💪', 'BEAST MODE', '#EF4444'], ['fire', '🔥', 'ON FIRE', '#F97316'], ['pr', '🏆', 'NEUER REKORD', '#EAB308'], ['noex', '😤', 'NO EXCUSES', '#8B5CF6'], ['legday', '🦵', 'LEG DAY', '#3B82F6'], ['glute', '🍑', 'PO-POWER', '#EC4899'], ['sore', '😵', 'MUSKELKATER', '#14B8A6'], ['done', '✅', 'ERLEDIGT', '#22C55E']] },
  { id: 'run', n: 'Laufen', items: [['go', '🏃', "LET'S RUN", '#F97316'], ['pb', '⚡', 'BESTZEIT!', '#EAB308'], ['km', '🥵', 'KM-FRESSER', '#EF4444'], ['shoes', '👟', 'SCHUHE AN!', '#3B82F6'], ['rain', '🌧️', 'AUCH BEI REGEN', '#64748B'], ['finish', '🥇', 'ZIEL!', '#F59E0B'], ['slow', '🐢', 'LANGSAM IST OK', '#22C55E'], ['respect', '🫡', 'RESPEKT', '#8B5CF6']] },
  { id: 'life', n: 'Essen & Leben', items: [['clean', '🥦', 'CLEAN EATING', '#22C55E'], ['cheat', '🍕', 'CHEAT DAY', '#F97316'], ['water', '💧', 'TRINKEN!', '#0EA5E9'], ['rest', '😴', 'REST DAY', '#6366F1'], ['proud', '❤️', 'STOLZ AUF DICH', '#EF4444'], ['team', '🤝', 'TEAM!', '#14B8A6'], ['haha', '😂', 'HAHA', '#EAB308'], ['go2', '🚀', "LOS GEHT'S", '#8B5CF6']] }
];
const BY = {}; PACKS.forEach(p => p.items.forEach(([id, e, t, c]) => { BY[p.id + ':' + id] = { e, t, c }; }));
export const stickerExists = id => !!BY[id];
let uid = 0;
export function stickerSVG(id) {
  const s = BY[id]; if (!s) return '<span class="st-missing">🎨</span>';
  const f = 'so' + (uid++);
  const fs = s.t.length > 11 ? 17 : s.t.length > 8 ? 20 : 23;
  return `<svg class="stk" viewBox="0 0 200 200" aria-label="${s.t}"><defs><filter id="${f}" x="-20%" y="-20%" width="140%" height="140%">
    <feMorphology in="SourceAlpha" operator="dilate" radius="6" result="d"/><feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="o"/>
    <feGaussianBlur in="d" stdDeviation="5" result="b"/><feOffset in="b" dy="4" result="sh"/><feFlood flood-color="#000" flood-opacity=".28"/><feComposite in2="sh" operator="in" result="shadow"/>
    <feMerge><feMergeNode in="shadow"/><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g filter="url(#${f})"><text x="100" y="92" font-size="98" text-anchor="middle" dominant-baseline="middle">${s.e}</text>
    <g transform="rotate(-6 100 158)"><rect x="18" y="138" width="164" height="40" rx="14" fill="${s.c}"/><text x="100" y="159" font-size="${fs}" font-weight="900" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" letter-spacing="1">${s.t}</text></g></g></svg>`;
}

/* ---------- Sticker-Editor (Canvas 512×512) ---------- */
export const EMOJIS = ['💪', '🔥', '🏆', '😂', '😎', '❤️', '🥦', '🍕', '🏃', '⚡', '👑', '💯', '🤝', '😤', '🙌', '✨'];
export function editorState() { return { img: null, x: 0, y: 0, zoom: 1, shape: 'circle', top: '', bottom: '', border: true, emoji: '', strokes: [], color: '#FF4D2E', draw: false }; }
function shapePath(ctx, shape, S) {
  const c = S / 2, r = S * 0.42; ctx.beginPath();
  if (shape === 'circle') ctx.arc(c, c, r, 0, Math.PI * 2);
  else if (shape === 'round') { const w = r * 2, x = c - r, y = c - r, k = w * 0.2; ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + w, k); ctx.arcTo(x + w, y + w, x, y + w, k); ctx.arcTo(x, y + w, x, y, k); ctx.arcTo(x, y, x + w, y, k); }
  else if (shape === 'heart') { const s = r * 1.05; ctx.moveTo(c, c + s * 0.85); ctx.bezierCurveTo(c - s * 1.45, c + s * 0.05, c - s * 0.95, c - s * 1.05, c, c - s * 0.42); ctx.bezierCurveTo(c + s * 0.95, c - s * 1.05, c + s * 1.45, c + s * 0.05, c, c + s * 0.85); }
  else if (shape === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.55 : r * 1.05; ctx[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * rr, c + Math.sin(a) * rr); } }
  else ctx.rect(S * 0.08, S * 0.08, S * 0.84, S * 0.84);
  ctx.closePath();
}
function memeText(ctx, txt, y, S) {
  if (!txt) return; let fs = S * 0.12; ctx.font = `900 ${fs}px Impact, "Arial Black", system-ui, sans-serif`;
  while (ctx.measureText(txt).width > S * 0.9 && fs > 18) { fs -= 2; ctx.font = `900 ${fs}px Impact, "Arial Black", system-ui, sans-serif`; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = fs * 0.22; ctx.strokeStyle = '#000'; ctx.strokeText(txt, S / 2, y);
  ctx.fillStyle = '#fff'; ctx.fillText(txt, S / 2, y);
}
export function renderSticker(canvas, st) {
  const S = canvas.width, ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, S, S);
  if (st.img) {
    if (st.border) { ctx.save(); shapePath(ctx, st.shape, S); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = S * 0.04; ctx.shadowOffsetY = S * 0.015; ctx.lineWidth = S * 0.05; ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
    ctx.save(); shapePath(ctx, st.shape, S); ctx.clip();
    const im = st.img, base = Math.max(S / im.width, S / im.height) * st.zoom, w = im.width * base, h = im.height * base;
    ctx.drawImage(im, (S - w) / 2 + st.x, (S - h) / 2 + st.y, w, h); ctx.restore();
  }
  for (const s of st.strokes) { ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s.w; ctx.strokeStyle = s.c; s.p.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
  memeText(ctx, st.top.toUpperCase(), S * 0.14, S); memeText(ctx, st.bottom.toUpperCase(), S * 0.86, S);
  if (st.emoji) { ctx.font = `${S * 0.24}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 8; ctx.fillText(st.emoji, S * 0.8, S * 0.76); ctx.shadowBlur = 0; }
}
export function exportSticker(canvas, size = 384) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').drawImage(canvas, 0, 0, size, size);
  return c.toDataURL('image/webp', 0.86).startsWith('data:image/webp') ? c.toDataURL('image/webp', 0.86) : c.toDataURL('image/png');
}
export function dataUrlToBlob(d) { const [h, b] = d.split(','); const mime = h.match(/:(.*?);/)[1]; const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); }
/* Foto verkleinern (für Chat-Bilder und Avatare) */
export function shrinkImage(file, max = 1280, quality = 0.82, square = false) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height, sx = 0, sy = 0, sw = w, sh = h;
      if (square) { const m = Math.min(w, h); sx = (w - m) / 2; sy = (h - m) / 2; sw = sh = m; w = h = m; }
      const k = Math.min(1, max / Math.max(w, h)); const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('Bild konnte nicht gelesen werden')), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')); };
    img.src = url;
  });
}
export const loadImage = file => new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; });
