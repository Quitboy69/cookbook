/* Service Worker: App offline verfügbar machen + Mitteilungen (Web-Push) anzeigen. */
const VERSION = 'ybwye-2.1.0-1';
const SHELL = ['./', 'index.html', 'app.js', 'styles.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-500-normal.woff2', 'fonts/inter-latin-600-normal.woff2', 'fonts/inter-latin-700-normal.woff2'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (/^\/(api|media|join|strava)\b/.test(u.pathname) || u.pathname.endsWith('/manifest.webmanifest') && u.search) return;   // nie zwischenspeichern
  const staticFile = /\/(ex|fonts|icons)\//.test(u.pathname) || u.pathname.endsWith('/products.json');
  if (staticFile) { e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(VERSION).then(ca => ca.put(r, c)); } return res; }))); return; }
  // Seite, Programm, Design: erst Netz (damit Updates ankommen), sonst Zwischenspeicher
  e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(VERSION).then(ca => ca.put(r, c)); } return res; }).catch(() => caches.match(r).then(hit => hit || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'You By What You Eat', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some(w => w.visibilityState === 'visible')) { wins.forEach(w => w.postMessage({ type: 'push', payload: d })); return; }   // App ist offen: kein doppeltes Signal
    await self.registration.showNotification(d.title || 'You By What You Eat', { body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || '/' } });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { if ('focus' in w) { await w.focus(); w.postMessage({ type: 'go', url }); return; } }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
