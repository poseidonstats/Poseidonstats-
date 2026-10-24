// „Propunerea noastră” (24 oct 2026): blocul de citire din echipe de pe cardul meciului — textul se compune din data/citire.json,
// fără cote; echipa care deschide apare doar când e numită; nota de onestitate are cifrele din test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../assets/citire.js', import.meta.url), 'utf8');
function incarca(lang = 'ro') {
  const i18n = JSON.parse(readFileSync(new URL('../assets/i18n.json', import.meta.url), 'utf8'));
  const ctx = {
    window: {}, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    tt: (key, fallback) => (i18n[lang] && i18n[lang][key]) || fallback,
    _loc: () => (lang === 'ro' ? 'ro-RO' : 'en-GB'), fetch: undefined, console,
  };
  ctx.window = ctx;
  vm.runInNewContext(src, ctx);
  return ctx.POSEIDON_CITIRE;
}
const citire = {
  familia: ['2-1', '1-1'], directia: '1', p1x2: [47, 27, 26], goluri: { interval: [2, 4], cel_mai_probabil: 3, p_interval: 61 },
  deschide: { echipa: 'gazda', p: 66 }, p00_pauza: 31, n: [20, 20],
};
const testNr = { familia: { hit: 20.5, n: 75996 }, directia: { hit: 48.1 }, interval: { hit: [60.8, 62.7] } };

test('blocul are familia, direcția cu cifrele, golurile, cine deschide și 0-0 la pauză, în română', () => {
  const C = incarca('ro');
  const html = C.html(citire, testNr);
  for (const frag of ['Propunerea noastră', '2-1 sau 1-1', '47 / 27 / 26', '2-4', 'cel mai probabil 3', 'gazda', '66', '0-0 la pauză', '31'])
    assert.ok(html.includes(frag), 'lipsește: ' + frag);
  assert.ok(html.includes('20,5') && html.includes('48') && html.includes('61'), 'nota de onestitate fără cifrele din test');
  assert.ok(!/cot[aă]|odds|value|edge/i.test(html), 'blocul nu afișează cote sau limbaj de preț');
});

test('în engleză textele vin din i18n.json, iar fără echipă numită apare „either side”', () => {
  const C = incarca('en');
  const html = C.html({ ...citire, deschide: { echipa: null, p: 58 } }, testNr);
  assert.ok(html.includes('Our reading') && html.includes('2-1 or 1-1') && html.includes('either side') && html.includes('58'));
  assert.ok(!html.includes('gazda'));
});

test('fără „deschide” nu apare secțiunea; cardurile se leagă după data-fid', () => {
  const C = incarca('ro');
  const html = C.html({ ...citire, deschide: null }, testNr);
  assert.ok(!html.includes('Deschide scorul'));
  assert.equal(C.SELECTOR, '.match[data-fid]');
});
