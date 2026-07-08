const CACHE_NAME = 'protein-synthesis-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/style/fixed-elements.css',
  './assets/style/pages.css',
  './assets/style/app.css',
  './assets/js/dom.js',
  './assets/js/script.js',
  './assets/images/Logo.svg',
  './assets/images/icon-beta.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(ASSETS);
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
    caches.match(event.request)
      .then(function (cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request);
      })
  );
});
