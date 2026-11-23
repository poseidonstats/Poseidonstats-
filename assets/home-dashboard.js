/* Homepage presentation: public exports and the already verified member prediction list. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./country-label.js'), require('./home-watchlist.js'));
  else {
    const api = factory(root.PoseidonCountry, root.PoseidonWatchlist);
    root.PoseidonDashboard = api;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => api.mount(document));
    else api.mount(document);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (countries, watchlist) {
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
  function memberForecast(match) { return match.locked !== true && (match.prob_home != null || match.prob_over_1_5 != null); }
  function normalizeSearch(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  }
  function leagueChoices(data, day, selected = '') {
    availableDays(data);
    const available = [...new Set(data.matches.filter(m => dayOf(m.match_date) === day).map(m => m.league).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    const familiar = ['Liga I','Premier League','La Liga','Serie A','Bundesliga','Ligue 1','Eredivisie','Championship','2. Bundesliga'];
    const shortlist = [...familiar.filter(league => available.includes(league)),...available.filter(league => !familiar.includes(league))].slice(0,6);
    if (selected && available.includes(selected) && !shortlist.includes(selected)) shortlist.splice(Math.min(shortlist.length,5),1,selected);
    return {available,shortlist};
  }
  function competitionChoices(matches, loc) {
    const groups = new Map();
    for (const {league, country = ''} of matches) {
      if (!league) continue;
      if (!groups.has(league)) groups.set(league, new Set());
      groups.get(league).add(country);
    }
    const choices = [];
    for (const [league, nations] of groups) {
      for (const country of nations) {
        const label = [countries?.label(country, loc) || country, league].filter(Boolean).join(' · ');
        const value = nations.size === 1 ? league : JSON.stringify([country, league]);
        choices.push({country, league, label, value});
      }
    }
    return choices.sort((a,b) => a.label.localeCompare(b.label, loc));
  }
  function selectRows(data, day, league = '', limit = 7, search = '', member = false, country = '') {
    availableDays(data); // Validate the export before displaying any values.
    const query = normalizeSearch(search);
    const matching = data.matches.filter(m => dayOf(m.match_date) === day && (!league || m.league === league) && (!country || m.country === country) &&
      (!query || normalizeSearch(m.home_team).includes(query) || normalizeSearch(m.away_team).includes(query)));
    const visible = m => isPublic(m) || member && (m.dossier_only || memberForecast(m));
    const hasForecast = m => visible(m) && !m.dossier_only && memberForecast(m);
    matching.sort((a, b) => Number(hasForecast(b)) - Number(hasForecast(a))
      || Number(visible(b)) - Number(visible(a))
      || Date.parse(a.match_date) - Date.parse(b.match_date));
    return {
      total: matching.length,
      free: matching.filter(isPublic).length,
      rows: matching.slice(0, limit).map(m => ({
        fixture_id: m.fixture_id, match_date: m.match_date, home: m.home_team || '', away: m.away_team || '',
        league: m.league || '', country: m.country || '', locked: !visible(m),
        ...(isPublic(m) ? {free:true} : {}),
        ...(member && m.dossier_only ? {dossierOnly:true} : {}),
        marketProbabilities: visible(m) && !m.dossier_only ? {
          btts:probability(m.prob_btts), over_2_5:probability(m.prob_over_2_5), ht_over_0_5:probability(m.prob_ht_over_0_5)
        } : null,
        probabilities: visible(m) && !m.dossier_only ? [probability(m.prob_home), probability(m.prob_draw), probability(m.prob_away)] : [null, null, null],
        ...(visible(m) && !m.dossier_only && [m.top_score_h,m.top_score_a].every(n => Number.isSafeInteger(n) && n >= 0)
          ? {estimatedScore:[m.top_score_h,m.top_score_a]} : {})
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
  function cumulativeVerifiedFreeMatches(feed) {
    let cumulative = 0;
    const seen = new Set();
    return Object.keys(feed?.days || {}).sort().flatMap(date => {
      const candidates = new Set();
      let resolved = 0;
      for (const match of publicArchive(feed, date)) {
        const entry = watchlist.entry(match, '1x2');
        if (!entry) continue;
        const id = entry.fixture_id;
        candidates.add(id);
        const result = feed.days[date].results?.[id];
        if (seen.has(id) || !result || Date.parse(result.match_date) !== Date.parse(match.match_date)) continue;
        if (!watchlist.settle(entry, feed).ft) continue;
        seen.add(id);
        resolved++;
      }
      if (!resolved) return [];
      cumulative += resolved;
      return [{date, resolved, cumulative, partial:resolved < candidates.size}];
    });
  }
  function locale(doc) { return ({ro:'ro-RO', en:'en-GB', es:'es-ES', it:'it-IT', fr:'fr-FR', id:'id-ID'})[doc.documentElement.lang] || 'ro-RO'; }
  function translator() {
    return (key, vars = {}) => {
      const translated = typeof t === 'function' ? t(key) : key;
      return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), translated);
    };
  }
  function marketLabel(market, tr) {
    return market === '1x2' ? '1X2' : tr('dashboard.market.' + market);
  }
  function publicArchive(feed, day) {
    const matches = feed?.days?.[day]?.matches;
    return Array.isArray(matches) ? matches.filter(match => isPublic(match) && dayOf(match.match_date) === day) : [];
  }
  function archiveStat(feed, row, market) {
    const day = dayOf(row.match_date);
    const match = publicArchive(feed, day).find(item => String(item.fixture_id) === String(row.fixture_id)
      && item.home_team === row.home && item.away_team === row.away && item.match_date === row.match_date);
    return match && feed.days[day].stats?.[row.fixture_id] ? {
      home: feed.days[day].stats[row.fixture_id].home?.[market],
      away: feed.days[day].stats[row.fixture_id].away?.[market]
    } : {};
  }
  function formatDay(day, loc) {
    return new Intl.DateTimeFormat(loc, {day:'numeric', month:'short', year:'numeric', timeZone:TIMEZONE})
      .format(new Date(day + 'T12:00:00Z'));
  }
  function renderTeamHistory(stats, tr, loc, loading = false) {
    if (loading) return `<span class="dashboard-market-history">${escapeHTML(tr('loading'))}</span>`;
    const valid = value => value && count(value.hits) && count(value.n) && value.n > 0 && value.hits <= value.n
      && value.from <= value.to && watchlist.shiftDay(value.from, 0) === value.from && watchlist.shiftDay(value.to, 0) === value.to;
    const number = new Intl.NumberFormat(loc);
    const line = (side, value) => {
      if (!valid(value)) return '';
      return `<div><dt>${escapeHTML(tr('dashboard.market.' + side))}</dt><dd>${escapeHTML(tr('dashboard.market.sample', {
        hits:number.format(value.hits), n:number.format(value.n)
      }))} <span>(${escapeHTML(formatDay(value.from, loc))} – ${escapeHTML(formatDay(value.to, loc))})</span></dd></div>`;
    };
    return `<dl class="dashboard-market-history" aria-label="${escapeHTML(tr('dashboard.market.history'))}">${line('home',stats.home) || lineUnavailable('home')}${line('away',stats.away) || lineUnavailable('away')}</dl>`;
    function lineUnavailable(side) {
      return `<div><dt>${escapeHTML(tr('dashboard.market.' + side))}</dt><dd>${escapeHTML(tr('dashboard.market.noHistory'))}</dd></div>`;
    }
  }
  function renderMarketHistory(row, context, tr, loc) {
    const id = `${row.fixture_id}|${row.match_date}|${context.market}`;
    const history = renderTeamHistory(archiveStat(context.feed, row, context.market), tr, loc, context.marketHistoryPending);
    return `<details class="dashboard-market-details" data-home-team-history="${escapeHTML(id)}"${context.openHistory?.has(id) ? ' open' : ''}><summary>${escapeHTML(tr('dashboard.market.history'))}</summary>${history}</details>`;
  }
  function renderMarketResult(entry, feed, history, tr) {
    const result = watchlist.settle(entry, feed, history);
    const score = [
      result.ft && tr('dashboard.market.ft', {score:result.ft.join('–')}),
      entry.market === 'ht_over_0_5' && result.ht && tr('dashboard.market.ht', {score:result.ht.join('–')})
    ].filter(Boolean).join(' · ');
    const outcome = tr('dashboard.market.result.' + result.outcome);
    return `<span class="dashboard-market-result" data-outcome="${escapeHTML(result.outcome)}">${escapeHTML(score ? score + ' · ' + outcome : outcome)}</span>`;
  }
  function renderRows(rows, tr, loc, dossiers = null, member = false, publicDossiers = null, freeDay = null, context = null) {
    const pct = v => v == null ? '—' : `${new Intl.NumberFormat(loc, {maximumFractionDigits:1}).format(v * 100)}%`;
    return rows.map(row => {
      const date = new Date(row.match_date);
      const time = new Intl.DateTimeFormat(loc, {timeZone:TIMEZONE, hour:'2-digit', minute:'2-digit', hour12:false}).format(date);
      const identity = {fixture_id:row.fixture_id,home_team:row.home,away_team:row.away,match_date:row.match_date,locked:row.locked,free:row.free};
      const dossier = dossiers ? dossiers.button(identity, publicDossiers?.has(row.fixture_id)) : '';
      const readingAPI = !row.dossierOnly && typeof window !== 'undefined' && window.POSEIDON_CITIRE;
      const reading = !row.locked && readingAPI && typeof readingAPI.dashboardRow === 'function' ? readingAPI.dashboardRow(identity) : '';
      const readingAttributes = row.locked || row.dossierOnly ? '' : ` data-reading-fixture="${escapeHTML(row.fixture_id)}" data-reading-home="${escapeHTML(row.home)}" data-reading-away="${escapeHTML(row.away)}" data-reading-kickoff="${escapeHTML(row.match_date)}" data-reading-free="true"`;
      const title = `${escapeHTML(row.home)} <span aria-hidden="true">–</span> ${escapeHTML(row.away)}`;
      const name = row.dossierOnly || context?.past ? `<strong>${title}</strong>` : `<a href="#matches" data-dashboard-fixture="${escapeHTML(row.fixture_id)}" title="${escapeHTML(`${row.home} – ${row.away}`)}">${title}</a>`;
      const country = countries?.label(row.country, loc) || row.country;
      const competition = escapeHTML([country, row.league].filter(Boolean).join(' · '));
      const promoted = freeDay && dayOf(row.match_date) === freeDay && dossier;
      const accessLabel = dossier && member && !promoted ? dossiers.copy().member
        : tr(row.locked ? 'dashboard.access.locked' : 'dashboard.access.free');
      const entry = context && watchlist.entry(row, context.market);
      const key = entry && watchlist.key(entry);
      const saved = key && context.watched.some(item => watchlist.key(item) === key);
      const follow = key ? ` <button type="button" class="dashboard-watch-button" data-home-watch="${escapeHTML(key)}" data-conversion="watch-toggle" aria-pressed="${Boolean(saved)}" aria-label="${escapeHTML(tr('dashboard.watch.follow') + ' · ' + row.home + ' – ' + row.away + ' · ' + marketLabel(entry.market,tr))}">${escapeHTML(tr('dashboard.watch.' + (saved ? 'saved' : 'follow')))}</button>` : '';
      const result = entry && context.past ? renderMarketResult(entry, context.feed, context.history, tr) : '';
      const market = context?.market || '1x2';
      const marketCell = market !== '1x2' && !row.dossierOnly ? `<td class="dashboard-prob dashboard-market-cell" role="cell" colspan="3" headers="dashboard-th-market"><span class="dashboard-prob-key">${escapeHTML(tr('dashboard.market.model'))} · </span><strong>${escapeHTML(row.marketProbabilities?.[market] == null ? tr('dashboard.market.noEstimate') : pct(row.marketProbabilities[market]))}</strong>${row.locked ? '' : renderMarketHistory(row,context,tr,loc)}</td>` : '';
      const probabilityCells = marketCell || (row.dossierOnly
        ? `<td class="dashboard-stats-only" role="cell" colspan="3">${escapeHTML(tr('dashboard.table.statsOnly'))}</td>`
        : row.probabilities.map((value,i) =>
          `<td class="dashboard-prob" role="cell" headers="dashboard-th-${i}"><span class="dashboard-prob-key" aria-hidden="true">${['1','X','2'][i]}</span>${escapeHTML(pct(value))}</td>`).join(''));
      return `<tr class="dashboard-match-row" role="row"${readingAttributes}><td class="dashboard-time-cell" role="cell" headers="dashboard-th-time"><time datetime="${escapeHTML(row.match_date)}">${escapeHTML(time)}</time><small class="dashboard-match-league" title="${competition}">${competition}</small></td>` +
        `<td class="dashboard-team" role="cell" headers="dashboard-th-match">${name}${result}</td>` + probabilityCells +
        `<td class="dashboard-access-cell" role="cell" headers="dashboard-th-access"><span class="${row.locked ? 'dashboard-lock' : 'dashboard-free'}">${row.locked ? '🔒 ' : ''}${escapeHTML(accessLabel)}</span>${dossier}${follow}</td></tr>${reading}`;
    }).join('');
  }
  const favoriteKey = row => dayOf(row.match_date) + '/' + row.fixture_id;
  const groupKey = row => JSON.stringify([row.country,row.league]);

  function groupMatchRows(rows) {
    const groups = new Map();
    for (const row of rows) {
      const key = groupKey(row);
      if (!groups.has(key)) groups.set(key,{key,country:row.country,league:row.league,rows:[]});
      groups.get(key).rows.push(row);
    }
    return [...groups.values()];
  }

  const groupedTime = new Intl.DateTimeFormat('en-GB',{timeZone:TIMEZONE,hour:'2-digit',minute:'2-digit',hour12:false});

  function linkedHistoryMatch(entry, row, history) {
    if (!Array.isArray(history?.days)) return null;
    const matches = history.days.filter(day => day?.date === entry.day && Array.isArray(day.matches))
      .flatMap(day => day.matches).filter(match => String(match?.fixture_id) === entry.fixture_id);
    if (matches.length !== 1) return null;
    const [match] = matches;
    if ((match.home_team ?? match.home) !== entry.home || (match.away_team ?? match.away) !== entry.away
      || (match.league && match.league !== entry.league) || (match.country && match.country !== entry.country)) return null;
    const kickoff = match.match_date
      ? Date.parse(match.match_date) === Date.parse(row.match_date)
      : match.time === groupedTime.format(new Date(row.match_date));
    return kickoff ? match : null;
  }

  function groupedOutcome(row, market, context) {
    const entry = watchlist.entry(row,market);
    const unavailable = {ft:null,outcome:'unavailable'};
    if (!entry) return unavailable;
    const canonical = context.feed?.days?.[entry.day]?.results?.[entry.fixture_id];
    if (canonical && Date.parse(canonical.match_date) !== Date.parse(row.match_date)) return unavailable;
    const {ft,ht,outcome} = watchlist.settle(entry,context.feed,context.history);
    const hasEvent = market === '1x2' ? row.probabilities?.some(p => probability(p) !== null)
      : probability(row.marketProbabilities?.[market]) !== null;
    const scheduled = !ft && outcome === 'unavailable' && Date.parse(row.match_date) > +context.now;
    const displayedOutcome = scheduled ? 'scheduled' : hasEvent ? outcome : 'unavailable';
    if (market !== 'ht_over_0_5') return {ft,outcome:displayedOutcome};
    const archived = linkedHistoryMatch(entry,row,context.history);
    // Keep the existing score validation. An archive verdict can stand on its own
    // when the score is unavailable, provided it identifies this exact market.
    const linkedHt = ht && (archived || watchlist.settle(entry,context.feed).ht) ? ht : null;
    const picks = Array.isArray(archived?.picks) ? archived.picks : [];
    const tags = new Set(picks.filter(pick => pick?.market === 'HT Over 0.5'
      && ['WIN','LOSS'].includes(pick.outcome)).map(pick => pick.outcome));
    const archivedOutcome = tags.size === 1 ? (tags.has('WIN') ? 'hit' : 'miss') : null;
    return {...(linkedHt ? {ht:linkedHt} : {}),ft,
      outcome:!linkedHt && archivedOutcome ? archivedOutcome : displayedOutcome};
  }

  function renderGroupedRows(rows, tr, loc, context) {
    const time = new Intl.DateTimeFormat(loc,{timeZone:TIMEZONE,hour:'2-digit',minute:'2-digit',hour12:false});
    const number = new Intl.NumberFormat(loc,{maximumFractionDigits:1});
    const px = v => v == null ? '—' : number.format(v * 100) + '%';
    const market = context.market;
    const language = key => escapeHTML(tr(key));
    const pick = (label,p) => `<span class="match-pick"><span>${language(label)}</span><strong class="match-probability">${px(p)}</strong></span>`;
    return rows.map(row => {
      const fixture = escapeHTML(row.fixture_id);
      const fullName = row.home + ' – ' + row.away;
      const title = escapeHTML(fullName);
      const entry = watchlist.entry(row,market);
      const key = watchlist.key(entry);
      const saved = context.favorites.has(favoriteKey(row));
      const watched = context.watched.some(item => watchlist.key(item) === key);
      const identity = {fixture_id:row.fixture_id,home_team:row.home,away_team:row.away,match_date:row.match_date,locked:row.locked,free:row.free};
      const dossier = !row.locked && context.dossiers?.button(identity,context.publicDossiers?.has(row.fixture_id),{list:true});
      const access = row.free || (context.freeDay && dayOf(row.match_date) === context.freeDay && dossier)
        ? 'matchlist.free' : 'matchlist.basicPro';
      const name = dossier || `<strong class="match-team-label">${title}</strong>`;
      const canShow = !row.locked && !row.dossierOnly;
      const hasMarket = canShow && (market === '1x2' ? row.probabilities.some(p => p !== null)
        : row.marketProbabilities?.[market] != null);
      const choices = !hasMarket ? `<span class="match-missing">${language(row.dossierOnly ? 'dashboard.table.statsOnly' : 'dashboard.market.noEstimate')}</span>`
        : market === '1x2' ? ['marketHome','marketDraw','marketAway'].map((label,i) => pick('matchlist.' + label,row.probabilities[i])).join('')
          : pick(market === 'btts' ? 'matchlist.bttsYes' : 'dashboard.market.' + market,row.marketProbabilities[market]);
      const {ft,ht,outcome} = groupedOutcome(row,market,context);
      const label = {hit:'matchlist.confirmed',miss:'matchlist.missed',scheduled:'matchlist.scheduled',unavailable:'matchlist.unavailable'}[outcome]
        || 'dashboard.market.result.' + outcome;
      const halfScore = market === 'ht_over_0_5' ? `<span class="match-half-score">${ht
        ? escapeHTML(tr('dashboard.market.ht',{score:ht.join('–')})) : language('matchlist.halfUnavailable')}</span>` : '';
      const result = `<div class="match-result-line"><span class="match-outcome" data-outcome="${outcome}">${language(label)}</span>${halfScore}</div>`;
      const addWatch = key && hasMarket ? `<button type="button" class="dashboard-watch-button" data-home-watch="${escapeHTML(key)}" data-conversion="watch-toggle" aria-pressed="${watched}">${language('matchlist.' + (watched ? 'marketFollowed' : 'followMarket'))}</button>` : '';
      const historyId = `${row.fixture_id}|${row.match_date}|${market}`;
      const historyOpen = context.openHistory?.has(historyId) ? ' open' : '';
      const disclosure = addWatch ? `<details class="dashboard-market-details" data-home-team-history="${escapeHTML(historyId)}"${historyOpen}><summary>${language(market === '1x2' ? 'matchlist.marketTracking' : 'dashboard.market.history')}</summary>${
        market === '1x2' ? '' : renderTeamHistory(archiveStat(context.feed,row,market),tr,loc,context.marketHistoryPending)}${addWatch}</details>` : '';
      const score = (name, value, css = '') => `<span class="match-score${css}">${language(name)} <strong>${value.join('–')}</strong></span>`;
      const scores = (ft ? score('matchlist.final',ft) : '') + (canShow && row.estimatedScore
        ? score('matchlist.estimated',row.estimatedScore,' match-score-estimated') : '');
      const favorite = `<button type="button" class="match-favorite" data-match-favorite="${escapeHTML(favoriteKey(row))}" aria-label="${escapeHTML(tr('matchlist.favorite',{match:fullName}))}" aria-pressed="${saved}"><span aria-hidden="true">${saved ? '★' : '☆'}</span></button>`;
      const restricted = access !== 'matchlist.free' && !row.free;
      return `<tr class="dashboard-match-row" role="row" data-match-row="${fixture}"><td class="match-time" role="cell"><time datetime="${escapeHTML(row.match_date)}">${time.format(new Date(row.match_date))}</time></td><td class="match-teams" role="cell">${name}${
        dossier ? '' : `<small class="match-dossier-unavailable">${language(context.past && row.free ? 'matchlist.archiveDossierUnavailable' : 'matchlist.dossierUnavailable')}</small>`}</td><td class="match-selection" role="cell"><div class="match-picks${market === '1x2' && hasMarket ? ' match-picks-1x2' : ''}">${choices}</div>${result}</td><td class="match-scores" role="cell">${scores ? `<div>${scores}</div>` : ''}${disclosure}</td><td class="match-access" role="cell"><span class="match-access-label">${restricted ? '<span aria-hidden="true">🔒</span> ' : ''}${language(access)}</span></td><td class="match-favorite-cell" role="cell">${favorite}</td></tr>`;
    }).join('');
  }

  function renderGroups(groups, tr, loc, context) {
    const number = new Intl.NumberFormat(loc);
    const header = ['dashboard.table.time','dashboard.table.match','dashboard.market.model','matchlist.score','dashboard.table.access','matchlist.favorites']
      .map(label => `<th scope="col" role="columnheader">${escapeHTML(tr(label))}</th>`).join('');
    return groups.map(group => {
      const {key,country,league,rows} = group;
      const nation = countries?.label(country,loc) || country || '—';
      const heading = [nation,league].filter(Boolean).join(' · ');
      const flag = country === 'England' ? '' : countries?.flag(country) || '🌐';
      const count = rows.length === 1 ? tr('matchlist.oneMatch') : tr('matchlist.matchCount',{n:number.format(rows.length)});
      return `<details class="match-competition" data-match-competition="${escapeHTML(key)}"${context.isOpen(key) ? ' open' : ''}><summary>
        <span class="match-flag" data-flag="${escapeHTML(country)}" aria-hidden="true">${flag}</span>
        <span class="match-competition-heading"><span class="match-country">${escapeHTML(nation)}</span><span class="match-competition-name">${escapeHTML(league || '—')}</span></span>
        <span class="match-competition-count">${escapeHTML(count)}</span><span class="match-competition-chevron" aria-hidden="true">⌄</span>
      </summary><table class="match-competition-table" aria-label="${escapeHTML(heading)}" role="table"><colgroup><col><col><col><col><col><col></colgroup><thead role="rowgroup"><tr role="row">${header}</tr></thead><tbody role="rowgroup">${renderGroupedRows(rows,tr,loc,context)}</tbody></table></details>`;
    }).join('');
  }

  function renderChart(points, tr, loc, id, layout = {}) {
    if (!points.length) return `<p class="muted">${escapeHTML(tr('dashboard.data.unavailable'))}</p>`;
    const width = layout.width || 480, height = layout.height || 180, left = 40, top = 14, bottom = 28, right = 12;
    const max = points[points.length - 1].cumulative;
    const firstTime = Date.parse(points[0].date), span = Date.parse(points[points.length - 1].date) - firstTime;
    const x = point => left + (span ? (Date.parse(point.date) - firstTime) / span : 0) * (width - left - right);
    const y = point => height - bottom - point.cumulative / Math.max(max, 1) * (height - top - bottom);
    const line = points.map(p => `${x(p).toFixed(2)},${y(p).toFixed(2)}`).join(' ');
    const num = n => new Intl.NumberFormat(loc, {maximumFractionDigits:0}).format(n);
    const date = d => new Intl.DateTimeFormat(loc, {day:'numeric', month:'short', timeZone:TIMEZONE}).format(new Date(d + 'T12:00:00Z'));
    const partial = points.filter(p => p.partial).map(p => date(p.date)).join(', ');
    const total = tr(layout.free ? 'dashboard.chart.freeTotal' : 'dashboard.chart.total', {n:num(max)});
    const description = `${tr(layout.free ? 'dashboard.chart.freeTitle' : 'dashboard.chart.title')}. ${date(points[0].date)} – ${date(points[points.length - 1].date)}. ${num(max)}. ${partial ? tr('dashboard.chart.partial', {dates:partial}) : ''}`;
    return `<svg class="dashboard-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="${id}"><title id="${id}">${escapeHTML(description)}</title>` +
      `<defs><linearGradient id="${id}-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d7b56d" stop-opacity=".28"/><stop offset="100%" stop-color="#d7b56d" stop-opacity="0"/></linearGradient></defs>` +
      [0, .5, 1].map(r => { const yy = height - bottom - r * (height - top - bottom); return `<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" stroke="currentColor" opacity=".12"/><text x="${left-7}" y="${yy+4}" text-anchor="end" fill="currentColor" font-size="12">${escapeHTML(num(max*r))}</text>`; }).join('') +
      `<polygon points="${left},${height-bottom} ${line} ${x(points[points.length-1])},${height-bottom}" fill="url(#${id}-fill)"/>` +
      `<polyline points="${line}" fill="none" stroke="#d7b56d" stroke-width="2.5" stroke-linejoin="round"/>` +
      points.map(p => `<circle cx="${x(p)}" cy="${y(p)}" r="${p.partial?3:2}" fill="${p.partial?'#101c2c':'#d7b56d'}" stroke="#d7b56d" stroke-width="1.5"><title>${escapeHTML(`${date(p.date)}: ${num(p.cumulative)}${p.partial?' · '+tr('dashboard.chart.partialday'):''}`)}</title></circle>`).join('') +
      `<text x="${left}" y="${height-5}" fill="currentColor" font-size="12">${escapeHTML(date(points[0].date))}</text><text x="${width-right}" y="${height-5}" text-anchor="end" fill="currentColor" font-size="12">${escapeHTML(date(points[points.length-1].date))}</text></svg>` +
      `<p class="dashboard-chart-caption">${escapeHTML(total)} · ${escapeHTML(tr('dashboard.chart.partialday'))}: ○</p>`;
  }
  function openTargetDetails(doc, fragment, scroll = false) {
    let id;
    try { id = decodeURIComponent(String(fragment || '').replace(/^#/,'')); } catch (_) { return null; }
    if (!id) return null;
    const destination = id === 'exemplu-pro' ? doc.getElementById('public-pro-demo') : null;
    const target = destination || doc.getElementById(id);
    if (!target) return null;
    for (let node = target; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
    if (id === 'exemplu-pro' && !destination && target.querySelector) {
      const sample = target.querySelector('details');
      if (sample) sample.open = true;
    }
    if (scroll && target.scrollIntoView) target.scrollIntoView({block:'start'});
    return target;
  }
  function afterBrowserScroll(view, restore) {
    view.requestAnimationFrame(() => view.requestAnimationFrame(restore));
  }
  function mountFragmentHistory(view, readSaved) {
    const history = view.history;
    if (!history?.replaceState) return;
    const entries = new Map();
    const marker = () => history.state?.poseidonHomeEntry;
    const currentEntry = () => {
      const hash = view.location.hash;
      let id = marker();
      if (!id || (entries.has(id) && entries.get(id).hash !== hash)) {
        id = view.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
        try { history.replaceState({...history.state, poseidonHomeEntry:id}, ''); }
        catch (_) { return null; }
      }
      if (!entries.has(id)) entries.set(id, {hash, y:view.scrollY});
      return entries.get(id);
    };
    let active = currentEntry();
    view.addEventListener('scroll', () => {
      if (!history.state?.poseidonDossierReading && active?.hash === view.location.hash) active.y = Math.max(0,view.scrollY);
    }, {passive:true});
    const traverse = () => {
      const stored = entries.get(marker());
      const offset = stored?.hash === view.location.hash ? stored.y : readSaved();
      const entry = currentEntry();
      if (active === entry) return;
      active = entry;
      if (!entry || !Number.isFinite(offset)) return;
      afterBrowserScroll(view, () => {
        if (active === entry && view.location.hash === entry.hash) view.scrollTo(0,offset);
      });
    };
    view.addEventListener('popstate', traverse);
    view.addEventListener('hashchange', traverse);
  }
  function mountAnchorNavigation(doc) {
    const view = doc.defaultView;
    if (!view?.location || !view.addEventListener) return () => {};
    const fragment = view.location.hash;
    const page = () => view.location.pathname + view.location.hash;
    const storageKey = () => 'poseidon.home.scroll:' + (view.history?.state?.poseidonHomeEntry || '');
    const type = view.performance?.getEntriesByType?.('navigation')?.[0]?.type;
    const readSaved = () => {
      try {
        const saved = JSON.parse(view.sessionStorage.getItem(storageKey()));
        if (saved?.page === page() && Number.isFinite(saved.y) && saved.y >= 0) return saved.y;
      } catch (_) { /* Native restoration remains available when storage is blocked. */ }
      return null;
    };
    mountFragmentHistory(view, readSaved);
    const savedY = ['reload','back_forward'].includes(type) ? readSaved() : null;
    const savePosition = () => {
      if (view.history?.state?.poseidonDossierReading) return;
      try {
        view.sessionStorage.setItem(storageKey(), JSON.stringify({page:page(), y:Math.max(0,view.scrollY)}));
      } catch (_) { /* Storage may be unavailable in this browser. */ }
    };
    view.addEventListener('pagehide',savePosition);
    doc.addEventListener?.('click',event => {
      if (event.target.closest?.('[data-dossier-list]')) savePosition();
    },true);
    let moved = false;
    const stopRestoration = () => { moved = true; };
    const inputEvents = ['touchstart', 'wheel', 'pointerdown', 'keydown'];
    const watchInput = fragment || savedY !== null;
    if (watchInput) inputEvents.forEach(name => view.addEventListener(name, stopRestoration, {passive:true}));
    const restore = () => {
      if (!moved && view.location.hash === fragment && savedY !== null) view.scrollTo(0, savedY);
    };
    // WebKit can jump to the fragment while the first layout is still changing.
    // Restore after the browser and again after the asynchronously loaded dashboard.
    view.addEventListener('pageshow', event => {
      if (view.history?.state?.poseidonDossierReading) return;
      if (!event.persisted) {
        if (savedY !== null) afterBrowserScroll(view, restore);
        return;
      }
      const destination = page(), offset = readSaved();
      if (offset !== null) afterBrowserScroll(view, () => {
        if (page() === destination) view.scrollTo(0,offset);
      });
    });
    view.addEventListener('hashchange', () => {
      stopRestoration();
      openTargetDetails(doc, view.location.hash);
    });
    return () => {
      if (watchInput) inputEvents.forEach(name => view.removeEventListener(name, stopRestoration));
      const hash = view.location.hash;
      // A fresh deep link may need to reveal a section populated after initial layout.
      const initialLink = fragment && hash === fragment && !moved && type !== 'reload' && type !== 'back_forward';
      openTargetDetails(doc, hash, Boolean(initialLink));
      if (savedY !== null && !moved) view.requestAnimationFrame(restore);
    };
  }
  function revealMatch(doc, source) {
    openTargetDetails(doc,'#matches');
    const reset = doc.getElementById('filter-reset');
    if (reset) reset.click();
    [['filter-day',dayOf(source.match_date)],['filter-league',source.league],['filter-minprob','0']].forEach(([id,value]) => {
      const select = doc.getElementById(id);
      if (select) {
        const pair = JSON.stringify([source.country || '',source.league]);
        select.value = id === 'filter-league' && Array.from(select.options || []).some(option => option.value === pair) ? pair : value;
        select.dispatchEvent(new Event('change',{bubbles:true}));}
    });
    const fixture = Number(source.fixture_id);
    if (Number.isSafeInteger(fixture)) {
      const heading = doc.querySelector(`#matches .match-report[data-fid="${fixture}"] .match-header[aria-expanded="false"]`);
      if (heading) heading.click();
    }
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
    const nav = doc.querySelector('#home-nav') || doc.querySelector('header nav');
    if (!nav) return null;
    const observer = new Observer(() => {if (decorateLanguageSelector(doc,tr)) observer.disconnect();});
    observer.observe(nav,{childList:true,subtree:true});
    return observer;
  }
  function decorateMemberLogin(doc, tr) {
    const links = doc.querySelectorAll('.members-login');
    links.forEach(link => {
      const concise = tr('approved.nav.account'), full = tr('members.login');
      link.setAttribute('data-i18n','approved.nav.account');
      link.setAttribute('data-i18n-attr','aria-label:members.login,title:members.login');
      link.setAttribute('aria-label',full);
      link.setAttribute('title',full);
      if (link.textContent !== concise) link.textContent = concise;
    });
    return links.length;
  }
  function watchMemberLogin(doc, tr, Observer = typeof MutationObserver === 'function' ? MutationObserver : null) {
    decorateMemberLogin(doc,tr);
    const bar = doc.getElementById('members-bar');
    if (!bar || !Observer) return null;
    const observer = new Observer(() => decorateMemberLogin(doc,tr));
    observer.observe(bar,{childList:true,subtree:true});
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
  function analysisLink(head,action,tr) {
    const day = head.querySelector?.('[data-date]')?.getAttribute('data-date');
    const title = head.textContent.split(' · ')[0].trim();
    const specific = action.href === '#pro-analize' && /^\d{4}-\d{2}-\d{2}$/.test(day) && title;
    const attrs = specific ? ` data-pro-day="${day}" data-pro-match="${escapeHTML(title)}"` : action.sample ? ' data-dashboard-analysis' : '';
    return `<a class="dashboard-analysis-link" href="${escapeHTML(action.href)}"${attrs}>${escapeHTML(tr(action.key))} →</a>`;
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
  function mountNavigation(doc) {
    const menu = doc.querySelector('#home-nav .nav-more');
    if (!menu) return;
    const toggle = menu.querySelector('summary');
    const closeOutside = event => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    };
    doc.addEventListener('click', closeOutside);
    doc.addEventListener('focusin', closeOutside);
    menu.addEventListener('click', event => {
      if (!event.target.closest('a')) return;
      toggle.focus({preventScroll:true});
      menu.open = false;
    });
    menu.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !menu.open) return;
      event.preventDefault();
      toggle.focus({preventScroll:true});
      menu.open = false;
    });
  }
  async function mount(doc) {
    const finishNavigation = mountAnchorNavigation(doc);
    if (!doc.querySelector('[data-dashboard-kpis]')) return;
    mountNavigation(doc);
    if (typeof i18nGata === 'function') await i18nGata();
    watchLanguageSelector(doc,translator());
    watchMemberLogin(doc,translator());
    ensureProofNotice(doc,translator());
    let predictions = null, history = null, audit = null, archive = null, marketHistory = null;
    let marketHistoryPending = true;
    const view = doc.defaultView;
    const marketButtons = [...doc.querySelectorAll('[data-home-market]')];
    const dayButtons = [...doc.querySelectorAll('[data-home-day]')];
    const watchEntries = doc.getElementById('dashboard-watch-entries');
    const watchCount = doc.getElementById('dashboard-watch-count');
    const watchStatus = doc.getElementById('dashboard-watch-status');
    let market = '1x2', storage = null, watchError = false;
    try { storage = view?.localStorage; } catch (_) { /* A blocked browser store is reported when saving. */ }
    let watched = watchlist.read(storage);
    const shown = new Map();
    const dateSelect = doc.getElementById('dashboard-date');
    const leagues = doc.getElementById('dashboard-leagues');
    const leagueMenu = doc.getElementById('dashboard-league-menu');
    const search = doc.getElementById('dashboard-search');
    const clearSearch = doc.getElementById('dashboard-search-clear');
    const table = doc.getElementById('dashboard-predictions');
    const status = doc.getElementById('dashboard-table-status');
    const dossiers = doc.defaultView?.PoseidonDossier;
    const grouped = table?.tagName === 'DIV';
    const matchFavoritesStorage = 'poseidon:grouped-favorites:v1';
    const matchViewStorage = 'poseidon:grouped-list-view:v1';
    function readStored(area,key) {
      try { return JSON.parse(view?.[area]?.getItem(key) || 'null'); }
      catch (_) { return null; }
    }
    function readFavorites() {
      const keys = readStored('localStorage',matchFavoritesStorage);
      return new Set(Array.isArray(keys) ? keys.filter(key => /^\d{4}-\d{2}-\d{2}\/\d+$/.test(key)) : []);
    }
    let favorites = grouped ? readFavorites() : new Set(), onlyFavorites = false, favoriteError = false;
    let visibleGroups = [], openByDay = new Map(), filteredClosed = new Set();
    let preferredDate = '';
    if (grouped) {
      const previous = readStored('sessionStorage',matchViewStorage);
      if (previous?.day && watchlist.shiftDay(previous.day,0)) preferredDate = previous.day;
      if (watchlist.markets.includes(previous?.market)) market = previous.market;
      if (search && typeof previous?.query === 'string') search.value = previous.query;
      onlyFavorites = previous?.onlyFavorites === true;
      if (Array.isArray(previous?.filteredClosed)) filteredClosed = new Set(previous.filteredClosed);
      if (Array.isArray(previous?.openGroups)) openByDay = new Map(previous.openGroups.filter(pair => Array.isArray(pair)
        && typeof pair[0] === 'string' && Array.isArray(pair[1])).map(([day,groups])=>[day,new Set(groups)]));
      if (/^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(view?.location?.hostname || '')) {
        const marker = doc.querySelector('[data-match-preview]');
        if (marker) marker.hidden = false;
      }
    }
    function saveGroupedView() {
      if (!grouped || !dateSelect) return;
      try {
        view.sessionStorage.setItem(matchViewStorage,JSON.stringify({day:dateSelect.value,query:search?.value || '',
          market,onlyFavorites,filteredClosed:[...filteredClosed],openGroups:[...openByDay].map(([day,groups])=>[day,[...groups]])}));
      } catch (_) { /* The list remains usable without storage. */ }
    }
    const groupFilterActive = () => onlyFavorites || Boolean(normalizeSearch(search?.value));
    const unfilteredOpen = () => openByDay.get(dateSelect?.value) ?? new Set(visibleGroups.slice(0,2).map(group=>group.key));
    function setGroupOpenness(key, open) {
      if (groupFilterActive()) {
        if (open) filteredClosed.delete(key);
        else filteredClosed.add(key);
      } else {
        const expanded = unfilteredOpen();
        if (open) expanded.add(key);
        else expanded.delete(key);
        openByDay.set(dateSelect.value,expanded);
      }
    }
    let selectedLeague = '';
    let competitions = [];
    async function localJSON(path) {
      const response = await fetch(path, {credentials:'omit'});
      if (!response.ok) throw new Error(`Public export unavailable: ${path}`);
      return response.json();
    }
    const required = Promise.allSettled([localJSON('data/predictions.json'), localJSON('data/history.json'), localJSON('data/audit.json')]);
    const supplemental = localJSON('data/dashboard-market-history.json').catch(() => null);
    [predictions, history, audit] = (await required).map(result => result.status === 'fulfilled' ? result.value : null);
    view?.PoseidonVisitor?.setPublicData(predictions,history);
    function renderMetrics() {
      const tr = translator(), loc = locale(doc), num = n => n == null ? '—' : new Intl.NumberFormat(loc).format(n);
      const auditGrid = doc.getElementById('approved-audit-metrics');
      if (auditGrid) {
        const period = doc.getElementById('approved-audit-period');
        const dates = [audit?.de_la, audit?.pana_la].map(day => new Date(day + 'T12:00:00Z'));
        const format = new Intl.DateTimeFormat(loc, {day:'numeric', month:'long', year:'numeric', timeZone:TIMEZONE});
        period.textContent = dates.every(date => Number.isFinite(+date))
          ? tr('approved.audit.period', {period: format.formatRange(...dates)}) : '';
        if (Array.isArray(audit?.piete) && count(audit.n_rezolvate)) {
          const cards = [[num(audit.n_rezolvate), tr('approved.audit.ft', {ht:num(audit.eligibility?.ht_included)})]];
          for (const key of ['over_1_5','over_2_5','btts']) {
            const market = audit.piete.find(item => item.cheie === key);
            const value = finite(market?.bss)
              ? new Intl.NumberFormat(loc,{minimumFractionDigits:1,maximumFractionDigits:1,signDisplay:'exceptZero'}).format(market.bss) + '%' : '—';
            cards.push([value, `BSS · ${tr('audit.piata.' + key)} · N = ${num(market?.n)}`]);
          }
          auditGrid.innerHTML = cards.map(([value,label]) => `<div><strong>${escapeHTML(value)}</strong><span>${escapeHTML(label)}</span></div>`).join('');
        } else auditGrid.textContent = tr('dashboard.data.unavailable');
      }
      try {
        const metrics = extractMetrics(audit, history);
        const labels = ['dashboard.kpi.resolved','dashboard.kpi.hit','dashboard.kpi.brier','dashboard.kpi.markets'];
        const values = [num(metrics.resolved), metrics.hit == null ? '—' : `${num(metrics.hit)}%`, metrics.brier == null ? '—' : new Intl.NumberFormat(loc,{minimumFractionDigits:3,maximumFractionDigits:3}).format(metrics.brier), num(metrics.auditedMarkets)];
        const notes = [`${metrics.from} – ${metrics.to}`, `Over 1.5 · ≥75% · N=${num(metrics.n)} · Wlo 95%=${num(metrics.wlo)}%`, `Over 1.5 · N=${num(metrics.brierN)} · ${tr('dashboard.kpi.lower')}`, tr('dashboard.kpi.audit')];
        const icons = ['M5 3h14v18H5zM8 7h8M8 11h8M8 15h5','M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10M12 10v4M10 12h4','M4 4v16h16M7 15l4-5 4 2 5-7','M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'];
        const sources = ['data/audit.json','data/history.json','data/audit.json','data/audit.json'];
        const context = `<details class="dashboard-kpi-context dashboard-source-context"><summary>${escapeHTML(tr('dashboard.sources.title'))}</summary><ul>` + labels.map((label,i) => `<li><strong>${escapeHTML(tr(label))}:</strong> ${escapeHTML(notes[i])} · <a href="${sources[i]}">${sources[i]}</a></li>`).join('') + `</ul><p>${escapeHTML(tr('dashboard.track.context', {date:metrics.generated}))}</p></details>`;
        const markup = labels.map((label,i) => `<div class="dashboard-kpi"><span class="dashboard-kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[i]}"/></svg></span><strong class="dashboard-kpi-value">${escapeHTML(values[i])}</strong><span class="dashboard-kpi-label">${escapeHTML(tr(label))}</span></div>`).join('') + context;
        doc.querySelectorAll('[data-dashboard-kpis]').forEach(el => {el.innerHTML = markup;});
        const summary = doc.getElementById('dashboard-track-summary');
        if (summary) summary.innerHTML = `<div class="dashboard-summary-cards">` + [['Over 1.5 · N',num(metrics.n)],['Wlo 95%',metrics.wlo == null ? '—' : `${num(metrics.wlo)}%`],['Brier · N',num(metrics.brierN)]].map(([label,value]) => `<div class="dashboard-market-summary"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join('') + `</div><p>${escapeHTML(tr('dashboard.track.context', {date:metrics.generated}))}</p>`;
      } catch (_) {
        doc.querySelectorAll('[data-dashboard-kpis]').forEach(el => {el.textContent = tr('dashboard.data.unavailable');});
      }
      renderCharts();
    }
    function renderCharts() {
      const tr = translator(), loc = locale(doc);
      let points = [];
      try { points = cumulativeResolved(history); } catch (_) { /* Unavailable stays explicit. */ }
      const waiting = !points.length && marketHistoryPending;
      let free = false;
      if (!points.length && !waiting) {
        points = cumulativeVerifiedFreeMatches(marketHistory);
        free = points.length > 0;
      }
      const copyKeys = free ? {title:'freeTitle',note:'freeNote'} : {title:'title',note:'note'};
      doc.querySelectorAll('[data-journal-chart-copy]').forEach(el => {
        const key = 'dashboard.chart.' + copyKeys[el.getAttribute('data-journal-chart-copy')];
        el.setAttribute('data-i18n',key);
        el.textContent = tr(key);
      });
      const viewport = doc.defaultView;
      const height = viewport && finite(viewport.innerWidth) && viewport.innerWidth <= 1180 ? 160 : 95;
      doc.querySelectorAll('[data-dashboard-chart]').forEach((el,i) => {
        const width = finite(el.clientWidth) && el.clientWidth > 0 ? el.clientWidth : i ? 340 : 560;
        el.innerHTML = waiting ? `<p class="muted">${escapeHTML(tr('loading'))}</p>`
          : renderChart(points,tr,loc,`dashboard-chart-${i}`,{width,height,free});
      });
    }
    function memberForDay(day) {
      const guestDay = dossiers?.guestPredictionDay?.();
      return guestDay && day !== guestDay ? null : dossiers?.predictions();
    }
    function dashboardPredictions() {
      const day = dateSelect?.value;
      const member = memberForDay(day);
      const current = member?.matches ?? predictions?.matches?.filter(isPublic);
      const archived = day < dayOf(new Date()) ? publicArchive(marketHistory, day) : [];
      if (current == null && !archived.length) return null;
      const matches = [...(current || [])];
      const identities = new Set(matches.map(item => dayOf(item.match_date) + ':' + item.fixture_id));
      for (const item of archived) {
        if (!identities.has(day + ':' + item.fixture_id)) matches.push(item);
      }
      if (!member || !day) return {...predictions, matches};
      const forecastIds = new Set(matches.filter(m => dayOf(m.match_date) === day && memberForecast(m)).map(m => String(m.fixture_id)));
      const dossierOnly = dossiers.catalog(day).filter(m => !forecastIds.has(String(m.fixture_id)));
      const dossierIds = new Set(dossierOnly.map(m => String(m.fixture_id)));
      return {...member, matches: [...matches.filter(m => dayOf(m.match_date) !== day || !dossierIds.has(String(m.fixture_id))), ...dossierOnly]};
    }
    function relativeDays() {
      const today = dayOf(new Date());
      return {today, yesterday:watchlist.shiftDay(today, -1)};
    }
    function renderQuickFilters() {
      const day = dateSelect?.value;
      const relative = relativeDays();
      for (const button of dayButtons) button.setAttribute('aria-pressed', String(day === relative[button.dataset.homeDay]));
      for (const button of marketButtons) button.setAttribute('aria-pressed', String(market === button.dataset.homeMarket));
      for (let i = 0; i < 3; i++) {
        const heading = doc.getElementById('dashboard-th-' + i);
        if (heading) heading.hidden = market !== '1x2';
      }
      const heading = doc.getElementById('dashboard-th-market');
      if (heading) heading.hidden = market === '1x2';
    }
    function renderWatchlist() {
      if (!watchEntries) return;
      const tr = translator(), loc = locale(doc);
      if (watchCount) watchCount.textContent = '(' + new Intl.NumberFormat(loc).format(watched.length) + ')';
      if (watchStatus) watchStatus.textContent = watchError ? tr('dashboard.watch.error') : watched.length ? '' : tr('dashboard.watch.empty');
      watchEntries.innerHTML = watched.map(item => `<li><div><strong>${escapeHTML(item.home)} – ${escapeHTML(item.away)}</strong><small>${escapeHTML([formatDay(item.day,loc),countries?.label(item.country,loc) || item.country,item.league,marketLabel(item.market,tr)].filter(Boolean).join(' · '))}</small>${renderMarketResult(item,marketHistory,history,tr)}</div><button type="button" data-home-unwatch="${escapeHTML(watchlist.key(item))}">${escapeHTML(tr('dashboard.watch.remove'))}</button></li>`).join('');
    }
    function renderLeagues() {
      if (!leagues && !leagueMenu) return;
      const day = dateSelect && dateSelect.value;
      const data = dashboardPredictions();
      competitions = competitionChoices((data?.matches || []).filter(m => dayOf(m.match_date) === day), locale(doc));
      if (!competitions.some(option => option.value === selectedLeague)) selectedLeague = '';
      const all = {value:'', label:translator()('dashboard.leagues.all')};
      if (leagues) leagues.innerHTML = [all,...competitions.slice(0,6)].map(({value,label}) => `<button type="button" data-dashboard-league="${escapeHTML(value)}" aria-pressed="${value===selectedLeague}">${escapeHTML(label)}</button>`).join('');
      if (leagueMenu) {
        leagueMenu.innerHTML = [all,...competitions].map(({value,label}) => `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`).join('');
        leagueMenu.value = selectedLeague;
        leagueMenu.disabled = !competitions.length;
      }
    }
    function renderTable() {
      if (!table) return;
      const tr = translator();
      renderQuickFilters();
      const focusedKey = doc.activeElement?.dataset?.homeWatch;
      const focusedFavorite = doc.activeElement?.dataset?.matchFavorite;
      const focusedDossier = doc.activeElement?.dataset?.dossierList ? doc.activeElement.dataset.dossierFixture : null;
      const focusedHistory = doc.activeElement?.tagName === 'SUMMARY'
        ? doc.activeElement.parentElement?.dataset?.homeTeamHistory : null;
      const openHistory = new Set(Array.from(table.querySelectorAll?.('details[data-home-team-history][open]') || [],
        details => details.dataset.homeTeamHistory));
      shown.clear();
      try {
        const query = search ? search.value : '';
        const member = !!memberForDay(dateSelect?.value);
        if (member && dateSelect?.value) dossiers.loadCatalog(dateSelect.value);
        const data = dashboardPredictions();
        const competition = competitions.find(option => option.value === selectedLeague);
        const freeDay = doc.defaultView?.PoseidonMembers?.webFreeDay?.();
        const limit = member && (grouped || (freeDay && dateSelect?.value === freeDay)) ? Infinity : 5;
        const selection = selectRows(data,dateSelect ? dateSelect.value : '',competition?.league,limit,query,member,competition?.country);
        const rows = grouped && onlyFavorites ? selection.rows.filter(row => favorites.has(favoriteKey(row))) : selection.rows;
        const publicDossiers = member ? null : dossiers?.publicFixtureIds?.(data);
        if (search) search.disabled = false;
        if (clearSearch) clearSearch.disabled = !normalizeSearch(query);
        for (const row of rows) {
          const entry = watchlist.entry(row, market);
          if (entry && !row.locked) shown.set(watchlist.key(entry), entry);
        }
        const past = dateSelect?.value < relativeDays().today;
        const empty = past && marketHistoryPending ? 'loading' : normalizeSearch(query) ? 'simplify.search.empty'
          : grouped && onlyFavorites ? 'matchlist.noFavorites' : past ? 'dashboard.market.noArchive' : 'dashboard.table.empty';
        const context = {market,past,watched,feed:marketHistory,history,marketHistoryPending,openHistory};
        if (grouped) {
          for (const note of doc.querySelectorAll('[data-match-free-context]')) note.hidden = member;
          visibleGroups = groupMatchRows(rows);
          const expanded = unfilteredOpen();
          table.innerHTML = rows.length ? renderGroups(visibleGroups,tr,locale(doc),{...context,dossiers,publicDossiers,freeDay,
            favorites,now:new Date(),isOpen:key=>groupFilterActive() ? !filteredClosed.has(key) : expanded.has(key)})
            : `<p class="match-empty">${escapeHTML(tr(empty))}</p>`;
          const favoriteButton = doc.querySelector('[data-match-favorites]');
          favoriteButton?.setAttribute('aria-pressed',String(onlyFavorites));
          const count = doc.querySelector('[data-match-favorite-count]');
          if (count) count.textContent = favorites.size ? '(' + favorites.size + ')' : '';
          for (const button of doc.querySelectorAll('[data-match-expand], [data-match-collapse]')) button.disabled = !rows.length;
          if (focusedDossier) table.querySelector('[data-dossier-fixture="' + focusedDossier + '"]')?.focus({preventScroll:true});
          if (focusedFavorite) ([...table.querySelectorAll('[data-match-favorite]')]
            .find(button => button.dataset.matchFavorite === focusedFavorite) || favoriteButton)?.focus({preventScroll:true});
          if (status) status.textContent = favoriteError ? tr('matchlist.favoriteStore')
            : [
              rows.length === 1 ? tr('matchlist.oneMatch') : tr('matchlist.matchCount',{n:rows.length}),
              visibleGroups.length === 1 ? tr('matchlist.oneCompetition') : tr('matchlist.competitionCount',{n:visibleGroups.length})
            ].join(' · ');
          saveGroupedView();
        } else {
          table.innerHTML = rows.length ? renderRows(rows,tr,locale(doc),dossiers,member,publicDossiers,freeDay,context)
            : `<tr><td colspan="6">${escapeHTML(tr(empty))}</td></tr>`;
        }
        if (focusedKey) [...table.querySelectorAll('[data-home-watch]')].find(button => button.dataset.homeWatch === focusedKey)?.focus();
        if (focusedHistory) [...table.querySelectorAll('details[data-home-team-history]')]
          .find(details => details.dataset.homeTeamHistory === focusedHistory)?.querySelector('summary')?.focus();
        if (status && !grouped) status.textContent = (member
          ? tr('match.count', {shown:selection.rows.length,total:selection.total})
          : tr('dashboard.table.count', {shown:selection.rows.length,total:selection.total,free:selection.free})) + ' · ' + tr('dashboard.table.timezone') + (member ? '' : ' · ' + tr('dashboard.table.rawnote'));
      } catch (_) {
        if (search) search.disabled = true;
        if (clearSearch) clearSearch.disabled = true;
        table.innerHTML = grouped ? `<p class="match-empty">${escapeHTML(tr('dashboard.data.unavailable'))}</p>`
          : `<tr><td colspan="6">${escapeHTML(tr('dashboard.data.unavailable'))}</td></tr>`;
        if (status) status.textContent = tr('dashboard.table.error');
      }
    }
    function renderDates() {
      if (!dateSelect) return;
      const {today,yesterday} = relativeDays();
      const guestDay = dossiers?.guestPredictionDay?.();
      const data = dossiers?.predictions() || predictions;
      const available = Array.isArray(data?.matches) ? availableDays(data) : [];
      const archived = grouped ? Object.keys(marketHistory?.days || {}).filter(day => watchlist.shiftDay(day,0)) : [];
      const resume = grouped && preferredDate && preferredDate >= watchlist.shiftDay(today,-6) && preferredDate < today ? [preferredDate] : [];
      const days = [...new Set([today,yesterday,...(guestDay ? [guestDay] : available),...archived,...resume,
        ...(dossiers?.predictions() && !guestDay ? dossiers.recentDays() : [])])].sort();
      const previous = dateSelect.value || preferredDate;
      const format = grouped ? new Intl.DateTimeFormat(locale(doc),{day:'numeric',month:'short',timeZone:TIMEZONE}) : null;
      dateSelect.innerHTML = days.map(day => {
        const label = format ? format.format(new Date(day+'T12:00:00Z')) : formatDay(day,locale(doc));
        const relative = day === today ? 'today' : day === yesterday ? 'yesterday' : '';
        return `<option value="${day}">${escapeHTML(label + (format && relative ? ' · ' + translator()('dashboard.market.' + relative) : ''))}</option>`;
      }).join('');
      dateSelect.value = days.includes(previous) ? previous : today;
      dateSelect.disabled = !days.length;
    }
    function renderAnalyses() {
      const target = doc.getElementById('dashboard-analyses');
      const tr = translator(), lang = doc.documentElement.lang;
      const sampleCountry = doc.querySelector('#exemplu-pro-source [data-sample-country]');
      if (sampleCountry && countries) {
        sampleCountry.textContent = countries.label(sampleCountry.getAttribute('data-sample-country'), lang);
      }
      const source = doc.querySelector('#exemplu-pro-source [data-sample-fixture]');
      doc.querySelectorAll('[data-dashboard-pro-summary]').forEach(element => {
        dossiers?.mountPublicSample?.(element,source,lang,predictions,history);
      });

      if (doc.defaultView && doc.defaultView.PoseidonProReport) doc.defaultView.PoseidonProReport.scan();
      if (!target) return;
      const action = analysisAction(membershipTier(doc.body));
      const cards = [];
      const head = doc.querySelector('#exemplu-pro-source .pro-card-head');
      if (head) {
        const title = head.textContent.split(' · ')[0].trim();
        const metadata = head.textContent.slice(title.length).replace(/^\s*·\s*/, '').trim();
        cards.push(`<article class="dashboard-analysis-card"><span class="dashboard-illustration dashboard-analysis-illustration">${escapeHTML(tr('dashboard.illustration'))}</span><span class="dashboard-analysis-meta">${escapeHTML(tr('dashboard.analysis.sample'))}</span><h3 class="dashboard-analysis-title">${escapeHTML(title)}</h3><p class="dashboard-analysis-meta">${escapeHTML(metadata)}</p>${analysisLink(head,action,tr)}</article>`);
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
    function render() {decorateLanguageSelector(doc,translator());decorateMemberLogin(doc,translator());ensureProofNotice(doc,translator());renderDates();renderLeagues();renderTable();renderWatchlist();renderMetrics();renderAnalyses();}
    if (dateSelect) dateSelect.addEventListener('change', () => {selectedLeague='';filteredClosed.clear();renderLeagues();renderTable();});
    const renderSearch = () => {filteredClosed.clear();renderTable();};
    if (search) search.addEventListener('input',renderSearch);
    if (clearSearch) clearSearch.addEventListener('click',() => {if (search) {search.value='';renderSearch();search.focus && search.focus();}});
    if (leagueMenu) leagueMenu.addEventListener('change',() => {selectedLeague=leagueMenu.value;renderLeagues();renderTable();});
    if (leagues) leagues.addEventListener('click', event => {
      const button = event.target.closest('[data-dashboard-league]');
      if (!button) return;
      selectedLeague = button.getAttribute('data-dashboard-league');renderLeagues();renderTable();
    });
    function saveFollow(entry) {
      const next = watchlist.toggle(watchlist.read(storage), entry);
      watchError = !watchlist.write(storage, next);
      if (!watchError) watched = next;
      renderWatchlist();
      renderTable();
      if (watchError) doc.getElementById('dashboard-watchlist').open = true;
    }
    doc.addEventListener('click', event => {
      if (grouped) {
        const favorite = event.target.closest('[data-match-favorite]');
        if (favorite) {
          const key = favorite.dataset.matchFavorite;
          const next = readFavorites();
          if (next.has(key)) next.delete(key);
          else next.add(key);
          try {
            storage.setItem(matchFavoritesStorage,JSON.stringify([...next]));
            favorites = next;
            favoriteError = false;
          } catch (_) { favoriteError = true; }
          renderTable();
        }
        if (event.target.closest('[data-match-favorites]')) {
          onlyFavorites = !onlyFavorites;
          filteredClosed.clear();
          renderTable();
        }
        const bulk = event.target.closest('[data-match-expand], [data-match-collapse]');
        if (bulk) {
          const open = bulk.hasAttribute('data-match-expand');
          for (const group of table.querySelectorAll('.match-competition')) {
            setGroupOpenness(group.dataset.matchCompetition,open);
            group.open = open;
          }
          saveGroupedView();
        }
        const summary = event.target.closest('.match-competition > summary');
        if (summary) {
          const group = summary.parentElement;
          setGroupOpenness(group.dataset.matchCompetition,!group.open);
          saveGroupedView();
        }
      }
      const marketButton = event.target.closest('[data-home-market]');
      if (marketButton && watchlist.markets.includes(marketButton.dataset.homeMarket)) {
        market = marketButton.dataset.homeMarket;
        renderTable();
      }
      const dayButton = event.target.closest('[data-home-day]');
      if (dayButton && dateSelect) {
        renderDates();
        dateSelect.value = relativeDays()[dayButton.dataset.homeDay];
        selectedLeague = '';
        renderLeagues();
        renderTable();
      }
      const watch = event.target.closest('[data-home-watch]');
      if (watch && shown.has(watch.dataset.homeWatch)) {
        const key = watch.dataset.homeWatch;
        saveFollow(shown.get(key));
        [...table.querySelectorAll('[data-home-watch]')].find(button => button.dataset.homeWatch === key)?.focus();
      }
      const unwatch = event.target.closest('[data-home-unwatch]');
      if (unwatch) {
        const entry = watched.find(item => watchlist.key(item) === unwatch.dataset.homeUnwatch);
        if (entry) {
          saveFollow(entry);
          doc.querySelector('#dashboard-watchlist summary')?.focus();
        }
      }
      const fragment = event.target.closest('a[href^="#"]');
      const href = fragment?.getAttribute('href');
      const target = href ? openTargetDetails(doc,href) : null;
      if (href === '#exemplu-pro' && target?.id === 'public-pro-demo' && !event.defaultPrevented
          && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        if (view.location.hash === '#public-pro-demo') target.scrollIntoView({block:'start'});
        else view.location.hash = '#public-pro-demo';
      }
      const match = event.target.closest('[data-dashboard-fixture]');
      if (match && dashboardPredictions()) {
        const source = dashboardPredictions().matches.find(m => String(m.fixture_id) === match.getAttribute('data-dashboard-fixture'));
        if (source) {
          revealMatch(doc, source);
        }
      }
      const sample = event.target.closest('[data-dashboard-analysis]');
      if (sample && target?.id !== 'public-pro-demo') openTargetDetails(doc,'#exemplu-pro');
    });
    doc.addEventListener('change', event => {if(event.target.matches('.lang-select')) setTimeout(render,0);});
    if (view && view.addEventListener) {
      view.addEventListener('resize',renderCharts);
      view.addEventListener('storage', event => {
        if (event.storageArea !== storage) return;
        watched = watchlist.read(storage);
        if (grouped) favorites = readFavorites();
        renderWatchlist();
        renderTable();
      });
    }
    const evidence = doc.getElementById('dashboard-evidence-details');
    if (evidence) evidence.addEventListener('toggle',() => {if (evidence.open) renderCharts();});
    observeMembership(doc.body, renderAnalyses);
    if (dossiers) view.addEventListener('poseidon:member-predictions', () => {renderDates();renderLeagues();renderTable();});
    if (dossiers) view.addEventListener('poseidon:dossier-catalog', () => {renderLeagues();renderTable();});
    render();
    void supplemental.then(data => {
      marketHistoryPending = false;
      marketHistory = data;
      if (grouped) renderDates();
      if (dateSelect?.value < relativeDays().today) renderLeagues();
      renderTable();
      renderWatchlist();
      renderCharts();
    });
    try {
      const response = await fetch('analize/index.html',{credentials:'omit'});
      if (response.ok) archive = new DOMParser().parseFromString(await response.text(),'text/html');
    } catch (_) { /* Current real sample remains available if the archive cannot load. */ }
    renderAnalyses();
    try { await view?.PoseidonHomeLayoutReady; } catch (_) { /* Still open reachable page sections. */ }
    finishNavigation();
  }
  return {escapeHTML,dayOf,availableDays,chooseDay,isPublic,normalizeSearch,leagueChoices,competitionChoices,selectRows,publicArchive,archiveStat,renderMarketResult,groupedOutcome,groupMatchRows,renderGroupedRows,extractMetrics,cumulativeResolved,cumulativeVerifiedFreeMatches,renderRows,renderChart,openTargetDetails,revealMatch,chooseAnalysisLanguage,analysisLanguageNotice,decorateLanguageSelector,watchLanguageSelector,decorateMemberLogin,watchMemberLogin,ensureProofNotice,analysisAction,membershipTier,observeMembership,mount};
});
