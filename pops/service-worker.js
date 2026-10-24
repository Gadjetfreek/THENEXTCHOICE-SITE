// POPS service worker — caches the app shell so POPS works fully offline.
// It never caches or sees Journal data (that lives in localStorage), and it
// ignores every cross-origin request. Bump VERSION on each release
// (scripts/build.mjs stamps it automatically in dist/).
const VERSION = "0.1.0-beta-0f47db6a";
const CACHE = `pops-shell-${VERSION}`;
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.mjs", "./logic.mjs", "./manifest.webmanifest",
  "./icons/pops-icon.svg", "./icons/pops-192.png", "./icons/pops-512.png", "./icons/pops-maskable-512.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("pops-shell-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Network-first for same-origin GETs (so testers get updates), falling back to cache offline.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then(cached => cached || (request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
