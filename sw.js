'use strict';
// Service worker da versão de celular: guarda o app no aparelho para abrir sem internet.
// Ao publicar uma versão nova, mude VERSION para os aparelhos baixarem tudo de novo.
const VERSION = 'focus-0.7.0';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css', './css/features.css', './css/themes.css',
  './js/store.js', './js/timer.js', './js/charts.js', './js/stats.js', './js/sound.js', './js/history.js',
  './js/subjects.js', './js/reviews.js', './js/simulados.js', './js/sync.js', './js/report.js', './js/import.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Responde do aparelho na hora e atualiza em segundo plano (a novidade aparece na próxima abertura).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
  }));
});

// tocar na notificação do timer abre o app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const c = list[0];
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
