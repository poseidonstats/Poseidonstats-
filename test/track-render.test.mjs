import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const dictionary=JSON.parse(readFileSync(new URL('../assets/i18n.json',import.meta.url),'utf8'));
function actual(start,end) {
  const first=source.indexOf(start),last=source.indexOf(end,first+start.length);
  assert(first>=0 && last>first,start);return source.slice(first,last);
}
// Authentic public calibration bucket copied for this fixed UI regression fixture.
const calibration={
  "meta": {
    "n_total": 65436,
    "n_whitelist_inter": 7472,
    "cert_threshold_pct": 70,
    "methodology": "TRAIN 2024-2025 / TEST 2026, ratings frozen 2025-12-31, calibrare per-ligă cu shrinkage K=14, probabilități calibrate Platt per piață (slope fix, validat split temporal ian-mar/apr-mai)",
    "probabilities": "post-platt"
  },
  "markets": [
    {
      "name": "Over 1.5 goluri (FT) — sub-set ligi top calibrate",
      "scope": "7,472 meciuri pe sub-set restrâns (calibrare strictă verificată)",
      "buckets": [
        {
          "range": "90–100%",
          "n": 26,
          "hit_pct": 96.15,
          "wlo_pct": 81.11,
          "diff_pp": 4.92,
          "low_sample": true
        }
      ]
    }
  ],
  "leagues": []
};

test('actual Track record renderer interpolates low-sample label and title in all six languages', async () => {
  for (const language of ['ro','en','es','it','fr','id']) {
    const elements=new Map();
    const document={getElementById:id=>{if(!elements.has(id))elements.set(id,{innerHTML:''});return elements.get(id);}};
    const context=createContext({
      I18N:dictionary,LANG:language,document,CALIB_URL:'data/calibration.json',FORWARD_URL:'data/forward.json',
      i18nGata:async()=>{},honestEmptyHtml:()=>'<div class="explicit-forward-empty-stub"></div>',
      // Explicit local transport mocks: no production API or generated files are touched.
      fetchJSON:async url=>{
        if(url==='data/calibration.json')return calibration;
        assert.equal(url,'data/forward.json');return {n_resolved:0};
      }
    });
    runInContext([
      actual('function t(key) {','function applyI18n()'),
      actual('function tt(key, fallbackRo) {','function honestEmptyHtml('),
      actual('function esc(s) {','/* ============== TRACK RECORD'),
      actual('function _numePiataBT(name) {','if (document.getElementById("matches"))')
    ].join('\n'),context);
    await runInContext('renderTrackRecord()',context);
    const html=elements.get('calibration-tables').innerHTML;
    assert(html.includes(`title="${dictionary[language]['tr.bt.lowsample.title']}"`),`${language}: translated low-sample title`);
    assert(html.includes(`>${dictionary[language]['tr.bt.lowsample']}</span>`),`${language}: translated low-sample label`);
    assert(!html.includes('${tt('),'no unevaluated template syntax is visible');
    assert(html.includes(`<td>${calibration.markets[0].buckets[0].n} <span`),'source N is preserved');
    assert(html.includes('style="opacity:.45"'),'existing low-sample visibility treatment is retained');
  }
});
