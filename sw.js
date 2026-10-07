/* POSEIDON Service Worker — 29 sept 2026 (v43): network-first pentru TOT ce e pe domeniul nostru (pagini, scripturi, date), cu
   cache-ul doar ca rezervă offline. Versiunea veche (cache-first pe shell) ținea telefoanele pe pagina și scripturile de la prima
   vizită, iar cererile către zona de membri (alt domeniu) treceau tot prin ea și se puteau îngheța. Cererile către alte domenii
   (Worker-ul de membri, Patreon) NU mai sunt interceptate deloc. */
const CACHE = "poseidon-v79";
const SHELL = [
  "./index.html",
  "./simulator.html",
  "./istoric.html",
  "./track-record.html",
  "./metodologie.html",
  "./terms.html",
  "./assets/style.css",
  "./assets/app.js",
  "./assets/members.js",
  "./manifest.json",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => null)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== "GET") return;   // alt domeniu / non-GET: direct la rețea, fără noi
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => null); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("./index.html")))
  );
});
