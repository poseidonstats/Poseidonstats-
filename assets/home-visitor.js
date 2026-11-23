/* Daily public homepage. The full catalog uses the shared public feed from its own page. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PoseidonVisitor = factory(root);
})(typeof window !== 'undefined' ? window : globalThis, function (view) {
  'use strict';
  const zone = 'Europe/Bucharest';
  const siteDay = new Intl.DateTimeFormat('sv-SE', {timeZone:zone});
  const day = value => {
    const time = Date.parse(value);
    return Number.isFinite(time) ? siteDay.format(time) : '';
  };
  const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const markets = ['prob_home','prob_draw','prob_away'];
  const probability = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

  function compactRoute(location) {
    return ['/', '/index', '/index.html'].includes(location.pathname);
  }

  function dailyFixtures(data, today, include) {
    if (!Array.isArray(data?.matches) || !validDay(today)) return [];
    const rows = data.matches.filter(row => row && include(row) && day(row.match_date) === today &&
      Number.isSafeInteger(row.fixture_id) && row.fixture_id > 0 &&
      typeof row.home_team === 'string' && row.home_team.trim() &&
      typeof row.away_team === 'string' && row.away_team.trim());
    rows.sort((a,b) => Date.parse(a.match_date) - Date.parse(b.match_date) || a.fixture_id - b.fixture_id);
    return [...new Map(rows.map(row => [row.fixture_id,row])).values()];
  }

  function selectFreeMatches(data, today) {
    return dailyFixtures(data,today,row => row.free === true && row.locked !== true &&
      markets.every(key => probability(row[key]))).slice(0,5);
  }

  function selectLockedMatches(data, today) {
    return dailyFixtures(data,today,row => row.locked === true && row.free !== true);
  }

  function selectSample(payload, today) {
    const item = payload?.item, match = item?.match, kickoff = Date.parse(match?.match_date);
    if (!validDay(today) || payload?.date !== today || day(match?.match_date) !== today
      || Date.parse(item?.provenance?.original_kickoff_utc) !== kickoff
      || !Number.isSafeInteger(match?.fixture_id) || match.fixture_id < 1
      || ![match.home, match.away, match.league].every(value => typeof value === 'string' && value.trim())) return null;
    return match;
  }

  if (!view) return {compactRoute, selectFreeMatches, selectLockedMatches, selectSample};
  const doc = view.document, html = doc.documentElement;
  html.classList.add('visitor-no-sample');
  html.classList.toggle('visitor-compact',compactRoute(view.location));
  let predictions, history, readyDay = '', liveDay = '', revision = 0;
  let predictionRequest, sampleInFlightDay = '', currentSample = null, sampleLanguage = '';
  const tr = (key, vars = {}) => Object.entries(vars).reduce((text,[name,value]) => text.replace(`{${name}}`, value),view.t(key));
  const locale = () => ({ro:'ro-RO',en:'en-GB',es:'es-ES',it:'it-IT',fr:'fr-FR',id:'id-ID'})[html.lang] || 'ro-RO';
  const clock = value => new Intl.DateTimeFormat(locale(),{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(Date.parse(value));
  const text = (tag, content, className) => {
    const el = doc.createElement(tag);
    el.textContent = content;
    if (className) el.className = className;
    return el;
  };

  function hasCatalogAccess() {
    const member = view.PoseidonMembers;
    return ['basic','pro'].includes(member?.tier?.()) || Boolean(member?.webFreeDay?.());
  }

  function syncView() {
    const link = doc.querySelector('[data-visitor-member-pro]');
    if (link) link.hidden = !(view.PoseidonMembers?.tier?.() === 'pro' || view.PoseidonMembers?.webFreeDay?.());
    html.classList.toggle('visitor-catalog-access',hasCatalogAccess());
  }

  function syncLinks() {
    for (const link of doc.querySelectorAll('[data-visitor-language]')) {
      const url = new URL(link.href,view.location.href);
      url.searchParams.set('lang',html.lang || 'ro');
      link.href = url;
    }
  }

  let remainingLocked = [];

  function lockedRow(row) {
    const li = doc.createElement('li');
    const time = text('time',clock(row.match_date),'visitor-time');
    time.dateTime = row.match_date;
    const name = doc.createElement('div');
    name.className = 'visitor-fixture';
    name.append(text('small',row.league || ''),text('strong',`${row.home_team} – ${row.away_team}`));
    const lock = text('span','🔒','visitor-lock');
    lock.setAttribute('aria-hidden','true');
    li.append(time,name,lock);
    return li;
  }

  function updateLockedDisclosure() {
    const more = doc.querySelector('[data-visitor-locked-more]');
    const rest = doc.querySelector('[data-visitor-locked-rest]');
    const toggle = doc.querySelector('[data-visitor-locked-toggle]');
    toggle.textContent = more.open ? tr('visitor.home.lockedLess') : tr('visitor.home.lockedMore',{n:remainingLocked.length});
    if (more.open && rest.childElementCount === 0) rest.replaceChildren(...remainingLocked.map(lockedRow));
  }

  function renderLocked(data,today) {
    const section = doc.querySelector('[data-visitor-locked]');
    if (!section) return;
    const rows = selectLockedMatches(data,today);
    section.hidden = !rows.length;
    const first = doc.querySelector('[data-visitor-locked-first]');
    first.replaceChildren(...rows.slice(0,3).map(lockedRow));
    section.querySelector('[data-visitor-locked-count]').textContent = new Intl.NumberFormat(locale()).format(rows.length);
    remainingLocked = rows.slice(3);
    const more = doc.querySelector('[data-visitor-locked-more]');
    more.hidden = !remainingLocked.length;
    if (more.dataset.day !== today || more.hidden) more.open = false;
    more.dataset.day = today;
    doc.querySelector('[data-visitor-locked-rest]').replaceChildren();
    updateLockedDisclosure();
  }

  function renderMatches() {
    const list = doc.querySelector('[data-visitor-matches]');
    if (!list) return;
    const today = siteDay.format(Date.now());
    const dateEl = doc.querySelector('[data-visitor-today]');
    dateEl.dateTime = today;
    dateEl.textContent = new Intl.DateTimeFormat(locale(),{
      timeZone:zone, weekday:'long', day:'numeric', month:'long', year:'numeric',
    }).format(Date.now());
    const current = day(predictions?.generated_at) === today ? predictions : null;
    renderLocked(current,today);
    const rows = selectFreeMatches(current,today), status = doc.querySelector('[data-visitor-status]');
    const title = doc.querySelector('[data-visitor-free-title]');
    const titleKey = rows.length > 1 ? 'visitor.home.free' : rows.length ? 'visitor.home.freeOne' : 'visitor.home.freeTitle';
    title.dataset.i18n = titleKey;
    title.dataset.i18nVars = JSON.stringify({n:rows.length});
    title.textContent = tr(titleKey,{n:rows.length});
    const statusKey = readyDay !== today ? 'loading'
      : current ? 'visitor.home.empty' : 'dashboard.data.unavailable';
    status.dataset.i18n = statusKey;
    status.textContent = tr(statusKey);
    status.hidden = rows.length > 0;
    const fmt = new Intl.NumberFormat(locale(),{style:'percent',maximumFractionDigits:1});
    const dossier = view.PoseidonDossier;
    const publicDossiers = dossier?.publicFixtureIds(current);
    list.replaceChildren(...rows.map(row => {
      const li = doc.createElement('li');
      const time = text('time',clock(row.match_date),'visitor-time');
      time.dateTime = row.match_date;
      const name = doc.createElement('div');
      name.className = 'visitor-fixture';
      name.append(text('small',row.league || ''));
      const link = dossier?.button(row,publicDossiers?.has(row.fixture_id),{list:true});
      if (link) name.insertAdjacentHTML('beforeend',link);
      else name.append(text('strong',`${row.home_team} – ${row.away_team}`));
      const probs = doc.createElement('div');
      probs.className = 'visitor-probs';
      markets.forEach((key,index) => {
        const label = text('span',['1 ','X ','2 '][index]);
        label.append(text('b',fmt.format(row[key])));
        probs.append(label);
      });
      name.append(probs);
      li.append(time,name);
      if (link) {
        const arrow = text('span','›','visitor-arrow');
        arrow.setAttribute('aria-hidden','true');
        li.append(arrow);
      }
      return li;
    }));
  }

  function loadPublicPredictions(refresh = false) {
    const today = siteDay.format(Date.now());
    if (predictionRequest?.day === today) return predictionRequest.promise;
    if (!refresh && readyDay === today && day(predictions?.generated_at) === today) return Promise.resolve(predictions);
    const controller = new AbortController();
    const request = {day:today};
    predictionRequest = request;
    const deadline = view.setTimeout(() => controller.abort(),8000);
    request.promise = (async () => {
      try {
        const response = await view.fetch('data/predictions.json',{credentials:'omit',cache:'no-cache',signal:controller.signal});
        if (!response.ok) throw new Error('Public predictions unavailable');
        const data = await response.json();
        if (!Array.isArray(data?.matches)) throw new Error('Missing public predictions');
        if (predictionRequest !== request || siteDay.format(Date.now()) !== today) return null;
        if (day(predictions?.generated_at) === today && day(data.generated_at) !== today) return predictions;
        predictions = data;
        view.PoseidonDossier?.setPublicPredictions(data);
        return data;
      } catch (_) {
        // Keep the last validated response, with the displayed rows restricted to the current day.
        return predictions ?? null;
      } finally {
        view.clearTimeout(deadline);
        if (predictionRequest === request) {
          predictionRequest = null;
          if (siteDay.format(Date.now()) === today) {
            readyDay = today;
            renderMatches();
          }
        }
      }
    })();
    return request.promise;
  }

  function hideLegacySample(unavailable) {
    html.classList.toggle('visitor-no-sample',unavailable);
    for (const id of ['exemplu-pro','exemplu-pro-source']) {
      const section = doc.getElementById(id);
      if (section) section.hidden = unavailable;
    }
  }

  async function renderSample() {
    const card = doc.querySelector('[data-visitor-sample]'), dossier = view.PoseidonDossier;
    if (!card || !dossier) return;
    const today = siteDay.format(Date.now()), run = ++revision, lang = html.lang;
    const active = () => run === revision && lang === html.lang && siteDay.format(Date.now()) === today;
    sampleInFlightDay = today;
    const keepCard = currentSample && day(currentSample.match_date) === today && sampleLanguage === lang;
    if (!keepCard) {
      card.hidden = true;
      hideLegacySample(true);
    }
    try {
      const available = selectSample(await dossier.samplePayload(today),today);
      if (!active()) return;
      if (!available) throw new Error('Public analysis is unavailable');
      const action = card.querySelector('[data-visitor-sample-action]');
      const selection = await dossier.mountPublicSample(card.querySelector('[data-visitor-sample-reader]'),
        {dataset:{sampleFixture:available.fixture_id,sampleDay:today}}, lang, predictions, history, action);
      if (!active()) return;
      if (!selection?.market) throw new Error('Public selection is unavailable');
      card.querySelector('[data-visitor-sample-title]').textContent = `${available.home} – ${available.away}`;
      card.querySelector('[data-visitor-sample-meta]').textContent = `${available.league} · ${clock(available.match_date)}`;
      card.querySelector('[data-visitor-sample-pick]').textContent = selection.market;
      currentSample = available;
      sampleLanguage = lang;
      hideLegacySample(false);
      card.hidden = false;
    } catch (_) {
      if (!active()) return;
      card.hidden = true;
      currentSample = null;
      hideLegacySample(true);
    } finally {
      if (run === revision) sampleInFlightDay = '';
    }
  }

  function syncDay(refresh = false) {
    const today = siteDay.format(Date.now());
    if (liveDay !== today) {
      liveDay = today;
      renderMatches();
    }
    void loadPublicPredictions(refresh);
    if (sampleInFlightDay !== today && day(currentSample?.match_date) !== today) void renderSample();
  }

  function refreshLanguage() {
    syncLinks();
    renderMatches();
    if (liveDay) void renderSample();
  }

  function guardCatalogSample() {
    const marker = doc.querySelector('#exemplu-pro [data-sample-fixture]');
    const today = siteDay.format(Date.now());
    if (!marker || marker.dataset.sampleDay !== today || !view.PoseidonDossier) {
      hideLegacySample(true);
      return;
    }
    view.PoseidonDossier.samplePayload(today).then(payload => {
      const sample = selectSample(payload,siteDay.format(Date.now()));
      hideLegacySample(!sample || sample.fixture_id !== Number(marker.dataset.sampleFixture));
    }).catch(() => hideLegacySample(true));
  }

  function mount() {
    if (!doc.querySelector('[data-compact-home]')) {
      if (doc.querySelector('[data-match-catalog]')) {
        guardCatalogSample();
        view.addEventListener('pageshow',guardCatalogSample);
        view.addEventListener('online',guardCatalogSample);
        doc.addEventListener('visibilitychange',() => {if (!doc.hidden) guardCatalogSample();});
        view.setInterval(() => {if (!doc.hidden) guardCatalogSample();},60000);
      }
      return;
    }
    doc.querySelector('[data-visitor-locked-more]')?.addEventListener('toggle',updateLockedDisclosure);
    const memberBar = doc.getElementById('members-bar');
    if (memberBar) new MutationObserver(syncView).observe(memberBar,{attributes:true,attributeFilter:['data-account-state']});
    for (const event of ['storage','pageshow']) view.addEventListener(event,syncView);
    doc.addEventListener('change',event => {
      if (!event.target.matches('.lang-select')) return;
      refreshLanguage();
    });
    view.addEventListener('poseidon:dictionary-ready',refreshLanguage);
    syncView();
    Promise.resolve(view.i18nGata?.()).then(() => {syncLinks();syncDay();});
    doc.addEventListener('visibilitychange',() => {if (!doc.hidden) syncDay();});
    view.addEventListener('pageshow',() => syncDay());
    view.addEventListener('online',() => syncDay(true));
    view.setInterval(() => {if (!doc.hidden) syncDay();},60000);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded',mount);
  else mount();
  return {compactRoute, selectFreeMatches, selectLockedMatches, selectSample, loadPublicPredictions, setPublicHistory(journal) {
    history = journal;
  }};
});
