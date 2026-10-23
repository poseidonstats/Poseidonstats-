/* Homepage presentation only: public local exports, no model or member API calls. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.PoseidonDashboard = api;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => api.mount(document));
    else api.mount(document);
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const TIMEZONE = 'Europe/Bucharest';
  const dayFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const count = value => finite(value) && value >= 0 && Number.isInteger(value);
  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  }
  function dayOf(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '';
    const parts = dayFormatter.formatToParts(date);
    const part = name => parts.find(p => p.type === name).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  function availableDays(data) {
    if (!data || !Array.isArray(data.matches)) throw new Error('Missing public predictions');
    return [...new Set(data.matches.map(m => dayOf(m.match_date)).filter(Boolean))].sort();
  }
  function chooseDay(days, now = new Date()) {
    const today = dayOf(now);
    return days.includes(today) ? today : days.find(d => d >= today) || days[days.length - 1] || '';
  }
  function isPublic(match) { return match.free === true && match.locked !== true; }
  function probability(value) { return finite(value) && value >= 0 && value <= 1 ? value : null; }
  function selectRows(data, day, league = '', limit = 7) {
    availableDays(data); // Validate the export before displaying any values.
    const matching = data.matches.filter(m => dayOf(m.match_date) === day && (!league || m.league === league));
    matching.sort((a, b) => Number(isPublic(b)) - Number(isPublic(a)) || Date.parse(a.match_date) - Date.parse(b.match_date));
    return {
      total: matching.length,
      free: matching.filter(isPublic).length,
      rows: matching.slice(0, limit).map(m => ({
        fixture_id: m.fixture_id, match_date: m.match_date, home: m.home_team || '', away: m.away_team || '',
        league: m.league || '', country: m.country || '', locked: !isPublic(m),
        probabilities: isPublic(m) ? [probability(m.prob_home), probability(m.prob_draw), probability(m.prob_away)] : [null, null, null]
      }))
    };
  }
  function extractMetrics(audit, history) {
    if (!audit || !Array.isArray(audit.piete) || !count(audit.n_rezolvate)) throw new Error('Missing public audit');
    if (!history || !Array.isArray(history.cumulated_markets)) throw new Error('Missing public history');
    const market = audit.piete.find(m => m.cheie === 'over_1_5');
    const record = history.cumulated_markets.find(m => m.name === 'Over 1.5');
    return {
      resolved: audit.n_rezolvate, auditedMarkets: audit.piete.length,
      brier: market && finite(market.brier) ? market.brier : null,
      brierN: market && count(market.n) ? market.n : null,
      hit: record && finite(record.hit_pct) ? record.hit_pct : null,
      n: record && count(record.n) ? record.n : null,
      wlo: record && finite(record.wlo_pct) ? record.wlo_pct : null,
      from: audit.de_la || '', to: audit.pana_la || '', generated: audit.generat_la || ''
    };
  }
  function cumulativeResolved(history) {
    if (!history || !Array.isArray(history.days)) throw new Error('Missing public journal');
    let cumulative = 0;
    return history.days.slice().sort((a, b) => a.date.localeCompare(b.date)).flatMap(day => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !day.totals || !count(day.totals.wins) || !count(day.totals.losses)) return [];
      const resolved = day.totals.wins + day.totals.losses;
      if (!resolved) return [];
      cumulative += resolved;
      return [{ date: day.date, resolved, cumulative, partial: day.status === 'partial' || day.status === 'in_progress' }];
    });
  }
  function locale(doc) { return ({ro:'ro-RO', en:'en-GB', es:'es-ES', it:'it-IT', fr:'fr-FR', id:'id-ID'})[doc.documentElement.lang] || 'ro-RO'; }
  function translator() {
    return (key, vars = {}) => {
      const translated = typeof t === 'function' ? t(key) : key;
      return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), translated);
    };
  }
  function renderRows(rows, tr, loc) {
    const pct = v => v == null ? '—' : `${new Intl.NumberFormat(loc, {maximumFractionDigits:1}).format(v * 100)}%`;
    return rows.map(row => {
      const date = new Date(row.match_date);
      const time = new Intl.DateTimeFormat(loc, {timeZone:TIMEZONE, hour:'2-digit', minute:'2-digit', hour12:false}).format(date);
      return `<tr><td><time datetime="${escapeHTML(row.match_date)}">${escapeHTML(time)}</time></td>` +
        `<td class="dashboard-team"><a href="#matches" data-dashboard-fixture="${escapeHTML(row.fixture_id)}">${escapeHTML(row.home)} <span aria-hidden="true">–</span> ${escapeHTML(row.away)}</a><small>${escapeHTML(row.country)} · ${escapeHTML(row.league)}</small></td>` +
        row.probabilities.map(v => `<td class="dashboard-prob">${escapeHTML(pct(v))}</td>`).join('') +
        `<td><span class="${row.locked ? 'dashboard-lock' : 'dashboard-free'}">${row.locked ? '🔒 ' : ''}${escapeHTML(tr(row.locked ? 'dashboard.access.locked' : 'dashboard.access.free'))}</span></td></tr>`;
    }).join('');
  }
  function renderChart(points, tr, loc, id) {
    if (!points.length) return `<p class="muted">${escapeHTML(tr('dashboard.data.unavailable'))}</p>`;
    const width = 480, height = 180, left = 40, top = 14, bottom = 28, right = 12;
    const max = points[points.length - 1].cumulative;
    const firstTime = Date.parse(points[0].date), span = Date.parse(points[points.length - 1].date) - firstTime;
    const x = point => left + (span ? (Date.parse(point.date) - firstTime) / span : 0) * (width - left - right);
    const y = point => height - bottom - point.cumulative / Math.max(max, 1) * (height - top - bottom);
    const line = points.map(p => `${x(p).toFixed(2)},${y(p).toFixed(2)}`).join(' ');
    const num = n => new Intl.NumberFormat(loc, {maximumFractionDigits:0}).format(n);
    const date = d => new Intl.DateTimeFormat(loc, {day:'numeric', month:'short', timeZone:TIMEZONE}).format(new Date(d + 'T12:00:00Z'));
    const partial = points.filter(p => p.partial).map(p => date(p.date)).join(', ');
    const description = `${tr('dashboard.chart.title')}. ${date(points[0].date)} – ${date(points[points.length - 1].date)}. ${num(max)}. ${partial ? tr('dashboard.chart.partial', {dates:partial}) : ''}`;
    return `<svg class="dashboard-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-labelledby="${id}"><title id="${id}">${escapeHTML(description)}</title>` +
      `<defs><linearGradient id="${id}-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d7b56d" stop-opacity=".28"/><stop offset="100%" stop-color="#d7b56d" stop-opacity="0"/></linearGradient></defs>` +
      [0, .5, 1].map(r => { const yy = height - bottom - r * (height - top - bottom); return `<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" stroke="currentColor" opacity=".12"/><text x="${left-7}" y="${yy+4}" text-anchor="end" fill="currentColor" font-size="10">${escapeHTML(num(max*r))}</text>`; }).join('') +
      `<polygon points="${left},${height-bottom} ${line} ${x(points[points.length-1])},${height-bottom}" fill="url(#${id}-fill)"/>` +
      `<polyline points="${line}" fill="none" stroke="#d7b56d" stroke-width="2.5" stroke-linejoin="round"/>` +
      points.map(p => `<circle cx="${x(p)}" cy="${y(p)}" r="${p.partial?3:2}" fill="${p.partial?'#101c2c':'#d7b56d'}" stroke="#d7b56d" stroke-width="1.5"><title>${escapeHTML(`${date(p.date)}: ${num(p.cumulative)}${p.partial?' · '+tr('dashboard.chart.partialday'):''}`)}</title></circle>`).join('') +
      `<text x="${left}" y="${height-5}" fill="currentColor" font-size="11">${escapeHTML(date(points[0].date))}</text><text x="${width-right}" y="${height-5}" text-anchor="end" fill="currentColor" font-size="11">${escapeHTML(date(points[points.length-1].date))}</text></svg>` +
      `<p class="dashboard-chart-caption">${escapeHTML(tr('dashboard.chart.total', {n:num(max)}))} · ${escapeHTML(tr('dashboard.chart.partialday'))}: ○</p>`;
  }
  function revealMatch(doc, source) {
    const reset = doc.getElementById('filter-reset');
    if (reset) reset.click();
    // Original full-card filters use UTC dates; the dashboard displays Bucharest time.
    [['filter-day',source.match_date.slice(0,10)],['filter-league',source.league],['filter-minprob','0']].forEach(([id,value]) => {
      const select = doc.getElementById(id);
      if (select) {select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}
    });
  }
  function chooseAnalysisLanguage(preferred, available) {
    const language = [preferred,'en','ro'].find(lang => available.includes(lang)) || null;
    return {language,fallback:language !== preferred};
  }
  function analysisLanguageNotice(selection, tr) {
    if (!selection.fallback) return '';
    if (!selection.language) return tr('dashboard.data.unavailable');
    const language = tr(selection.language === 'en' ? 'dashboard.language.english' : 'dashboard.language.romanian');
    return tr('dashboard.analysis.fallback').split('{language}').join(language);
  }
  function decorateLanguageSelector(doc, tr) {
    const selects = doc.querySelectorAll('.lang-select');
    selects.forEach(select => {
      select.setAttribute('data-i18n-attr','aria-label:dashboard.language.label');
      select.setAttribute('aria-label',tr('dashboard.language.label'));
    });
    return selects.length;
  }
  function watchLanguageSelector(doc, tr, Observer = typeof MutationObserver === 'function' ? MutationObserver : null) {
    if (decorateLanguageSelector(doc,tr) || !Observer) return null;
    const nav = doc.querySelector('header nav');
    if (!nav) return null;
    const observer = new Observer(() => {if (decorateLanguageSelector(doc,tr)) observer.disconnect();});
    observer.observe(nav,{childList:true,subtree:true});
    return observer;
  }
  function ensureProofNotice(doc, tr) {
    const metrics = doc.querySelector('.proof-metrici');
    if (!metrics || !metrics.parentNode) return;
    let notice = doc.querySelector('.dashboard-proof-note');
    if (!notice) {
      notice = doc.createElement('p');
      notice.className = 'proof-note dashboard-proof-note';
      metrics.parentNode.insertBefore(notice,metrics);
    }
    notice.textContent = tr('proof.previous.note') + ' ';
    const link = doc.createElement('a');
    link.setAttribute('href','track-record.html');
    link.textContent = tr('proof.previous.link');
    notice.appendChild(link);
  }
  function analysisAction(tier) {
    if (tier === 'pro') return {href:'#pro-analize',key:'dashboard.analysis.member',sample:false};
    if (tier === 'basic') return {href:'analize/index.html',key:'dashboard.analysis.readarchive',sample:false};
    return {href:'#exemplu-pro',key:'dashboard.analysis.read',sample:true};
  }
  function membershipTier(body) {
    const classes = body && body.classList;
    if (!classes || !classes.contains('is-member')) return null;
    if (classes.contains('tier-pro')) return 'pro';
    return classes.contains('tier-basic') ? 'basic' : null;
  }
  function observeMembership(body, changed, Observer = typeof MutationObserver === 'function' ? MutationObserver : null) {
    if (!body || !Observer) return null;
    let previous = membershipTier(body);
    const observer = new Observer(() => {
      const current = membershipTier(body);
      if (current !== previous) {previous=current;changed();}
    });
    observer.observe(body,{attributes:true,attributeFilter:['class']});
    return observer;
  }
  async function mount(doc) {
    if (!doc.querySelector('[data-dashboard-kpis]')) return;
    if (typeof i18nGata === 'function') await i18nGata();
    watchLanguageSelector(doc,translator());
    ensureProofNotice(doc,translator());
    let predictions = null, history = null, audit = null, archive = null;
    const dateSelect = doc.getElementById('dashboard-date');
    const leagues = doc.getElementById('dashboard-leagues');
    const table = doc.getElementById('dashboard-predictions');
    const status = doc.getElementById('dashboard-table-status');
    let selectedLeague = '';
    async function localJSON(path) {
      const response = await fetch(path, {credentials:'omit'});
      if (!response.ok) throw new Error(`Public export unavailable: ${path}`);
      return response.json();
    }
    const results = await Promise.allSettled([localJSON('data/predictions.json'), localJSON('data/history.json'), localJSON('data/audit.json')]);
    [predictions, history, audit] = results.map(result => result.status === 'fulfilled' ? result.value : null);
    function renderMetrics() {
      const tr = translator(), loc = locale(doc), num = n => n == null ? '—' : new Intl.NumberFormat(loc).format(n);
      try {
        const metrics = extractMetrics(audit, history);
        const labels = ['dashboard.kpi.resolved','dashboard.kpi.hit','dashboard.kpi.brier','dashboard.kpi.markets'];
        const values = [num(metrics.resolved), metrics.hit == null ? '—' : `${num(metrics.hit)}%`, metrics.brier == null ? '—' : new Intl.NumberFormat(loc,{minimumFractionDigits:3,maximumFractionDigits:3}).format(metrics.brier), num(metrics.auditedMarkets)];
        const notes = [`${metrics.from} – ${metrics.to}`, `Over 1.5 · ≥75% · N=${num(metrics.n)} · Wlo 95%=${num(metrics.wlo)}%`, `Over 1.5 · N=${num(metrics.brierN)} · ${tr('dashboard.kpi.lower')}`, tr('dashboard.kpi.audit')];
        const icons = ['▤','◎','⌁','▦'];
        const markup = labels.map((label,i) => `<div class="dashboard-kpi"><span class="dashboard-kpi-icon" aria-hidden="true">${icons[i]}</span><strong class="dashboard-kpi-value">${escapeHTML(values[i])}</strong><span class="dashboard-kpi-label">${escapeHTML(tr(label))}</span><small>${escapeHTML(notes[i])}</small></div>`).join('');
        doc.querySelectorAll('[data-dashboard-kpis]').forEach(el => {el.innerHTML = markup;});
        const summary = doc.getElementById('dashboard-track-summary');
        if (summary) summary.textContent = tr('dashboard.track.context', {date:metrics.generated});
      } catch (_) {
        doc.querySelectorAll('[data-dashboard-kpis]').forEach(el => {el.textContent = tr('dashboard.data.unavailable');});
      }
      let points = [];
      try { points = cumulativeResolved(history); } catch (_) { /* Unavailable stays explicit. */ }
      doc.querySelectorAll('[data-dashboard-chart]').forEach((el,i) => {el.innerHTML = renderChart(points,tr,loc,`dashboard-chart-${i}`);});
    }
    function renderLeagues() {
      if (!leagues || !predictions) return;
      const day = dateSelect && dateSelect.value;
      const available = [...new Set(predictions.matches.filter(m => dayOf(m.match_date) === day).map(m => m.league).filter(Boolean))].sort((a,b) => a.localeCompare(b,locale(doc)));
      if (!available.includes(selectedLeague)) selectedLeague = '';
      const tr = translator();
      leagues.innerHTML = ['',...available].map(league => `<button type="button" data-dashboard-league="${escapeHTML(league)}" aria-pressed="${league===selectedLeague}">${escapeHTML(league || tr('dashboard.leagues.all'))}</button>`).join('');
    }
    function renderTable() {
      if (!table) return;
      const tr = translator();
      try {
        const selection = selectRows(predictions,dateSelect ? dateSelect.value : '',selectedLeague,5);
        table.innerHTML = selection.rows.length ? renderRows(selection.rows,tr,locale(doc)) : `<tr><td colspan="6">${escapeHTML(tr('dashboard.table.empty'))}</td></tr>`;
        if (status) status.textContent = tr('dashboard.table.count', {shown:selection.rows.length,total:selection.total,free:selection.free}) + ' · ' + tr('dashboard.table.timezone') + ' · ' + tr('dashboard.table.rawnote');
      } catch (_) {
        table.innerHTML = `<tr><td colspan="6">${escapeHTML(tr('dashboard.data.unavailable'))}</td></tr>`;
        if (status) status.textContent = tr('dashboard.table.error');
      }
    }
    function renderDates() {
      if (!dateSelect) return;
      try {
        const days = availableDays(predictions), previous = dateSelect.value;
        dateSelect.innerHTML = days.map(day => `<option value="${day}">${escapeHTML(new Intl.DateTimeFormat(locale(doc),{day:'numeric',month:'long',year:'numeric',timeZone:TIMEZONE}).format(new Date(day+'T12:00:00Z')))}</option>`).join('');
        dateSelect.value = days.includes(previous) ? previous : chooseDay(days);
        dateSelect.disabled = !days.length;
      } catch (_) {dateSelect.disabled = true;}
    }
    function renderAnalyses() {
      const target = doc.getElementById('dashboard-analyses');
      if (!target) return;
      const tr = translator(), lang = doc.documentElement.lang;
      const action = analysisAction(membershipTier(doc.body));
      const cards = [];
      const head = doc.querySelector('#exemplu-pro .pro-card-head');
      if (head) {
        const card = head.closest('.pro-card');
        const selection = chooseAnalysisLanguage(lang,Array.from(card.querySelectorAll('[data-lang]'),el => el.getAttribute('data-lang')));
        const body = selection.language ? card.querySelector(`[data-lang="${selection.language}"]`) : null;
        const notice = analysisLanguageNotice(selection,tr);
        const excerpt = body && body.querySelector('.pro-visible p');
        const title = head.textContent.split(' · ')[0].trim();
        const metadata = head.textContent.slice(title.length).replace(/^\s*·\s*/, '').trim();
        cards.push(`<article class="dashboard-analysis-card"><span class="dashboard-analysis-meta">${escapeHTML(tr('dashboard.analysis.sample'))}</span><h3 class="dashboard-analysis-title">${escapeHTML(title)}</h3><p class="dashboard-analysis-meta">${escapeHTML(metadata)}</p>${notice ? `<p class="dashboard-analysis-meta dashboard-analysis-language">${escapeHTML(notice)}</p>` : ''}<p class="dashboard-analysis-excerpt">${escapeHTML(excerpt ? excerpt.textContent : tr('dashboard.data.unavailable'))}</p><a class="dashboard-analysis-link" href="${escapeHTML(action.href)}"${action.sample ? ' data-dashboard-analysis' : ''}>${escapeHTML(tr(action.key))} →</a></article>`);
      }
      if (archive) {
        const links = Array.from(archive.querySelectorAll('a[href]')).filter(a => /^\d{4}-\d{2}-\d{2}\.html$/.test(a.getAttribute('href'))).slice(0,2);
        links.forEach(a => {
          const day = a.getAttribute('href').slice(0,10);
          const date = new Intl.DateTimeFormat(locale(doc),{day:'numeric',month:'long',year:'numeric',timeZone:TIMEZONE}).format(new Date(day+'T12:00:00Z'));
          cards.push(`<article class="dashboard-analysis-card"><span class="dashboard-analysis-meta">${escapeHTML(tr('dashboard.analysis.archive'))}</span><h3 class="dashboard-analysis-title">${escapeHTML(date)}</h3><p class="dashboard-analysis-excerpt">${escapeHTML(tr('dashboard.analysis.archivedesc'))}</p><a class="dashboard-analysis-link" href="analize/${escapeHTML(a.getAttribute('href'))}">${escapeHTML(tr('dashboard.analysis.openarchive'))} →</a></article>`);
        });
      }
      target.innerHTML = cards.join('') || `<p>${escapeHTML(tr('dashboard.data.unavailable'))}</p>`;
    }
    function render() {decorateLanguageSelector(doc,translator());ensureProofNotice(doc,translator());renderDates();renderLeagues();renderTable();renderMetrics();renderAnalyses();}
    if (dateSelect) dateSelect.addEventListener('change', () => {selectedLeague='';renderLeagues();renderTable();});
    if (leagues) leagues.addEventListener('click', event => {
      const button = event.target.closest('[data-dashboard-league]');
      if (!button) return;
      selectedLeague = button.getAttribute('data-dashboard-league');renderLeagues();renderTable();
    });
    doc.addEventListener('click', event => {
      const match = event.target.closest('[data-dashboard-fixture]');
      if (match && predictions) {
        const source = predictions.matches.find(m => String(m.fixture_id) === match.getAttribute('data-dashboard-fixture'));
        if (source) {
          revealMatch(doc, source);
        }
      }
      const sample = event.target.closest('[data-dashboard-analysis]');
      if (sample) {const detail=doc.querySelector('#exemplu-pro details');if(detail) detail.open=true;}
    });
    doc.addEventListener('change', event => {if(event.target.matches('.lang-select')) setTimeout(render,0);});
    observeMembership(doc.body, renderAnalyses);
    render();
    try {
      const response = await fetch('analize/index.html',{credentials:'omit'});
      if (response.ok) archive = new DOMParser().parseFromString(await response.text(),'text/html');
    } catch (_) { /* Current real sample remains available if the archive cannot load. */ }
    renderAnalyses();
  }
  return {escapeHTML,dayOf,availableDays,chooseDay,isPublic,selectRows,extractMetrics,cumulativeResolved,renderRows,renderChart,revealMatch,chooseAnalysisLanguage,analysisLanguageNotice,decorateLanguageSelector,watchLanguageSelector,ensureProofNotice,analysisAction,membershipTier,observeMembership,mount};
});
