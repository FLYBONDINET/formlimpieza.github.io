const CACHE_NAME = 'fb-limpieza-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './list.html',
  './review.html',
  './manifest.webmanifest',
  './assets/css/base.css',
  './assets/css/index.css',
  './assets/css/list.css',
  './assets/css/review.css',
  './assets/js/config.js',
  './assets/js/main.js',
  './assets/js/pwa.js',
  './assets/img/Manual 2022-49.png',
  './assets/img/Manual 2022-50.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k!==CACHE_NAME) && caches.delete(k)));
    self.clients.claim();
  })());
});

// cache-first para assets; network-first para Apps Script
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.hostname.includes('script.google.com')) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(e.request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(e.request);
        return cached || new Response(JSON.stringify({ok:false, error:'Sin conexión'}), {headers:{'Content-Type':'application/json'}});
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try{
      const fresh = await fetch(e.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(e.request, fresh.clone());
      return fresh;
    }catch{
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      return new Response('Offline', {status:503, statusText:'Offline'});
    }
  })());
});
