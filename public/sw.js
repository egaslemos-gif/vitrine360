/* Vitrine360 Passive Player — Service Worker v12
 * Cold offline start serves static offline boot (no Next hydration).
 * v12: preserve media aspect ratio without cropping; shell bump.
 * v9: /_next assets network-first (avoid stale Smart TV shells); shell bump.
 * v8: Smart TV (Sraf) clients unregister SW; shell cache bump.
 * v7: offline-boot honors ?reset=1 (clear IDB) + refreshed shell cache.
 */
const SHELL_CACHE = "vitrine360-shell-v13";
const RUNTIME_CACHE = "vitrine360-runtime-v13";

const PRECACHE = [
  "/player",
  "/player-manifest.webmanifest",
  "/sw.js",
  "/v360-offline.html",
  "/v360-offline-boot.js",
  "/player-smarttv.html",
  "/player-smarttv.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Precache individually so one failure does not abort the whole install.
      await Promise.all(
        PRECACHE.map(async (path) => {
          try {
            await cache.add(path);
          } catch (err) {
            console.warn("[v360-sw] precache failed", path, err);
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isApi(url) {
  return url.pathname.startsWith("/api/");
}

function isNextAsset(url) {
  return url.pathname.startsWith("/_next/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (isApi(url)) return;

  if (isNextAsset(url)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  if (
    request.mode === "navigate" ||
    url.pathname === "/player" ||
    url.pathname.startsWith("/player/")
  ) {
    event.respondWith(navigatePlayer(request));
    return;
  }

  if (
    url.pathname === "/v360-offline.html" ||
    url.pathname === "/v360-offline-boot.js"
  ) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function networkFirst(request, cacheName) {
  const cached = await caches.match(request);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    if (cached) return cached;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function navigatePlayer(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put("/player", response.clone());
      await cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    // Prefer dedicated offline boot (vanilla IDB player) over incomplete Next shell
    const offline = await caches.match("/v360-offline.html");
    if (offline) return offline;
    const shell = await caches.match("/player");
    if (shell) return shell;
    return new Response(
      "<!doctype html><meta charset=utf-8><body style='background:#070b14;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif'>Vitrine360 offline</body>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
