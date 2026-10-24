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

  function html(c, testNr) {
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
    const t = testNr || {};
    const nota = T("citire.nota", "Citire din echipe, nu din preț. Pe test ({n} meciuri): scorul exact din familie {fam} %, intervalul de goluri {int} %, direcția {dir} %. Fiecare citire intră în bilanțul de a doua zi.")
      .replace("{n}", t.familia && t.familia.n ? nr(t.familia.n) : "–")
      .replace("{fam}", t.familia ? nr(t.familia.hit, 1) : "–")
      .replace("{int}", t.interval && t.interval.hit ? `${nr(t.interval.hit[0])}-${nr(t.interval.hit[1])}` : "–")
      .replace("{dir}", t.directia ? nr(t.directia.hit) : "–");
    return `<div class="citire"><span class="citire-titlu">${T("citire.titlu", "Propunerea noastră")}</span>`
      + parti.join('<span class="citire-sep">·</span>') + `<span class="citire-nota">${nota}</span></div>`;
  }

  let DATE = null, cerut = false;
  async function incarca() {
    if (cerut) return DATE;
    cerut = true;
    try { const r = await fetch(URL_CITIRE, { cache: "no-store" }); if (r.ok) DATE = await r.json(); } catch (e) { DATE = null; }
    return DATE;
  }
  function aplica(root) {
    if (!DATE || !DATE.meciuri) return 0;
    let n = 0;
    (root || document).querySelectorAll(SELECTOR).forEach(card => {
      if (card.querySelector(".citire")) return;
      const c = DATE.meciuri[card.getAttribute("data-fid")];
      if (!c) return;
      const antet = card.querySelector(".match-header");
      (antet || card).insertAdjacentHTML(antet ? "afterend" : "afterbegin", html(c, DATE.test));
      n++;
    });
    return n;
  }
  function porneste() {
    const lista = document.getElementById("matches");
    if (!lista) return;
    incarca().then(() => { aplica(lista); new MutationObserver(() => aplica(lista)).observe(lista, { childList: true }); });
  }
  if (typeof document !== "undefined" && typeof document.readyState === "string") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", porneste); else porneste();
  }
  window.POSEIDON_CITIRE = { html, aplica, incarca, SELECTOR };
})();
