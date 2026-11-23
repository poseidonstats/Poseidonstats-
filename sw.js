/* Public responses only. Keep the homepage and its versioned assets together. */
const CACHE = "poseidon-v127";
const RELEASE = "20261123-visitor-feed";
const PREVIOUS_CACHE = "poseidon-v126";
const PREVIOUS_RELEASE = "20261123-visitor-home";
// Update with RELEASE when these static files change. The daily dictionary is validated separately.
const RELEASE_ASSET_SHA256 = {
  "assets/app.js": "1ce1fe174a69e3c64860ae2746ca4a1fe25e88788c07270568e9ecae4c349ad3",
  "assets/home-dashboard.js": "f91aed33b17300e1b92af00891bde976fac4793f9e64e374aced546da46645b9",
  "assets/i18n-lite.js": "c5bd8e691a9640a986df7d8186b376480452ec5cc7870eed374bce3ff9c4be76",
  "assets/member-dossier.css": "0e4a89b6aba2e0ec1aca1f60d4c10fc7b52d6a26467899c733a4e9718fb646e2",
  "assets/member-dossier.js": "aacbff031cf599cdef22848b7a83c802cbcfc93f8b637799405a651d9696b884",
  "assets/pro-report.js": "59f49fe21a062c564eaa3ca0b7dea418fe88f3758e8cfa6b6e97e2e5941c9b0b",
  "assets/pro-context.js": "85883d7956fd08c68addc2966880103308b678f902c92eb4a3c68d719c3c987c",
  "assets/home-modern.css": "7d895e32f3dc529a75dcbe83a2075c31a92472159876811c73fa3b6c300b28eb",
  "assets/members.js": "a25510651b61bda03af790d9f38aaa6e95027343ac57335437c305737eb029ed",
  "assets/home-watchlist.js": "ab2473d038e3c2ac0f2d465dd35afd7ed616d38926a270c81ea9190465be35db",
  "assets/pro-report.css": "0354032afbda4e020f84c16c62960f6bf0d42256578e32b9843b76c3721b7939",
  "assets/conversion.js": "2e83078674dd83600fb53f70e65dc884605d5a7b07a50e3788a8ea8ed413c729",
  "assets/country-label.js": "8d2bc3956ddfab93f81fb7341b677a12ecb8525bdb603e05ca93b4401c8d34bd",
  "assets/home-visitor.css": "d3a6f18da617d6e730a556138004fa4a75918ed1ba7cb0b39cb009c9a0fcc57c",
  "assets/home-visitor.js": "4f7777552dcb375919d881824619b58930e3ee2b84956a4eb184a23a97ddda09",
};
const PREVIOUS_ASSET_SHA256 = {
  "assets/app.js": "cca7815571595bb638013d9920a0f8a1f13c6160371b2ff8feaf9af5c35a19b7",
  "assets/home-dashboard.js": "e6219fb93845f256f35a4a668ccb755c07b7113fa98dbe60c232b89e45691d06",
  "assets/i18n-lite.js": "f6d559fb6196d90e2d8ef8a5dbbec115d5912df42c3b15bd6c24e575bc6fc031",
  "assets/member-dossier.css": "0e4a89b6aba2e0ec1aca1f60d4c10fc7b52d6a26467899c733a4e9718fb646e2",
  "assets/member-dossier.js": "4d78d827d30d9ebde5d7da33d5479c055dd4156bc826ec657ee9ddac0ab0cea9",
  "assets/pro-report.js": "59f49fe21a062c564eaa3ca0b7dea418fe88f3758e8cfa6b6e97e2e5941c9b0b",
  "assets/pro-context.js": "85883d7956fd08c68addc2966880103308b678f902c92eb4a3c68d719c3c987c",
  "assets/home-modern.css": "7d895e32f3dc529a75dcbe83a2075c31a92472159876811c73fa3b6c300b28eb",
  "assets/members.js": "a25510651b61bda03af790d9f38aaa6e95027343ac57335437c305737eb029ed",
  "assets/home-watchlist.js": "ab2473d038e3c2ac0f2d465dd35afd7ed616d38926a270c81ea9190465be35db",
  "assets/pro-report.css": "0354032afbda4e020f84c16c62960f6bf0d42256578e32b9843b76c3721b7939",
  "assets/conversion.js": "2e83078674dd83600fb53f70e65dc884605d5a7b07a50e3788a8ea8ed413c729",
  "assets/country-label.js": "8d2bc3956ddfab93f81fb7341b677a12ecb8525bdb603e05ca93b4401c8d34bd",
  "assets/home-visitor.css": "c41ee79f9e0bc2ae93163b424c907acdd36858f991dbaf39ec203ae0ba096755",
  "assets/home-visitor.js": "08cc0a3f8da4fbaee6986cc2895d6060f2b1c7ce04490b81a22d3b38b6b9fcfb",
};
const HOME_PATHS = ["", "index.html", "meciuri.html"];
const HOME_ASSETS = [
  "assets/country-label.js",
  "assets/members.js",
  "assets/app.js",
  "assets/home-modern.css",
  "assets/home-visitor.css",
  "assets/home-visitor.js",
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
  "./meciuri.html",
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
  "./assets/home-visitor.css",
  "./assets/home-visitor.js",
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
    || /^(?:index|meciuri|simulator|istoric|track-record|metodologie|statistici-pariuri|terms|privacy)\.html$/.test(path)
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
    return ["ro", "en", "es", "it", "fr", "id"]
      .every(lang => Boolean(dictionary?.[lang]?.["pro.search.one"] && dictionary?.[lang]?.["webfree.banner"]
        && dictionary?.[lang]?.["webfree.dossiers"] && dictionary?.[lang]?.["webfree.pro"]
        && dictionary?.[lang]?.["webfree.ended"] && dictionary?.[lang]?.["dashboard.market.btts"]
        && dictionary?.[lang]?.["dashboard.watch.title"] && dictionary?.[lang]?.["dashboard.analysis.preview.read"]
        && dictionary?.[lang]?.["matchlist.back"] && dictionary?.[lang]?.["matchlist.halfUnavailable"]
        && (version === PREVIOUS_RELEASE || (["freeTitle", "freeNote", "freeTotal"]
          .every(key => Boolean(dictionary?.[lang]?.[`dashboard.chart.${key}`]))
          && ["title", "freeTitle", "freeOne", "free", "empty", "basic", "pro", "lockedTitle", "lockedMore", "lockedLess"]
            .every(key => Boolean(dictionary?.[lang]?.[`visitor.home.${key}`]))))));
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
    // The home entry points, catalog and the scoped assets must be ready before activation.
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
