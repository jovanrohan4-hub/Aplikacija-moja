/* Moj život: servis za rad bez interneta */
const CACHE = 'moj-zivot-v2';
const EXT = 'moj-zivot-ext-v1';
const SHELL = ['./', 'index.html', 'manifest.json', 'firebase-config.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== EXT; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* aplikacija: prvo mreža (da nove verzije stignu odmah), pa keš kad nema interneta */
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('index.html'); });
      })
    );
    return;
  }

  /* samo fontovi i Firebase skripte se keširaju; svi ostali pozivi (baza, prijava) idu direktno na mrežu */
  var isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  var isSdk = url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0;
  if (isFont || isSdk) {
    e.respondWith(
      caches.open(EXT).then(function (c) {
        return c.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
            return res;
          }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
  }
});
