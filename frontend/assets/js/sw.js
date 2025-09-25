/* sw.js */
const CACHE_VER = 'v1.0.0';
const CACHE_STATIC = `static-${CACHE_VER}`;
const APP_SHELL = [
  './',
  './index.html',
  './list.html',
  './review.html',
  './assets/css/style.css',
  './assets/js/config.js',
  './assets/js/main.js',
  './assets/js/pwa.js',
  './assets/img/flybondi-logo.svg',
  './assets/img/Manual%202022-49.png',
  './assets/img/Manual%202022-50.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_STATIC).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isHTML(req){ return req.destination === 'document' || (req.headers.get('accept')||'').includes('text/html'); }
function isAsset(req){ return ['style','script','image'].includes(req.destination); }
function isFont(req){ return req.destination === 'font'; }

self.addEventListener('fetch', (e) => {
  const req = e.request;

  if (req.method === 'GET'){
    // Network-first para HTML
    if (isHTML(req)){
      e.respondWith(
        fetch(req).then(r => {
          caches.open(CACHE_STATIC).then(c => c.put(req, r.clone()));
          return r;
        }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
      );
      return;
    }

    // Stale-while-revalidate para CSS/JS/IMG
    if (isAsset(req)){
      e.respondWith(
        caches.match(req).then(cacheRes => {
          const net = fetch(req).then(r => {
            caches.open(CACHE_STATIC).then(c => c.put(req, r.clone()));
            return r;
          }).catch(() => cacheRes);
          return cacheRes || net;
        })
      );
      return;
    }

    // Cache-first para fonts
    if (isFont(req)){
      e.respondWith(
        caches.match(req).then(r => r || fetch(req).then(fr => {
          caches.open(CACHE_STATIC).then(c => c.put(req, fr.clone()));
          return fr;
        }))
      );
      return;
    }
  }

  // POST hacia la App Web: si falla por red, avisamos al cliente para encolar
  if (req.method === 'POST'){
    e.respondWith(
      fetch(req.clone()).catch(async () => {
        const allClients = await self.clients.matchAll({ includeUncontrolled: true });
        allClients.forEach(c => c.postMessage({ type: 'post-failed' }));
        return new Response(JSON.stringify({ ok:false, offline:true }), {
          status: 503, headers: { 'Content-Type':'application/json' }
        });
      })
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'fb-sync') {
    event.waitUntil((async () => {
      const allClients = await self.clients.matchAll({ includeUncontrolled: true });
      allClients.forEach(c => c.postMessage({ type: 'sync' }));
    })());
  }
});
