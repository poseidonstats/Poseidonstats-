/* POSEIDON site — vanilla JS, citește JSON-uri, render. */

const PRED_URL = "data/predictions.json";
const CALIB_URL = "data/calibration.json";
const FORWARD_URL = "data/forward.json";
const HISTORY_URL = "data/history.json";
const I18N_URL = "assets/i18n.json";

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

function applyI18n() {
  if (!I18N) return;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.innerHTML = t(key);
  });
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
    if (document.getElementById("matches")) renderIndex();
    if (document.getElementById("days-list")) renderIstoric();
    if (document.getElementById("calibration-tables")) renderTrackRecord();
  });
}

// Auto-init pe TOATE paginile (cu i18n.json fetch)
if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => { initI18n(); });
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

/* ============== INDEX (predicții) ============== */
async function renderIndex() {
  // F3 — încarc și calibration.json pt eligibilitatea per piață (badge data-driven).
  // Fallback grațios: dacă lipsește, MARKET_CERT={} → marketState cade pe PROMOTED (ca înainte).
  const [data, calib] = await Promise.all([fetchJSON(PRED_URL), fetchJSON(CALIB_URL)]);
  if (calib && calib.market_cert) MARKET_CERT = calib.market_cert;
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
      if (fmin > 0) {
        const p = probForMarket(m, fmk);
        if (p == null || p < fmin) return false;
      }
      return true;
    });
    const sortMode = selSort.value;
    if (sortMode === "prob_desc") {
      filtered.sort((a, b) => probForMarket(b, fmk) - probForMarket(a, fmk));
    } else if (sortMode === "league") {
      filtered.sort((a, b) => (a.league || "").localeCompare(b.league || "") || a.match_date.localeCompare(b.match_date));
    } else {
      filtered.sort((a, b) => a.match_date.localeCompare(b.match_date));
    }
    document.getElementById("match-count").textContent =
      `${filtered.length} meciuri afișate (din ${matches.length} totale).`;
    const matchesEl = document.getElementById("matches");
    matchesEl.classList.toggle("only-calibrated-markets", !!(chkCalibMk && chkCalibMk.checked));
    matchesEl.innerHTML = filtered.map(m => renderMatch(m, fmk)).join("");
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

function pickBadge(name, prob, minThreshold = 0.65) {
  if (prob == null || prob < minThreshold) return "";
  const cls = prob >= 0.80 ? "pick-elite" : prob >= 0.70 ? "pick-strong" : "pick-good";
  const tip = tt("pick.tooltip", "Probabilitate dominantă, calibrată empiric. Informativ — nu recomandare.");
  return `<span class="pick-badge ${cls}" title="${tip}">★ ${name}</span>`;
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
  return `<button type="button" class="market-warn" data-tip="${tip}" title="${tip}" aria-label="${tip}">⚠️</button>`;
}

// Marcaj per piață calibrabilă, derivat din market_cert (3 stări). Certified → fără marcaj (curat).
function marketCertMark(label) {
  const st = marketState(label);
  if (st === "certified") return "";
  const c = MARKET_CERT[LABEL_MKEY[label]];
  return warnMark(st, c ? c.pct_leagues_good : null);
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
  btts: ["BTTS"],
  ht_over_0_5: ["HT O0.5"],
  ht_over_1_5: ["HT O1.5"],
  "1x2": ["1", "X", "2"],
};
function isFilteredMarket(label, filterMarket) {
  const targets = MARKET_FILTER_TO_LABEL[filterMarket];
  return targets ? targets.includes(label) : false;
}

function renderMatch(m, filterMarket = "") {
  const calibTag = m.calibrated
    ? `<span class="ok-tag">✓ calibrată</span>`
    : `<span class="warn-tag">⚠️ ligă necalibrată</span>`;
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
  const picks = [];
  const showOver15 = !filterMarket || filterMarket === "over_1_5";
  const showHtO05 = !filterMarket || filterMarket === "ht_over_0_5";
  if (showOver15 && m.prob_over_1_5 >= 0.75) picks.push(["Over 1.5", m.prob_over_1_5]);
  if (showHtO05 && m.prob_ht_over_0_5 >= 0.70) picks.push(["HT Over 0.5", m.prob_ht_over_0_5]);
  picks.sort((a, b) => b[1] - a[1]);
  const picksHtml = picks.map(([name, p]) => pickBadge(name, p)).join(" ");

  // Pick 1X2 (cel mai probabil)
  const pick1x2 = m.prob_home >= m.prob_draw && m.prob_home >= m.prob_away ? "1"
                : m.prob_away >= m.prob_draw ? "2" : "X";

  return `<div class="match ${m.calibrated ? "" : "uncalibrated"}">
    <div class="match-header">
      <div class="match-title">
        <div class="match-teams">${esc(m.home_team)} <span class="vs">vs</span> ${esc(m.away_team)}</div>
        <div class="match-meta">
          <span class="liga">${esc(m.country)} · ${esc(m.league)}</span>
          <span class="when">${dateStr}</span>
          ${calibTag}
        </div>
      </div>
      ${picksHtml ? `<div class="picks-row">${picksHtml}</div>` : ""}
    </div>

    <div class="xg-section">
      <div class="xg-label">xG model (Poisson + Dixon-Coles + 200K simulări Monte Carlo)</div>
      ${xgBar(m.xg_home, m.xg_away)}
      <div class="score-prob">
        <span class="score-label">Scor probabil</span>
        <span class="score-val">${m.top_score_h}–${m.top_score_a}</span>
        <span class="score-pct">(${fmtPct(m.top_score_prob)})</span>
      </div>
    </div>

    <div class="phase-row ft">
      <div class="phase-label">⏱ FT · 90 min</div>
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

    ${m.ht_prob_home != null ? `<div class="phase-row ht">
      <div class="phase-label">⌛ HT · prima repriză ${m.xg_home_ht ? `<span class="muted-xs">(xG ${m.xg_home_ht}–${m.xg_away_ht})</span>` : ""}</div>
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
        <p class="muted" style="border-left:3px solid #b45309;padding-left:.6em">
          <strong>Calibrare live, out-of-sample</strong> — în acumulare din 2 iunie 2026.
          Pe fereastra curentă (iunie) modelul rulează <strong>conservator pe piețele Over (~2–3pp)</strong>:
          evenimentele se întâmplă ceva mai des decât arată procentul calibrat
          (Over 1.5 ≈ +2.8pp, HT Over 0.5 ≈ +2.2pp). E o sub-estimare reală a golurilor în acest
          interval, nu un artefact de afișare — monitorizată.
        </p>
        <p>Predicții resolved live: <strong>${fwd.n_resolved}</strong>
        (din ${fwd.n_total} totale, ${fwd.n_pending} pending, ${fwd.n_not_played} amânate).</p>
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

if (document.getElementById("matches")) renderIndex();


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
      <p class="muted">${esc(data.note || "")}</p>`
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
      ? `<span class="day-status status-resolved">REZOLVATĂ</span>`
      : d.status === "partial"
      ? `<span class="day-status status-partial">PARȚIAL REZOLVATĂ</span>`
      : d.status === "in_progress"
      ? `<span class="day-status status-live">ÎN CURS</span>`
      : `<span class="day-status status-scheduled">PROGRAMATĂ</span>`;

    const t = d.totals;
    const totalsLine = t.wins + t.losses > 0
      ? `${t.picks} picks · <strong class="num-win">${t.wins} WIN</strong> · <strong class="num-loss">${t.losses} LOSS</strong>${t.pending > 0 ? ` · ${t.pending} pending` : ""}`
      : `${t.picks} picks · ${t.pending} pending`;

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
  const d = new Date(s + "T12:00:00Z");
  const wd = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"][d.getUTCDay()];
  const m = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
             "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"][d.getUTCMonth()];
  return `${wd}, ${d.getUTCDate()} ${m} ${d.getUTCFullYear()}`;
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
