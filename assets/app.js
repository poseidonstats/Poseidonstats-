/* POSEIDON site — vanilla JS, citește JSON-uri, render. */

const PRED_URL = "data/predictions.json";
const CALIB_URL = "data/calibration.json";
const FORWARD_URL = "data/forward.json";
const HISTORY_URL = "data/history.json";
const SCORECARD_URL = "data/scorecard.json";
const I18N_URL = "assets/i18n.json";

// 🆕 29 iun — scorecard skill per piață (din backtest OOS). Picks-urile (badge verde) se
// extind data-driven la TOATE piețele cu tier=PICK, fiecare cu pragul + stelele ei de skill.
// Fallback grațios: dacă scorecard.json lipsește → SCORECARD {} → picks cad pe cele 2 brand.
let SCORECARD = {};                       // key -> card (label, tier, threshold, skill_stars, lift_pp, hit)
const PICK_PROB = {                       // cheie scorecard -> probabilitatea din match
  "1x2_home":    m => m.prob_home,
  "1x2_away":    m => m.prob_away,
  "dc_1x":       m => m.prob_1x,
  "dc_x2":       m => m.prob_x2,
  "dc_12":       m => m.prob_12,
  "over_1_5":    m => m.prob_over_1_5,
  "over_2_5":    m => m.prob_over_2_5,
  "under_3_5":   m => (m.prob_over_3_5 != null ? 1 - m.prob_over_3_5 : null),
  "ht_over_0_5": m => m.prob_ht_over_0_5,
};
const PICK_LABEL = {                       // label scurt pt badge
  "1x2_home": "1", "1x2_away": "2", "dc_1x": "1X", "dc_x2": "X2", "dc_12": "12",
  "over_1_5": "Over 1.5", "over_2_5": "Over 2.5", "under_3_5": "Under 3.5", "ht_over_0_5": "HT O0.5",
};
const PICK_FILTER = {                       // cheie scorecard -> valoarea filtrului „Piață"
  "over_1_5": "over_1_5", "over_2_5": "over_2_5", "under_3_5": "under_3_5",
  "ht_over_0_5": "ht_over_0_5", "1x2_home": "1x2", "1x2_away": "1x2",
  "dc_1x": "dc_1x", "dc_x2": "dc_x2", "dc_12": "dc_12",
};

/* ============== i18n ============== */
let I18N = null;
let LANG = "ro";

function detectLang() {
  const saved = localStorage.getItem("poseidon_lang");
  if (saved && ["ro","en","es","it"].includes(saved)) return saved;
  const bl = (navigator.language || "ro").slice(0,2).toLowerCase();
  if (["en","es","it","ro"].includes(bl)) return bl;
  return "ro";
}

function t(key) {
  if (!I18N) return key;
  return (I18N[LANG] && I18N[LANG][key]) || (I18N.ro && I18N.ro[key]) || key;
}

function _loc() { return LANG === "en" ? "en-GB" : LANG === "es" ? "es-ES" : LANG === "it" ? "it-IT" : "ro-RO"; }
function applyI18n() {
  if (!I18N) return;
  for (let trecere = 0; trecere < 2; trecere++) document.querySelectorAll("[data-i18n]").forEach(el => {   // a 2-a trecere: span-uri injectate prin {variabile}
    const key = el.getAttribute("data-i18n");
    let v = t(key); if (v === key) return;
    // 7 oct 2026: variabile {x} (data-i18n-vars, JSON) — aceeași convenție ca i18n-lite pe paginile generate
    const vars = el.getAttribute("data-i18n-vars");
    if (vars) { try { const o = JSON.parse(vars.replace(/&#39;/g, "'")); Object.keys(o).forEach(n => { v = v.split("{" + n + "}").join(o[n]); }); } catch (e) {} }
    el.innerHTML = v;
  });
  // date în limba aleasă
  try {
    const fmt = new Intl.DateTimeFormat(_loc(), { day: "numeric", month: "long", year: "numeric" });
    document.querySelectorAll("[data-date]").forEach(el => { const dd = el.getAttribute("data-date"); if (/^\d{4}-\d{2}-\d{2}$/.test(dd)) el.textContent = fmt.format(new Date(dd + "T12:00:00Z")); });
  } catch (e) {}
  document.querySelectorAll("[data-i18n-attr]").forEach(el => {
    // format: "attr:key,attr:key"
    el.getAttribute("data-i18n-attr").split(",").forEach(pair => {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr.trim(), t(key.trim()));
    });
  });
  document.documentElement.lang = LANG;
}

async function initI18n() {
  I18N = await fetchJSON(I18N_URL);
  LANG = detectLang();
  applyI18n();
  mountLangSwitcher();
  // Cifrele vii se injectează DUPĂ i18n (applyI18n rescrie innerHTML pe [data-i18n])
  loadLiveStats().then(injectLiveStats);
}

function mountLangSwitcher() {
  const nav = document.querySelector("header nav");
  if (!nav || nav.querySelector(".lang-switcher")) return;
  const wrap = document.createElement("span");
  wrap.className = "lang-switcher";
  const FLAGS = { ro:"🇷🇴", en:"🇬🇧", es:"🇪🇸", it:"🇮🇹" };
  wrap.innerHTML = `<select class="lang-select" aria-label="Language">
    ${["ro","en","es","it"].map(l => `<option value="${l}" ${l===LANG?"selected":""}>${FLAGS[l]} ${I18N && I18N[l] ? I18N[l]["lang.name"] : l.toUpperCase()}</option>`).join("")}
  </select>`;
  nav.appendChild(wrap);
  wrap.querySelector("select").addEventListener("change", e => {
    LANG = e.target.value;
    localStorage.setItem("poseidon_lang", LANG);
    applyI18n();
    injectLiveStats(); // re-injectare după ce applyI18n a rescris [data-i18n]
    // Re-render pagini dinamice
    if (document.getElementById("matches")) renderIndex().then(renderProAnalize);
    if (document.getElementById("days-list")) renderIstoric();
    if (document.getElementById("calibration-tables")) renderTrackRecord();
    if (document.getElementById("sim-gen-result")) renderSimulator();
  });
}

// Auto-init pe TOATE paginile (cu i18n.json fetch)
if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => { initI18n(); });
}

// 28 sept 2026 — zona de membri: membrii (Basic/Pro, login Patreon) primesc setul complet de la worker;
// fără token sau fără API configurat → fișierul public (5 gratuite + restul cu lacăt), exact ca înainte.
let PRED_SURSA = "public";
let PRED_CU_TOKEN = false;   // prima încărcare a pornit deja cu token → plasa de siguranță de la DOMContentLoaded nu mai redesenează (evita 2× 2 MB)
async function loadPredictions() {
  const M = (typeof window !== "undefined") ? window.PoseidonMembers : null;
  if (M && M.MEMBERS_API) {
    if (M.tier()) {
      PRED_CU_TOKEN = true;
      // 7 oct 2026 (Andreea, logată: „tot scrolez mult până la meciuri”): membrul nu are nevoie de prezentare.
      // body.is-member + tier-basic/tier-pro → CSS ascunde intro/dovadă; Basic: exemplul Pro (upsell) coboară SUB lista de meciuri.
      try {
        document.body.classList.add("is-member", "tier-" + M.tier());
        const mt = document.getElementById("matches");
        if (M.tier() === "basic") { const ex = document.getElementById("exemplu-pro"); if (ex && mt && mt.parentNode) mt.parentNode.insertBefore(ex, mt.nextSibling); }
        // reperele zilei coboară sub listă: membrul vrea lista imediat (analize Pro → filtre pliate → meciuri)
        const rep = document.getElementById("repere-azi"); if (rep && mt && mt.parentNode) mt.parentNode.insertBefore(rep, mt.nextSibling);
      } catch (e) {}
    }
    const r = await M.incarca(PRED_URL);
    PRED_SURSA = r.sursa;
    // 6 oct 2026: abonat valid, dar datele membrilor n-au venit (9 zile de KV gol au trecut neobservate) → spunem clar, nu lacăte tăcute
    if (M.tier() && r.sursa === "public" && r.eroare && r.eroare !== 401 && r.eroare !== 403) {
      const b = document.getElementById("match-count");
      if (b) b.insertAdjacentHTML("beforebegin", `<p class="membru-eroare">⚠️ ${tt("membru.eroare", "Ești membru, dar datele complete nu s-au încărcat (cod {cod}). Reîncarcă peste câteva minute; dacă persistă, scrie-ne pe Discord, #discutii.").replace("{cod}", r.eroare)}</p>`);
    }
    // 29 sept — diagnostic: browserul spune worker-ului ce sursă a afișat (apare în `wrangler tail`); fără header, fără preflight
    try { fetch(`${M.MEMBERS_API}/api/ping?sursa=${r.sursa}&tier=${M.tier() || "none"}&v=${SCRIPT_V}`, { mode: "no-cors", cache: "no-store" }).catch(() => {}); } catch {}
    return r.data;
  }
  return fetchJSON(PRED_URL);
}
const SCRIPT_V = "20261007r";
// 7 oct 2026 — evenimente în GoatCounter (fără cookie, fără date personale): clicuri pe butoanele de abonament/trial/login și
// dacă vizitatorul a ajuns la secțiunea de abonament. Răspund la „250 de vizite și niciun abonat”: nu ajung la ofertă, sau ajung și pleacă?
function _gcEvent(nume) {
  try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: nume, title: nume, event: true }); } catch (e) {}
}
function _instaleazaUrmarireClicuri() {
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest && ev.target.closest("a"); if (!a) return;
    const h = a.getAttribute("href") || ""; const c = a.className || "";
    if (h.includes("patreon.com")) _gcEvent("click/patreon/" + (c.includes("plan-btn-pro") ? "pro" : c.includes("plan-btn-basic") ? "basic" : c.includes("pro-cta") ? "pro-inline" : "alt"));
    else if (c.includes("trial-banner")) _gcEvent("click/trial-banner");
    else if (c.includes("unlock-btn")) _gcEvent("click/unlock-btn");
    else if (c.includes("members-login")) _gcEvent("click/login-patreon");
    else if (c.includes("members-sub")) _gcEvent("click/members-sub");
    else if (h.includes("track-record")) _gcEvent("click/track-record");
    else if (h.includes("analize/")) _gcEvent("click/arhiva-pro");
  }, { passive: true });
  const sec = document.getElementById("abonament");
  if (sec && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { _gcEvent("vazut/abonament"); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(sec);
  }
  const ex = document.getElementById("exemplu-pro");
  if (ex && "IntersectionObserver" in window) {
    const io2 = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { _gcEvent("vazut/exemplu-pro"); io2.disconnect(); } }, { threshold: 0.3 });
    io2.observe(ex);
  }
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", _instaleazaUrmarireClicuri); else _instaleazaUrmarireClicuri();
}
// 7 oct 2026 — pe telefon cardul e un RÂND: tap pe antet deschide corpul (xG, piețe)
if (typeof document !== "undefined") {
  document.addEventListener("click", (ev) => {
    if (window.innerWidth > 600) return;
    const h = ev.target.closest && ev.target.closest(".match-header"); if (!h || ev.target.closest("a, button")) return;
    h.parentElement.classList.toggle("open");
  });
}
// 7 oct 2026 — pe telefon filtrele stau pliate sub un buton „Filtre ▾” (6 selectoare = un ecran întreg înainte de meciuri)
function _pliazaFiltre() {
  const f = document.querySelector("section.filters"); if (!f || f.previousElementSibling?.classList?.contains("filtre-toggle")) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "filtre-toggle";
  const txt = () => tt("filters.toggle", "⚙️ Filtre") + (f.classList.contains("deschis") ? " ▴" : " ▾");
  b.textContent = txt(); b.addEventListener("click", () => { f.classList.toggle("deschis"); b.textContent = txt(); });
  f.parentNode.insertBefore(b, f);
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", _pliazaFiltre); else _pliazaFiltre();
}
// 7 oct 2026 — buton plutitor „⚽ Meciurile de azi” pe telefon: sare direct la listă; dispare când lista e deja pe ecran
function _butonSalt() {
  const mt = document.getElementById("match-count"); if (!mt || document.getElementById("salt-meciuri")) return;
  const b = document.createElement("a"); b.id = "salt-meciuri"; b.href = "#match-count"; b.className = "salt-meciuri";
  b.setAttribute("data-i18n", "salt.meciuri"); b.textContent = tt("salt.meciuri", "⚽ Meciurile de azi"); document.body.appendChild(b);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { b.classList.toggle("ascuns", es.some(e => e.isIntersecting)); }, { rootMargin: "0px 0px -60% 0px" });
    io.observe(mt);
  }
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", _butonSalt); else _butonSalt();
}

// 29 sept — plasă de siguranță: dacă la DOMContentLoaded există token valid, dar lista a fost desenată din fișierul public
// (tokenul a ajuns târziu, script vechi din cache etc.), desenăm din nou cu datele de membru.
if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const M = window.PoseidonMembers;
    if (M && M.MEMBERS_API && M.tier() && !PRED_CU_TOKEN && PRED_SURSA === "public" && document.getElementById("matches")) renderIndex().then(renderProAnalize);
  });
}

async function fetchJSON(url) {
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.error("Fetch failed:", url, e);
    return null;
  }
}

function pctClass(p) {
  if (p >= 0.70) return "high";
  if (p <= 0.30) return "low";
  return "";
}
function fmtPct(p) {
  if (p == null || isNaN(p)) return "—";
  return Math.round(p * 100) + "%";
}
function fmtNum(n, d = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toFixed(d);
}

/* ============== Cifre vii (sursă unică: JSON-urile publicate) ==============
   Cifrele VII (ligi calibrate, jurnal live) se citesc din calibration.json /
   forward.json și se injectează în elementele [data-stat]. Fetch eșuat →
   rămâne fallback-ul static din HTML. Cifra de BACKTEST (65.250) e fereastră
   ÎNCHISĂ și rămâne STATICĂ în text — nu o lega niciodată dinamic aici. */
let LIVE_STATS = null;

async function loadLiveStats() {
  if (LIVE_STATS) return LIVE_STATS;
  const [calib, fwd] = await Promise.all([fetchJSON(CALIB_URL), fetchJSON(FORWARD_URL)]);
  const s = {};
  if (calib && Array.isArray(calib.leagues) && calib.leagues.length) {
    const cal = calib.leagues.filter(l => l.calibrated).length;
    s["leagues-cal"] = String(cal);
    s["leagues"] = cal + "/" + calib.leagues.length;
  }
  if (fwd && fwd.n_total != null) {
    s["fwd-frozen"] = String(fwd.n_total);
    s["fwd-resolved"] = String(fwd.n_resolved ?? 0);
  }
  LIVE_STATS = s;
  return s;
}

function injectLiveStats() {
  if (!LIVE_STATS) return;
  document.querySelectorAll("[data-stat]").forEach(el => {
    const v = LIVE_STATS[el.getAttribute("data-stat")];
    if (v != null) el.textContent = v;
  });
}

/* ============== Empty state onest (zero loader infinit) ==============
   Jurnalul forward a pornit pe 2 iunie 2026. Când datele lipsesc sau fetch-ul
   eșuează, scepticul primește un răspuns concret, nu "Se încarcă...". */
const FORWARD_START = "2026-06-02";

function tt(key, fallbackRo) {
  // t() cu fallback explicit RO — render-ele pot rula înainte ca i18n.json să fie încărcat
  const v = t(key);
  return v === key ? fallbackRo : v;
}

function honestEmptyHtml(frozen) {
  const days = Math.max(1, Math.floor((Date.now() - new Date(FORWARD_START + "T00:00:00Z").getTime()) / 86400000));
  let txt;
  if (frozen != null) {
    txt = tt("empty.fwd.full",
      "Jurnalul live a început pe <strong>2 iunie 2026</strong>. Până acum: {days} zile, {frozen} predicții înghețate. Tabelul se populează pe măsură ce se joacă meciurile.")
      .replace("{days}", days).replace("{frozen}", frozen);
  } else {
    txt = tt("empty.fwd.basic",
      "Jurnalul live a început pe <strong>2 iunie 2026</strong> ({days} zile). Tabelul se populează pe măsură ce se joacă meciurile.")
      .replace("{days}", days);
  }
  return `<div class="calibration-card"><p>${txt}</p></div>`;
}

/* ============== FREEMIUM (29 aug 2026) ==============
   Fișierul public conține 5 meciuri complete pe zi (`free: true`) și restul doar cu
   identitatea (`locked: true`): echipe, oră, ligă. Regula de aur aici e că un meci fără
   cifre NU trece niciodată prin renderMatch() — acela citește zeci de câmpuri și ar
   scrie „NaN%" peste tot. isLocked() e deliberat mai larg decât flagul: dacă lipsesc
   probabilitățile, tratăm meciul ca blocat, nu îl randăm gol. */
const LOCKED_PREVIEW = 40;   // câte rânduri blocate desenăm (2775 de noduri ar îneca pagina)

// Numeralul românesc cere „de" când ultimele două cifre sunt 0 sau ≥20:
// „2775 de meciuri", dar „5 meciuri". Fără asta, textele generate ies agramate.
// Celelalte limbi nu au regula, deci primesc numărul simplu.
function nUnits(n) {
  // 7 oct 2026: separator de mii după limbă (2.771 în RO/ES/IT, 2,771 în EN) + „de” în RO doar înaintea unui substantiv
  // (textele care îl folosesc au substantivul imediat după: „2.771 de meciuri în total”, nu „2.771 de în total”)
  const fmt = new Intl.NumberFormat(LANG === "en" ? "en-GB" : LANG === "es" ? "es-ES" : LANG === "it" ? "it-IT" : "ro-RO").format(n);
  if (LANG !== "ro") return fmt;
  const r = n % 100;
  return (r === 0 || r >= 20) ? `${fmt} de` : fmt;
}

function isLocked(m) {
  return m.locked === true || (m.prob_over_1_5 == null && m.prob_home == null);
}

function matchWhen(m) {
  return new Date(m.match_date).toLocaleString("ro-RO", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest"
  });
}

function renderLockedMatch(m) {
  return `<div class="match match-locked">
    <div class="match-title">
      <div class="match-teams">${esc(m.home_team)} <span class="vs">vs</span> ${esc(m.away_team)}</div>
      <div class="match-meta">
        <span class="liga">${esc(m.country)} · ${esc(m.league)}</span>
        <span class="when">${matchWhen(m)}</span>
      </div>
    </div>
    <span class="lock-tag" aria-label="predicție disponibilă pentru abonați">🔒</span>
  </div>`;
}

function renderUnlockCta(nLocked, nLockedAzi = null) {
  // 1 oct 2026 (după-amiază) — Pro în față (decizia Andreei); dimineață: rescris după cele 5 obiecții (evaluare ChatGPT): ce primești concret, dovada ÎNAINTE de preț, 3 pași după plată, anulare
  const n = nUnits(nLocked); const nAzi = nUnits(nLockedAzi == null ? nLocked : nLockedAzi);
  const list = tt("unlock.list", "Analizele scrise ale zilei, verificate a doua zi cu scorul real (Pro) · Toate cele {azi} meciuri de azi și {n} meciuri pe următoarele 7 zile · Toate probabilitățile (1X2, dublă șansă, goluri, GG, pauză, scor) · Simulator și bilete pe tot setul · Selecția zilei pe Discord").replace("{azi}", nAzi).replace("{n}", n)
    .split(" · ").map(x => `<li>${x}</li>`).join("");
  return `<div class="unlock-cta">
    <div class="unlock-txt"><span class="unlock-icon">🔒</span> ${tt("unlock.h", "<strong>Ai văzut cele 5 predicții gratuite ale zilei.</strong> În spatele lacătului, Pro îți dă analizele scrise ale zilei și toate cifrele; Basic, doar cifrele:")}</div>
    <ul class="unlock-list">${list}</ul>
    <p class="unlock-proof">${tt("unlock.proof", "Nu plătești pentru o garanție, plătești pentru acces. Predicțiile sunt înghețate înainte de meci, iar rezultatele rămân publice, inclusiv cele ratate. Verifică înainte să plătești:")}
      <a href="track-record.html" class="unlock-proof-btn">${tt("unlock.proof.btn", "Vezi track record-ul")}</a></p>
    <p class="unlock-steps">${tt("unlock.steps", "3 pași: alegi Pro (7 zile gratuit) sau Basic pe Patreon → apeși „Intră cu Patreon” aici pe site → accesul se deschide pe loc.")}
      <span class="muted">${tt("unlock.cancel", "Primele 7 zile de Pro sunt gratuite; anulezi oricând din Patreon, și înainte de prima plată. Accesul rămâne până la sfârșitul perioadei plătite.")}</span></p>
    <a href="#abonament" class="unlock-btn">${tt("unlock.btn", "💎 Încearcă Pro gratuit 7 zile")}</a>
    <a href="#abonament" class="unlock-pro muted">${tt("unlock.alt", "Vrei doar cifrele? Basic, 5 $/lună.")}</a>
  </div>`;
}

/* ============== SIMULATOR COMBINATE (29 aug 2026) ==============
   Rulează DOAR pe cele 5 meciuri publicate gratuit — pe site nu putem calcula
   pe setul complet fără să republicăm exact datele pe care le-am încuiat.

   Două moduri: biletul GENERAT (principal) și construitul manual (secundar).

   Regula de afișare, deliberată: biletul generat începe ÎNTOTDEAUNA cu șansa
   compusă, nu cu lista selecțiilor. Un bilet generat automat e cel mai aproape
   de „pont" din tot ce are site-ul; singurul lucru care îl ține de partea bună
   a liniei e că primul număr pe care îl vezi e cât de mică e șansa, nu cât de
   frumos arată combinația.

   Ipoteza de independență e reală și declarată pe pagină: înmulțim
   probabilitățile ca și cum meciurile ar fi independente. Sunt aproape
   independente, nu perfect. */

const SIM_MARKETS = [
  ["1", "prob_home", "Victorie gazde"],
  ["X", "prob_draw", "Egal"],
  ["2", "prob_away", "Victorie oaspeți"],
  ["1X", "prob_1x", "Gazdele nu pierd"],
  ["X2", "prob_x2", "Oaspeții nu pierd"],
  ["Peste 1.5", "prob_over_1_5", "Minim 2 goluri"],
  ["Peste 2.5", "prob_over_2_5", "Minim 3 goluri"],
  ["Ambele", "prob_btts", "Ambele echipe marchează"],
];

const SIM = { sel: new Map(), free: [], nTotal: 0, varianta: 0, nGen: 3 };

function simFmtOdds(p) {
  if (!p || p <= 0) return "—";
  const c = 1 / p;
  return c >= 100 ? c.toFixed(0) : c.toFixed(2);
}

// renderSimulator() se reapelează la schimbarea limbii; fără garda asta, „Altă variantă"
// ar sări două variante la un click, iar input-ul de cotă ar recalcula de două ori.
function simBind(el, ev, fn) {
  if (!el || el.dataset.simBound === ev) return;
  el.dataset.simBound = ev;
  el.addEventListener(ev, fn);
}

function simNume(m) {
  return `${m.home_team} – ${m.away_team}`;
}

// Piața cu cea mai mare probabilitate calibrată din meci. E o descriere a ieșirii
// modelului, nu o alegere editorială: nu „recomandăm" piața, e pur și simplu maximul.
function simBest(m) {
  let best = null;
  for (const [et, k] of SIM_MARKETS) {
    const p = m[k];
    if (p != null && (best === null || p > best.prob)) best = { eticheta: et, prob: p, meci: simNume(m), fix: String(m.fixture_id) };
  }
  return best;
}

// Toate combinațiile de n meciuri din cele disponibile, ordonate DESCRESCĂTOR după
// șansa compusă. Nimic aleatoriu: „altă variantă" înseamnă următoarea ca probabilitate,
// nu o altă tragere la sorți.
function simCombinatii(lista, n) {
  // 7 oct 2026: enumerarea completă (C(L,n)) omora Safari la membri (40 meciuri → miliarde de combinații, pagina se închidea).
  // Peste ~3.000 de combinații luăm variantele ca ferestre glisante pe lista sortată după probabilitate: top-n, apoi decalate cu 1…
  const L = lista.slice().sort((a, b) => b.prob - a.prob);
  let comb = 1; for (let i = 1; i <= n; i++) comb = comb * (L.length - n + i) / i;
  const out = [];
  if (comb <= 3000) {
    (function rec(start, acc) {
      if (acc.length === n) { out.push(acc.slice()); return; }
      for (let i = start; i < L.length; i++) rec(i + 1, acc.concat([L[i]]));
    })(0, []);
  } else {
    for (let k = 0; k + n <= L.length && out.length < 12; k++) out.push(L.slice(k, k + n));
  }
  return out
    .map(sel => ({ sel, p: sel.reduce((a, s) => a * s.prob, 1) }))
    .sort((a, b) => b.p - a.p);
}

/* Randarea unui bilet — folosită de ambele moduri, ca să nu existe două adevăruri. */
function simTicketHtml(sel, cotaIn) {
  let p = 1;
  const pasi = sel.map((s, i) => {
    p *= s.prob;
    return `<tr><td>${i + 1}</td><td><strong>${esc(s.meci)}</strong> — ${esc(s.eticheta)}
      <span class="muted">(${fmtPct(s.prob)})</span></td>
      <td class="sim-run">${(p * 100).toFixed(1)}%</td></tr>`;
  }).join("");
  const unuDin = 1 / p;

  let comparatie = "";
  if (cotaIn && cotaIn > 1) {
    comparatie = `<div class="sim-compare">
      <p>${tt("sim.compare",
        "La cota <strong>{cota}</strong>, casa te plătește ca și cum șansa ar fi <strong>1 din {casa}</strong>. Calibrarea noastră spune <strong>~1 din {noi}</strong>.")
        .replace("{cota}", cotaIn.toFixed(2))
        .replace("{casa}", cotaIn.toFixed(1))
        .replace("{noi}", unuDin.toFixed(1))}</p>
      <p class="sim-warn">${tt("sim.compare.warn", "Diferența dintre cele două numere <strong>nu este un câștig</strong>. Cota casei include marja ei, iar modelul nostru greșește regulat — vezi <a href=\"track-record.html\">track record-ul</a>, unde publicăm și piețele pe care nu prezicem destul de bine. Comparația e aici ca să înțelegi ce plătește casa, nu ca să-ți spună ce să faci.")}</p>
    </div>`;
  }

  return `
    <div class="sim-total">
      <div class="sim-total-p">${(p * 100).toFixed(1)}%</div>
      <div class="sim-total-lbl">${tt("sim.total",
        "șansa ca <strong>toate cele {n} selecții</strong> să iasă — adică <strong>~1 din {x}</strong>")
        .replace("{n}", sel.length).replace("{x}", unuDin.toFixed(1))}</div>
      <div class="sim-total-odds">${tt("sim.fair",
        "Cota care ar corespunde exact acestei probabilități: <strong>{c}</strong>")
        .replace("{c}", simFmtOdds(p))}</div>
    </div>
    <table class="sim-table">
      <thead><tr><th>#</th><th>${tt("sim.th.sel", "Selecție")}</th><th>${tt("sim.th.run", "Șansa cumulată")}</th></tr></thead>
      <tbody>${pasi}</tbody>
    </table>
    <p class="sim-drop">${tt("sim.drop",
      "Fiecare selecție adăugată <strong>scade</strong> șansa totală — de la {prima} cu una singură, la {ultima} cu toate {n}. Asta e aritmetica pe care biletele nu ți-o arată.")
      .replace("{prima}", fmtPct(sel[0].prob))
      .replace("{ultima}", (p * 100).toFixed(1) + "%")
      .replace("{n}", sel.length)}</p>
    ${comparatie}`;
}

function simCtaPro() {
  return `<div class="unlock-cta">
    <div class="unlock-txt"><span class="unlock-icon">💎</span> ${tt("sim.cta", "Vrei biletul din 10+ meciuri, ales din toate cele {n} meciuri ale zilei — sau unul construit către o cotă anume, până la 200? Abonații Pro le primesc zilnic pe Discord, fiecare cu șansa reală scrisă alături. La ținte mari de cotă, aceea e de ordinul unu la zeci sau sute, și scrie acolo.")
      .replace("{n}", nUnits(SIM.nTotal))}</div>
    <a href="index.html#abonament" class="unlock-btn">${tt("freemium.cta.btn", "Vezi abonamentele")}</a>
  </div>`;
}

/* ---------- Modul principal: biletul generat ---------- */

function simGenereaza() {
  const out = document.getElementById("sim-gen-result");
  if (!out) return;
  const cand = SIM.free.map(simBest).filter(Boolean);
  const n = Math.min(SIM.nGen, cand.length);
  if (n < 2) {
    out.innerHTML = `<p class="muted">${tt("sim.few", "Azi sunt sub două meciuri publicate gratuit, deci n-avem ce combina — se întâmplă în pauzele competiționale. Explicația de mai jos rămâne valabilă, iar meciurile revin odată cu etapele.")}</p>`;
    return;
  }
  const variante = simCombinatii(cand, n);
  SIM.varianta = ((SIM.varianta % variante.length) + variante.length) % variante.length;
  const v = variante[SIM.varianta];
  const cota = parseFloat((document.getElementById("sim-gen-odds") || {}).value);

  out.innerHTML = simTicketHtml(v.sel, cota)
    + `<p class="sim-varianta">${tt("sim.gen.variant",
        "Varianta {k} din {total}, ordonate descrescător după șansa compusă. Selecțiile sunt piețele cu cea mai mare probabilitate calibrată din fiecare meci — o alegere mecanică, nu o recomandare.")
        .replace("{k}", SIM.varianta + 1).replace("{total}", variante.length)}</p>`
    + simCtaPro();
}

/* ---------- Modul secundar: construit manual ---------- */

function simCard(m) {
  const chips = SIM_MARKETS
    .filter(([, k]) => m[k] != null)
    .map(([et, k, titlu]) =>
      `<button type="button" class="sim-chip" data-fix="${m.fixture_id}" data-key="${k}"
         data-et="${esc(et)}" data-p="${m[k]}" title="${esc(titlu)}">
         ${esc(et)} <span class="sim-chip-p">${fmtPct(m[k])}</span>
       </button>`).join("");
  return `<div class="sim-card" data-card="${m.fixture_id}">
    <div class="sim-card-head">
      <strong>${esc(m.home_team)}</strong> – <strong>${esc(m.away_team)}</strong>
      <span class="muted-xs">${esc(m.country)} · ${esc(m.league)} · ${matchWhen(m)}</span>
    </div>
    <div class="sim-chips">${chips}</div>
  </div>`;
}

function simUpdate() {
  const out = document.getElementById("sim-result");
  if (!out) return;
  const sel = [...SIM.sel.values()];
  if (sel.length < 2) {
    out.innerHTML = `<p class="muted">${tt("sim.empty",
      "Alege cel puțin două selecții, din meciuri diferite, ca să vezi cum se compune șansa.")}</p>`;
    return;
  }
  const cota = parseFloat((document.getElementById("sim-odds") || {}).value);
  out.innerHTML = simTicketHtml(sel, cota);
}

async function renderSimulator() {
  const genEl = document.getElementById("sim-gen-result");
  const el = document.getElementById("sim-matches");
  if (!genEl && !el) return;

  const data = await loadPredictions();
  if (!data || !data.matches) {
    const msg = `<p class="muted">${tt("sim.nodata",
      "Datele zilei nu sunt încă publicate. Revino după actualizarea de dimineață.")}</p>`;
    if (genEl) genEl.innerHTML = msg;
    if (el) el.innerHTML = "";
    return;
  }

  const azi = new Date().toISOString().slice(0, 10);
  // 7 oct 2026: pentru MEMBRI setul complet n-are steagul `free` (0 lacăte) → simulatorul lua 0 meciuri și spunea „sub două
  // meciuri gratuite”. Membru = toate meciurile de azi (ora RO) cu probabilități; vizitator = cele 5 gratuite, ca înainte.
  const Mm = (typeof window !== "undefined") ? window.PoseidonMembers : null;
  const aziRO0 = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
  let free;
  if (Mm && Mm.MEMBERS_API && Mm.tier() && PRED_SURSA === "membru") {
    free = data.matches.filter(m => !isLocked(m) && (m.match_date || "").slice(0, 10) === aziRO0 && m.prob_over_1_5 != null);
    if (free.length < 2) free = data.matches.filter(m => !isLocked(m) && (m.match_date || "").slice(0, 10) >= azi && m.prob_over_1_5 != null).slice(0, 60);
    free.sort((a, b) => (b.prob_over_1_5 || 0) - (a.prob_over_1_5 || 0)); free = free.slice(0, 12);   // cele mai sigure 40, ca lista manuală să rămână parcurgibilă
  } else {
    free = data.matches.filter(m => m.free && m.match_date.slice(0, 10) >= azi);
    if (free.length < 2) free = data.matches.filter(m => m.free);   // pauze: iau tot ce e liber
  }
  SIM.free = free;
  // 2 oct 2026 — „toate cele {n} meciuri ale zilei” = doar ziua curentă (ora României), nu fereastra de 7 zile
  const aziRO = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
  SIM.nTotal = data.matches.filter(m => (m.match_date || "").slice(0, 10) === aziRO).length || data.matches.length;
  SIM.sel.clear();

  if (free.length < 2) {
    const msg = `<p class="muted">${tt("sim.few", "Azi sunt sub două meciuri publicate gratuit, deci n-avem ce combina — se întâmplă în pauzele competiționale. Explicația de mai jos rămâne valabilă, iar meciurile revin odată cu etapele.")}</p>`;
    if (genEl) genEl.innerHTML = msg + simCtaPro();
    if (el) el.innerHTML = "";
    const r = document.getElementById("sim-result");
    if (r) r.innerHTML = "";
    return;
  }

  // Butoanele „câte selecții" — doar valorile posibile cu meciurile de azi.
  const pick = document.getElementById("sim-gen-count");
  if (pick) {
    const maxN = Math.min(free.length, 10);   // 7 oct 2026: cel mult 10 selecții pe bilet; butoanele nu mai ies din ecran
    SIM.nGen = Math.min(SIM.nGen, maxN);
    pick.innerHTML = Array.from({ length: maxN - 1 }, (_, i) => i + 2)
      .map(n => `<button type="button" class="sim-n ${n === SIM.nGen ? "on" : ""}" data-n="${n}">${n}</button>`)
      .join("");
    simBind(pick, "click", e => {
      const b = e.target.closest(".sim-n");
      if (!b) return;
      SIM.nGen = parseInt(b.dataset.n, 10);
      SIM.varianta = 0;
      pick.querySelectorAll(".sim-n").forEach(x => x.classList.toggle("on", x === b));
      simGenereaza();
    });
  }
  const btn = document.getElementById("sim-gen-btn");
  simBind(btn, "click", () => { SIM.varianta += 1; simGenereaza(); });
  const gOdds = document.getElementById("sim-gen-odds");
  simBind(gOdds, "input", simGenereaza);
  simGenereaza();

  // Modul manual
  if (el) {
    el.innerHTML = free.map(simCard).join("");
    simBind(el, "click", e => {
      const chip = e.target.closest(".sim-chip");
      if (!chip) return;
      const fix = chip.dataset.fix;
      const activ = chip.classList.contains("on");
      // Max o selecție per meci: două rezultate din același meci s-ar exclude
      // reciproc, iar produsul lor ar fi o cifră fără sens.
      el.querySelectorAll(`.sim-chip[data-fix="${fix}"]`).forEach(c => c.classList.remove("on"));
      if (activ) {
        SIM.sel.delete(fix);
      } else {
        chip.classList.add("on");
        const card = chip.closest(".sim-card").querySelector(".sim-card-head");
        SIM.sel.set(fix, {
          eticheta: chip.dataset.et,
          prob: parseFloat(chip.dataset.p),
          meci: card.textContent.trim().split("\n")[0].trim(),
        });
      }
      simUpdate();
    });
    const odds = document.getElementById("sim-odds");
    simBind(odds, "input", simUpdate);
    simUpdate();
  }
}

/* ============== INDEX (predicții) ============== */
async function renderIndex() {
  // F3 — încarc și calibration.json pt eligibilitatea per piață (badge data-driven).
  // Fallback grațios: dacă lipsește, MARKET_CERT={} → marketState cade pe PROMOTED (ca înainte).
  const [data, calib] = await Promise.all([loadPredictions(), fetchJSON(CALIB_URL)]);
  if (calib && calib.market_cert) MARKET_CERT = calib.market_cert;
  const scData = await fetchJSON(SCORECARD_URL);
  if (scData && scData.markets) scData.markets.forEach(c => { SCORECARD[c.key] = c; });
  if (!data || !data.matches) {
    document.getElementById("matches").innerHTML =
      `<p class="muted">Datele se încarcă... Dacă persistă, predicțiile zilei nu sunt încă publicate.</p>`;
    return;
  }
  const matches = data.matches;

  // Populate filters
  const days = [...new Set(matches.map(m => m.match_date.slice(0, 10)))].sort();
  const leagues = [...new Set(matches.map(m => m.league))].sort();
  const countries = [...new Set(matches.map(m => m.country))].sort();
  const selDay = document.getElementById("filter-day");
  const selLeague = document.getElementById("filter-league");
  const selCountry = document.getElementById("filter-country");
  const selMarket = document.getElementById("filter-market");
  const selMinProb = document.getElementById("filter-minprob");
  const selSort = document.getElementById("filter-sort");
  const chkCalib = document.getElementById("filter-calibrated-only");
  const chkCalibMk = document.getElementById("filter-calibrated-markets");
  days.forEach(d => selDay.add(new Option(d, d)));
  leagues.forEach(l => selLeague.add(new Option(l, l)));
  countries.forEach(c => selCountry.add(new Option(c, c)));

  // Pe baza calibrată (afișată). Returnează valoarea pentru piața selectată.
  function probForMarket(m, mk) {
    if (mk === "over_1_5")    return m.prob_over_1_5;
    if (mk === "over_2_5")    return m.prob_over_2_5;
    if (mk === "over_3_5")    return m.prob_over_3_5;
    if (mk === "btts")        return m.prob_btts;
    if (mk === "ht_over_0_5") return m.prob_ht_over_0_5;
    if (mk === "ht_over_1_5") return m.prob_ht_over_1_5;
    if (mk === "1x2")         return Math.max(m.prob_home || 0, m.prob_away || 0);
    if (mk === "dc_1x")       return m.prob_1x;
    if (mk === "dc_x2")       return m.prob_x2;
    if (mk === "dc_12")       return m.prob_12;
    if (mk === "under_2_5")   return m.prob_over_2_5 != null ? 1 - m.prob_over_2_5 : null;
    if (mk === "under_3_5")   return m.prob_over_3_5 != null ? 1 - m.prob_over_3_5 : null;
    // Toate piețele: cea mai mare prob găsită
    return Math.max(
      m.prob_over_1_5 || 0, m.prob_over_2_5 || 0, m.prob_over_3_5 || 0,
      m.prob_btts || 0, m.prob_ht_over_0_5 || 0, m.prob_ht_over_1_5 || 0,
      m.prob_home || 0, m.prob_away || 0
    );
  }

  function update() {
    const fd = selDay.value;
    const fl = selLeague.value;
    const fc = selCountry.value;
    const fmk = selMarket.value;
    const fmin = parseFloat(selMinProb.value) || 0;
    const calibOnly = chkCalib.checked;
    let filtered = matches.filter(m => {
      if (fd && !m.match_date.startsWith(fd)) return false;
      if (fl && m.league !== fl) return false;
      if (fc && m.country !== fc) return false;
      if (calibOnly && !m.calibrated) return false;
      // Meciul blocat nu are cifre, deci nu poate fi filtrat pe piață sau pe prag.
      // Îl lăsăm să treacă: e catalogul a ceea ce modelul a calculat, nu o afirmație.
      if (fmin > 0 && !isLocked(m)) {
        const p = probForMarket(m, fmk);
        if (p == null || p < fmin) return false;
      }
      return true;
    });
    const deschise = filtered.filter(m => !isLocked(m));
    const blocate = filtered.filter(isLocked);

    const sortMode = selSort.value;
    if (sortMode === "prob_desc") {
      deschise.sort((a, b) => probForMarket(b, fmk) - probForMarket(a, fmk));
    } else if (sortMode === "league") {
      deschise.sort((a, b) => (a.league || "").localeCompare(b.league || "") || a.match_date.localeCompare(b.match_date));
    } else {
      deschise.sort((a, b) => a.match_date.localeCompare(b.match_date));
    }
    // Blocatele merg mereu cronologic: n-avem după ce altceva să le ordonăm onest.
    blocate.sort((a, b) => a.match_date.localeCompare(b.match_date));

    // 2 oct 2026 — cifra onestă: blocatele de AZI separat de cele din toată fereastra (7 zile); „2117 azi” era fereastra întreagă.
    const aziRO = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
    const blocateAzi = blocate.filter(m => (m.match_date || "").slice(0, 10) === aziRO).length;
    document.getElementById("match-count").textContent = blocate.length
      ? tt("freemium.count", "{free} predicții complete, gratuite. Alte {today} meciuri calculate de model pentru azi și {locked} meciuri în total pe următoarele 7 zile; le deblochezi pe toate cu Basic, 5 $/lună, intrând cu contul Patreon.")
          .replace("{free}", deschise.length).replace("{today}", nUnits(blocateAzi)).replace("{locked}", nUnits(blocate.length))
      : `${deschise.length} meciuri afișate (din ${matches.length} totale).`;

    const matchesEl = document.getElementById("matches");
    matchesEl.classList.toggle("only-calibrated-markets", !!(chkCalibMk && chkCalibMk.checked));

    // 6 oct 2026 — banda de trial deasupra primului meci (doar pentru nemembri); blocul mare rămâne după cele 5 gratuite.
    let html = blocate.length
      ? `<a href="#abonament" class="trial-banner">${tt("trial.banner", "🎁 <strong>Pro, 7 zile gratuit</strong>: analizele scrise ale zilei, verificate a doua zi cu scorul real · <span class=\"trial-banner-cta\">Încearcă →</span>")}</a>`
      : "";
    html += deschise.map(m => renderMatch(m, fmk)).join("");
    if (blocate.length) {
      if (blocate.length) html += renderUnlockCta(blocate.length, blocateAzi);
      html += blocate.slice(0, LOCKED_PREVIEW).map(renderLockedMatch).join("");
      if (blocate.length > LOCKED_PREVIEW) {
        html += `<p class="locked-more muted">` + tt("freemium.more", "… și încă {n} meciuri analizate, nelistate aici.").replace("{n}", nUnits(blocate.length - LOCKED_PREVIEW)) + `</p>`;
      }
    }
    matchesEl.innerHTML = html;
  }

  [selDay, selLeague, selCountry, selMarket, selMinProb, selSort].forEach(s => s.addEventListener("change", update));
  chkCalib.addEventListener("change", update);
  if (chkCalibMk) chkCalibMk.addEventListener("change", update);
  document.getElementById("filter-reset").addEventListener("click", () => {
    selDay.value = ""; selLeague.value = ""; selCountry.value = "";
    selMarket.value = ""; selMinProb.value = "0.70"; selSort.value = "time";
    chkCalib.checked = false;
    if (chkCalibMk) chkCalibMk.checked = false;
    update();
  });
  update();
}

function pickBadge(name, prob, stars = 0) {
  if (prob == null) return "";
  const cls = prob >= 0.80 ? "pick-elite" : prob >= 0.70 ? "pick-strong" : "pick-good";
  const st = stars > 0 ? `<span class="skill-dots" aria-hidden="true">${"●".repeat(stars)}</span>` : "";
  const tip = `${name}: ${fmtPct(prob)} · skill ${stars}/3 (lift peste base-rate, backtest OOS). Informativ — nu recomandare.`;
  return `<span class="pick-badge ${cls}" title="${tip}">${name} <b>${fmtPct(prob)}</b>${st}</span>`;
}

function rawNote(raw, cal) {
  if (raw == null || Math.abs(raw - cal) < 0.03) return "";
  return `<span class="raw-note">brut ${fmtPct(raw)}</span>`;
}

/* ============== Marcaj onestitate per piață (F3 — eligibilitate empirică + veto editorial) ==============
   Stratul 1 — ELIGIBILITATE (empiric, din calibration.json.market_cert): o piață e eligibilă dacă
     ≥ pragul (70%, în calibration.json) din ligi (N≥80) au |bias_rel|≤10% pe backtest post-Platt.
     Front-end citește flag-ul `eligible` — NU recalculează; dacă pragul se schimbă în pipeline, badge-ul
     urmează automat (V4). Fallback la PROMOTED dacă calibration.json lipsește.
   Stratul 2 — VETO EDITORIAL: badge ✓ DOAR dacă eligibilă ȘI în PROMOTED_MARKETS.
   3 stări: "certified" (eligibil+promovat) / "eligible" (≥prag, nepromovat) / "below" (<prag).
   ONEST: ⚠️ pe o piață care ARE calibrare = "sub pragul de certificare", NU "fără calibrare".
   (i18n: textele dinamice cu % rămân RO; cheile statice pot fi traduse ulterior.) */
const PROMOTED_MARKETS = ["O1.5", "HT O0.5"];   // veto editorial peste eligibilitate
const LABEL_MKEY = {                             // label din card → cheie din market_cert
  "O1.5": "over_1_5", "O2.5": "over_2_5", "O3.5": "over_3_5",
  "BTTS": "btts", "HT O0.5": "ht_over_0_5", "HT O1.5": "ht_over_1_5",
};
let MARKET_CERT = {};   // populat din calibration.json în renderIndex; {} → fallback pe PROMOTED

function marketState(label) {
  const key = LABEL_MKEY[label];
  if (!key) return "raw";                        // 1X2, 1H/XH/2H, HT BTTS — output brut (fără Platt)
  const c = MARKET_CERT[key];
  const eligible = c ? !!c.eligible : PROMOTED_MARKETS.includes(label);  // fallback fără calib
  const promoted = PROMOTED_MARKETS.includes(label);
  if (eligible && promoted) return "certified";
  if (eligible && !promoted) return "eligible";
  return "below";
}

function warnTipText(kind, pct) {
  if (kind === "raw")
    return "Probabilitate brută a modelului, fără re-mapare empirică.";
  if (kind === "eligible")
    return `Calibrare validată empiric (${pct != null ? pct + "% din " : ""}ligi în ±10%), dar nepromovată editorial.`;
  return `Calibrată empiric, dar sub pragul de certificare per-ligă${pct != null ? ` (${pct}% din ligi în ±10%, prag 70%)` : ""}. Poate fi mai puțin fiabilă pe unele ligi.`;
}

function warnMark(kind, pct) {
  const tip = warnTipText(kind, pct);
  return `<button type="button" class="market-warn" data-tip="${tip}" title="${tip}" aria-label="${tip}">i</button>`;
}

// Marcaj per piață calibrabilă, derivat din market_cert (3 stări). Certified → fără marcaj (curat).
function marketCertMark(label) {
  const st = marketState(label);
  if (st === "certified") return "";
  const c = MARKET_CERT[LABEL_MKEY[label]];
  return warnMark(st, c ? c.pct_leagues_good : null);
}

// 🆕 29 iun — marcaj de SKILL per piață din scorecard (stele = lift OOS peste base-rate).
// PICK → stele + hit; restul → nimic (afișat calibrat, dar fără pretenție de pick).
function skillMark(key, prob) {
  const c = SCORECARD[key];
  if (!c || c.tier !== "PICK" || !c.skill_stars) return "";
  if (prob == null || prob < c.threshold) return "";   // stele DOAR când piața e pick pe ACEST meci
  const hit = c.hit_at_threshold != null ? fmtPct(c.hit_at_threshold) : "—";
  const tip = `Skill ${c.skill_stars}/3 (lift +${c.lift_pp}pp peste base-rate). Hit istoric OOS: ${hit}.`;
  return `<span class="skill-stars" title="${tip}" aria-label="${tip}">${"●".repeat(c.skill_stars)}</span>`;
}

/* Popover singleton — tap pe ⚠️ deschide explicația, tap în afară o închide. */
function ensureWarnPopover() {
  let pop = document.getElementById("warn-popover");
  if (!pop) {
    pop = document.createElement("div");
    pop.id = "warn-popover";
    pop.setAttribute("role", "tooltip");
    pop.style.display = "none";
    document.body.appendChild(pop);
  }
  return pop;
}

let _warnOpenFor = null;
document.addEventListener("click", e => {
  const btn = e.target.closest(".market-warn");
  const pop = ensureWarnPopover();
  if (btn) {
    e.preventDefault();
    if (_warnOpenFor === btn) { // al doilea tap pe același ⚠️ → închide
      pop.style.display = "none";
      _warnOpenFor = null;
      return;
    }
    pop.textContent = btn.getAttribute("data-tip") || "";
    pop.style.display = "block";
    const r = btn.getBoundingClientRect();
    const popW = Math.min(280, window.innerWidth - 24);
    pop.style.maxWidth = popW + "px";
    let left = r.left + window.scrollX + r.width / 2 - popW / 2;
    left = Math.max(12, Math.min(left, window.scrollX + window.innerWidth - popW - 12));
    pop.style.left = left + "px";
    pop.style.top = (r.bottom + window.scrollY + 6) + "px";
    _warnOpenFor = btn;
  } else if (!e.target.closest("#warn-popover")) {
    pop.style.display = "none";
    _warnOpenFor = null;
  }
});

function xgBar(xgH, xgA) {
  const total = xgH + xgA;
  if (!total) return "";
  const hPct = (xgH / total) * 100;
  return `<div class="xg-bar">
    <div class="xg-bar-h" style="width:${hPct}%"></div>
    <div class="xg-bar-a" style="width:${100 - hPct}%"></div>
    <div class="xg-bar-labels">
      <span>${fmtNum(xgH)}</span><span>${fmtNum(xgA)}</span>
    </div>
  </div>`;
}

// 10 iun 2026 — Mapping filter market → label din card (pentru highlight piață filtrată).
// 1x2 = highlight pe TOATE 3 (1, X, 2) fiindcă filtrul prinde oricare.
const MARKET_FILTER_TO_LABEL = {
  over_1_5: ["O1.5"],
  over_2_5: ["O2.5"],
  over_3_5: ["O3.5"],
  under_2_5: ["U2.5"],
  under_3_5: ["U3.5"],
  btts: ["BTTS"],
  ht_over_0_5: ["HT O0.5"],
  ht_over_1_5: ["HT O1.5"],
  "1x2": ["1", "X", "2"],
  dc_1x: ["1X"],
  dc_x2: ["X2"],
  dc_12: ["12"],
};
function isFilteredMarket(label, filterMarket) {
  const targets = MARKET_FILTER_TO_LABEL[filterMarket];
  return targets ? targets.includes(label) : false;
}

function renderMatch(m, filterMarket = "") {
  const calibTag = m.calibrated
    ? `<span class="ok-tag">calibrată</span>`
    : `<span class="warn-tag">ligă necalibrată</span>`;
  // match_date e UTC (cu Z). Convertesc explicit la fusul orar Europe/Bucharest (ora RO).
  const d = new Date(m.match_date);
  const dateStr = d.toLocaleString("ro-RO", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Bucharest"
  });

  // 🆕 10 iun 2026 — Acumulator STRICT cu DOAR cele 2 piețe brand (Over 1.5 + HT Over 0.5).
  // 🆕 11 iun 2026 — Coerență cu filtru: badge verde apare DOAR pe piața filtrată dacă e
  //    una din cele 2 de încredere. Filtru pe altă piață → ZERO badge verde (corect, nu o
  //    recomandăm). Filtru gol → ambele badge-uri ca înainte.
  // Decizie pe baza calibration.json (TEST 65.250 meciuri):
  //   - Over 1.5 ≥75%: bucket 70-80% drift +1.11pp, 80-90% -2.29pp ✅
  //   - HT Over 0.5 ≥70%: bucket 70-80% drift -1.28pp, 80-90% -5.44pp ✅
  // Filosofie: badge verde = "recomand cu încredere" (doar 2 piețe). Highlight auriu pe
  // piața filtrată = "asta ai cerut, uite cifra reală". Niciodată badge de la o piață
  // nefiltrată când există filtru activ.
  // 🆕 29 iun — picks DATA-DRIVEN din scorecard: TOATE piețele tier=PICK, fiecare cu pragul
  // + stelele ei de skill (lift OOS). Fallback grațios: SCORECARD gol → cele 2 brand (ca înainte).
  const picks = [];
  const pickKeys = Object.keys(SCORECARD).length
    ? Object.values(SCORECARD).filter(c => c.tier === "PICK").map(c => c.key)
    : ["over_1_5", "ht_over_0_5"];
  for (const key of pickKeys) {
    const c = SCORECARD[key];
    const thr = c ? c.threshold : (key === "over_1_5" ? 0.75 : 0.70);
    const fn = PICK_PROB[key];
    if (!fn) continue;
    if (filterMarket && PICK_FILTER[key] !== filterMarket) continue;  // coerență cu filtrul
    const p = fn(m);
    if (p == null || p < thr) continue;
    picks.push([PICK_LABEL[key] || key, p, c ? c.skill_stars : 0]);
  }
  picks.sort((a, b) => b[1] - a[1]);
  const pick1x2 = m.prob_home >= m.prob_draw && m.prob_home >= m.prob_away ? "1" : m.prob_away >= m.prob_draw ? "2" : "X";
  const picksHtml = picks.map(([name, p, stars]) => pickBadge(name, p, stars)).join(" ");


  const freeTag = m.free
    ? `<span class="free-tag">${tt("freemium.tag", "GRATUIT AZI")}</span>` : "";

  const lead = picks.length ? `<div class="match-lead"><span class="lead-pct">${fmtPct(picks[0][1])}</span><span class="lead-mk">${esc(picks[0][0])}</span></div>` : `<div class="match-lead"><span class="lead-pct">${fmtPct(Math.max(m.prob_home, m.prob_draw, m.prob_away))}</span><span class="lead-mk">${pick1x2}</span></div>`;
  return `<div class="match ${m.calibrated ? "" : "uncalibrated"} ${m.free ? "match-free" : ""}">
    <div class="match-header" role="button" tabindex="0">
      ${lead}
      <div class="match-title">
        <div class="match-teams"><span class="team home">${esc(m.home_team)}</span><span class="vs">vs</span><span class="team away">${esc(m.away_team)}</span></div>
        <div class="match-meta">
          <span class="liga">${esc(m.country)} · ${esc(m.league)}</span>
          <span class="when">${dateStr}</span>
          ${calibTag}${freeTag}
        </div>
      </div>
      ${picksHtml ? `<div class="picks-row">${picksHtml}</div>` : ""}
      <span class="match-chev" aria-hidden="true"></span>
    </div>
    <div class="match-body">
    <div class="xg-section">
      <div class="xg-label" title="Poisson + Dixon-Coles + 200.000 simulări Monte Carlo">xG model <span class="xg-label-long">(Poisson + Dixon-Coles + 200K simulări Monte Carlo)</span></div>
      ${xgBar(m.xg_home, m.xg_away)}
      <div class="score-prob">
        <span class="score-label">Scor probabil</span>
        <span class="score-val">${m.top_score_h}–${m.top_score_a}</span>
        <span class="score-pct">(${fmtPct(m.top_score_prob)})</span>
      </div>
    </div>

    <div class="phase-row ft">
      <div class="phase-label">Final · 90 min</div>
      <div class="markets-grid">
        <div class="market uncal-market ${pick1x2 === "1" ? "pick" : ""} ${isFilteredMarket("1", filterMarket) ? "market-filtered" : ""}">
          <span class="label">1</span>
          <span class="val ${pctClass(m.prob_home)}">${fmtPct(m.prob_home)}</span>
          ${warnMark("raw")}
        </div>
        <div class="market uncal-market ${pick1x2 === "X" ? "pick" : ""} ${isFilteredMarket("X", filterMarket) ? "market-filtered" : ""}">
          <span class="label">X</span>
          <span class="val ${pctClass(m.prob_draw)}">${fmtPct(m.prob_draw)}</span>
          ${warnMark("raw")}
        </div>
        <div class="market uncal-market ${pick1x2 === "2" ? "pick" : ""} ${isFilteredMarket("2", filterMarket) ? "market-filtered" : ""}">
          <span class="label">2</span>
          <span class="val ${pctClass(m.prob_away)}">${fmtPct(m.prob_away)}</span>
          ${warnMark("raw")}
        </div>
        <div class="market ${isFilteredMarket("O1.5", filterMarket) ? "market-filtered" : ""}">
          <span class="label">O1.5</span>
          <span class="val ${pctClass(m.prob_over_1_5)}">${fmtPct(m.prob_over_1_5)}</span>
          ${marketCertMark("O1.5")}
        </div>
        <div class="market uncal-market ${isFilteredMarket("O2.5", filterMarket) ? "market-filtered" : ""}">
          <span class="label">O2.5</span>
          <span class="val ${pctClass(m.prob_over_2_5)}">${fmtPct(m.prob_over_2_5)}</span>
          ${rawNote(m.prob_over_2_5_raw, m.prob_over_2_5)}
          ${marketCertMark("O2.5")}
        </div>
        <div class="market uncal-market ${isFilteredMarket("O3.5", filterMarket) ? "market-filtered" : ""}">
          <span class="label">O3.5</span>
          <span class="val ${pctClass(m.prob_over_3_5)}">${fmtPct(m.prob_over_3_5)}</span>
          ${marketCertMark("O3.5")}
        </div>
        <div class="market uncal-market ${isFilteredMarket("BTTS", filterMarket) ? "market-filtered" : ""}">
          <span class="label">BTTS</span>
          <span class="val ${pctClass(m.prob_btts)}">${fmtPct(m.prob_btts)}</span>
          ${rawNote(m.prob_btts_raw, m.prob_btts)}
          ${marketCertMark("BTTS")}
        </div>
      </div>
    </div>

    <details class="more-markets" ${(typeof window !== "undefined" && window.innerWidth > 600) ? "open" : ""}>
    <summary class="more-markets-sum">${tt("match.more", "Mai multe piețe: dublă șansă, under, prima repriză")}</summary>
    ${m.prob_1x != null ? `<div class="phase-row extra">
      <div class="phase-label">Dublă șansă & Under</div>
      <div class="markets-grid">
        <div class="market ${isFilteredMarket("1X", filterMarket) ? "market-filtered" : ""}"><span class="label">1X</span><span class="val ${pctClass(m.prob_1x)}">${fmtPct(m.prob_1x)}</span>${skillMark("dc_1x", m.prob_1x)}</div>
        <div class="market ${isFilteredMarket("X2", filterMarket) ? "market-filtered" : ""}"><span class="label">X2</span><span class="val ${pctClass(m.prob_x2)}">${fmtPct(m.prob_x2)}</span>${skillMark("dc_x2", m.prob_x2)}</div>
        <div class="market ${isFilteredMarket("12", filterMarket) ? "market-filtered" : ""}"><span class="label">12</span><span class="val ${pctClass(m.prob_12)}">${fmtPct(m.prob_12)}</span>${skillMark("dc_12", m.prob_12)}</div>
        <div class="market uncal-market ${isFilteredMarket("U2.5", filterMarket) ? "market-filtered" : ""}"><span class="label">U2.5</span><span class="val ${pctClass(1 - m.prob_over_2_5)}">${fmtPct(1 - m.prob_over_2_5)}</span>${skillMark("under_2_5", 1 - m.prob_over_2_5)}</div>
        <div class="market ${isFilteredMarket("U3.5", filterMarket) ? "market-filtered" : ""}"><span class="label">U3.5</span><span class="val ${pctClass(1 - m.prob_over_3_5)}">${fmtPct(1 - m.prob_over_3_5)}</span>${skillMark("under_3_5", 1 - m.prob_over_3_5)}</div>
      </div>
    </div>` : ""}

    ${m.ht_prob_home != null ? `<div class="phase-row ht">
      <div class="phase-label">Prima repriză ${m.xg_home_ht ? `<span class="muted-xs">(xG ${m.xg_home_ht}–${m.xg_away_ht})</span>` : ""}</div>
      <div class="markets-grid">
        <div class="market uncal-market"><span class="label">1H</span><span class="val ${pctClass(m.ht_prob_home)}">${fmtPct(m.ht_prob_home)}</span>${warnMark("raw")}</div>
        <div class="market uncal-market"><span class="label">XH</span><span class="val ${pctClass(m.ht_prob_draw)}">${fmtPct(m.ht_prob_draw)}</span>${warnMark("raw")}</div>
        <div class="market uncal-market"><span class="label">2H</span><span class="val ${pctClass(m.ht_prob_away)}">${fmtPct(m.ht_prob_away)}</span>${warnMark("raw")}</div>
        <div class="market ${isFilteredMarket("HT O0.5", filterMarket) ? "market-filtered" : ""}"><span class="label">HT O0.5</span><span class="val ${pctClass(m.prob_ht_over_0_5)}">${fmtPct(m.prob_ht_over_0_5)}</span>${marketCertMark("HT O0.5")}</div>
        <div class="market uncal-market ${isFilteredMarket("HT O1.5", filterMarket) ? "market-filtered" : ""}"><span class="label">HT O1.5</span><span class="val ${pctClass(m.prob_ht_over_1_5)}">${fmtPct(m.prob_ht_over_1_5)}</span>${marketCertMark("HT O1.5")}</div>
        <div class="market uncal-market"><span class="label">HT BTTS</span><span class="val ${pctClass(m.ht_prob_btts)}">${fmtPct(m.ht_prob_btts)}</span>${warnMark("raw")}</div>
        ${m.ht_top_score_h != null ? `<div class="market score-ht">
          <span class="label">Scor HT</span>
          <span class="val">${m.ht_top_score_h}–${m.ht_top_score_a}</span>
          <span class="raw-note">${fmtPct(m.ht_top_score_prob)}</span>
        </div>` : ""}
      </div>
    </div>` : ""}
    </details>
    </div>
  </div>`;
}

function esc(s) {
  return (s == null) ? "" : String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ============== TRACK RECORD ============== */
async function renderTrackRecord() {
  const calib = await fetchJSON(CALIB_URL);
  if (!calib) {
    document.getElementById("calibration-tables").innerHTML =
      `<p class="muted">Calibrarea backtest se publică după prima rulare completă.</p>`;
  } else {
    const meta = calib.meta || {};
    let html = `<p class="muted">Sample: <strong>${meta.n_total || "—"}</strong> meciuri TEST 2026
                (ratings frozen 2025-12-31, train/test split strict, zero leakage).</p>`;
    for (const market of (calib.markets || [])) {
      html += `<div class="calibration-card">
        <h4>${market.name}</h4>
        <p class="muted">Sub-set: ${market.scope}. Coloana "Real" = procent din meciuri unde evenimentul s-a întâmplat efectiv.</p>
        <table>
          <thead>
            <tr><th>Bucket prob</th><th>N</th><th>Real %</th><th>Wlo 95%</th><th>Diferență</th></tr>
          </thead>
          <tbody>
            ${market.buckets.map(b => `<tr${b.low_sample ? ' style="opacity:.45"' : ''}>
              <td>${b.range}</td>
              <td>${b.n}${b.low_sample ? ' <span class="muted" title="sub 100 meciuri">⚠ sample mic</span>' : ''}</td>
              <td>${b.hit_pct.toFixed(1)}%</td>
              <td>${b.wlo_pct.toFixed(1)}%</td>
              <td style="color:${b.low_sample ? '#6b7280' : (Math.abs(b.diff_pp) <= 3 ? '#065f46' : '#991b1b')}">${b.low_sample ? "—" : (b.diff_pp >= 0 ? "+" : "") + b.diff_pp.toFixed(1) + "pp"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    }
    document.getElementById("calibration-tables").innerHTML = html;
  }

  // Leagues
  if (calib && calib.leagues) {
    const ok = calib.leagues.filter(l => l.calibrated);
    const bad = calib.leagues.filter(l => !l.calibrated);
    let html = `<div class="calibration-card">
      <h4>Ligi calibrate (${ok.length})</h4>
      <p class="muted">Bias între goluri prezise vs reale: ±10%.</p>
      <table><thead><tr><th>Țară / Ligă</th><th>N</th><th>Bias</th></tr></thead>
        <tbody>${ok.slice(0, 30).map(l => `<tr>
          <td>${esc(l.country)} / ${esc(l.league)}</td>
          <td>${l.n}</td>
          <td>${l.bias_pp >= 0 ? "+" : ""}${l.bias_pp.toFixed(1)}%</td>
        </tr>`).join("")}</tbody>
      </table>
      ${ok.length > 30 ? `<p class="muted">… +${ok.length - 30} ligi</p>` : ""}
    </div>

    <div class="calibration-card">
      <h4>Ligi cu calibrare slabă (${bad.length})</h4>
      <p class="muted">Bias mai mare de ±10% sau sample sub 80 — predicții afișate cu marker ⚠️ pe pagina principală.</p>
      <table><thead><tr><th>Țară / Ligă</th><th>N</th><th>Bias</th></tr></thead>
        <tbody>${bad.slice(0, 30).map(l => `<tr>
          <td>${esc(l.country)} / ${esc(l.league)}</td>
          <td>${l.n}</td>
          <td>${l.bias_pp >= 0 ? "+" : ""}${l.bias_pp.toFixed(1)}%</td>
        </tr>`).join("")}</tbody>
      </table>
      ${bad.length > 30 ? `<p class="muted">… +${bad.length - 30} ligi</p>` : ""}
    </div>`;
    document.getElementById("leagues-tables").innerHTML = html;
  } else {
    document.getElementById("leagues-tables").innerHTML =
      `<p class="muted">Tabelul per ligă se publică odată cu datele de calibrare — vezi secțiunea de mai sus.</p>`;
  }

  // Forward — date reale SAU empty state onest (niciodată loader infinit)
  const fwd = await fetchJSON(FORWARD_URL);
  const fwdHtml = (fwd && fwd.n_resolved > 0)
    ? `<div class="calibration-card">
        <p class="muted" style="border-left:3px solid #b45309;padding-left:.6em">${tt("tr.fwd.p", "<strong>Calibrare live, out-of-sample</strong> — în acumulare din {data}.").replace("{data}", new Intl.DateTimeFormat(_loc(), { day: "numeric", month: "long", year: "numeric" }).format(new Date("2026-06-02T12:00:00Z")))}</p>
        ${fwd.calibration_note ? `<p class="muted" style="font-size:.82em">ℹ️ ${esc(fwd.calibration_note)}</p>` : ""}
        <p class="muted" style="font-size:.82em">${tt("tr.fwd.note", "Notă: «tier» reflectă mărimea eșantionului + Wilson 95%, NU edge-ul peste baseline.")}</p>
        <p>${tt("tr.resolved.live", "Predicții rezolvate live: <strong>{n}</strong>").replace("{n}", fwd.n_resolved)}
        ${tt("tr.fwd.totals", "(din {t} totale, {p} în așteptare, {a} amânate).").replace("{t}", fwd.n_total).replace("{p}", fwd.n_pending).replace("{a}", fwd.n_not_played)}</p>
        ${(fwd.markets || []).map(m => `<div>
          <h4>${m.name}</h4>
          <table><thead><tr><th>Bucket prob</th><th>N</th><th>Real %</th></tr></thead>
          <tbody>${m.buckets.map(b => `<tr${b.low_sample ? ' style="opacity:.45"' : ''}>
            <td>${b.range}</td><td>${b.n}${b.low_sample ? ' <span class="muted">⚠ sample mic</span>' : ''}</td><td>${b.low_sample ? "—" : b.hit_pct.toFixed(1) + "%"}</td>
          </tr>`).join("")}</tbody></table>
        </div>`).join("")}
      </div>`
    : honestEmptyHtml(fwd ? (fwd.n_total || 0) : null);
  document.getElementById("forward-stats").innerHTML = fwdHtml;
}

if (document.getElementById("matches")) renderIndex().then(renderProAnalize);


/* ============== ISTORIC (pagina istoric.html) ============== */

let _histData = null;

async function renderIstoric() {
  const data = await fetchJSON(HISTORY_URL);
  if (!data) {
    // history.json indisponibil — empty state onest pe AMBELE secțiuni
    // (înainte, #cumulat-stats rămânea blocat pe "Se încarcă..." pentru totdeauna).
    // Încerc forward.json pentru cifre concrete; dacă pică și el, mesaj static.
    await loadLiveStats();
    const frozen = LIVE_STATS && LIVE_STATS["fwd-frozen"] ? LIVE_STATS["fwd-frozen"] : null;
    document.getElementById("cumulat-stats").innerHTML = honestEmptyHtml(frozen);
    document.getElementById("days-list").innerHTML = honestEmptyHtml(frozen);
    return;
  }
  _histData = data;

  // Cumulat per piață
  const cumHtml = (data.cumulated_markets || []).length
    ? `<table class="cumulat-table">
        <thead><tr><th>Piață</th><th>N</th><th>WIN</th><th>LOSS</th><th>Hit %</th><th>Wlo 95%</th><th>Tier</th></tr></thead>
        <tbody>${data.cumulated_markets.map(m => {
          const tierClass = m.tier === "STRONG ROBUST" ? "tier-elite"
            : m.tier === "ROBUST" ? "tier-strong"
            : m.tier === "PROMISING" ? "tier-good"
            : m.tier === "PRE-PROMISING" ? "tier-mid"
            : m.tier === "DROP" ? "tier-drop"
            : "tier-noise";
          return `<tr>
            <td><strong>${esc(m.name)}</strong></td>
            <td>${m.n}</td>
            <td class="num-win">${m.wins}</td>
            <td class="num-loss">${m.losses}</td>
            <td>${m.hit_pct.toFixed(1)}%</td>
            <td>${m.wlo_pct.toFixed(1)}%</td>
            <td><span class="tier-badge ${tierClass}">${m.tier}</span></td>
          </tr>`;
        }).join("")}</tbody>
      </table>
      <p class="muted">${tt("istoric.note", "Jurnal forward în acumulare din {data}. Predicții înghețate înainte de meci.").replace("{data}", new Intl.DateTimeFormat(_loc(), { day: "numeric", month: "long", year: "numeric" }).format(new Date("2026-06-02T12:00:00Z")))}</p>`
    : honestEmptyHtml(data.n_total != null ? data.n_total : null);
  document.getElementById("cumulat-stats").innerHTML = cumHtml;

  // Populez filtru piață
  const allPicks = new Set();
  for (const d of data.days) for (const m of d.matches) for (const p of m.picks) allPicks.add(p.market);
  const sel = document.getElementById("filter-market");
  [...allPicks].sort().forEach(m => sel.add(new Option(m, m)));

  // Hook filters
  ["filter-market", "filter-result", "filter-calibrated-only"].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener(el.tagName === "SELECT" ? "change" : "change", renderIstoricDays);
  });

  renderIstoricDays();
}

function renderIstoricDays() {
  if (!_histData) return;
  const mF = document.getElementById("filter-market").value;
  const rF = document.getElementById("filter-result").value;
  const cF = document.getElementById("filter-calibrated-only").checked;

  const html = _histData.days.map(d => {
    const visibleMatches = d.matches.map(m => {
      const visPicks = m.picks.filter(p => {
        if (mF && p.market !== mF) return false;
        if (rF && p.outcome !== rF) return false;
        return true;
      });
      if (visPicks.length === 0) return null;
      if (cF && !m.calibrated_lg) return null;
      return { ...m, picks: visPicks };
    }).filter(Boolean);

    if (visibleMatches.length === 0) return "";

    const statusBadge = d.status === "resolved"
      ? `<span class="day-status status-resolved">${tt("ist.rezolvata", "REZOLVATĂ")}</span>`
      : d.status === "partial"
      ? `<span class="day-status status-partial">${tt("ist.partial", "PARȚIAL REZOLVATĂ")}</span>`
      : d.status === "in_progress"
      ? `<span class="day-status status-live">ÎN CURS</span>`
      : `<span class="day-status status-scheduled">${tt("ist.programata", "PROGRAMATĂ")}</span>`;

    const t = d.totals;
    const totalsLine = t.wins + t.losses > 0
      ? tt("ist.picks", "{p} picks · <strong class=\"num-win\">{w} WIN</strong> · <strong class=\"num-loss\">{l} LOSS</strong>").replace("{p}", t.picks).replace("{w}", t.wins).replace("{l}", t.losses) + (t.pending > 0 ? tt("ist.pending.sufix", " · {n} în așteptare").replace("{n}", t.pending) : "")
      : tt("ist.pending", "{p} picks · {n} în așteptare").replace("{p}", t.picks).replace("{n}", t.pending);

    return `<details class="day-card" ${d.status !== "scheduled" ? "open" : ""}>
      <summary>
        <span class="day-date">${fmtDayDate(d.date)}</span>
        ${statusBadge}
        <span class="day-totals">${totalsLine}</span>
      </summary>
      <div class="day-matches">
        ${visibleMatches.map(m => renderHistMatch(m)).join("")}
      </div>
    </details>`;
  }).join("");

  document.getElementById("days-list").innerHTML = html
    || `<p class="muted">Niciun pick care să se potrivească filtrelor.</p>`;
}

function fmtDayDate(s) {
  // 7 oct 2026: data în limba aleasă (era mereu în română)
  const d = new Date(s + "T12:00:00Z");
  const t = new Intl.DateTimeFormat(_loc(), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function renderHistMatch(m) {
  const ftHtml = (m.ft_h != null && m.ft_a != null)
    ? `<strong>${m.ft_h}–${m.ft_a}</strong>${m.ht_h != null ? ` <span class="muted">(HT ${m.ht_h}–${m.ht_a})</span>` : ""}`
    : `<span class="muted">—</span>`;

  const picksHtml = m.picks.map(p => {
    const cls = p.outcome === "WIN" ? "pick-win"
      : p.outcome === "LOSS" ? "pick-loss"
      : "pick-pending";
    const mark = p.outcome === "WIN" ? "✓"
      : p.outcome === "LOSS" ? "✗"
      : "⏳";
    return `<span class="pick-row ${cls}">★ ${esc(p.market)} ${p.prob}% <span class="pick-mark">${mark}</span></span>`;
  }).join(" ");

  const calMark = m.calibrated_lg
    ? `<span class="ok-tag">✓ calibrată</span>`
    : `<span class="warn-tag">⚠️ ligă slab calibrată</span>`;

  return `<div class="hist-match">
    <div class="hist-match-head">
      <span class="hist-time">${esc(m.time)}</span>
      <span class="hist-teams"><strong>${esc(m.home)}</strong> vs <strong>${esc(m.away)}</strong></span>
      <span class="hist-ft">${ftHtml}</span>
    </div>
    <div class="hist-match-meta">
      <span class="muted">${esc(m.country)} · ${esc(m.league)}</span>
      ${calMark}
    </div>
    <div class="hist-match-picks">${picksHtml}</div>
  </div>`;
}


/* 28 sept 2026 — membrii Pro văd pe site analizele scrise ale zilei (aceleași ca în #analize-pro). */
function _md(s) {
  // 7 oct 2026: analiza începe cu „## 💎 Meci · Ligă · dată” — titlul e deja în capul cardului, îl scoatem; alte „#” devin text simplu
  return String(s || "").trim().replace(/^#{1,6}\s[^\n]*\n?/, "").replace(/^#{1,6}\s+/gm, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
}
async function renderProAnalize() {
  const M = (typeof window !== "undefined") ? window.PoseidonMembers : null;
  const el = document.getElementById("pro-analize");
  if (!M || !M.MEMBERS_API || !el || M.tier() !== "pro") return;
  // 7 oct 2026: pentru Pro, analizele stau EXACT unde se uită membrul — în secțiunea „Exemplu Pro”, în locul listei cu lacăt
  // „Încă N analize azi în Pro” (Andreea, logată Pro, nu le-a găsit: secțiunea era după lista de 164 de meciuri).
  // 7 oct 2026 (Andreea): pentru Pro, analizele sunt PRIMA secțiune a paginii — înaintea exemplului și a listei; lista cu lacăt dispare
  const loc = document.querySelector(".pro-today"); if (loc) loc.remove();
  const prima = document.querySelector("main.container > section, main.container > *"); const main = document.querySelector("main.container");
  if (main && prima && prima !== el) main.insertBefore(el, prima);
  el.innerHTML = `<h2>${tt("pro.azi.h2", "💎 Analizele tale Pro de azi")}</h2><p class="muted">…</p>`;
  const azi = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
  try {
    const r = await fetch(`${M.MEMBERS_API}/api/analize/${azi}`, { headers: { authorization: "Bearer " + localStorage.getItem("poseidon_members_token") }, cache: "no-store" });
    if (!r.ok) {
      // 6 oct 2026: mesaj după oră și cod — „apar după 07:45” doar dimineața; după aceea e o problemă a noastră, spusă ca atare
      const oraRO = Number(new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit", hour12: false }));
      const msg = (r.status === 404 && oraRO < 8)
        ? tt("pro.azi.devreme", "Analizele Pro de azi apar după 07:45. Până atunci: #analize-pro pe Discord.")
        : (r.status === 401 || r.status === 403)
          ? tt("pro.azi.sesiune", "Sesiunea a expirat — apasă „Intră cu Patreon” ca să vezi analizele.")
          : tt("pro.azi.lipsa", "Analizele de azi nu s-au încărcat pe site (cod {cod}). Le găsești în #analize-pro pe Discord; noi reparăm aici.").replace("{cod}", r.status);
      el.innerHTML = `<h2>${tt("pro.azi.h2", "💎 Analizele tale Pro de azi")}</h2><p class="muted">${msg}</p>`; return;
    }
    const d = await r.json();
    // 7 oct 2026: analiza în limba aleasă pe site (analysis_en/es/it din arhivă, traduse de traduce_analize.py); fără traducere → româna
    const txt = it => (LANG !== "ro" && it[`analysis_${LANG}`]) || it.analysis;
    const nota = (d.items || []).some(it => LANG !== "ro" && !it[`analysis_${LANG}`]) ? `<p class="muted">${tt("pro.azi.ro_only", "Traducerea apare în câteva minute; până atunci textul e în română.")}</p>` : "";
    el.innerHTML = `<h2 data-i18n="pro.azi.h2">${tt("pro.azi.h2", "💎 Analizele tale Pro de azi")}</h2>${nota}` + (d.items || []).map(it => `<article class="pro-card pro-card-full"><div class="pro-card-head">💎 ${_md(it.match?.home)} – ${_md(it.match?.away)} · ${_md(it.match?.league)}</div><div class="pro-visible">${_md(txt(it))}</div></article>`).join("");
  } catch (e) { console.warn("[membri] analize", e); el.innerHTML = `<h2>${tt("pro.azi.h2", "💎 Analizele tale Pro de azi")}</h2><p class="muted">${tt("pro.azi.retea", "Nu am putut contacta serverul membrilor. Reîncarcă pagina; analizele sunt și în #analize-pro pe Discord.")}</p>`; }
}
