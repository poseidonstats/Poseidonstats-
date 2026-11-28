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
  const locales = {ro:'ro-RO',en:'en-GB',es:'es-ES',it:'it-IT',fr:'fr-FR',id:'id-ID'};
  // Keep the English home, match-list controls and offer usable while the full dictionary loads.
  const earlyEnglish = {
    'page.title.home':'POSEIDON — Football predictions today, pre-match probabilities and a verifiable track record',
    'visitor.home.freeTitle':'Free matches',
    'visitor.home.free':'{n} free matches',
    'visitor.home.freeOne':'One free match',
    'visitor.home.previousEdition':'Latest published edition. The list updates when the new predictions are published.',
    'visitor.home.empty':'No free predictions have been published for today yet.',
    'visitor.home.lockedTitle':'Subscriber matches',
    'visitor.home.unlockBasic':'Unlock prediction · Basic, US$5/month on Patreon',
    'visitor.home.lockedLess':'Show fewer matches',
    'visitor.home.lockedMore':'Show {n} more',
    'dashboard.table.timezone':'Bucharest time',
    'dashboard.data.unavailable':'Data temporarily unavailable.',
    'dashboard.nav.label':'Main navigation',
    'dashboard.predictions.all':'View all predictions',
    'loading':'Loading...',
    'redesign.edition.badge':'Public sample · Pro',
    'redesign.edition.read':'Read the full analysis',
    'pro.analize.h2':'Your Pro match reports',
    'nav.abonamente':'Membership',
    'approved.nav.menu':'Menu',
    'nav.simulator':'Simulator',
    'nav.trackrecord':'Track record',
    'nav.metodologie':'Methodology',
    'faq.h2':'Frequently asked questions',
    'simplify.activation.login':'Sign in with Patreon',
    'footer.terms':'Terms & Conditions',
    'footer.privacy':'Privacy',
    'istoric.recent':'Recent results',
    'app.download':'Download on the App Store · iPhone',
    'app.store.badge':'assets/app-store/en.svg',
    'app.google.download':'Get it on Google Play · Android',
    'app.google.badge':'assets/google-play/en.svg',
    'banner.legal':'Statistical information only. The model can be wrong. Verify the source. 18+.',
    'redesign.hero.title':"Analyse today's matches with probabilities and verifiable results.",
    'redesign.hero.subtitle':'See 5 complete predictions free each day. Basic gives you access to all predictions, and Pro adds editorial analysis.',
    'redesign.hero.free':'See the 5 free predictions',
    'redesign.hero.pro':'See the Pro example',
    "approved.access.apps":"App access",
    "approved.access.appsText":"App subscriptions are managed separately. The store shows the price and billing period before confirmation.",
    "approved.access.billing":"Monthly billing",
    "approved.access.billingText":"Patreon charges at sign-up and renews monthly. You can cancel in your account. Access continues until the end of the period you paid for.",
    "approved.access.site":"Website access",
    "approved.access.title":"Access and payment",
    "approved.plan.basic.1":"All available predictions",
    "approved.plan.basic.2":"Statistics reports with sample sizes",
    "approved.plan.basic.3":"Home and away comparisons",
    "approved.plan.basic.4":"Goals, halves and corners where data is available",
    "approved.plan.basic.5":"Simulator with member data",
    "approved.plan.free.1":"5 complete predictions per day",
    "approved.plan.free.2":"Eligible free reports",
    "approved.plan.free.3":"Access to public results",
    "approved.plan.pro.1":"Everything in Basic",
    "approved.plan.pro.2":"Editorial analysis for selected matches",
    "approved.plan.pro.3":"Editorial selection and model probability",
    "approved.plan.pro.4":"League frequency for the same market",
    "approved.plan.pro.5":"Pro selection record",
    "approved.plan.pro.6":"Editorial verdict and result verification",
    "approved.plans.scope":"These prices are for the website. App subscriptions are purchased separately.",
    "conversion.basic.body":"All predictions and the simulator. For those who want the numbers.",
    "conversion.basic.cta":"Choose Basic",
    "conversion.details":"Compare all benefits",
    "conversion.free.body":"5 full predictions daily and the entire public track record. No account.",
    "conversion.free.cta":"View free",
    "conversion.free.name":"Free",
    "conversion.note":"Prices in USD · Payment via Patreon · cancel anytime.",
    "conversion.paypal":"Card declined by your bank? On the Patreon page you can also pay with PayPal.",
    "conversion.plans.membertitle":"More context with Pro",
    "conversion.pro.body":"Everything in Basic + written analysis: form, absences, context and pitfalls.",
    "conversion.pro.cta":"Choose Pro",
    "conversion.sample":"Read a complete analysis",
    "conversion.sample.member":"View reviewed analyses",
    "dashboard.access.free":"FREE",
    "dashboard.access.locked":"Members",
    "dashboard.analysis.readarchive":"Read archived analyses",
    "dashboard.leagues.all":"All leagues",
    "dashboard.market.away":"Away team away",
    "dashboard.market.btts":"Both teams to score",
    "dashboard.market.ft":"Full time {score}",
    "dashboard.market.history":"Market history",
    "dashboard.market.home":"Home team at home",
    "dashboard.market.ht":"Half time {score}",
    "dashboard.market.ht_over_0_5":"First-half goal",
    "dashboard.market.label":"Market",
    "dashboard.market.model":"Model estimate",
    "dashboard.market.noArchive":"Archived predictions for this day are unavailable.",
    "dashboard.market.noEstimate":"Estimate unavailable",
    "dashboard.market.noHistory":"History unavailable",
    "dashboard.market.over_2_5":"Over 2.5 goals",
    "dashboard.market.result.away":"Result 2 · Away",
    "dashboard.market.result.draw":"Result X · Draw",
    "dashboard.market.result.hit":"Market hit",
    "dashboard.market.result.home":"Result 1 · Home",
    "dashboard.market.result.miss":"Market missed",
    "dashboard.market.result.unavailable":"Result unconfirmed or unavailable",
    "dashboard.market.sample":"{hits} of {n} matches",
    "dashboard.market.today":"Today",
    "dashboard.market.yesterday":"Yesterday",
    "dashboard.nav.analysis":"Analysis",
    "dashboard.nav.home":"Home",
    "dashboard.table.access":"Access",
    "dashboard.table.count":"{shown} of {total} matches · {free} free",
    "dashboard.table.empty":"No matches for these filters.",
    "dashboard.table.error":"Public data could not load. Reload the page.",
    "dashboard.table.match":"Match",
    "dashboard.table.rawnote":"1/X/2: raw model probabilities, without empirical remapping.",
    "dashboard.table.statsOnly":"Match stats only",
    "dashboard.table.time":"Time",
    "dashboard.watch.empty":"You aren’t following any matches yet.",
    "dashboard.watch.error":"This browser could not save the list.",
    "dashboard.watch.follow":"Follow",
    "dashboard.watch.remove":"Remove",
    "dashboard.watch.saved":"Following",
    "dashboard.watch.scope":"This list is saved in this browser. The result is for the followed market.",
    "dashboard.watch.title":"Followed matches",
    "footer.contact":"Contact:",
    "matchlist.archiveDossierUnavailable":"Dossier unavailable in the archive",
    "matchlist.back":"Back to matches",
    "matchlist.basicOffer":"Basic: all available matches, USD 5/month",
    "matchlist.basicPro":"Basic / Pro",
    "matchlist.bttsShort":"BTTS",
    "matchlist.bttsYes":"BTTS: Yes",
    "matchlist.clearSearch":"Clear search",
    "matchlist.collapse":"Collapse all",
    "matchlist.competitionCount":"{n} competitions",
    "matchlist.competitions":"Competitions",
    "matchlist.confirmed":"Confirmed",
    "matchlist.date":"Match date",
    "matchlist.dossierLoadError":"The dossier could not be loaded.",
    "matchlist.dossierUnavailable":"The match dossier is unavailable.",
    "matchlist.estimated":"Predicted score",
    "matchlist.expand":"Expand all",
    "matchlist.favorite":"Add or remove from favorites: {match}",
    "matchlist.favoriteStore":"This browser could not save your favorites.",
    "matchlist.favorites":"Favorites",
    "matchlist.final":"Final score",
    "matchlist.followMarket":"Follow market",
    "matchlist.followedMarketScope":"Follow a market here to see its outcome. The star saves the match to Favorites. Both lists are saved in this browser.",
    "matchlist.followedMarkets":"Followed markets",
    "matchlist.free":"Free",
    "matchlist.freeDaily":"5 free matches per day",
    "matchlist.halfShort":"1st-half goal",
    "matchlist.halfUnavailable":"Half-time score unavailable",
    "matchlist.listCount":"{shown} matches · {leagues} competitions",
    "matchlist.marketAway":"Away (2)",
    "matchlist.marketDraw":"Draw (X)",
    "matchlist.marketFollowed":"Market followed",
    "matchlist.marketHome":"Home (1)",
    "matchlist.marketTracking":"Market tracking",
    "matchlist.matchCount":"{n} matches",
    "matchlist.missed":"Missed",
    "matchlist.models":"Model probabilities",
    "matchlist.noFavorites":"No favorite matches for this date.",
    "matchlist.noSelection":"Selection unavailable",
    "matchlist.oneCompetition":"1 competition",
    "matchlist.oneMatch":"1 match",
    "matchlist.overShort":"Over 2.5",
    "matchlist.preview":"Test version · Unpublished",
    "matchlist.retryDossier":"Try again",
    "matchlist.scheduled":"Scheduled",
    "matchlist.score":"Score",
    "matchlist.selection":"Selection",
    "matchlist.subtitle":"Predictions and model probabilities",
    "matchlist.title":"Match list",
    "matchlist.unavailable":"Unconfirmed result",
    "nav.istoric":"History",
    "nav.ligi":"By league",
    "nav.predictii":"Predictions",
    "plans.per":"/ month",
    "redesign.nav.results":"Results",
    "simplify.activation.body":"After choosing a subscription, return to the site and sign in with the same Patreon account. Discord is optional.",
    "simplify.search.empty":"No matches for this search.",
    "simplify.search.label":"Search for a team",
    "simplify.search.placeholder":"Team name",
    "tagline":"Probabilities published before kick-off · <strong>verifiable track record</strong> · public dataset",
  };

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

  function validatedExportTime(data) {
    const stamp = data?.generated_at;
    if (typeof stamp !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(stamp)) return NaN;
    const time = Date.parse(stamp);
    const rows = data.matches, free = data.freemium?.free, locked = data.freemium?.locked;
    if (!Number.isFinite(time) || time > Date.now() || !Array.isArray(rows) || !rows.length ||
        data.n_matches !== rows.length || !Number.isInteger(free) || free < 0 || free > 5 ||
        !Number.isInteger(locked) || locked < 0 || free + locked !== rows.length) return NaN;
    if (rows.filter(m => m?.locked === true && m.free !== true).length !== locked ||
        selectFreeMatches(data,siteDay.format(time)).length !== free) return NaN;
    return time;
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
  const tr = (key, vars = {}, fallbackText = key) => {
    const translated = view.t?.(key);
    const fallback = html.lang === 'en' ? englishText(key) : null;
    return Object.entries(vars).reduce((text,[name,value]) => text.replace(`{${name}}`, value),
      translated && translated !== key ? translated : fallback ?? fallbackText);
  };
  const locale = () => locales[html.lang] || locales.ro;
  const formatDate = (value, options) => new Intl.DateTimeFormat(locale(),{timeZone:zone,...options}).format(value);
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
    const access = hasCatalogAccess();
    if (predictions && html.classList.contains('visitor-catalog-access') !== access) renderMatches();
    html.classList.toggle('visitor-catalog-access',access);
  }

  function explicitLanguage() {
    const search = view.location.search;
    const lang = search ? new URLSearchParams(search).get('lang') : null;
    return Object.hasOwn(locales,lang) ? lang : null;
  }

  function syncLinks(lang = explicitLanguage() ?? (html.lang || 'ro'), selector = '[data-visitor-language]') {
    for (const link of doc.querySelectorAll(selector)) {
      const url = new URL(link.href,view.location.href);
      if (url.origin !== view.location.origin) continue;
      url.searchParams.set('lang',lang);
      link.href = url.href;
    }
  }

  function englishText(key) {
    return Object.hasOwn(earlyEnglish,key) ? earlyEnglish[key] : null;
  }

  function bootstrapLanguage() {
    const lang = explicitLanguage();
    const catalog = doc.querySelector('[data-match-catalog]');
    if (!lang || !(catalog || doc.querySelector('[data-compact-home]'))) return;
    syncLinks(lang, catalog
      ? '#home-nav a[href]:not([href^="#"]):not([hreflang]), footer a[href]:not([href^="#"]):not([hreflang])'
      : undefined);
    if (lang !== 'en') return;
    html.lang = lang;
    for (const element of doc.querySelectorAll('[data-i18n]')) {
      const value = englishText(element.getAttribute('data-i18n'));
      if (value?.includes('<')) element.innerHTML = value; // Trusted copy bundled with this release.
      else if (value) element.textContent = value;
    }
    for (const element of doc.querySelectorAll('[data-i18n-attr]')) {
      for (const pair of element.getAttribute('data-i18n-attr').split(',')) {
        const [attr,key] = pair.split(':');
        const value = englishText(key);
        if (value) element.setAttribute(attr,value);
      }
    }
    const title = doc.querySelector('title[data-page-title]');
    const value = englishText(title?.getAttribute('data-page-title'));
    if (value) title.textContent = value;
  }

  let remainingLocked = [];
  const basicMatchKey = 'poseidon.basic.match';

  function rememberBasicMatch(event) {
    const link = event.target.closest?.('a.visitor-unlock');
    if (!link || event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return;
    const edition = day(predictions?.generated_at), fixture = Number(link.dataset.fixture);
    if (edition !== siteDay.format(Date.now()) || !Number.isSafeInteger(fixture) || fixture < 1) return;
    try { view.localStorage.setItem(basicMatchKey,JSON.stringify({edition,fixture})); } catch (_) {}
  }

  // Called after the catalog's access check and first render; only the login callback sets this tab's return target.
  function resumeBasicMatch(memberPredictions) {
    if (view.location.hash !== '#meci-ales') return;
    let selection;
    try {
      const raw = view.sessionStorage.getItem(basicMatchKey);
      view.sessionStorage.removeItem(basicMatchKey);
      view.history.replaceState(view.history.state,'',view.location.pathname + view.location.search);
      selection = JSON.parse(raw);
    } catch (_) { return; }
    if (!selection || selection.edition !== siteDay.format(Date.now()) ||
        !Number.isSafeInteger(selection.fixture) || selection.fixture < 1) return;
    const row = memberPredictions?.matches?.find(match => match.fixture_id === selection.fixture &&
      match.locked !== true && day(match.match_date) === selection.edition);
    if (!row) return;
    view.PoseidonDashboard.revealMatch(doc,row);
    const heading = doc.querySelector(`#matches .match-report[data-fid="${row.fixture_id}"] .match-header`);
    heading?.focus({preventScroll:true});
    heading?.scrollIntoView({block:'center'});
  }

  function lockedRow(row,offerBasic) {
    const li = doc.createElement('li');
    const time = text('time',clock(row.match_date),'visitor-time');
    time.dateTime = row.match_date;
    const name = doc.createElement('div');
    name.className = 'visitor-fixture';
    const teams = `${row.home_team} – ${row.away_team}`;
    name.append(text('small',row.league || ''),text('strong',teams));
    if (offerBasic) {
      const label = tr('visitor.home.unlockBasic',{},'Deblochează predicția · Basic, 5 USD/lună pe Patreon');
      const link = text('a',label,'visitor-unlock');
      link.href = 'https://www.patreon.com/checkout/PoseidonPredictions?rid=28975826';
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label',label + ' · ' + teams);
      link.dataset.conversion = 'plan-outbound';
      link.dataset.conversionSource = 'locked-match';
      link.dataset.conversionTier = 'basic';
      link.dataset.fixture = String(row.fixture_id);
      name.append(link);
    }
    const lock = text('span','🔒','visitor-lock');
    lock.setAttribute('aria-hidden','true');
    li.append(time,name,lock);
    return li;
  }

  function lockedRows(rows,edition) {
    const offerBasic = edition === siteDay.format(Date.now()) && !hasCatalogAccess();
    return rows.map(row => lockedRow(row,offerBasic));
  }

  function updateLockedDisclosure() {
    const more = doc.querySelector('[data-visitor-locked-more]');
    const rest = doc.querySelector('[data-visitor-locked-rest]');
    const toggle = doc.querySelector('[data-visitor-locked-toggle]');
    toggle.textContent = more.open ? tr('visitor.home.lockedLess') : tr('visitor.home.lockedMore',{n:remainingLocked.length});
    if (more.open && rest.childElementCount === 0) rest.replaceChildren(...lockedRows(remainingLocked,more.dataset.day));
    view.PoseidonConversion?.observeLockedOffers?.(doc.querySelector('[data-visitor-locked]'), more.dataset.day);
  }

  function renderLocked(data,edition,earlierDate) {
    const section = doc.querySelector('[data-visitor-locked]');
    if (!section) return;
    const rows = selectLockedMatches(data,edition);
    section.hidden = !rows.length;
    const first = doc.querySelector('[data-visitor-locked-first]');
    first.replaceChildren(...lockedRows(rows.slice(0,3),edition));
    const count = new Intl.NumberFormat(locale()).format(rows.length);
    section.querySelector('[data-visitor-locked-count]').textContent = earlierDate ? `${count} · ${earlierDate}` : count;
    remainingLocked = rows.slice(3);
    const more = doc.querySelector('[data-visitor-locked-more]');
    more.hidden = !remainingLocked.length;
    if (more.dataset.day !== edition || more.hidden) more.open = false;
    more.dataset.day = edition;
    doc.querySelector('[data-visitor-locked-rest]').replaceChildren();
    updateLockedDisclosure();
  }

  function renderMatches() {
    const list = doc.querySelector('[data-visitor-matches]');
    if (!list) return;
    const today = siteDay.format(Date.now());
    const edition = day(predictions?.generated_at);
    const previous = Boolean(edition && edition < today);
    const date = formatDate(edition ? Date.parse(predictions.generated_at) : Date.now(),
      {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    const dateEl = doc.querySelector('[data-visitor-today]');
    dateEl.dateTime = edition || today;
    dateEl.textContent = date;
    renderLocked(predictions,edition,previous ? date : '');
    const rows = selectFreeMatches(predictions,edition), status = doc.querySelector('[data-visitor-status]');
    const title = doc.querySelector('[data-visitor-free-title]');
    const titleKey = rows.length > 1 ? 'visitor.home.free' : rows.length ? 'visitor.home.freeOne' : 'visitor.home.freeTitle';
    title.dataset.i18n = titleKey;
    title.dataset.i18nVars = JSON.stringify({n:rows.length});
    title.textContent = tr(titleKey,{n:rows.length});
    const statusKey = previous ? 'visitor.home.previousEdition' : readyDay !== today ? 'loading'
      : edition ? 'visitor.home.empty' : 'dashboard.data.unavailable';
    status.dataset.i18n = statusKey;
    status.dataset.i18nVars = JSON.stringify({date});
    status.textContent = tr(statusKey,{date});
    status.hidden = !previous && rows.length > 0;
    const fmt = new Intl.NumberFormat(locale(),{style:'percent',maximumFractionDigits:1});
    const dossier = view.PoseidonDossier;
    const publicDossiers = previous ? null : dossier?.publicFixtureIds(predictions);
    list.replaceChildren(...rows.map(row => {
      const li = doc.createElement('li');
      const time = text('time',clock(row.match_date),'visitor-time');
      time.dateTime = row.match_date;
      const name = doc.createElement('div');
      name.className = 'visitor-fixture';
      name.append(text('small',row.league || ''));
      const link = previous ? null : dossier?.button(row,publicDossiers?.has(row.fixture_id),{list:true});
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
        if (predictionRequest !== request || siteDay.format(Date.now()) !== today) return null;
        const generated = validatedExportTime(data);
        if (!Number.isFinite(generated)) throw new Error('Invalid public edition');
        if (predictions && generated <= Date.parse(predictions.generated_at)) return predictions;
        predictions = data;
        view.PoseidonDossier?.setPublicPredictions(data);
        return data;
      } catch (_) {
        // Keep the last published edition on transient errors, identified by its actual date.
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
        {dataset:{sampleFixture:available.fixture_id,sampleDay:today}}, lang, day(predictions?.generated_at) === today ? predictions : null, history, action);
      if (!active()) return;
      if (!selection?.market) throw new Error('Public selection is unavailable');
      card.querySelector('[data-visitor-sample-title]').textContent = `${available.home} – ${available.away}`;
      const date = formatDate(Date.parse(available.match_date),{day:'numeric',month:'short',year:'numeric'});
      card.querySelector('[data-visitor-sample-meta]').textContent = `${available.league} · ${date} · ${clock(available.match_date)}`;
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
    doc.addEventListener('click',rememberBasicMatch);
    doc.addEventListener('auxclick',rememberBasicMatch);
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
  return {compactRoute, selectFreeMatches, selectLockedMatches, selectSample, bootstrapLanguage, englishText, loadPublicPredictions, resumeBasicMatch, setPublicHistory(journal) {
    history = journal;
  }};
});
