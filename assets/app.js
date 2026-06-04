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

/* ============== INDEX (predicții) ============== */
async function renderIndex() {
  const data = await fetchJSON(PRED_URL);
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
  days.forEach(d => selDay.add(new Option(d, d)));
  leagues.forEach(l => selLeague.add(new Option(l, l)));
  countries.forEach(c => selCountry.add(new Option(c, c)));

  function update() {
    const fd = selDay.value;
    const fl = selLeague.value;
    const fc = selCountry.value;
    const calibOnly = document.getElementById("filter-calibrated-only").checked;
    let filtered = matches.filter(m => {
      if (fd && !m.match_date.startsWith(fd)) return false;
      if (fl && m.league !== fl) return false;
      if (fc && m.country !== fc) return false;
      if (calibOnly && !m.calibrated) return false;
      return true;
    });
    filtered.sort((a, b) => a.match_date.localeCompare(b.match_date));
    document.getElementById("match-count").textContent =
      `${filtered.length} meciuri afișate (din ${matches.length} totale).`;
    document.getElementById("matches").innerHTML = filtered.map(renderMatch).join("");
  }

  [selDay, selLeague, selCountry].forEach(s => s.addEventListener("change", update));
  document.getElementById("filter-calibrated-only").addEventListener("change", update);
  update();
}

function pickBadge(name, prob, minThreshold = 0.65) {
  if (prob == null || prob < minThreshold) return "";
  const cls = prob >= 0.80 ? "pick-elite" : prob >= 0.70 ? "pick-strong" : "pick-good";
  return `<span class="pick-badge ${cls}">★ ${name}</span>`;
}

function rawNote(raw, cal) {
  if (raw == null || Math.abs(raw - cal) < 0.03) return "";
  return `<span class="raw-note">brut ${fmtPct(raw)}</span>`;
}

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

function renderMatch(m) {
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

  // Pick principal: cel mai mare prob ≥65% (combined OU + BTTS + 1X2)
  const picks = [];
  if (m.prob_home >= 0.65) picks.push(["1 (home)", m.prob_home]);
  if (m.prob_away >= 0.65) picks.push(["2 (away)", m.prob_away]);
  if (m.prob_over_2_5 >= 0.65) picks.push(["Over 2.5", m.prob_over_2_5]);
  if (m.prob_over_1_5 >= 0.75) picks.push(["Over 1.5", m.prob_over_1_5]);
  if (m.prob_over_3_5 >= 0.65) picks.push(["Over 3.5", m.prob_over_3_5]);
  if (m.prob_btts >= 0.65) picks.push(["BTTS Da", m.prob_btts]);
  if ((1 - m.prob_btts) >= 0.65) picks.push(["BTTS Nu", 1 - m.prob_btts]);
  if ((1 - m.prob_over_2_5) >= 0.65) picks.push(["Under 2.5", 1 - m.prob_over_2_5]);
  picks.sort((a, b) => b[1] - a[1]);
  const picksHtml = picks.slice(0, 3).map(([name, p]) => pickBadge(name, p)).join(" ");

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
        <div class="market ${pick1x2 === "1" ? "pick" : ""}">
          <span class="label">1</span>
          <span class="val ${pctClass(m.prob_home)}">${fmtPct(m.prob_home)}</span>
        </div>
        <div class="market ${pick1x2 === "X" ? "pick" : ""}">
          <span class="label">X</span>
          <span class="val ${pctClass(m.prob_draw)}">${fmtPct(m.prob_draw)}</span>
        </div>
        <div class="market ${pick1x2 === "2" ? "pick" : ""}">
          <span class="label">2</span>
          <span class="val ${pctClass(m.prob_away)}">${fmtPct(m.prob_away)}</span>
        </div>
        <div class="market">
          <span class="label">O1.5</span>
          <span class="val ${pctClass(m.prob_over_1_5)}">${fmtPct(m.prob_over_1_5)}</span>
        </div>
        <div class="market">
          <span class="label">O2.5</span>
          <span class="val ${pctClass(m.prob_over_2_5)}">${fmtPct(m.prob_over_2_5)}</span>
          ${rawNote(m.prob_over_2_5_raw, m.prob_over_2_5)}
        </div>
        <div class="market">
          <span class="label">O3.5</span>
          <span class="val ${pctClass(m.prob_over_3_5)}">${fmtPct(m.prob_over_3_5)}</span>
        </div>
        <div class="market">
          <span class="label">BTTS</span>
          <span class="val ${pctClass(m.prob_btts)}">${fmtPct(m.prob_btts)}</span>
          ${rawNote(m.prob_btts_raw, m.prob_btts)}
        </div>
      </div>
    </div>

    ${m.ht_prob_home != null ? `<div class="phase-row ht">
      <div class="phase-label">⌛ HT · prima repriză ${m.xg_home_ht ? `<span class="muted-xs">(xG ${m.xg_home_ht}–${m.xg_away_ht})</span>` : ""}</div>
      <div class="markets-grid">
        <div class="market"><span class="label">1H</span><span class="val ${pctClass(m.ht_prob_home)}">${fmtPct(m.ht_prob_home)}</span></div>
        <div class="market"><span class="label">XH</span><span class="val ${pctClass(m.ht_prob_draw)}">${fmtPct(m.ht_prob_draw)}</span></div>
        <div class="market"><span class="label">2H</span><span class="val ${pctClass(m.ht_prob_away)}">${fmtPct(m.ht_prob_away)}</span></div>
        <div class="market"><span class="label">HT O0.5</span><span class="val ${pctClass(m.prob_ht_over_0_5)}">${fmtPct(m.prob_ht_over_0_5)}</span></div>
        <div class="market"><span class="label">HT O1.5</span><span class="val ${pctClass(m.prob_ht_over_1_5)}">${fmtPct(m.prob_ht_over_1_5)}</span></div>
        <div class="market"><span class="label">HT BTTS</span><span class="val ${pctClass(m.ht_prob_btts)}">${fmtPct(m.ht_prob_btts)}</span></div>
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
            ${market.buckets.map(b => `<tr>
              <td>${b.range}</td>
              <td>${b.n}</td>
              <td>${b.hit_pct.toFixed(1)}%</td>
              <td>${b.wlo_pct.toFixed(1)}%</td>
              <td style="color:${Math.abs(b.diff_pp) <= 3 ? '#065f46' : '#991b1b'}">${b.diff_pp >= 0 ? "+" : ""}${b.diff_pp.toFixed(1)}pp</td>
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
  }

  // Forward
  const fwd = await fetchJSON(FORWARD_URL);
  const fwdHtml = (fwd && fwd.n_resolved > 0)
    ? `<div class="calibration-card">
        <p>Predicții resolved live: <strong>${fwd.n_resolved}</strong>
        (din ${fwd.n_total} totale, ${fwd.n_pending} pending, ${fwd.n_not_played} amânate).</p>
        ${(fwd.markets || []).map(m => `<div>
          <h4>${m.name}</h4>
          <table><thead><tr><th>Bucket prob</th><th>N</th><th>Real %</th></tr></thead>
          <tbody>${m.buckets.map(b => `<tr>
            <td>${b.range}</td><td>${b.n}</td><td>${b.hit_pct.toFixed(1)}%</td>
          </tr>`).join("")}</tbody></table>
        </div>`).join("")}
      </div>`
    : `<div class="calibration-card">
        <p>Jurnal forward în acumulare din <strong>2 iunie 2026</strong>.
        Primele rezultate live apar în câteva zile, după ce meciurile se joacă.</p>
        ${fwd ? `<p class="muted">Total predicții înghețate: ${fwd.n_total || 0} (toate pending încă).</p>` : ""}
      </div>`;
  document.getElementById("forward-stats").innerHTML = fwdHtml;
}

if (document.getElementById("matches")) renderIndex();


/* ============== ISTORIC (pagina istoric.html) ============== */

let _histData = null;

async function renderIstoric() {
  const data = await fetchJSON(HISTORY_URL);
  if (!data) {
    document.getElementById("days-list").innerHTML =
      `<p class="muted">Datele se încarcă... Dacă persistă, jurnalul nu e încă publicat.</p>`;
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
    : `<p class="muted">Jurnal încă în acumulare — verifică din nou peste câteva zile.</p>`;
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
