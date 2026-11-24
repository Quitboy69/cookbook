/* Brücke zu Android: Benachrichtigungen, Kamera + Texterkennung, Vibration, Zurück-Taste */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Share } from '@capacitor/share';

export const isNative = Capacitor.isNativePlatform();
const ReceiptOcr = registerPlugin('ReceiptOcr');
const FoodAi = registerPlugin('FoodAi');
const Net = registerPlugin('Net');

/* ---------- Haptik ---------- */
export const haptic = {
  tap() { if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); else if (navigator.vibrate) navigator.vibrate(8); },
  med() { if (isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}); },
  ok() { if (isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => {}); },
  warn() { if (isNative) Haptics.notification({ type: NotificationType.Warning }).catch(() => {}); }
};

/* ---------- Statusleiste passend zum Theme ---------- */
export function statusBar(dark) {
  if (!isNative) return;
  StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
}

/* ---------- Zurück-Taste ---------- */
export function onBack(fn) { if (isNative) App.addListener('backButton', fn); }
export function exitApp() { if (isNative) App.exitApp(); }
export function onResume(fn) {
  if (isNative) App.addListener('appStateChange', s => { if (s.isActive) fn(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fn(); });
}

/* ---------- Kassenbon fotografieren + erkennen ---------- */
export async function takeReceiptPhoto(source) {
  const photo = await Camera.getPhoto({
    source: source === 'gallery' ? CameraSource.Photos : CameraSource.Camera,
    resultType: CameraResultType.Uri,
    quality: 92,
    correctOrientation: true,
    width: 2200,
    saveToGallery: false
  });
  return { path: photo.path || photo.webPath, webPath: photo.webPath };
}
export async function ocr(path) { return ReceiptOcr.recognize({ path }); }
/* Essen auf dem Foto erkennen – lokale KI (AIY Food, offline) */
export async function analyzeFood(path) { return FoodAi.analyze({ path }); }
/* Kleines Vorschaubild für die Tagesliste (≈ 5–10 KB) */
export function makeThumb(src, size = 160) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = size; c.height = size;
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        res(c.toDataURL('image/jpeg', 0.6));
      } catch (e) { res(null); }
    };
    img.onerror = () => res(null);
    img.src = src;
  });
}

/* ---------- Benachrichtigungen ---------- */
let notifReady = false;
export async function notifPermission(ask = false) {
  if (!isNative) return 'browser';
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted' && ask) p = await LocalNotifications.requestPermissions();
    return p.display;
  } catch (e) { return 'denied'; }
}
export async function setupNotifications(onAction) {
  if (!isNative || notifReady) return;
  notifReady = true;
  try {
    await LocalNotifications.createChannel({ id: 'meals', name: 'Essen & Bewertungen', description: 'Erinnerungen ans Kochen, Essen und Bewerten', importance: 4, vibration: true, visibility: 1 });
    await LocalNotifications.createChannel({ id: 'tips', name: 'Trinken & Einkauf', description: 'Wasser- und Einkaufs-Erinnerungen', importance: 3, vibration: true, visibility: 1 });
    await LocalNotifications.createChannel({ id: 'chat', name: 'Freunde & Chats', description: 'Neue Nachrichten aus deinen Gruppen und von Freunden', importance: 4, vibration: true, visibility: 0 });
    await LocalNotifications.createChannel({ id: 'run', name: 'Laufen & Workout', description: 'Lauf-Erinnerungen und Ansagen während des Laufs', importance: 5, vibration: true, visibility: 1 });
    await LocalNotifications.registerActionTypes({ types: [
      { id: 'RATE', actions: [{ id: 'eaten', title: 'Gegessen ✓' }, { id: 'rate', title: 'Jetzt bewerten ★' }] },
      { id: 'COOK', actions: [{ id: 'cooked', title: 'Schon gekocht ✓' }, { id: 'recipe', title: 'Rezept öffnen' }] },
      { id: 'SHOP', actions: [{ id: 'list', title: 'Einkaufsliste' }, { id: 'scan', title: 'Bon scannen' }] },
      { id: 'RUN', actions: [{ id: 'run-go', title: 'Los geht’s 🏃' }, { id: 'run-wo', title: 'Lieber Workout' }] },
      { id: 'WO', actions: [{ id: 'wo-go', title: 'Workout starten 💪' }, { id: 'run-go', title: 'Doch laufen' }] }
    ] });
    LocalNotifications.addListener('localNotificationActionPerformed', ev => onAction(ev.actionId, (ev.notification && ev.notification.extra) || {}));
  } catch (e) { /* nicht schlimm */ }
}
export async function reschedule(list) {
  if (!isNative) return { ok: false, n: 0 };
  try {
    const pending = await LocalNotifications.getPending();
    const old = pending.notifications.filter(n => n.id < 700000 || n.id >= 900000);   // Chat (700000+) und Lauf-Ansagen (880000+) bleiben
    if (old.length) await LocalNotifications.cancel({ notifications: old.map(n => ({ id: n.id })) });
    const now = Date.now();
    const notifications = list.filter(n => n.at.getTime() > now + 30000).slice(0, 60).map(n => ({
      id: n.id, title: n.title, body: n.body, largeBody: n.body,
      schedule: { at: n.at, allowWhileIdle: true },
      isExactNotification: false,          // keine Wecker-Berechtigung nötig, kein Einstellungs-Popup
      channelId: n.channel || 'meals', actionTypeId: n.action, extra: n.extra || {},
      smallIcon: 'ic_stat_icon', iconColor: '#12B886', autoCancel: true
    }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    return { ok: true, n: notifications.length };
  } catch (e) { return { ok: false, n: 0, err: String(e && e.message || e) }; }
}
export async function testNotification() {
  if (!isNative) return false;
  await LocalNotifications.schedule({ notifications: [{
    id: 999999, title: 'So sehen deine Erinnerungen aus 👋', body: 'Tippe hier, um dein heutiges Essen zu bewerten.',
    schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, isExactNotification: false, channelId: 'meals', actionTypeId: 'RATE',
    extra: { route: 'rate' }, smallIcon: 'ic_stat_icon', iconColor: '#12B886'
  }] });
  return true;
}

/* Ansagen während eines Laufs – funktionieren auch bei ausgeschaltetem Bildschirm */
export async function scheduleRunCues(cues) {
  if (!isNative) return;
  try {
    await cancelRunCues();
    const now = Date.now();
    const notifications = cues.filter(c => c.at > now + 1500).slice(0, 40).map((c, i) => ({
      id: 880000 + i, title: c.title, body: c.body, schedule: { at: new Date(c.at), allowWhileIdle: true },
      isExactNotification: true, channelId: 'run',   // pünktlich dank USE_EXACT_ALARM, kein Popup
      smallIcon: 'ic_stat_icon', iconColor: '#FF7A2F', autoCancel: true, extra: { route: 'timer' }
    }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch (e) { /* egal */ }
}
export async function cancelRunCues() {
  if (!isNative) return;
  try {
    const ids = []; for (let i = 0; i < 40; i++) ids.push({ id: 880000 + i });
    await LocalNotifications.cancel({ notifications: ids });
  } catch (e) { /* egal */ }
}

/* ---------- Strava: Netzwerk + Rückkehr-Link ---------- */
/* Am Handy läuft der Aufruf nativ (nur www.strava.com), im Browser per fetch (zum Testen) */
export async function http(url, { method = 'GET', headers = {}, body } = {}) {
  if (isNative) { const r = await Net.request({ url, method, headers, body }); return { status: r.status, text: r.body || '' }; }
  const r = await fetch(url, { method, headers, body });
  return { status: r.status, text: await r.text() };
}
export async function openExternal(url) {
  if (isNative) return Net.open({ url });
  window.open(url, '_blank', 'noopener');
}
/* ybwye://localhost?code=… – kommt nach der Freigabe in Strava zurück in die App */
export function onDeepLink(fn) {
  if (!isNative) return;
  App.addListener('appUrlOpen', e => { if (e && e.url) fn(e.url); });
  App.getLaunchUrl().then(r => { if (r && r.url) fn(r.url); }).catch(() => {});
}

/* ---------- Community: Teilen + Chat-Benachrichtigung ---------- */
export async function shareText(text, title = 'Teilen') {
  if (isNative) { try { await Share.share({ title, text, dialogTitle: title }); return true; } catch (e) { if (/cancel/i.test(String(e && e.message))) return false; } }
  if (navigator.share) { try { await navigator.share({ title, text }); return true; } catch (e) { return false; } }
  try { await navigator.clipboard.writeText(text); } catch (e) { /* egal */ }
  const { toast } = await import('./ui.js'); toast('In die Zwischenablage kopiert – jetzt einfügen und senden.');
  return true;
}
let chatNid = 0;
export async function chatNotify({ title, body, chat }) {
  if (!isNative) return;
  try {
    await LocalNotifications.schedule({ notifications: [{
      id: 700000 + (chatNid++ % 5000), title, body, largeBody: body, schedule: { at: new Date(Date.now() + 300), allowWhileIdle: true },
      isExactNotification: false, channelId: 'chat', group: 'chat', extra: { route: 'chat/' + encodeURIComponent(chat) }, smallIcon: 'ic_stat_icon', iconColor: '#12B886', autoCancel: true
    }] });
  } catch (e) { /* egal */ }
}
