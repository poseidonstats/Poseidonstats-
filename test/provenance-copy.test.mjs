import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const d=JSON.parse(readFileSync(new URL('../assets/i18n.json',import.meta.url),'utf8'));
const languages=['ro','en','es','it','fr','id'];
test('six-language provenance distinguishes reconstruction and descriptive archives with complete cohort placeholders',()=>{
 const keys=['arhiva.bilant.prospectiv','arhiva.bilant.cohorta','arhiva.intro.descriptiv','arhiva.model.arhivat',
  'arhiva.zi.descriptiv','arhiva.disclaimer.descriptiv','pro.card.archived','audit.p','ds.note',
  'ds.col.calibration_available','ds.col.calibration_provenance','ds.col.calibration_version_ts','ds.col.evaluation_eligible'];
 const placeholders=s=>(s.match(/\{\w+\}/g)||[]).sort();
 for(const lang of languages) {
  for(const key of keys) {
   assert.equal(typeof d[lang][key],'string',`${lang}.${key}`);
   assert(d[lang][key].trim(),`${lang}.${key}`);
   assert.deepEqual(placeholders(d[lang][key]),placeholders(d.ro[key]),`${lang}.${key} placeholders`);
  }
  for(const token of ['calibration_available','calibration_provenance','cal_prob_','pub_ts']) assert(d[lang]['ds.note'].includes(token),`${lang} ${token}`);
  assert(d[lang]['audit.p'].includes('pub_ts')&&d[lang]['audit.p'].includes('BSS'));
  for(const key of ['tr.li.backtest','tr.li.source.bt','index.cardinfo.body']) assert.doesNotMatch(d[lang][key],/zero\s+(?:temporal\s+)?leakage|cero leakage/i);
 }
});
