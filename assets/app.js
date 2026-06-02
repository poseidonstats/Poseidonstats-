/* POSEIDON site — vanilla JS, citește JSON-uri, render. */

const PRED_URL = "data/predictions.json";
const CALIB_URL = "data/calibration.json";
const FORWARD_URL = "data/forward.json";

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

function renderMatch(m) {
  const calibTag = m.calibrated
    ? `<span class="ok-tag">✓ calibrată</span>`
    : `<span class="warn-tag">⚠️ ligă necalibrată</span>`;
  const d = new Date(m.match_date);
  const dateStr = d.toLocaleString("ro-RO", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit"
  });

  return `<div class="match ${m.calibrated ? "" : "uncalibrated"}">
    <div class="match-header">
      <div>
        <div class="match-teams">${esc(m.home_team)} vs ${esc(m.away_team)}</div>
        <div class="match-meta">
          <span class="liga">${esc(m.country)} / ${esc(m.league)}</span>
          · ${dateStr}
        </div>
      </div>
      <div>${calibTag}</div>
    </div>

    <div class="xg-row">
      <strong>xG estimat:</strong>
      ${esc(m.home_team)} ${fmtNum(m.xg_home)} — ${fmtNum(m.xg_away)} ${esc(m.away_team)}
      <span class="muted">· scor probabil: ${m.top_score_h}–${m.top_score_a} (${fmtPct(m.top_score_prob)})</span>
    </div>

    <div class="markets">
      <div class="market">
        <span class="label">1 (home win)</span>
        <span class="val ${pctClass(m.prob_home)}">${fmtPct(m.prob_home)}</span>
      </div>
      <div class="market">
        <span class="label">X (egal)</span>
        <span class="val ${pctClass(m.prob_draw)}">${fmtPct(m.prob_draw)}</span>
      </div>
      <div class="market">
        <span class="label">2 (away win)</span>
        <span class="val ${pctClass(m.prob_away)}">${fmtPct(m.prob_away)}</span>
      </div>
      <div class="market">
        <span class="label">Over 1.5</span>
        <span class="val ${pctClass(m.prob_over_1_5)}">${fmtPct(m.prob_over_1_5)}</span>
      </div>
      <div class="market">
        <span class="label">Over 2.5</span>
        <span class="val ${pctClass(m.prob_over_2_5)}">${fmtPct(m.prob_over_2_5)}</span>
        ${m.prob_over_2_5_raw && Math.abs(m.prob_over_2_5_raw - m.prob_over_2_5) >= 0.03
          ? `<span class="raw-note">model brut ${fmtPct(m.prob_over_2_5_raw)}</span>` : ""}
      </div>
      <div class="market">
        <span class="label">Over 3.5</span>
        <span class="val ${pctClass(m.prob_over_3_5)}">${fmtPct(m.prob_over_3_5)}</span>
      </div>
      <div class="market">
        <span class="label">BTTS</span>
        <span class="val ${pctClass(m.prob_btts)}">${fmtPct(m.prob_btts)}</span>
        ${m.prob_btts_raw && Math.abs(m.prob_btts_raw - m.prob_btts) >= 0.03
          ? `<span class="raw-note">model brut ${fmtPct(m.prob_btts_raw)}</span>` : ""}
      </div>
      <div class="market">
        <span class="label">HT Over 0.5</span>
        <span class="val ${pctClass(m.prob_ht_over_0_5)}">${fmtPct(m.prob_ht_over_0_5)}</span>
      </div>
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
