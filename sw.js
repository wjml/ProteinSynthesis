const CACHE_NAME = 'protein-synthesis-v2';
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
  // Network-first: sempre tenta buscar a versão mais nova primeiro (evita
  // servir JS/CSS desatualizado durante o desenvolvimento) e só recorre ao
  // cache se a rede falhar (ex: offline). A resposta da rede é usada pra
  // manter o cache atualizado, então o fallback offline também vai ficando
  // mais recente a cada visita bem-sucedida.
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
        return caches.match(event.request);
      })
  );
});
