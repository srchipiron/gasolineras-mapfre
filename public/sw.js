// Service worker: la app funciona sin conexión con los últimos datos vistos.

const VERSION = 'v14';
const SHELL_CACHE = `shell-${VERSION}`;
const API_CACHE = `api-${VERSION}`;
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/app.css',
  '/js/app.js',
  '/js/api.js',
  '/js/chart.js',
  '/js/format.js',
  '/js/map.js',
  '/js/render.js',
  '/js/store.js',
  '/js/views/card.js',
  '/js/views/favorites.js',
  '/js/views/trend.js',
  '/js/install.js',
  '/js/views/log.js',
  '/js/views/refuel.js',
  '/js/views/settings.js',
  '/shared/carnet.js',
  '/shared/fuels.js',
  '/shared/geo.js',
  '/shared/horario.js',
  '/shared/ics.js',
  '/shared/locator.js',
  '/shared/provincias.js',
  '/shared/ranking.js',
  '/shared/treboles.js',
  '/shared/vehiculos.js',
  '/vendor/leaflet/leaflet.js',
  '/vendor/leaflet/leaflet.css',
  '/vendor/qrcode/qrcode.js',
  '/vendor/jsbarcode/JsBarcode.all.min.js',
  '/icons/icon.svg',
  '/icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' evita copiar ficheros viejos de la caché HTTP del navegador.
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== API_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // teselas del mapa: red

  if (url.pathname.startsWith('/api/')) {
    // Red primero; si no hay conexión, la última respuesta guardada.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(API_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || Response.json({ error: 'Sin conexión' }, { status: 503 }))),
    );
    return;
  }

  // Ficheros de la app: caché y actualización en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
