// 30 oct 2026: actual Pro renderer, isolated DOM/network boundary, no member credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';

const dashboard = createRequire(import.meta.url)('../assets/home-dashboard.js');
const source = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const dictionary = JSON.parse(readFileSync(new URL('../assets/i18n.json', import.meta.url), 'utf8'));
const languages = ['ro', 'en', 'es', 'it', 'fr', 'id'];
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const payload = (date, text = 'Analysis body') => ({ date, items: [{ match: { home: 'Home', away: 'Away', league: 'League' }, analysis: text,
  ...Object.fromEntries(languages.filter(l => l !== 'ro').map(l => ['analysis_' + l, text + ':' + l])) }] });
const reply = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });

function actual(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, start);
  return source.slice(first, last);
}
function harness({ language = 'ro', tier = 'pro', now = '2026-10-30T04:00:00Z', fetchImpl = async () => reply(payload('2026-10-30')) } = {}) {
  // The real renderer owns markup, request URL/headers and event registration.
  // The small DOM boundary records HTML and exposes actual input change handlers.
  const controlIds = ['pro-date', 'pro-content', 'pro-match-choice', 'pro-match-search', 'pro-match-name', 'pro-match-clear', 'pro-match-status', 'pro-match-results', 'pro-active-report'];
  const elements = new Map(), requests = [], dossierOpens = [], warnings = [], documentEvents = {};
  let documentFocus;
  function node(id) {
    let html = '', children = [];
    const n = { value: '', attributes: {}, dataset: {}, listeners: {}, focus() { documentFocus = this; }, setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; }, addEventListener(type, fn) { this.listeners[type] = fn; },
      get children() { return children; }, replaceChildren(...nodes) { children = nodes; }, append(...nodes) { children.push(...nodes); },
      querySelector(selector) { return elements.get(selector.replace(/^#/, '')) || null; },
      get innerHTML() { return html; }, set innerHTML(value) {
        html = value;
        if (id === 'pro-analize') {
          for (const child of controlIds) elements.delete(child);
        }
        if (['pro-analize','pro-content','pro-match-choice'].includes(id)) {
          for (const match of value.matchAll(/<(?:input|div|span|button|p|ul)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
            if (!controlIds.includes(match[1])) continue;
            const child = node(match[1]);
            child.value = match[0].match(/\bvalue="([^"]*)"/)?.[1] || '';
            child.hidden = /\shidden(?=[\s>])/.test(match[0]);
            child.max = match[0].match(/\bmax="([^"]*)"/)?.[1] || '';
            elements.set(match[1], child);
          }
        }
      } };
    return n;
  }
  elements.set('pro-analize', node('pro-analize'));
  elements.set('home-nav-analyses', { href: 'analize/index.html' });
  elements.set('home-nav-analyses-archive', { hidden: true });
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return new Date(now).getTime(); } }
  const context = createContext({ LANG: language, I18N: dictionary, Date: Clock, Intl,
    document: { getElementById: id => elements.get(id) || null, querySelector: () => null, createElement: node,
      addEventListener: (type,handler) => { documentEvents[type] = handler; } },
    window: { PoseidonDashboard: dashboard, PoseidonMembers: { MEMBERS_API: 'https://members.invalid', tier: () => context.memberTier },
      PoseidonDossier: { copy: lang => ({ viewEditorial: 'VIEW-PRO-' + lang }), openPro: (trigger,item,day) => {
        dossierOpens.push({ trigger,item,day }); return true;
      } } }, memberTier: tier,
    localStorage: { getItem: key => key === 'poseidon_members_token' ? 'TEST-TOKEN' : null },
    fetch: async (url, options) => { requests.push({ url, options }); return fetchImpl(url, options); },
    URLSearchParams, i18nGata: async () => {}, console: { warn: (...args) => warnings.push(args) }
  });
  runInContext([
    actual('const ziRO =', '/* ============== i18n'),
    actual('function t(key) {', 'function applyI18n()'),
    actual('function tt(key, fallbackRo) {', 'function honestEmptyHtml('),
    actual('function esc(s) {', '/* ============== TRACK RECORD'),
    source.slice(source.indexOf('/* Shared presentation for public sample'))
  ].join('\n'), context);
  function open() {
    const button = elements.get('pro-active-report')?.children[0];
    if (!button) return null;
    const before = dossierOpens.length;
    button.listeners.click();
    return dossierOpens.length > before ? dossierOpens.at(-1) : null;
  }
  return { context, requests, dossierOpens, warnings, focused: () => documentFocus,
    search: query => { const input = elements.get('pro-match-search'); assert(input, 'visible team search'); input.value = query; input.listeners.input(); },
    results: () => elements.get('pro-match-results')?.children.map(row => row.children[0]) || [],
    element: id => elements.get(id), open, documentEvents,
    selectedText: () => { const selection = open(); return selection && runInContext('proAnalysisText',context)(selection.item,context.LANG); },
    render: date => { context.selected = date; return runInContext('renderProAnalize(selected)', context); },
    body: () => [elements.get('pro-match-choice')?.innerHTML, elements.get('pro-content')?.innerHTML || elements.get('pro-analize').innerHTML,
      ...(elements.get('pro-active-report')?.children || []).map(child => child.html || child.textContent)].join(''),
    change: async date => { const input = elements.get('pro-date'); assert(input, 'native date control is visible'); input.value = date; return input.listeners.change({ target: input }); } };
}

test('default Pro date follows Bucharest day; native calendar retrieves yesterday with the existing authenticated route', async () => {
  const h = harness({ now: '2026-10-29T23:30:00Z', fetchImpl: async url => reply(payload(url.slice(-10), url.slice(-10))) });
  await h.render();
  assert.equal(h.requests[0].url, 'https://members.invalid/api/analize/2026-10-30');
  assert.equal(h.requests[0].options.headers.authorization, 'Bearer TEST-TOKEN');
  assert.equal(h.requests[0].options.cache, 'no-store');
  assert.equal(h.element('pro-date')?.value, '2026-10-30');
  assert.equal(h.element('pro-date')?.max, '2026-10-30');
  await h.change('2026-10-29');
  assert.equal(h.requests.at(-1).url, 'https://members.invalid/api/analize/2026-10-29');
  assert.equal(h.element('pro-date').value, '2026-10-29');
  assert.equal(h.open().day,'2026-10-29');
  assert.match(h.element('pro-analize').innerHTML, /id="pro-date" type="date" value="2026-10-29"/);
  assert.doesNotMatch(h.element('pro-analize').innerHTML, /data-date="2026-10-29"/);
});

test('visible Pro date follows the site language while the native input keeps its ISO value', async () => {
  const h = harness({ language: 'fr' });
  await h.render();
  assert.match(h.element('pro-analize').innerHTML, /<span class="pro-date-label" aria-hidden="true">30 oct\. 2026<\/span>/);
  h.context.LANG = 'en';
  await h.change('2026-10-29');
  assert.match(h.element('pro-analize').innerHTML, /<span class="pro-date-label" aria-hidden="true">29 Oct 2026<\/span>/);
  assert.equal(h.element('pro-date').value, '2026-10-29');
  assert.equal(h.element('pro-date').max, '2026-10-30');
});

test('historical 404 replaces old analysis and never promises it will arrive after 07:45', async () => {
  const h = harness({ fetchImpl: async url => url.endsWith('2026-10-29') ? reply({}, 404) : reply(payload('2026-10-30', 'STALE-TODAY')) });
  await h.render(); assert.equal(h.open().item.analysis,'STALE-TODAY');
  await h.render('2026-10-29');
  assert.equal(h.open(),null);
  assert(!h.body().includes('07:45'));
  assert(h.body().includes(dictionary.ro['pro.zi.lipsa'].replace('{cod}', '404')));
});

test('today early 404 retains the existing morning status, while empty historical days show an explicit translated empty state', async () => {
  const h = harness({ fetchImpl: async () => reply({}, 404) }); await h.render();
  assert(h.body().includes(dictionary.ro['pro.azi.devreme']));
  const empty = harness({ fetchImpl: async () => reply({ date: '2026-10-29', items: [] }) });
  await empty.render('2026-10-29');
  assert(empty.body().includes(dictionary.ro['pro.zi.gol']));
});

test('basic and logged-out users make no Pro request; 401/403 discard previous Pro contents', async () => {
  for (const tier of ['basic', null]) { const h = harness({ tier }); await h.render('2026-10-29'); assert.equal(h.requests.length, 0); assert.equal(h.body(), ''); }
  for (const status of [401, 403]) {
    const h = harness({ fetchImpl: async url => url.endsWith('2026-10-29') ? reply({}, status) : reply(payload('2026-10-30', 'PRIVATE-OLD')) });
    await h.render(); await h.render('2026-10-29');
    assert.equal(h.open(),null);
    assert(h.body().includes(dictionary.ro['pro.azi.sesiune']));
  }
});

test('slower prior dates and prior language responses cannot overwrite the most recently selected view', async () => {
  const today = deferred(), yesterday = deferred();
  let dateRequest = 0;
  const h = harness({ fetchImpl: () => ++dateRequest === 1 ? today.promise : yesterday.promise });
  const p0 = h.render(); await new Promise(r => setImmediate(r)); const p1 = h.render('2026-10-29');
  yesterday.resolve(reply(payload('2026-10-29', 'YESTERDAY'))); await p1;
  today.resolve(reply(payload('2026-10-30', 'WRONG-TODAY'))); await p0;
  assert.equal(h.open().item.analysis,'YESTERDAY');
  const old = deferred(), current = deferred(); let n = 0;
  const lang = harness({ fetchImpl: () => ++n === 1 ? old.promise : current.promise });
  const ro = lang.render('2026-10-29'); await new Promise(r => setImmediate(r)); lang.context.LANG = 'en'; const en = lang.render();
  current.resolve(reply(payload('2026-10-29', 'CURRENT'))); await en;
  old.resolve(reply(payload('2026-10-29', 'OUTDATED'))); await ro;
  assert.equal(lang.selectedText().text,'CURRENT:en');
  assert.equal(lang.requests.at(-1).url, 'https://members.invalid/api/analize/2026-10-29');
});

test('all six languages translate calendar/title/date and render the matching analysis variant safely', async () => {
  for (const language of languages) {
    const h = harness({ language, fetchImpl: async () => reply(payload('2026-10-29', '<script>unsafe</script>')) });
    await h.render('2026-10-29');
    const html = h.element('pro-analize').innerHTML;
    assert(dictionary[language]['pro.analize.h2']); assert(dictionary[language]['pro.zi.gol']); assert(dictionary[language]['pro.zi.lipsa']);
    assert(html.includes(dictionary[language]['pro.analize.h2'])); assert(html.includes(dictionary[language]['filters.day']));
    assert.match(html, /id="pro-date" type="date" value="2026-10-29"/);
    assert(h.body().includes(dictionary[language]['simplify.search.label']));
    assert(h.body().includes(dictionary[language]['simplify.search.placeholder']));
    assert(h.body().includes(dictionary[language]['simplify.search.clear']));
    h.search('UNMATCHED TEAM');
    assert.equal(h.element('pro-match-status').textContent, dictionary[language]['simplify.search.empty']);
    h.search('Away');
    assert.equal(h.element('pro-match-status').textContent, dictionary[language]['pro.search.one']);
    h.element('pro-match-clear').listeners.click();
    assert.match(h.body(),new RegExp('VIEW-PRO-'+language));
    assert.equal(h.selectedText().lang,language);
    assert(!h.body().includes('<script>'));
  }
});

test('network and malformed payload errors replace previous cards, and invalid/future dates never become request paths', async () => {
  for (const response of [() => Promise.reject(new Error('explicit offline fixture')), () => reply({ items: 'bad' })]) {
    const h = harness({ fetchImpl: async url => url.endsWith('2026-10-29') ? response() : reply(payload('2026-10-30', 'OLD-CARD')) });
    await h.render(); await h.render('2026-10-29');
    assert.equal(h.open(),null); assert(h.body().includes(dictionary.ro['pro.azi.retea']));
  }
  const h = harness(); await h.render();
  for (const date of ['2026-10-31', '2026-02-30', '2026-10-29/../../api/predictions', '']) {
    await h.render(date);
    assert.equal(h.requests.at(-1).url, 'https://members.invalid/api/analize/2026-10-30');
  }
});

test('Pro button and dashboard action open only the selected fixture and preserve selection on translation', async () => {
  const date = '2026-10-30';
  const first = { match: { home: 'Elazığspor', away: 'Menemen Belediyespor', fixture_id: 101 }, analysis: 'FIRST ANALYSIS' };
  const second = { match: { home: 'Hatayspor', away: 'İnegöl Kafkas Gençlik', fixture_id: 102 }, analysis: 'SECOND ANALYSIS' };
  const historic = { match: { home: 'Home & Sons', away: 'Visitors' }, analysis: 'LEGACY ANALYSIS' };
  const h = harness({ fetchImpl: async () => reply({ date, items: [first,second,historic] }) });
  await h.render();
  assert.match(h.body(), /<label[^>]+for="pro-match-search"/);
  assert.doesNotMatch(h.body(), /<select\b/);
  assert.doesNotMatch(h.body(), /FIRST ANALYSIS|SECOND ANALYSIS|LEGACY ANALYSIS/);
  assert.equal(h.dossierOpens.length,0);
  assert.equal(h.element('pro-match-name').textContent,'Elazığspor – Menemen Belediyespor');
  assert.equal(h.open().item,first);

  h.search(' INEGOL   KAFKAS ');
  assert.equal(h.results().length,1);
  assert.equal(h.results()[0].textContent,'Hatayspor – İnegöl Kafkas Gençlik');
  assert.equal(h.open(),null);
  const rezultat = h.results()[0];
  const before = h.dossierOpens.length;
  rezultat.listeners.click();
  assert.equal(h.dossierOpens.length,before + 1);
  assert.equal(h.dossierOpens.at(-1).item,second);
  assert.equal(h.dossierOpens.at(-1).day,date);
  assert.equal(h.dossierOpens.at(-1).trigger,h.element('pro-active-report').children[0]);
  assert.equal(h.element('pro-active-report').hidden,false);
  assert.equal(h.element('pro-match-results').hidden,true);
  rezultat.listeners.click();
  assert.equal(h.dossierOpens.length,before + 1);
  assert.equal(h.element('pro-match-name').textContent,'Hatayspor – İnegöl Kafkas Gençlik');
  const link = { dataset: {}, closest: () => link };
  let prevented = false;
  h.documentEvents.click({target: link, preventDefault: () => { prevented = true; }});
  assert(prevented);
  assert.equal(h.dossierOpens.at(-1).trigger,link);
  assert.equal(h.dossierOpens.at(-1).item,second);

  h.search('HOME & SONS');
  assert.equal(h.results()[0].textContent,'Home & Sons – Visitors');
  h.results()[0].listeners.click();
  assert.equal(h.open().item,historic);
  h.context.LANG = 'fr';
  await h.render();
  assert.equal(h.element('pro-match-search').value,'');
  assert.equal(h.element('pro-match-name').textContent,'Home & Sons – Visitors');
  assert.equal(h.selectedText().lang,'ro');
  assert.equal(h.open().day,date);
  h.context.memberTier = null;
  assert.equal(h.open(),null);
});

test('large Pro day filters either team and blocks the old action until selection or clear', async () => {
  const date = '2026-10-30';
  const items = Array.from({ length: 593 }, (_, i) => ({
    match: { fixture_id: 1000 + i, home: `Home ${i}`, away: `Away ${i}` }, analysis: `Report ${i}`,
  }));
  items.at(-1).match.away = 'Știința Elazığspor';
  const h = harness({ fetchImpl: async () => reply({ date, items }) });
  await h.render();
  assert.equal(h.open().item,items[0]);
  h.search('STIINTA ELAZIGSPOR');
  assert.equal(h.results().length,1);
  assert.equal(h.open(),null);
  const input = h.element('pro-match-search');
  input.listeners.keydown({ key: 'ArrowDown', preventDefault() {} });
  assert.equal(h.focused(),h.results()[0]);
  const before = h.dossierOpens.length;
  input.listeners.keydown({ key: 'Enter', isComposing: true, preventDefault() {} });
  assert.equal(h.dossierOpens.length,before);
  input.listeners.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(h.dossierOpens.length,before + 1);
  assert.equal(h.dossierOpens.at(-1).item,items.at(-1));
  assert.equal(h.dossierOpens.at(-1).trigger,h.element('pro-active-report').children[0]);
  h.search('no matching team');
  assert.equal(h.results().length,0);
  assert.equal(h.element('pro-match-status').textContent,dictionary.ro['simplify.search.empty']);
  assert.equal(h.open(),null);
  h.element('pro-match-clear').listeners.click();
  assert.equal(h.focused(),input);
  assert.equal(h.open().item,items.at(-1));
  h.search('Home 592');
  assert.equal(h.results().length,1);
  assert.equal(h.requests.length,1);
});

test('team deep link initializes the original fixture and changing the day clears a pending filter', async () => {
  const matches = day => ['Home', 'Linked Team'].map((home, i) => ({
    match: { home, away: 'Away', fixture_id: i + 1 }, analysis: day,
  }));
  const h = harness({ fetchImpl: async url => reply({ date: url.slice(-10), items: matches(url.slice(-10)) }) });
  h.context.window.location = { search: '?echipa=Linked+Team' };
  await h.render();
  assert.equal(h.open().item.match.home,'Linked Team');
  h.search('Linked Team');
  const stale = h.results()[0];
  h.search('unmatched team');
  const before = h.dossierOpens.length;
  stale.listeners.click();
  assert.equal(h.dossierOpens.length,before);
  h.search('Linked Team');
  const fromOldDay = h.results()[0];
  await h.change('2026-10-29');
  fromOldDay.listeners.click();
  assert.equal(h.dossierOpens.length,before);
  assert.equal(h.element('pro-match-search').value,'');
  assert.equal(h.open().day,'2026-10-29');
  assert.equal(h.open().item.match.home,'Linked Team');
});

test('sticky analyses link opens the daily feed only for a verified Pro member and preserves access to the archive', async () => {
  const h = harness({ fetchImpl: async url => url.endsWith('2026-10-29') ? reply({}, 403) : reply(payload('2026-10-30')) });
  const nav = h.element('home-nav-analyses');
  const archive = h.element('home-nav-analyses-archive');
  assert.equal(nav.href, 'analize/index.html');
  assert(archive.hidden);
  await h.render();
  assert.equal(nav.href, '#pro-analize');
  assert(!archive.hidden);
  await h.render('2026-10-29');
  assert.equal(nav.href, 'analize/index.html');
  assert(archive.hidden);
  await h.render('2026-10-30');
  h.context.memberTier = null;
  await h.render();
  assert.equal(nav.href, 'analize/index.html');
  assert(archive.hidden);
});
