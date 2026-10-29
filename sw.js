// Service worker do Leitura Guiada.
// Para forçar a atualização do app nos aparelhos, aumente o número de VERSION.
const VERSION = "v2";
const CACHE = "leitura-guiada-" + VERSION;
const SHELL = [
  "./", "index.html", "app.js", "config.js", "manifest.webmanifest",
  "supabase.js", "guia.json", "contexto.json",
  "icon.svg", "icon-192.png", "icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("leitura-guiada-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function staleWhileRevalidate(req) {
  return caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Supabase (login, banco, storage) nunca passa pelo cache.
  if (/\.supabase\.(co|in)$/.test(url.hostname)) return;
  if (url.origin === location.origin || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      staleWhileRevalidate(req).then((r) => r || (req.mode === "navigate" ? caches.match("index.html") : r))
    );
  }
});
