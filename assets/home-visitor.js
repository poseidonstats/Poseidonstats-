/* Compact homepage for visitors. The existing member and complete views stay in this document. */
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

  function compactRoute(location, account = 'guest', webFree = false) {
    const params = new URLSearchParams(location.search);
    return !webFree && account === 'guest' && params.get('view') !== 'full' && !params.has('members')
      && !params.has('members_token') && (!location.hash || location.hash === '#visitor-plans');
  }

  function selectFreeMatches(data, today) {
    if (!Array.isArray(data?.matches) || !validDay(today)) return [];
    const eligible = data.matches.filter(row => row?.free === true && row.locked !== true && day(row.match_date) === today
      && Number.isSafeInteger(row.fixture_id) && row.fixture_id > 0 && typeof row.home_team === 'string' && row.home_team.trim()
      && typeof row.away_team === 'string' && row.away_team.trim() && markets.every(key => probability(row[key])));
    eligible.sort((a,b) => Date.parse(a.match_date) - Date.parse(b.match_date) || a.fixture_id - b.fixture_id);
    return [...new Map(eligible.map(row => [row.fixture_id,row])).values()].slice(0,5);
  }

  function selectSample(payload, today) {
    const item = payload?.item, match = item?.match, kickoff = Date.parse(match?.match_date);
    if (!validDay(today) || payload?.date !== today || day(match?.match_date) !== today
      || Date.parse(item?.provenance?.original_kickoff_utc) !== kickoff
      || !Number.isSafeInteger(match?.fixture_id) || match.fixture_id < 1
      || ![match.home, match.away, match.league].every(value => typeof value === 'string' && value.trim())) return null;
    return match;
  }

  if (!view) return {compactRoute, selectFreeMatches, selectSample};
  const doc = view.document, html = doc.documentElement;
  html.classList.add('visitor-no-sample');
  html.classList.toggle('visitor-compact',compactRoute(view.location));
  let predictions, history, dataReady = false, liveDay = '', revision = 0;
  let currentSample = null;
  const tr = (key, vars = {}) => Object.entries(vars).reduce((text,[name,value]) => text.replace(`{${name}}`, value),view.t(key));
  const locale = () => ({ro:'ro-RO',en:'en-GB',es:'es-ES',it:'it-IT',fr:'fr-FR',id:'id-ID'})[html.lang] || 'ro-RO';
  const clock = value => new Intl.DateTimeFormat(locale(),{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(Date.parse(value));
  const text = (tag, content, className) => {
    const el = doc.createElement(tag);
    el.textContent = content;
    if (className) el.className = className;
    return el;
  };

  function syncView() {
    const member = view.PoseidonMembers;
    const state = doc.getElementById('members-bar')?.dataset.accountState;
    const account = member?.tier?.() || state || 'guest';
    html.classList.toggle('visitor-compact',compactRoute(view.location,account,Boolean(member?.webFreeDay?.())));
  }

  function syncLinks() {
    for (const link of doc.querySelectorAll('[data-visitor-language]')) {
      const url = new URL(link.href,view.location.href);
      url.searchParams.set('lang',html.lang || 'ro');
      link.href = url;
    }
  }

  function renderMatches() {
    const list = doc.querySelector('[data-visitor-matches]');
    if (!list) return;
    const today = siteDay.format(Date.now());
    const dateEl = doc.querySelector('[data-visitor-today]');
    dateEl.dateTime = today;
    dateEl.textContent = today.split('-').reverse().join('.');
    if (!dataReady) return;
    const rows = selectFreeMatches(predictions,today), status = doc.querySelector('[data-visitor-status]');
    const title = doc.querySelector('[data-visitor-free-title]');
    const titleKey = rows.length > 1 ? 'visitor.home.free' : rows.length ? 'visitor.home.freeOne' : 'visitor.home.freeTitle';
    title.dataset.i18n = titleKey;
    title.dataset.i18nVars = JSON.stringify({n:rows.length});
    title.textContent = tr(titleKey,{n:rows.length});
    const statusKey = predictions ? 'visitor.home.empty' : 'dashboard.data.unavailable';
    status.dataset.i18n = statusKey;
    status.textContent = tr(statusKey);
    status.hidden = rows.length > 0;
    const fmt = new Intl.NumberFormat(locale(),{style:'percent',maximumFractionDigits:0});
    const dossier = view.PoseidonDossier;
    const publicDossiers = dossier?.publicFixtureIds(predictions);
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
      li.append(time,name,probs);
      return li;
    }));
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
    const today = siteDay.format(Date.now()), run = ++revision;
    const keepCard = currentSample && day(currentSample.match_date) === today;
    if (!keepCard) {
      card.hidden = true;
      hideLegacySample(true);
    }
    try {
      const available = selectSample(await dossier.samplePayload(today),today);
      if (run !== revision || siteDay.format(Date.now()) !== today) return;
      if (!available) throw new Error('Public analysis is unavailable');
      const marker = doc.querySelector('#exemplu-pro [data-sample-fixture]');
      hideLegacySample(marker?.dataset.sampleDay !== today || Number(marker.dataset.sampleFixture) !== available.fixture_id);
      const action = card.querySelector('[data-visitor-sample-action]');
      const selection = await dossier.mountPublicSample(card.querySelector('[data-visitor-sample-reader]'),
        {dataset:{sampleFixture:available.fixture_id,sampleDay:today}}, html.lang, predictions, history, action);
      if (run !== revision || siteDay.format(Date.now()) !== today) return;
      if (!selection?.market) throw new Error('Public selection is unavailable');
      card.querySelector('[data-visitor-sample-title]').textContent = `${available.home} – ${available.away}`;
      card.querySelector('[data-visitor-sample-meta]').textContent = `${available.league} · ${today} · ${clock(available.match_date)}`;
      card.querySelector('[data-visitor-sample-pick]').textContent = selection.market;
      currentSample = available;
      card.hidden = false;
    } catch (_) {
      if (run !== revision) return;
      card.hidden = true;
      currentSample = null;
      hideLegacySample(true);
    }
  }

  function syncDay() {
    const today = siteDay.format(Date.now());
    if (liveDay === today) return;
    liveDay = today;
    renderMatches();
    void renderSample();
  }

  function mount() {
    const memberBar = doc.getElementById('members-bar');
    if (memberBar) new MutationObserver(syncView).observe(memberBar,{attributes:true,attributeFilter:['data-account-state']});
    new MutationObserver(syncView).observe(doc.body,{attributes:true,attributeFilter:['class']});
    for (const event of ['hashchange','popstate','storage','pageshow']) view.addEventListener(event,syncView);
    doc.addEventListener('change',event => {
      if (!event.target.matches('.lang-select')) return;
      view.setTimeout(() => {syncLinks();renderMatches();void renderSample();},0);
    });
    syncView();
    Promise.resolve(view.i18nGata?.()).then(() => {syncLinks();syncDay();});
    doc.addEventListener('visibilitychange',() => {if (!doc.hidden) syncDay();});
    view.setInterval(syncDay,60000);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded',mount);
  else mount();
  return {compactRoute, selectFreeMatches, selectSample, setPublicData(data, journal) {
    predictions = data;
    history = journal;
    dataReady = true;
    view.PoseidonDossier?.setPublicPredictions(data);
    renderMatches();
  }};
});
