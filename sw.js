/* WebDich v0.9.8 — Service Worker for PWA.
 * Cache-first strategy: all static assets served from cache,
 * refreshed in background. App starts instantly from icon.
 */
var CACHE_NAME = 'webdich-v0.9.8-cache';
var PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './js/state.js',
  './js/text.js',
  './js/language.js',
  './js/idioms.js',
  './js/asr.js',
  './js/translation.js',
  './js/tts.js',
  './js/ui.js',
  './js/app.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Translation / network APIs: always network-first, no cache
  if (url.hostname.indexOf('translate.googleapis.com') >= 0 ||
      url.hostname.indexOf('mymemory.translated.net') >= 0) {
    return;
  }

  // Static assets: cache-first, refresh in background
  event.respondWith(
    caches.match(req).then(function (cached) {
      var fetchPromise = fetch(req).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); });
        }
        return response;
      }).catch(function () { return cached; });
      return cached || fetchPromise;
    })
  );
});
