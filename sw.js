/* Network-first for public static pages and assets. Keep the last successful response for offline use. */
const CACHE = "poseidon-v104";
const SHELL = [
  "./",
  "./index.html",
  "./simulator.html",
  "./istoric.html",
  "./track-record.html",
  "./metodologie.html",
  "./terms.html",
  "./assets/style.css",
  "./assets/home-modern.css",
  "./assets/app-store-badge.svg",
  "./assets/stadium-night.png",
  "./assets/pages-modern.css",
  "./assets/pro-report.css",
  "./assets/pro-report.js",
  "./assets/pro-context.js",
  "./assets/app.js",
  "./assets/i18n-lite.js",
  "./assets/i18n.json",
  "./assets/country-label.js",
  "./assets/citire.js",
  "./assets/conversion.js",
  "./assets/home-dashboard.js",
  "./assets/members.js",
  "./assets/member-dossier.js",
  "./assets/member-dossier.css",
  "./manifest.json",
];
const LEGACY_CACHE = "poseidon-v103";
const SCOPE = new URL(self.registration.scope);
const OFFLINE_COPY = {
  ro: ["Nu ai conexiune la internet", "Pagina cerută nu este disponibilă offline.", "Încearcă din nou", "Acasă"],
  en: ["You’re offline", "This page isn’t available offline.", "Try again", "Home"],
  es: ["No tienes conexión", "Esta página no está disponible sin conexión.", "Volver a intentar", "Inicio"],
  it: ["Sei offline", "Questa pagina non è disponibile offline.", "Riprova", "Home"],
  fr: ["Vous êtes hors ligne", "Cette page est indisponible hors ligne.", "Réessayer", "Accueil"],
  id: ["Anda sedang offline", "Halaman ini tidak tersedia saat offline.", "Coba lagi", "Beranda"],
};

function relativePath(url) {
  return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname)
    ? url.pathname.slice(SCOPE.pathname.length)
    : null;
}

function isPublicPath(path) {
  return path !== null && (path === "" || /^(?:assets|data|analize|predictii|en)\//.test(path)
    || /^(?:index|simulator|istoric|track-record|metodologie|statistici-pariuri|terms|privacy)\.html$/.test(path)
    || path === "manifest.json");
}

function isPublicRequest(request) {
  const url = new URL(request.url);
  const path = relativePath(url);
  if (path === null || request.method !== "GET" || request.headers.has("authorization")
      || url.searchParams.has("members_token")) return false;
  return isPublicPath(path);
}

function cacheable(response) {
  return response.ok && !/\b(?:no-store|private)\b/i.test(response.headers.get("cache-control") || "")
    && (!response.url || isPublicPath(relativePath(new URL(response.url))));
}

function offlineResponse(request) {
  const headers = { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" };
  if (request.mode !== "navigate") return new Response("", { status: 503, headers });
  headers["content-type"] = "text/html; charset=utf-8";
  return new Response(`<!doctype html>
<html lang="ro"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${OFFLINE_COPY.ro[0]} · POSEIDON</title>
<style>
  body{margin:0;background:#051725;color:#eef5f8;font:1rem/1.55 system-ui,sans-serif}
  main{max-width:34rem;padding:2rem;margin:clamp(2rem,14vh,9rem) auto}
  h1{line-height:1.2} .actions{display:flex;flex-wrap:wrap;gap:.8rem}
  .actions>*{display:inline-grid;place-items:center;min-height:44px;padding:0 .85rem;border:1px solid #b4d3e6;border-radius:.4rem;font:inherit}
  button{background:#d9eef9;color:#051725;cursor:pointer} a{color:#eef5f8}
  :focus-visible{outline:3px solid #f2dc98;outline-offset:3px}
</style>
</head><body><main>
<h1>${OFFLINE_COPY.ro[0]}</h1><p>${OFFLINE_COPY.ro[1]}</p>
<div class="actions"><button type="button">${OFFLINE_COPY.ro[2]}</button><a href="${SCOPE.pathname}">${OFFLINE_COPY.ro[3]}</a></div>
</main><script>
const messages=${JSON.stringify(OFFLINE_COPY)};
let preferred;
try { preferred=localStorage.getItem("poseidon_lang"); } catch {}
const fallback=(navigator.language||"ro").slice(0,2).toLowerCase();
const lang=Object.hasOwn(messages,preferred)?preferred:Object.hasOwn(messages,fallback)?fallback:"en";
const [title, explanation, retry, home]=messages[lang];
document.documentElement.lang=lang;
document.title=title+" · POSEIDON";
document.querySelector("h1").textContent=title;
document.querySelector("p").textContent=explanation;
document.querySelector("a").textContent=home;
const button=document.querySelector("button");
button.textContent=retry;
button.addEventListener("click",()=>location.reload());
</script></body></html>`, { status: 503, headers });
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(async path => {
      const request = new Request(new URL(path, SCOPE), { cache: "reload" });
      const response = await fetch(request);
      if (cacheable(response)) await cache.put(request, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    if (keys.includes(LEGACY_CACHE)) {
      const [old, current] = await Promise.all([caches.open(LEGACY_CACHE), caches.open(CACHE)]);
      const requests = await old.keys();
      // Preserve previously visited public pages and their assets during the upgrade.
      await Promise.allSettled(requests.filter(isPublicRequest).map(async request => {
        if (await current.match(request)) return;
        const response = await old.match(request);
        if (response && cacheable(response)) await current.put(request, response);
      }));
    }
    await Promise.all(keys.filter(key => /^poseidon-v\d+$/.test(key) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (!isPublicRequest(request)) return;
  const network = fetch(request);
  const cache = caches.open(CACHE);
  event.waitUntil(network.then(async response => {
    if (cacheable(response)) {
      const copy = response.clone();
      await (await cache).put(request, copy);
    }
  }).catch(() => {}));
  event.respondWith(network.catch(async () => {
    const available = await cache;
    const url = new URL(request.url);
    const fingerprinted = url.searchParams.size === 1 && url.searchParams.has("v")
      && relativePath(url).startsWith("assets/");
    return (await available.match(request)) ||
      (fingerprinted && await available.match(url.origin + url.pathname)) ||
      offlineResponse(request);
  }));
});
