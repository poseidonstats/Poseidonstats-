// 7 oct 2026 — i18n ușor pentru paginile GENERATE (analize/, predictii/): aceeași limbă ca restul site-ului (localStorage
// poseidon_lang), traduce [data-i18n] din assets/i18n.json, pune selectorul de limbă în nav și arată varianta [data-lang] potrivită.
(function () {
  var LANGS = ["ro", "en", "es", "it"], NUME = { ro: "🇷🇴 Română", en: "🇬🇧 English", es: "🇪🇸 Español", it: "🇮🇹 Italiano" };
  function lang() { try { var s = localStorage.getItem("poseidon_lang"); if (LANGS.indexOf(s) >= 0) return s; } catch (e) {} var b = (navigator.language || "ro").slice(0, 2); return LANGS.indexOf(b) >= 0 ? b : "ro"; }
  var L = lang(); var sus = (document.currentScript && document.currentScript.getAttribute("data-sus")) || "";
  function aplica(I) {
    document.documentElement.lang = L;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n"); var v = (I[L] && I[L][k]) || (I.ro && I.ro[k]); if (!v) return;
      var vars = el.getAttribute("data-i18n-vars"); if (vars) { try { var o = JSON.parse(vars); Object.keys(o).forEach(function (n) { v = v.split("{" + n + "}").join(o[n]); }); } catch (e) {} }
      el.innerHTML = v;
    });
    var fmt = new Intl.DateTimeFormat(L === "en" ? "en-GB" : L === "es" ? "es-ES" : L === "it" ? "it-IT" : "ro-RO", { day: "numeric", month: "long", year: "numeric" });
    document.querySelectorAll("[data-date]").forEach(function (el) { var d = el.getAttribute("data-date"); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) el.textContent = fmt.format(new Date(d + "T12:00:00Z")); });
    document.querySelectorAll("[data-lang]").forEach(function (el) { el.hidden = el.getAttribute("data-lang") !== L; });
    // dacă nu există varianta în limba aleasă, rămâne româna
    document.querySelectorAll("[data-lang-grup]").forEach(function (g) { var are = g.querySelector('[data-lang="' + L + '"]'); if (!are) { var ro = g.querySelector('[data-lang="ro"]'); if (ro) ro.hidden = false; } });
  }
  function selector() {
    var nav = document.querySelector("nav"); if (!nav || nav.querySelector(".lang-switcher")) return;
    var w = document.createElement("div"); w.className = "lang-switcher";
    w.innerHTML = '<select class="lang-select" aria-label="Language">' + LANGS.map(function (l) { return '<option value="' + l + '"' + (l === L ? " selected" : "") + ">" + NUME[l] + "</option>"; }).join("") + "</select>";
    nav.appendChild(w);
    w.querySelector("select").addEventListener("change", function (e) { try { localStorage.setItem("poseidon_lang", e.target.value); } catch (x) {} location.reload(); });
  }
  selector();
  fetch(sus + "assets/i18n.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(aplica).catch(function () {});
})();
