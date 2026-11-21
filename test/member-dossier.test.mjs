import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import dashboard from '../assets/home-dashboard.js';

const source = name => readFileSync(new URL('../assets/' + name, import.meta.url), 'utf8');

test('dossier uses only the official analysis for the requested fixture and prefers its site-language translation', () => {
  const app = source('app.js');
  const start = app.indexOf('function proAnalysisForFixture(');
  assert(start >= 0, 'fixture-specific official archive lookup is available');
  const { select, localized } = runInNewContext(app.slice(start, app.indexOf('// 30 oct 2026:', start)) +
    '\n({ select: proAnalysisForFixture, localized: proAnalysisText })');
  const day = '2026-11-18';
  const items = [
    { match:{fixture_id: 12}, analysis:'Another match' },
    { match:{fixture_id: '13'}, analysis:'Text original', analysis_es:'Análisis oficial', analysis_en:'Official English analysis', analysis_fr:' ', editorial_compact:'Unpublished simulation' },
    { match:{fixture_id: 14}, editorial_compact:'Unpublished simulation' },
  ];
  const item = select({date:day,items}, day, 13);
  assert.equal(localized(item, 'es').text, 'Análisis oficial');
  assert.equal(localized(item, 'ro').text, 'Text original');
  assert.equal(localized(item, 'fr').lang, 'en');
  assert.equal(localized(item, 'fr').text, 'Official English analysis');
  assert.equal(localized({ ...item, analysis_en: ' ' }, 'fr').lang, 'ro');
  assert.equal(select({date:day,items}, day, 14), null);
  assert.equal(select({date:day,items}, day, 15), null);
  assert.equal(select({date:'2026-11-17',items}, day, 13), null);
  const paragraphs = {
    ro: 'sezonul curent: 40 din 77',
    en: 'current season: 40 of 77',
    es: 'temporada actual: 40 de 77',
    it: 'stagione in corso: 40 su 77',
    fr: 'saison en cours : 40 sur 77',
    id: 'musim berjalan: 40 dari 77',
  };
  for (const [lang, text] of Object.entries(paragraphs)) {
    const field = lang === 'ro' ? 'analysis' : 'analysis_' + lang;
    const expected = text[0].toUpperCase() + text.slice(1);
    assert.equal(localized({ [field]: '🧮 **Model:** ' + text }, lang).text, '🧮 **Model:** ' + expected);
    assert.equal(localized({ [field]: 'aPI-FOOTBALL, ' + text }, lang).text, expected);
  }
  assert.equal(localized({analysis:'Formă. sezonul curent: 33 din 77.'}, 'ro').text,
    'Formă. Sezonul curent: 33 din 77.');

});

test('stats-only member rows keep their dossier without drawing empty forecast columns', () => {
  const rows=[{
    fixture_id:13, match_date:'2026-11-18T10:00Z', home:'Home', away:'Away',
    country:'Romania', league:'League', locked:false, dossierOnly:true,
    probabilities:[null,null,null],
  }];
  const dossiers={button:()=>'<button>Match dossier</button>', copy:()=>({member:'Member'})};
  const html=dashboard.renderRows(rows,key=>key==='dashboard.table.statsOnly'?'Match stats only':key,'en-GB',dossiers);
  assert.match(html,/colspan="3">Match stats only/);
  assert.match(html,/<button>Match dossier<\/button>/);
  assert.doesNotMatch(html,/dashboard-prob|data-reading-fixture/);
});

test('public buttons are offered only for official free fixtures on the current Bucharest day, in all site languages', () => {
  const doc = { documentElement: { lang: 'ro' }, readyState: 'loading', addEventListener() {} };
  const window = { PoseidonMembers: { tier: () => 'none' } };
  const time = Date.parse('2026-11-18T22:30:00Z');
  const Clock = class extends Date { constructor(...args) { super(...(args.length ? args : [time])); } static now() { return time; } };
  runInNewContext(source('member-dossier.js'), { window, document: doc, Date: Clock });
  const { button, copy, publicFixtureIds } = window.PoseidonDossier;
  const match = { fixture_id: 7, match_date: '2026-11-19T17:00:00Z', home_team: 'Home', away_team: 'Away', free: true };
  const snapshot = { generated_at: '2026-11-18T22:00:00Z', freemium: { free: 1 }, matches: [match] };
  assert(publicFixtureIds(snapshot).has(match.fixture_id));
  assert(!publicFixtureIds({ ...snapshot, generated_at:'2026-11-18T21:59:59Z' }).size);
  assert(!publicFixtureIds({ ...snapshot, freemium: { free: 2 } }).size);
  assert(!publicFixtureIds({ ...snapshot, matches: [match, { ...match, free:false }] }).size);
  assert.equal(button(match), '');
  for (const lang of ['ro','en','es','it','fr','id']) {
    doc.documentElement.lang = lang;
    assert.match(button(match,true), /data-dossier-public="true"/);
    assert(button(match,true).includes(copy(lang).open));
  }
  assert.equal(button({ ...match, locked: true },true), '');
  assert.equal(button({ ...match, free: false },true), '');
  assert.equal(button({ ...match, free: 'true' },true), '');
  assert.equal(button({ ...match, match_date: '2026-11-18T21:59:59Z' },true), '');
  assert.equal(button({ ...match, match_date: '2026-11-19T22:00:00Z' },true), '');
});

test('homepage rows preserve eligibility and identify the free button as public access', () => {
  const date = '2026-11-19T18:00:00Z';
  const data = { matches: [
    { fixture_id: 1, match_date: date, free: true, home_team: 'Home' },
    { fixture_id: 2, match_date: date, locked: true, home_team: 'Other' },
  ] };
  const selection = dashboard.selectRows(data, '2026-11-19');
  const dossiers = { button: (m, offer) => offer && m.free === true && !m.locked ? '<button>Match dossier</button>' : '',
    copy: () => ({ member:'Member' }) };
  const html = dashboard.renderRows(selection.rows, k => k, 'en-GB', dossiers, false, new Set([1]));
  assert.equal((html.match(/<button>Match dossier<\/button>/g) || []).length, 1);
  assert.match(html, /dashboard\.access\.free/);
  assert.doesNotMatch(html, />Member</);
});

test('Pro search stats opens the authenticated fixture route and rejects fixtures outside the verified feed', () => {
  const match = {
    fixture_id: 1575226, match_date: '2026-11-21T14:30:00Z',
    home_team: 'Borussia Monchengladbach', away_team: 'Borussia Dortmund',
  };
  const makeNode = () => ({ setAttribute() {}, replaceChildren() {}, focus() {}, addEventListener() {} });
  const title = makeNode(), close = makeNode(), body = makeNode();
  const nativeDialog = {
    classList: { remove() {} },
    querySelector(selector) {
      return { '[data-dossier-title]': title, '[data-dossier-close]': close, '[data-dossier-body]': body }[selector];
    },
    addEventListener() {},
    showModal() { this.open = true; },
  };
  const calls = [];
  let tier = 'pro';
  const window = {
    PoseidonMembers: { tier: () => tier, getProtected(path) {
      calls.push(path);
      return new Promise(() => {});
    } },
    history: {}, addEventListener() {}, dispatchEvent() {},
  };
  const document = {
    documentElement: { lang: 'ro' }, readyState: 'complete',
    getElementById: () => nativeDialog, createElement: makeNode, addEventListener() {},
  };
  runInNewContext(source('member-dossier.js'), { window, document, AbortController, Event });
  const { openPredictionStats, setPredictions } = window.PoseidonDossier;
  assert.equal(openPredictionStats({}, match, true), false);
  setPredictions({ matches: [match] });
  assert.equal(openPredictionStats({}, { ...match }, true), false);
  tier = 'basic';
  assert.equal(openPredictionStats({}, match, true), false);
  assert.deepEqual(calls, []);
  tier = 'pro';
  assert.equal(openPredictionStats({}, match, true), true);
  assert.deepEqual(calls, ['/api/dosar/2026-11-21/1575226']);
  assert.equal(title.textContent, 'Borussia Monchengladbach – Borussia Dortmund');
  assert.equal(nativeDialog.open, true);
});
