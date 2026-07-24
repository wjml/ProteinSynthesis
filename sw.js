const CACHE_NAME = 'protein-synthesis-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/style/fixed-elements.css',
  './assets/style/pages.css',
  './assets/style/app.css',
  './assets/js/dom.js',
  './assets/js/script.js',
  './assets/js/exercises.js',
  './assets/js/quiz.js',
  './assets/images/Logo.svg',
  './assets/images/icon-beta.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        // addAll falha se 1 asset der erro; wrap para falhar graciosamente
        return Promise.allSettled(
          ASSETS.map(function (url) {
            return cache.add(url).catch(function () {
              console.warn('[SW] Falha ao cachear: ' + url);
            });
          })
        );
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then(function (networkResponse) {
        if (networkResponse && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cached) {
          // Fallback: se tem no cache, serve; senão, devolve o index.html
          // (para que rotas SPA funcionem offline mesmo sem cache individual)
          return cached || caches.match('./index.html');
        });
      })
  );
});
