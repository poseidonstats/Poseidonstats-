import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

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
    { match:{fixture_id: '13'}, analysis:'Text original', analysis_es:'Análisis oficial', editorial_compact:'Unpublished simulation' },
    { match:{fixture_id: 14}, editorial_compact:'Unpublished simulation' },
  ];
  const item = select({date:day,items}, day, 13);
  assert.equal(localized(item, 'es').text, 'Análisis oficial');
  assert.equal(localized(item, 'ro').text, 'Text original');
  assert.equal(localized(item, 'fr').lang, 'ro');
  assert.equal(select({date:day,items}, day, 14), null);
  assert.equal(select({date:day,items}, day, 15), null);
  assert.equal(select({date:'2026-11-17',items}, day, 13), null);
});
