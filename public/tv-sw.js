var TV_SHELL_CACHE = "v360-tv-shell-v048";
var TV_SHELL_FILES = [
  "/tv.html",
  "/tv.js?v=048",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(TV_SHELL_CACHE)
      .then(function (cache) { return cache.addAll(TV_SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf("v360-tv-shell-") === 0 && key !== TV_SHELL_CACHE) {
          return caches.delete(key);
        }
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(TV_SHELL_CACHE).then(function (cache) {
            cache.put("/tv.html", copy);
          });
          return response;
        })
        .catch(function () {
          return caches.match("/tv.html");
        })
    );
    return;
  }

  if (new URL(event.request.url).pathname === "/tv.js") {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(TV_SHELL_CACHE).then(function (cache) {
              cache.put(event.request, copy);
              cache.put("/tv.js?v=048", copy.clone());
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match("/tv.js?v=048");
          });
        })
    );
  }
});
