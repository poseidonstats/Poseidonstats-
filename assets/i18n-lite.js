// 7 oct 2026 — i18n ușor pentru paginile GENERATE (analize/, predictii/): aceeași limbă ca restul site-ului (localStorage
// poseidon_lang), traduce [data-i18n] din assets/i18n.json, pune selectorul de limbă în nav și arată varianta [data-lang] potrivită.
(function () {
  var LANGS = ["ro", "en", "es", "it", "fr", "id"], NUME = { ro: "🇷🇴 Română", en: "🇬🇧 English", es: "🇪🇸 Español", it: "🇮🇹 Italiano", fr: "🇫🇷 Français", id: "🇮🇩 Bahasa Indonesia" };  // 14 oct 2026: + fr, + id
  function lang() { try { var s = localStorage.getItem("poseidon_lang"); if (LANGS.indexOf(s) >= 0) return s; } catch (e) {} var b = (navigator.language || "ro").slice(0, 2); return LANGS.indexOf(b) >= 0 ? b : "en"; }  // 14 oct 2026: limbile pe care nu le avem cad pe engleză
  var L = lang(); var sus = (document.currentScript && document.currentScript.getAttribute("data-sus")) || "";
  // Generated public pages keep their content; theme their shared shell here so regeneration stays safe.
  function temaPublica() {
    var canonical = document.querySelector('link[rel="canonical"]');
    var path = location.pathname;
    if (canonical) {
      try { path = new URL(canonical.getAttribute("href"), document.baseURI).pathname; } catch (e) { return; }
    }
    var analysis = /^\/analize\//.test(path), prediction = /^\/(?:predictii|en\/predictions)\//.test(path);
    var statistics = path === "/statistici-pariuri.html" || path === "/en/betting-odds-statistics.html";
    if ((!analysis && !prediction && !statistics) || !document.body) return;
    document.body.classList.add("home-modern", "secondary-modern", analysis ? "analysis-modern" : prediction ? "prediction-modern" : "stats-modern");
    var currentKey = analysis ? "nav.analize" : prediction ? "nav.ligi" : "";
    ["home-modern", "pages-modern"].forEach(function (name) {
      var href = sus + "assets/" + name + ".css";
      var absolute = new URL(href, document.baseURI).href;
      var present = document.getElementById("public-" + name + "-style") || Array.prototype.some.call(document.querySelectorAll('link[rel="stylesheet"]'), function (link) {
        return new URL(link.getAttribute("href"), document.baseURI).href === absolute;
      });
      if (present) return;
      var link = document.createElement("link");
      link.setAttribute("id", "public-" + name + "-style");
      link.setAttribute("rel", "stylesheet");
      link.setAttribute("href", href);
      document.head.appendChild(link);
    });
    // The script is inside header and main is not parsed yet. Only update brand/nav, retaining tagline and script.
    var header = document.querySelector("header");
    var brand = header && header.querySelector(".brand"), nav = header && header.querySelector("nav");
    if (brand) {
      brand.setAttribute("href", sus + "index.html");
      brand.innerHTML = '<span class="brand-icon" aria-hidden="true"><svg viewBox="0 0 40 48" fill="none"><path d="M20 44V7M13 14l7-9 7 9M7 8v12c0 7 5 11 13 11s13-4 13-11V8M2 13l5-7 5 7M28 13l5-7 5 7M13 43h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="brand-name">POSEIDON<span>STATS</span></span>';
    }
    if (!nav || nav.getAttribute("data-public-modern") === "true") return;
    nav.setAttribute("data-public-modern", "true");
    nav.innerHTML = "";
    function lien(parent, href, key, text, css) {
      var a = document.createElement("a");
      a.setAttribute("href", href.indexOf("mailto:") === 0 ? href : sus + href);
      a.setAttribute("data-i18n", key);
      a.textContent = text;
      if (css) a.className = css;
      if (key === currentKey) {
        a.classList.add("active");
        a.setAttribute("aria-current", new URL(href, new URL(sus, document.baseURI)).pathname === path ? "page" : "location");
      }
      parent.appendChild(a);
    }
    lien(nav, "index.html", "dashboard.nav.home", "Acasă");
    lien(nav, "index.html#dashboard", "nav.predictii", "Predicții");
    lien(nav, "analize/index.html", "nav.analize", "Analize");
    lien(nav, "track-record.html", "nav.trackrecord", "Track record");
    lien(nav, "metodologie.html", "nav.metodologie", "Metodologie");
    lien(nav, "index.html#abonament", "nav.abonamente", "Abonamente", "patreon");
    var more = document.createElement("details"), summary = document.createElement("summary"), menu = document.createElement("div");
    more.className = "nav-more";
    summary.setAttribute("data-i18n", "dashboard.nav.more");
    summary.textContent = "Mai mult";
    if (prediction) summary.className = "active";
    more.appendChild(summary);
    more.appendChild(menu);
    lien(menu, path.indexOf("/en/") === 0 ? "en/predictions/index.html" : "predictii/index.html", "nav.ligi", "Pe ligi");
    lien(menu, "simulator.html", "nav.simulator", "Simulator");
    lien(menu, "istoric.html", "nav.istoric", "Istoric");
    lien(menu, "index.html#intrebari", "faq.h2", "Întrebări frecvente");
    lien(menu, "mailto:contact@poseidonstats.com", "footer.contact", "Contact:");
    nav.appendChild(more);
  }
  temaPublica();
  // Older generated date spans contain unescaped HTML attribute quotes inside JSON strings.
  function normalizareVariabile() {
    document.querySelectorAll("[data-i18n-vars]").forEach(function (el) {
      var raw = el.getAttribute("data-i18n-vars");
      try { JSON.parse(raw); return; } catch (e) {}
      var repaired = raw.replace(/<[^<>]*>/g, function (tag) {
        return tag.replace(/\\.|"/g, function (token) { return token === '"' ? '\\"' : token; });
      });
      try { el.setAttribute("data-i18n-vars", JSON.stringify(JSON.parse(repaired))); }
      catch (e) { el.removeAttribute("data-i18n"); } // Keep original content when recovery is impossible.
    });
  }
  function traduceCandGata(I) {
    function reda() { normalizareVariabile(); aplica(I); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", reda, { once: true });
    else reda();
  }
  function aplica(I) {
    document.documentElement.lang = L;
    for (var trecere = 0; trecere < 2; trecere++) document.querySelectorAll("[data-i18n]").forEach(function (el) { if (trecere === 1 && !(el.parentElement && el.parentElement.closest("[data-i18n]"))) return;
      var k = el.getAttribute("data-i18n"); var v = (I[L] && I[L][k]) || (I.ro && I.ro[k]); if (!v) return;
      var vars = el.getAttribute("data-i18n-vars"); if (vars) { try { var o = JSON.parse(vars); Object.keys(o).forEach(function (n) { v = v.split("{" + n + "}").join(o[n]); }); } catch (e) {} }
      el.innerHTML = v;
    });
    var fmt = new Intl.DateTimeFormat(L === "en" ? "en-GB" : L === "es" ? "es-ES" : L === "it" ? "it-IT" : L === "fr" ? "fr-FR" : L === "id" ? "id-ID" : "ro-RO", { day: "numeric", month: "long", year: "numeric" });
    document.querySelectorAll("[data-date]").forEach(function (el) { var d = el.getAttribute("data-date"); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) el.textContent = fmt.format(new Date(d + "T12:00:00Z")); });
    document.querySelectorAll("[data-lang]").forEach(function (el) { el.hidden = el.getAttribute("data-lang") !== L; });
    // dacă nu există varianta în limba aleasă, rămâne româna
    document.querySelectorAll("[data-lang-grup]").forEach(function (g) { var are = g.querySelector('[data-lang="' + L + '"]'); if (!are) { var en = g.querySelector('[data-lang="en"]'), ro = g.querySelector('[data-lang="ro"]'), alt = en || ro; if (alt) { alt.hidden = false; if (alt === ro && L !== "ro" && !g.querySelector(".nota-ro")) { var n = document.createElement("p"); n.className = "muted nota-ro"; n.textContent = (I[L] && I[L]["arhiva.nota_ro"]) || ""; if (n.textContent) g.insertBefore(n, ro); } } } });
    // analizele mai vechi de 7 oct 2026 nu au traducere (articol fără grup de limbi): notă scurtă
    if (L !== "ro") document.querySelectorAll("article.pro-card-full").forEach(function (a) { if (!a.closest("[data-lang-grup]") && !a.querySelector(".nota-ro")) { var n = document.createElement("p"); n.className = "muted nota-ro"; n.textContent = (I[L] && I[L]["arhiva.nota_ro"]) || ""; var v = a.querySelector(".pro-visible"); if (n.textContent && v) v.insertBefore(n, v.firstChild); } });
  }
  function selector() {
    var nav = document.querySelector("nav"); if (!nav || nav.querySelector(".lang-switcher")) return;
    var w = document.createElement("div"); w.className = "lang-switcher";
    w.innerHTML = '<select class="lang-select" aria-label="Language">' + LANGS.map(function (l) { return '<option value="' + l + '"' + (l === L ? " selected" : "") + ">" + NUME[l] + "</option>"; }).join("") + "</select>";
    nav.appendChild(w);
    w.querySelector("select").addEventListener("change", function (e) { try { localStorage.setItem("poseidon_lang", e.target.value); } catch (x) {} location.reload(); });
  }
  selector();
  fetch(sus + "assets/i18n.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(traduceCandGata).catch(function () {});
})();
