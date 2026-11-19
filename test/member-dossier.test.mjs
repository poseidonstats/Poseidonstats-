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
