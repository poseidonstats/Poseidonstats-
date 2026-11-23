/* Public responses only. Keep the homepage and its versioned assets together. */
const CACHE = "poseidon-v123";
const RELEASE = "20261123-markets-follow";
const PREVIOUS_CACHE = "poseidon-v122";
const PREVIOUS_RELEASE = "20261123-predictions-first";
// Update with RELEASE when these static files change. The daily dictionary is validated separately.
const RELEASE_ASSET_SHA256 = {
  "assets/app.js": "6742b987a5c8bab736e28dbed605026a367250f2c9b70ee1bb6dd1eb9a90056b",
  "assets/home-dashboard.js": "11f5e093a5cc23c1c3ce5df6167b44ebb7cbfd9725200811b3f380e0c8d42f23",
  "assets/i18n-lite.js": "f6d559fb6196d90e2d8ef8a5dbbec115d5912df42c3b15bd6c24e575bc6fc031",
  "assets/member-dossier.css": "0e4a89b6aba2e0ec1aca1f60d4c10fc7b52d6a26467899c733a4e9718fb646e2",
  "assets/member-dossier.js": "81b8a5ea98a500b443db21386a5dc30ab11f7ec47daa529fc74a44db882c6224",
  "assets/pro-report.js": "59f49fe21a062c564eaa3ca0b7dea418fe88f3758e8cfa6b6e97e2e5941c9b0b",
  "assets/pro-context.js": "85883d7956fd08c68addc2966880103308b678f902c92eb4a3c68d719c3c987c",
  "assets/home-modern.css": "6be292a4eab414b497d06b9c3c3f9449c96e6a2a2b7926bed3f065120b930bb7",
  "assets/members.js": "a25510651b61bda03af790d9f38aaa6e95027343ac57335437c305737eb029ed",
  "assets/home-watchlist.js": "ab2473d038e3c2ac0f2d465dd35afd7ed616d38926a270c81ea9190465be35db",
  "assets/pro-report.css": "0354032afbda4e020f84c16c62960f6bf0d42256578e32b9843b76c3721b7939",
  "assets/conversion.js": "2e83078674dd83600fb53f70e65dc884605d5a7b07a50e3788a8ea8ed413c729",
};
const PREVIOUS_ASSET_SHA256 = {
  "assets/app.js": "6aee1b70267050fb8e1acfb214e29488353153d8614832ecba52c7475b1d9bd6",
  "assets/home-dashboard.js": "cd52b1e1cf308bedaf7436def2c0121e0e1428197afebf6cf0c180a8ac79a53a",
  "assets/member-dossier.css": "ad2846535906b2ac472b41f9368675d3e2dd3a5f5acd4f9ab883fe841f463881",
  "assets/member-dossier.js": "cfb97ebaa9d43f51c3317590207523a57ae3854e2acf3d738fb52773160f83bd",
  "assets/pro-report.js": "7aa98e931ac6974fc1f3c8791833df02a4789a2df7a80ca3417498c70826fde3",
  "assets/pro-context.js": "85883d7956fd08c68addc2966880103308b678f902c92eb4a3c68d719c3c987c",
  "assets/home-modern.css": "ab8b6e83119846a87ad86a64f08d2749b62fdc3a985f93f9a4dea626f91b63a4",
  "assets/members.js": "a25510651b61bda03af790d9f38aaa6e95027343ac57335437c305737eb029ed",
};
const HOME_PATHS = ["", "index.html"];
const HOME_ASSETS = [
  "assets/members.js",
  "assets/app.js",
  "assets/home-modern.css",
  "assets/home-dashboard.js",
  "assets/home-watchlist.js",
  "assets/conversion.js",
  "assets/member-dossier.css",
  "assets/member-dossier.js",
];
const I18N_PATH = "assets/i18n.json";
const RELEASE_PATHS = new Set([...Object.keys(RELEASE_ASSET_SHA256), I18N_PATH]);
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
  "./assets/home-watchlist.js",
  "./assets/members.js",
  "./assets/member-dossier.js",
  "./assets/member-dossier.css",
  "./manifest.json",
];
const LEGACY_CACHE = "poseidon-v111";
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

function releaseUrl(path, version) {
  const url = new URL(path, SCOPE);
  url.searchParams.set("release", version);
  return url.href;
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

async function hasDigest(response, expected) {
  const bytes = await crypto.subtle.digest("SHA-256", await response.clone().arrayBuffer());
  const hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
  return hash === expected;
}

async function matchesRelease(path, response, version = RELEASE) {
  if (!cacheable(response)) return false;
  if (HOME_PATHS.includes(path)) {
    const html = await response.clone().text();
    return HOME_ASSETS.every(asset => html.includes(`${asset}?release=${RELEASE}"`));
  }
  if (path === I18N_PATH) {
    const dictionary = await response.clone().json().catch(() => null);
    if (!["ro", "en"].every(lang => Boolean(dictionary?.[lang]?.["redesign.edition.resultPending"]))) return false;
    return version === PREVIOUS_RELEASE || ["ro", "en", "es", "it", "fr", "id"]
      .every(lang => Boolean(dictionary?.[lang]?.["pro.search.one"] && dictionary?.[lang]?.["webfree.banner"]
        && dictionary?.[lang]?.["webfree.dossiers"] && dictionary?.[lang]?.["webfree.pro"]
        && dictionary?.[lang]?.["webfree.ended"] && dictionary?.[lang]?.["dashboard.market.btts"]
        && dictionary?.[lang]?.["dashboard.watch.title"] && dictionary?.[lang]?.["dashboard.analysis.preview.read"]));
  }
  return hasDigest(response, RELEASE_ASSET_SHA256[path]);
}

async function fetchRelease(request, path, cache, fallbackKey = request) {
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (await matchesRelease(path, response)) {
      await cache.put(fallbackKey, response.clone());
      return response;
    }
  } catch (_) {
    // Use the installed release on a network or cache write failure.
  }
  return (await cache.match(fallbackKey)) || offlineResponse(request);
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
    // Both home entry points and the scoped assets must be ready before activation.
    const requiredPaths = [...HOME_PATHS, ...RELEASE_PATHS];
    await Promise.all(requiredPaths.map(async path => {
      const request = new Request(RELEASE_PATHS.has(path) ? releaseUrl(path, RELEASE) : new URL(path, SCOPE),
        { cache: "reload" });
      const response = await fetch(request);
      if (!await matchesRelease(path, response)) throw new Error("Release resource unavailable: " + path);
      await cache.put(request, response.clone());
      if (RELEASE_PATHS.has(path)) await cache.put(new URL(path, SCOPE).href, response);
    }));
    await Promise.allSettled(SHELL.filter(path => !requiredPaths.includes(relativePath(new URL(path, SCOPE)))).map(async path => {
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
    if (keys.includes(PREVIOUS_CACHE)) {
      const [old, current] = await Promise.all([caches.open(PREVIOUS_CACHE), caches.open(CACHE)]);
      // An old URL may contain current bytes during rollout. Verify the body.
      await Promise.allSettled(Object.entries(PREVIOUS_ASSET_SHA256).map(async ([path, expected]) => {
        const url = releaseUrl(path, PREVIOUS_RELEASE);
        for (const key of [url, new URL(path, SCOPE).href]) {
          const response = await old.match(key);
          if (!response || !cacheable(response) || !await hasDigest(response, expected)) continue;
          await current.put(url, response);
          break;
        }
      }));
      const dictionaryUrl = releaseUrl(I18N_PATH, PREVIOUS_RELEASE);
      const dictionary = await old.match(dictionaryUrl);
      if (dictionary && await matchesRelease(I18N_PATH, dictionary, PREVIOUS_RELEASE)) await current.put(dictionaryUrl, dictionary);
    }
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
  const url = new URL(request.url);
  const path = relativePath(url);
  if (request.mode === "navigate" && HOME_PATHS.includes(path)) {
    event.respondWith(caches.open(CACHE).then(cache => fetchRelease(request, path, cache, new URL(path, SCOPE).href)));
    return;
  }
  const singleVersion = url.searchParams.size === 1;
  const currentRelease = singleVersion && url.searchParams.get("release") === RELEASE;
  const previousRelease = singleVersion && url.searchParams.get("release") === PREVIOUS_RELEASE;
  if (RELEASE_PATHS.has(path) && (currentRelease || previousRelease)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      // The daily publisher also updates the public audit copy in the dictionary.
      if (path === I18N_PATH && currentRelease) return fetchRelease(request, path, cache);
      const existing = await cache.match(request);
      if (existing) return existing;
      // Older archived pages can reuse an asset when both releases expect identical bytes.
      if (previousRelease) {
        const expected = PREVIOUS_ASSET_SHA256[path];
        if (!expected || expected !== RELEASE_ASSET_SHA256[path]) return offlineResponse(request);
        const currentUrl = releaseUrl(path, RELEASE);
        return (await cache.match(currentUrl)) || fetchRelease(currentUrl, path, cache);
      }
      return fetchRelease(request, path, cache);
    })());
    return;
  }
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
    const fingerprinted = url.searchParams.size === 1 && url.searchParams.has("v")
      && path.startsWith("assets/");
    return (await available.match(request)) ||
      (fingerprinted && await available.match(url.origin + url.pathname)) ||
      offlineResponse(request);
  }));
});
