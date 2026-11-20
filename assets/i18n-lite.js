// 7 oct 2026 — i18n ușor pentru paginile GENERATE (analize/, predictii/): aceeași limbă ca restul site-ului (localStorage
// poseidon_lang), traduce [data-i18n] din assets/i18n.json, pune selectorul de limbă în nav și arată varianta [data-lang] potrivită.
(function () {
  var LANGS = ["ro", "en", "es", "it", "fr", "id"], NUME = { ro: "🇷🇴 Română", en: "🇬🇧 English", es: "🇪🇸 Español", it: "🇮🇹 Italiano", fr: "🇫🇷 Français", id: "🇮🇩 Bahasa Indonesia" };  // 14 oct 2026: + fr, + id
  var englishLeague = /^\/en\/predictions\//.test(location.pathname);
  function lang() { try { var s = localStorage.getItem("poseidon_lang"); if (LANGS.indexOf(s) >= 0) return s; } catch (e) {} if (englishLeague) return "en"; var b = (navigator.language || "ro").slice(0, 2).toLowerCase(); return LANGS.indexOf(b) >= 0 ? b : "en"; }
  var pageLanguage = document.documentElement.lang || "ro";

  function metadataUrl(selector, rel) {
    var link = document.querySelector(selector);
    if (!link || link.getAttribute("rel") !== rel || !link.getAttribute("href")) return null;
    try { return new URL(link.getAttribute("href"), document.baseURI); } catch (e) { return null; }
  }

  function publicEditionPair() {
    if (pageLanguage !== "ro" && pageLanguage !== "en") return null;
    var ro = metadataUrl('link[hreflang="ro"]', "alternate");
    var en = metadataUrl('link[hreflang="en"]', "alternate");
    var canonical = metadataUrl('link[rel="canonical"]', "canonical");
    if (!ro || !en || !canonical || ro.origin !== canonical.origin || en.origin !== canonical.origin) return null;
    var current = pageLanguage === "ro" ? ro : en;
    var leagues = /^\/predictii\/[^/]+\.html$/.test(ro.pathname) &&
      /^\/en\/predictions\/[^/]+\.html$/.test(en.pathname);
    var statistics = ro.pathname === "/statistici-pariuri.html" && en.pathname === "/en/betting-odds-statistics.html";
    if ((!leagues && !statistics) || current.href !== canonical.href) return null;
    var path = location.pathname;
    var alias = path.endsWith("/") ? path + "index.html" : path + ".html";
    if (current.pathname !== path && current.pathname !== alias) return null;
    // Canonicals are absolute, including in a local preview. Navigation stays on the current origin.
    return { ro: ro.pathname, en: en.pathname };
  }

  var editionPair = publicEditionPair();
  var L = editionPair ? pageLanguage : lang();
  var sus = (document.currentScript && document.currentScript.getAttribute("data-sus")) || "";
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
      var href = sus + "assets/" + name + ".css?v=20261119-functions";
      var absolute = new URL(href, document.baseURI);
      var present = document.getElementById("public-" + name + "-style") || Array.prototype.some.call(document.querySelectorAll('link[rel="stylesheet"]'), function (link) {
        var existing = new URL(link.getAttribute("href"), document.baseURI);
        return existing.origin === absolute.origin && existing.pathname === absolute.pathname;
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
    var englishLeagues = L === "en" || (prediction && path.indexOf("/en/") === 0);
    lien(menu, englishLeagues ? "en/predictions/index.html" : "predictii/index.html", "nav.ligi", "Pe ligi");
    lien(menu, "simulator.html", "nav.simulator", "Simulator");
    lien(menu, "istoric.html", "nav.istoric", "Istoric");
    lien(menu, "index.html#intrebari", "faq.h2", "Întrebări frecvente");
    lien(menu, "mailto:contact@poseidonstats.com", "footer.contact", "Contact:");
    more.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !more.open) return;
      event.preventDefault();
      more.open = false;
      summary.focus({ preventScroll: true });
    });
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
    function reda() {
      normalizareVariabile(); aplica(I);
      if (document.querySelector('.pro-card')) {
        if (window.PoseidonProReport) window.PoseidonProReport.scan();
        else if (!document.getElementById('pro-report-script')) {
          var style = document.createElement('link'); style.rel = 'stylesheet'; style.href = sus + 'assets/pro-report.css?v=20261118e'; document.head.appendChild(style);
          var report = document.createElement('script'); report.id = 'pro-report-script'; report.src = sus + 'assets/pro-context.js?release=20261121-pro-contextual';
          report.onload = function () { var ui = document.createElement('script'); ui.src = sus + 'assets/pro-report.js?release=20261121-pro-contextual'; document.head.appendChild(ui); };
          report.onerror = report.onload;
          document.head.appendChild(report);
        }
      }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", reda, { once: true });
    else reda();
  }
  function aplica(I) {
    document.documentElement.lang = editionPair ? pageLanguage : L;
    for (var trecere = 0; trecere < 2; trecere++) document.querySelectorAll("[data-i18n]").forEach(function (el) { if (trecere === 1 && !(el.parentElement && el.parentElement.closest("[data-i18n]"))) return;
      var k = el.getAttribute("data-i18n");
      var translated = I[L] && I[L][k];
      var v = translated || (I.ro && I.ro[k]);
      if (!v) return;
      var o = {};
      ["data-i18n-vars", "data-i18n-vars-" + L].forEach(function (attr) {
        var vars = el.getAttribute(attr);
        if (vars) { try { Object.assign(o, JSON.parse(vars)); } catch (e) {} }
      });
      Object.keys(o).forEach(function (n) { v = v.split("{" + n + "}").join(o[n]); });
      if (editionPair) el.setAttribute("lang", translated ? L : "ro");
      el.innerHTML = v;
    });
    var locale = { ro: "ro-RO", en: "en-GB", es: "es-ES", it: "it-IT", fr: "fr-FR", id: "id-ID" }[L];
    var ints = new Intl.NumberFormat(locale);
    document.querySelectorAll("[data-match-count]").forEach(function (el) {
      var raw = el.getAttribute("data-match-count");
      var n = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n)) return;
      var key = n === 1 ? "n.meci1" : "n.meciuri";
      var label = (I[L] && I[L][key]) || (I.ro && I.ro[key]);
      if (!label) return;
      var roDe = L === "ro" && n >= 20 && (n % 100 === 0 || n % 100 >= 20);
      el.textContent = label.replace("{n}", ints.format(n) + (roDe ? " de" : ""));
    });
    document.querySelectorAll("[data-decimal]").forEach(function (el) {
      var value = el.getAttribute("data-decimal");
      if (!/^-?\d+(?:\.\d{1,12})?$/.test(value)) return;
      var decimals = (value.split(".")[1] || "").length;
      el.textContent = new Intl.NumberFormat(locale, {minimumFractionDigits:decimals, maximumFractionDigits:decimals}).format(Number(value));
    });
    if (L !== "ro" && typeof window !== "undefined" && window.PoseidonCountry) {
      document.querySelectorAll("[data-country-label]").forEach(function (el) {
        el.textContent = window.PoseidonCountry.label(el.getAttribute("data-country-label"), locale);
      });
    }
    var fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });
    document.querySelectorAll("[data-date]").forEach(function (el) { var d = el.getAttribute("data-date"); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) el.textContent = fmt.format(new Date(d + "T12:00:00Z")); });
    var monthFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
    document.querySelectorAll("[data-month]").forEach(function (el) {
      var month = el.getAttribute("data-month");
      if (/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) el.textContent = monthFmt.format(new Date(month + "-15T12:00:00Z"));
    });
    if (!editionPair && L !== pageLanguage) {
      var heading = document.querySelector("h1[data-i18n]");
      if (heading && heading.textContent.trim()) document.title = heading.textContent.replace(/\s+/g, " ").trim() + " | POSEIDON";
    }
    var editionNotice = document.querySelector("[data-edition-notice]");
    if (editionNotice) {
      editionNotice.setAttribute("lang", L);
      editionNotice.hidden = L === pageLanguage;
    }
    document.querySelectorAll("[data-lang]").forEach(function (el) { el.hidden = el.getAttribute("data-lang") !== L; });
    document.querySelectorAll("[data-lang-grup]").forEach(function (group) {
      if (group.querySelector('[data-lang="' + L + '"]')) return;
      var english = group.querySelector('[data-lang="en"]');
      var fallback = english || group.querySelector('[data-lang="ro"]');
      if (!fallback) return;
      fallback.hidden = false;
      var family = english ? "en" : "ro";
      fallback.setAttribute("lang", family);
      if (document.body.classList.contains("analysis-modern")) archiveLanguageNotice(I, group, fallback, family);
    });
    if (L !== "ro" && document.body.classList.contains("analysis-modern")) document.querySelectorAll("article.pro-card-full").forEach(function (article) {
      if (article.closest("[data-lang-grup]")) return;
      var body = article.querySelector(".pro-visible");
      if (body) archiveLanguageNotice(I, body, body.firstChild, "ro");
    });
  }
  function archiveLanguageNotice(I, container, before, language) {
    if (container.querySelector(".nota-ro")) return;
    var notice = document.createElement("p");
    notice.className = "muted nota-ro";
    notice.textContent = (I[L] && I[L]["arhiva.nota_" + language]) || "";
    if (notice.textContent) container.insertBefore(notice, before);
  }
  function selector() {
    var nav = document.querySelector("nav"); if (!nav || nav.querySelector(".lang-switcher")) return;
    var w = document.createElement("div"); w.className = "lang-switcher";
    w.innerHTML = '<select class="lang-select" aria-label="Language">' + LANGS.map(function (l) { return '<option value="' + l + '"' + (l === L ? " selected" : "") + ">" + NUME[l] + "</option>"; }).join("") + "</select>";
    nav.appendChild(w);
    w.querySelector("select").addEventListener("change", function (e) {
      var selected = e.target.value;
      if (LANGS.indexOf(selected) < 0) return;
      try { localStorage.setItem("poseidon_lang", selected); } catch (x) {}
      if (!editionPair) {
        location.reload();
        return;
      }
      if ((selected === "ro" || selected === "en") && selected !== pageLanguage) {
        location.assign(editionPair[selected]);
        return;
      }
      L = selected;
      dictionaryReady.then(traduceCandGata).catch(function () {});
    });
  }
  selector();
  var dictionaryReady = fetch(sus + "assets/i18n.json?v=20261119-functions", { cache: "no-cache" }).then(function (r) { return r.json(); });
  dictionaryReady.then(traduceCandGata).catch(function () {});
})();
