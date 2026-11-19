import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const dictionary = JSON.parse(readFileSync(new URL('../assets/i18n.json', import.meta.url), 'utf8'));
function slice(start, end) {
  const first = app.indexOf(start);
  const last = app.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, start);
  return app.slice(first, last);
}
function runtime(document, ...source) {
  const context = vm.createContext({ document, I18N: dictionary, LANG: 'ro', Intl,
    window: { innerWidth: 390, scrollX: 0, scrollY: 0 } });
  vm.runInContext([
    slice('function t(key) {', 'let _i18nGataResolve'),
    slice('function tt(key, fallbackRo) {', 'function honestEmptyHtml('),
    ...source,
  ].join('\n'), context);
  return context;
}

function node(id = '') {
  const attrs = new Map(), handlers = new Map();
  return {
    id, children: [], dataset: {}, isConnected: true, value: '', innerHTML: '', style: {},
    addEventListener(type, fn) { handlers.set(type, fn); },
    dispatch(type, event) { handlers.get(type)?.(event); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    append(...children) { for (const child of children) child.parentElement = this; this.children.push(...children); },
  };
}

test('the generated and manual tickets parse the full input and remove the previous comparison on invalid odds', () => {
  const ids = ['sim-gen-result', 'sim-result', 'sim-gen-odds', 'sim-odds'];
  const nodes = new Map(ids.map(id => [id, node(id)]));
  for (const id of ['sim-gen-odds', 'sim-odds']) nodes.get(id).after = error => nodes.set(error.id, error);
  const context = runtime({ getElementById: id => nodes.get(id), createElement: () => node() },
    slice('const SIM_MARKETS = {', 'async function renderSimulator()'),
    slice('function pctClass(p) {', '/* ============== Cifre vii'),
    slice('function esc(s) {', '/* ============== TRACK RECORD'));
  Object.assign(context, { nUnits: String });
  vm.runInContext(`SIM.free = [
    {fixture_id: 1, home_team: 'A', away_team: 'B', prob_over_1_5: .8},
    {fixture_id: 2, home_team: 'C', away_team: 'D', prob_over_1_5: .75}
  ];
  SIM.sel.set('1', {meci: 'A – B', market: 'over_1_5', prob: .8});
  SIM.sel.set('2', {meci: 'C – D', market: 'over_1_5', prob: .75});`, context);

  for (const [inputId, resultId, update] of [
    ['sim-gen-odds', 'sim-gen-result', context.simGenereaza],
    ['sim-odds', 'sim-result', context.simUpdate],
  ]) {
    const input = nodes.get(inputId), result = nodes.get(resultId);
    for (const value of ['2,5', '2.5', ' 2.50 ', '2']) {
      input.value = value;
      update();
      assert.match(result.innerHTML, value === '2' ? /sim-compare[\s\S]*<strong>2,00</ : /sim-compare[\s\S]*<strong>2,50</,
        `${inputId} accepts ${value}`);
      assert.equal(input.getAttribute('aria-invalid'), null);
    }
    for (const value of ['2abc', '2 5', '2.5,0', '1e2', '1,00', '0.8', 'Infinity', '0x20', '9'.repeat(350)]) {
      input.value = '2.5';
      update();
      input.value = value;
      update();
      assert.doesNotMatch(result.innerHTML, /sim-compare/, `${inputId} rejects ${value}`);
      assert.match(result.innerHTML, /60,0\s*%/);
      assert.equal(input.getAttribute('aria-invalid'), 'true');
      assert.notEqual(nodes.get(`${inputId}-error`).textContent, '');
    }
    input.value = ' ';
    update();
    assert.doesNotMatch(result.innerHTML, /sim-compare/);
    assert.equal(input.getAttribute('aria-invalid'), null);
    assert.equal(nodes.get(`${inputId}-error`).textContent, '');
  }
});

test('rendering History after a language change keeps each market once and preserves the selected market', async () => {
  const nodes = new Map(['filter-market', 'filter-result', 'filter-calibrated-only', 'cumulat-stats', 'days-list']
    .map(id => [id, node(id)]));
  const market = nodes.get('filter-market');
  market.options = [{ value: '', text: 'All' }];
  market.add = option => market.options.push(option);
  market.replaceChildren = (...options) => { market.options = options; market.value = options[0].value; };
  const context = runtime({ getElementById: id => nodes.get(id) },
    slice('function esc(s) {', '/* ============== TRACK RECORD'),
    slice('const SIM_MARKETS = {', 'async function renderSimulator()'),
    slice('let _histData = null;', 'function fmtDayDate('));
  Object.assign(context, { i18nGata: async () => {}, HISTORY_URL: 'history.json',
    Option: class { constructor(text, value) { Object.assign(this, { text, value }); } },
    honestEmptyHtml: () => '',
    fetchJSON: async () => ({ cumulated_markets: [{key:'1x2_home', name:'1 (Home)', tier:'NOISE', n:2, wins:1, losses:1,
      hit_pct:50.5, wlo_pct:12.3, base_rate_pct:49.5, lift_pp:1}], days: [{ date: '2026-11-17', status: 'resolved', totals: { wins: 1, losses: 1, picks: 2 },
      matches: [{ picks: [{ market: 'Over 2.5', outcome: 'WIN' }, { market: '1X', outcome: 'LOSS' }, { market: '1X', outcome: 'WIN' }] }] }] }),
    fmtDayDate: value => value, renderHistMatch: match => match.picks.map(pick => pick.market).join(', '),
  });
  await context.renderIstoric();
  market.value = '1X';
  context.LANG = 'en';
  await context.renderIstoric();
  await context.renderIstoric();
  assert.deepEqual(Array.from(market.options, option => option.value), ['', '1X', 'Over 2.5']);
  assert.equal(market.value, '1X');
  assert.doesNotMatch(nodes.get('days-list').innerHTML, /Over 2\.5/);
  context.LANG = 'fr';
  await context.renderIstoric();
  const summary = nodes.get('cumulat-stats').innerHTML;
  assert.match(summary, /Marché/);
  assert.match(summary, /Victoire à domicile/);
  assert.match(summary, /50,5\s*%/);
  assert.match(summary, /Bruit statistique/);
  assert.doesNotMatch(summary, />NOISE</);
  assert.doesNotMatch(summary, /<th>Piață<\/th>|<th>Bază<\/th>|1 \(Home\)/);
  assert.notEqual(market.options.find(option => option.value === 'Over 2.5').text, 'Over 2.5');
});

test('simulator distinguishes the failed prediction export from a successful empty export', async () => {
  const result = node('sim-gen-result'), matches = node('sim-matches');
  const nodes = new Map([[result.id, result], [matches.id, matches]]);
  const context = runtime({ getElementById: id => nodes.get(id) },
    slice('async function renderSimulator()', '\nasync function renderIndex'));
  Object.assign(context, {i18nGata: async () => {}, showPredictionSource: () => {}, LANG: 'en',
    loadPredictions: async () => ({data:null, sursa:'public'})});
  await context.renderSimulator();
  assert.match(result.innerHTML, /could not be loaded/i);
  context.loadPredictions = async () => ({data:{matches:[]}, sursa:'public'});
  await context.renderSimulator();
  assert.match(result.innerHTML, /no published matches/i);
});

test('Escape closes a visible match explanation and returns focus to its originating button', () => {
  const events = new Map(), tooltip = node('warn-popover');
  const document = { addEventListener: (type, fn) => events.set(type, fn), getElementById: () => tooltip };
  runtime(document, slice('function ensureWarnPopover()', 'function xgBar('));
  const trigger = node();
  trigger.setAttribute('data-tip', 'Explanation');
  trigger.getBoundingClientRect = () => ({ left: 20, width: 22, bottom: 100 });
  trigger.focus = () => { document.activeElement = trigger; };
  events.get('click')({ target: { closest: () => trigger }, preventDefault() {} });
  assert.equal(tooltip.style.display, 'block');
  document.activeElement = node();
  events.get('keydown')?.({ key: 'Escape', preventDefault() {} });
  assert.equal(tooltip.style.display, 'none');
  assert.equal(document.activeElement, trigger);
});

test('the mobile filter toggle translates on first load and after switching languages while filters remain open', () => {
  const filters = node('filters');
  let open = false, button;
  filters.classList = { contains: () => open, toggle: () => (open = !open) };
  filters.parentNode = { insertBefore: inserted => { button = inserted; filters.previousElementSibling = inserted; } };
  const elements = element => (element ? [element, ...element.children.flatMap(elements)] : []);
  const doc = { readyState: 'complete', documentElement: {}, createElement: () => node(), querySelector: () => filters,
    querySelectorAll: selector => selector === '[data-i18n]' ? elements(button).filter(el => el.dataset.i18n) : [] };
  doc.querySelector = selector => selector === 'section.filters' ? filters : null;
  const create = doc.createElement;
  doc.createElement = () => {
    const el = create();
    el.getAttribute = key => key === 'data-i18n' ? el.dataset.i18n : null;
    el.closest = () => null;
    return el;
  };
  const context = runtime(doc, slice('function _pliazaFiltre()', '// 7 oct 2026 — buton plutitor'));
  const label = () => (button.children[0]?.innerHTML || button.textContent).trim();
  context.LANG = 'en';
  context.applyI18n();
  assert.equal(label(), 'Filters');
  button.dispatch('click');
  assert(open);
  context.LANG = 'fr';
  context.applyI18n();
  assert.equal(label(), 'Filtres');
  assert(open);
});

test('simulator uses the market key for translated labels and formats xG and decimals in all six site languages', () => {
  const context = runtime({}, slice('function pctClass(p) {', '/* ============== Cifre vii'),
    slice('const SIM_MARKETS = {', 'async function renderSimulator()'),
    slice('function esc(s) {', '/* ============== TRACK RECORD'));
  Object.assign(context, { matchWhen: () => '12:00', countryLabel: () => 'Translated country' });
  const marketNames = { ro: 'Peste 1,5', en: 'Over 1.5', es: 'Más de 1,5', it: 'Oltre 1,5', fr: 'Plus de 1,5', id: 'Di atas 1,5' };
  context.I18N = Object.fromEntries(Object.entries(dictionary).map(([lang, values]) =>
    [lang, { ...values, 'mk.over_1_5': marketNames[lang] }]));
  for (const [language, decimal, percent] of [
    ['ro', '1,63', '60,0\u00a0%'], ['en', '1.63', '60.0%'], ['es', '1,63', '60,0\u00a0%'],
    ['it', '1,63', '60,0%'], ['fr', '1,63', '60,0\u00a0%'], ['id', '1,63', '60,0%'],
  ]) {
    context.LANG = language;
    const match = { fixture_id: 1, home_team: 'Home', away_team: 'Away', country: 'Test', league: 'League', prob_over_1_5: .8 };
    const generated = context.simBest(match);
    const markup = context.simTicketHtml([generated, { ...generated, meci: 'Other', prob: .75 }], 2.5);
    assert.equal(context.fmtNum(1.63), decimal, language);
    assert.ok(markup.includes(percent), language);
    assert.ok(markup.includes(marketNames[language]), language);
    assert.match(context.simCard(match), /data-key="over_1_5"/);
    assert.ok(context.simCard(match).includes(marketNames[language]), language);
    assert.equal(generated.market, 'over_1_5');
  }
});

test('language changes update an opted-in page title and route the league link without losing its original path prefix', () => {
  const title = { dataset: { pageTitle: 'page.title.fixture' }, textContent: 'Romanian source title' };
  const link = node();
  link.setAttribute('href', '../predictii/index.html#competition');
  const doc = { documentElement: {}, querySelector: selector => selector === 'title[data-page-title]' ? title : null,
    querySelectorAll: selector => selector === 'a[data-i18n="nav.ligi"]' ? [link] : [] };
  const context = runtime(doc);
  context.I18N = { en: { 'page.title.fixture': 'POSEIDON — English title' }, ro: { 'page.title.fixture': 'POSEIDON — Titlu românesc' } };
  context.LANG = 'en';
  context.applyI18n();
  assert.equal(title.textContent, 'POSEIDON — English title');
  assert.equal(link.getAttribute('href'), '../en/predictions/index.html#competition');
  context.LANG = 'ro';
  context.applyI18n();
  assert.equal(title.textContent, 'POSEIDON — Titlu românesc');
  assert.equal(link.getAttribute('href'), '../predictii/index.html#competition');
});
