// ============================================================
// Service worker da casca do app (PWA instalável).
// Estratégia network-first com fallback pro cache, cobrindo tanto a
// casca (HTML/JS/CSS/ícones) quanto os dados em data/*.json — que são
// do mesmo domínio (gerados por sync-data.mjs), então cacheiam aqui
// mesmo, sem precisar de uma camada de IndexedDB separada.
// ============================================================
const CACHE_NAME = "t20-ficha-shell-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/style.css",
  "./src/app.js",
  "./src/database.js",
  "./src/rules.js",
  "./src/sources.js",
  "./src/storage.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
  );
});
