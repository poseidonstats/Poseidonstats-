/* „Propunerea noastră” (24 oct 2026) — citirea meciului DIN ECHIPE, nu din preț, pe cardurile meciurilor libere de pe prima pagină.
   Datele vin din data/citire.json (scris zilnic de ~/odds_decoder/scripts/citire_site.py, înainte de publicarea de la 06:10): familia de
   scor (două scoruri), direcția cu cifrele 1 / X / 2, golurile (interval + cel mai probabil), cine deschide scorul (echipa doar de la 65 %),
   0-0 la pauză, plus numerele de test pentru nota de onestitate. Se leagă de cardurile `.match[data-fid]` după fiecare randare a listei
   (MutationObserver pe #matches). Fără cote, fără limbaj de preț. Textele: cheile `citire.*` din i18n.json, prin tt() din app.js. */
(function () {
  const SELECTOR = ".match[data-fid]";
  const URL_CITIRE = "data/citire.json";
  const T = (k, ro) => (typeof tt === "function" ? tt(k, ro) : ro);
  const loc = () => (typeof _loc === "function" ? _loc() : "ro-RO");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nr = (x, d = 0) => Number(x).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d });

  const finite = x => typeof x === "number" && Number.isFinite(x);
  const percent = x => finite(x) && x >= 0 && x <= 100;
  const integer = x => Number.isInteger(x) && x >= 0 && x <= 100;
  function valid(c) {
    return c && Array.isArray(c.familia) && c.familia.length === 2 && c.familia.every(s => typeof s === "string" && /^\d{1,2}-\d{1,2}$/.test(s))
      && ["1", "X", "2"].includes(c.directia) && Array.isArray(c.p1x2) && c.p1x2.length === 3 && c.p1x2.every(percent)
      && c.goluri && Array.isArray(c.goluri.interval) && c.goluri.interval.length === 2 && c.goluri.interval.every(integer)
      && c.goluri.interval[0] <= c.goluri.interval[1] && integer(c.goluri.cel_mai_probabil) && percent(c.goluri.p_interval)
      && (c.deschide == null || ([null, "gazda", "oaspetele"].includes(c.deschide.echipa) && percent(c.deschide.p)))
      && (c.p00_pauza == null || percent(c.p00_pauza));
  }

  function html(c, testNr) {
    if (!valid(c)) return "";
    const sau = T("citire.sau", "sau");
    const parti = [
      `<span class="citire-rand">${T("citire.scor", "Scor")}: <b>${c.familia.map(esc).join(` ${sau} `)}</b></span>`,
      `<span class="citire-rand">${T("citire.directia", "Direcția")}: <b>${esc(c.directia)}</b> (${c.p1x2.join(" / ")})</span>`,
      `<span class="citire-rand">${T("citire.goluri", "Goluri")}: <b>${c.goluri.interval[0]}-${c.goluri.interval[1]}</b>, `
        + `${T("citire.cel_mai_probabil", "cel mai probabil {n}").replace("{n}", c.goluri.cel_mai_probabil)}</span>`,
    ];
    if (c.deschide) {
      const cine = c.deschide.echipa === "gazda" ? `${T("citire.gazda", "gazda")} ~${c.deschide.p} %`
        : c.deschide.echipa === "oaspetele" ? `${T("citire.oaspetele", "oaspeții")} ~${c.deschide.p} %`
        : T("citire.oricare", "oricare, {p} % gazda").replace("{p}", c.deschide.p);
      parti.push(`<span class="citire-rand">${T("citire.deschide", "Deschide scorul")}: <b>${cine}</b></span>`);
    }
    if (c.p00_pauza != null) parti.push(`<span class="citire-rand">${T("citire.p00", "0-0 la pauză")}: <b>${c.p00_pauza} %</b></span>`);
    // 24 oct 2026: fiecare metrică cu N-ul ei (familia și direcția N 75.996, intervalul N 75.430), o singură cifră pe TEST (nu „60,8-62,7”,
    // care amesteca testul cu antrenarea) și eticheta „variantă simplificată a formulei” — cifrele vin din backtest-ul proxy, nu din formula completă
    const t = testNr || {};
    const nN = m => (m && Number.isFinite(Number(m.n)) && Number(m.n) > 0 ? nr(m.n) : "–");
    const hit1 = (m, d = 0) => {
      if (!m) return "–";
      const h = Array.isArray(m.hit) ? m.hit[0] : m.hit;
      return Number.isFinite(Number(h)) ? nr(h, d) : "–";
    };
    const nota = T("citire.nota", "Citire din echipe, nu din preț. Numerele de test sunt pe o variantă simplificată a formulei: scorul exact din familie {fam} % (N {n_fam}), intervalul de goluri {int} % (N {n_int}), direcția {dir} % (N {n_dir}); formula completă are deocamdată doar un diagnostic pe un eșantion mai mic, nu o validare finală. Fiecare citire intră în bilanțul de a doua zi.")
      .replace("{n_fam}", nN(t.familia)).replace("{fam}", hit1(t.familia, 1))
      .replace("{n_int}", nN(t.interval)).replace("{int}", hit1(t.interval, 1))
      .replace("{n_dir}", nN(t.directia)).replace("{dir}", hit1(t.directia, 1));
    return `<div class="citire"><p class="citire-source">${esc(T("citire.source", "Context separat · formule_psg"))}</p><span class="citire-titlu">${T("citire.titlu", "Propunerea noastră")}</span>`
      + parti.join('<span class="citire-sep">·</span>') + `<span class="citire-nota">${nota}</span></div>`;
  }

  let DATE = null, request = null;
  function incarca() {
    if (!request) request = (async () => {
      try { const r = await fetch(URL_CITIRE, { cache: "no-store" }); if (r.ok) DATE = await r.json(); } catch (e) { DATE = null; }
      return DATE;
    })();
    return request;
  }
  function renderFor(identity) {
    if (!identity || identity.locked !== false || !["string", "number"].includes(typeof identity.fixture_id) || !/^[1-9]\d*$/.test(String(identity.fixture_id)) || !Number.isSafeInteger(Number(identity.fixture_id))
        || !DATE || typeof DATE.meciuri !== "object" || !DATE.meciuri || Array.isArray(DATE.meciuri) || !Object.hasOwn(DATE.meciuri, String(identity.fixture_id))) return "";
    const c = DATE.meciuri[String(identity.fixture_id)];
    const stamp = value => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
      const [year,month,day,hour,minute,second] = value.match(/\d+/g).slice(0,6).map(Number);
      return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year,month,0)).getUTCDate() && hour <= 23 && minute <= 59 && second <= 59 ? Date.parse(value) : NaN;
    };
    const generated = stamp(DATE.generated_at), kickoff = c && stamp(c.ko_utc), now = Date.now();
    if (!valid(c) || !Array.isArray(c.echipe) || c.echipe.length !== 2 || c.echipe[0] !== identity.home_team || c.echipe[1] !== identity.away_team
        || c.ko_utc !== identity.match_date || !Number.isFinite(kickoff) || generated >= kickoff || !Number.isFinite(generated) || generated > now || now - generated > 86400000
        || typeof c.versiune !== "string" || !c.versiune.startsWith("formule_psg ")) return "";
    return html(c, DATE.test);
  }
  function dashboardRow(identity) {
    const content = renderFor(identity);
    return content ? `<tr class="dashboard-reading-row" data-reading-for="${esc(identity.fixture_id)}" data-reading-language="${esc(loc())}"><td colspan="6">${content}</td></tr>` : "";
  }
  function aplica(root) {
    if (!DATE || !DATE.meciuri) return 0;
    let n = 0;
    (root || document).querySelectorAll(SELECTOR).forEach(card => {
      if ((card.classList && card.classList.contains("match-locked")) || card.querySelector(".citire")) return;
      const c = DATE.meciuri[card.getAttribute("data-fid")];
      if (!valid(c)) return;
      const antet = card.querySelector(".match-header");
      (antet || card).insertAdjacentHTML(antet ? "afterend" : "afterbegin", html(c, DATE.test));
      n++;
    });
    return n;
  }
  function aplicaDashboard(root) {
    let n = 0;
    (root || document).querySelectorAll("[data-reading-fixture]").forEach(row => {
      const identity = {fixture_id:row.getAttribute("data-reading-fixture"),home_team:row.getAttribute("data-reading-home"),away_team:row.getAttribute("data-reading-away"),match_date:row.getAttribute("data-reading-kickoff"),locked:row.getAttribute("data-reading-free") !== "true"};
      const anchor = row;
      const sibling = anchor.nextElementSibling;
      const existing = sibling && sibling.classList.contains("dashboard-reading-row") && sibling.getAttribute("data-reading-for") === identity.fixture_id ? sibling : null;
      const content = dashboardRow(identity);
      if (existing) {
        if (!content) existing.remove();
        else if (existing.getAttribute("data-reading-language") !== loc()) {existing.remove();anchor.insertAdjacentHTML("afterend", content);n++;}
      } else if (content) {anchor.insertAdjacentHTML("afterend", content);n++;}
    });
    return n;
  }
  function porneste(doc = document, Observer = MutationObserver) {
    const lista = doc.getElementById("matches"), table = doc.getElementById("dashboard-predictions");
    if (!lista && !table) return Promise.resolve();
    return incarca().then(() => {
      if (lista) {aplica(lista);new Observer(() => aplica(lista)).observe(lista, {childList:true});}
      if (table) {aplicaDashboard(table);new Observer(() => aplicaDashboard(table)).observe(table, {childList:true});}
    });
  }
  if (typeof document !== "undefined" && typeof document.readyState === "string") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => porneste()); else porneste();
  }
  window.POSEIDON_CITIRE = { html, aplica, aplicaDashboard, dashboardRow, renderFor, porneste, incarca, valid, SELECTOR };
})();
