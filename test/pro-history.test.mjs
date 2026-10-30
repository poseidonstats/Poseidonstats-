// 30 oct 2026: actual Pro renderer, isolated DOM/network boundary, no member credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

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
  const elements = new Map(), requests = [], warnings = [];
  function node(id) {
    let html = '';
    const n = { value: '', listeners: {}, setAttribute() {}, addEventListener(type, fn) { this.listeners[type] = fn; },
      querySelector(selector) { return elements.get(selector.replace(/^#/, '')) || null; },
      get innerHTML() { return html; }, set innerHTML(value) {
        html = value;
        if (id === 'pro-analize') {
          elements.delete('pro-date'); elements.delete('pro-content');
          for (const match of value.matchAll(/<(?:input|div)\b[^>]*\bid="(pro-date|pro-content)"[^>]*>/g)) {
            const child = node(match[1]);
            child.value = match[0].match(/\bvalue="([^"]*)"/)?.[1] || '';
            child.max = match[0].match(/\bmax="([^"]*)"/)?.[1] || '';
            elements.set(match[1], child);
          }
        }
      } };
    return n;
  }
  elements.set('pro-analize', node('pro-analize'));
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return new Date(now).getTime(); } }
  const context = createContext({ LANG: language, I18N: dictionary, Date: Clock, Intl,
    document: { getElementById: id => elements.get(id) || null, querySelector: () => null },
    window: { PoseidonMembers: { MEMBERS_API: 'https://members.invalid', tier: () => context.memberTier } }, memberTier: tier,
    localStorage: { getItem: key => key === 'poseidon_members_token' ? 'TEST-TOKEN' : null },
    fetch: async (url, options) => { requests.push({ url, options }); return fetchImpl(url, options); },
    i18nGata: async () => {}, console: { warn: (...args) => warnings.push(args) }
  });
  runInContext([
    actual('const ziRO =', '/* ============== i18n'),
    actual('function t(key) {', 'function applyI18n()'),
    actual('function tt(key, fallbackRo) {', 'function honestEmptyHtml('),
    actual('function esc(s) {', '/* ============== TRACK RECORD'),
    source.slice(source.indexOf('/* 28 sept 2026 — membrii Pro'))
  ].join('\n'), context);
  return { context, requests, warnings, element: id => elements.get(id),
    render: date => { context.selected = date; return runInContext('renderProAnalize(selected)', context); },
    body: () => elements.get('pro-content')?.innerHTML || elements.get('pro-analize').innerHTML,
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
  assert(h.body().includes('2026-10-29'));
  assert.match(h.element('pro-analize').innerHTML, /data-date="2026-10-29"/);
});

test('historical 404 replaces old analysis and never promises it will arrive after 07:45', async () => {
  const h = harness({ fetchImpl: async url => url.endsWith('2026-10-29') ? reply({}, 404) : reply(payload('2026-10-30', 'STALE-TODAY')) });
  await h.render(); assert(h.body().includes('STALE-TODAY'));
  await h.render('2026-10-29');
  assert(!h.body().includes('STALE-TODAY'));
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
    assert(!h.body().includes('PRIVATE-OLD'));
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
  assert(h.body().includes('YESTERDAY')); assert(!h.body().includes('WRONG-TODAY'));
  const old = deferred(), current = deferred(); let n = 0;
  const lang = harness({ fetchImpl: () => ++n === 1 ? old.promise : current.promise });
  const ro = lang.render('2026-10-29'); await new Promise(r => setImmediate(r)); lang.context.LANG = 'en'; const en = lang.render();
  current.resolve(reply(payload('2026-10-29', 'CURRENT'))); await en;
  old.resolve(reply(payload('2026-10-29', 'OUTDATED'))); await ro;
  assert(lang.body().includes('CURRENT:en')); assert(!lang.body().includes('OUTDATED'));
  assert.equal(lang.requests.at(-1).url, 'https://members.invalid/api/analize/2026-10-29');
});

test('all six languages translate calendar/title/date and render the matching analysis variant safely', async () => {
  for (const language of languages) {
    const h = harness({ language, fetchImpl: async () => reply(payload('2026-10-29', '<script>unsafe</script>')) });
    await h.render('2026-10-29');
    const html = h.element('pro-analize').innerHTML;
    assert(dictionary[language]['pro.analize.h2']); assert(dictionary[language]['pro.zi.gol']); assert(dictionary[language]['pro.zi.lipsa']);
    assert(html.includes(dictionary[language]['pro.analize.h2'])); assert(html.includes(dictionary[language]['filters.day']));
    const locale = { ro: 'ro-RO', en: 'en-GB', es: 'es-ES', it: 'it-IT', fr: 'fr-FR', id: 'id-ID' }[language];
    assert(html.includes(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date('2026-10-29T12:00:00Z'))));
    assert(h.body().includes('&lt;script>unsafe&lt;/script>'));
    if (language !== 'ro') assert(h.body().includes(':' + language));
    assert(!h.body().includes('<script>'));
  }
});

test('network and malformed payload errors replace previous cards, and invalid/future dates never become request paths', async () => {
  for (const response of [() => Promise.reject(new Error('explicit offline fixture')), () => reply({ items: 'bad' })]) {
    const h = harness({ fetchImpl: async url => url.endsWith('2026-10-29') ? response() : reply(payload('2026-10-30', 'OLD-CARD')) });
    await h.render(); await h.render('2026-10-29');
    assert(!h.body().includes('OLD-CARD')); assert(h.body().includes(dictionary.ro['pro.azi.retea']));
  }
  const h = harness(); await h.render();
  for (const date of ['2026-10-31', '2026-02-30', '2026-10-29/../../api/predictions', '']) {
    await h.render(date);
    assert.equal(h.requests.at(-1).url, 'https://members.invalid/api/analize/2026-10-30');
  }
});
