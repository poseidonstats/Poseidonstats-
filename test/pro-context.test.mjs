import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {proSample,pairedEvidence,numbers,plain} from './helpers/pro-sample.mjs';
const require=createRequire(import.meta.url),{extract,marketFrequency}=require('../assets/pro-context.js');

test('venue frequencies preserve market orientation and reject duplicates, future fixtures and invalid half-time rows',()=>{
 const date='2026-11-01T12:00:00Z';
 const row=(id,home,scored,conceded,extra={})=>({id,date,home,scored,conceded,...extra});
 const dossier={fixture_id:10,match_date:'2026-11-18T12:00:00Z',as_of:'2026-11-17T22:00:00Z',teams:[
  {name:'Home',home:true,matches:[row(1,true,2,1,{halfScored:1,halfConceded:1}),row(2,true,0,1,{halfScored:1,halfConceded:0})]},
  {name:'Away',home:false,matches:[row(3,false,1,3),row(4,false,1,1),row(3,false,1,0),row(5,false,4,0,{date:'2026-11-18T10:00:00Z'}),row(10,false,2,0)]},
 ]};
 const counts=key=>marketFrequency(dossier,10,key)?.map(({hits,n})=>[hits,n]);
 assert.deepEqual(counts('dc_1x'),[[1,2],[2,2]]);
 assert.deepEqual(counts('dc_x2'),[[1,2],[1,2]]);
 assert.deepEqual(counts('over_1_5'),[[1,2],[2,2]]);
 assert.deepEqual(counts('under_1_5'),[[1,2],[0,2]]);
 assert.deepEqual(counts('ht_over_0_5'),[[1,1],[0,0]]);
 assert.deepEqual(counts('ng'),[[1,2],[0,2]]);
 assert.deepEqual(counts('btts'),[[1,2],[2,2]]);
 assert.equal(marketFrequency(dossier,11,'dc_1x'),null);
 assert.equal(marketFrequency(dossier,10,'constructor'),null);
});
function fixture(file,lang) {
 const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const block=html.split(`data-lang="${lang}"`)[1];
 const find=key=>block.match(new RegExp(`<p><strong data-i18n="arhiva\\.sect\\.${key}">[\\s\\S]*?<\\/p>`))?.[0];
 return {home:'Sorrento',away:'SS Monopoli',language:lang,evidence:find('model'),context:find('context')};
}
test('immutable Sorrento archive extracts exact paired values in all six languages',()=>{
 for(const file of ['analize/2026-11-16.html'])for(const lang of ['ro','en','es','it','fr','id']){
  const input=fixture(file,lang);assert(input.evidence,`${file} ${lang}`);
  assert.deepEqual(extract(input),{home:{name:'Sorrento',sample:10,scored:1.2,conceded:.7,over25:{hits:3,n:10},rank:9,points:20},away:{name:'SS Monopoli',sample:10,scored:.8,conceded:1,over25:{hits:2,n:10},rank:6,points:20}},`${file} ${lang}`);
 }
});
function assertSampleFacts(sample) {
 let reference;
 for(const variant of sample.variants){
  const evidence=pairedEvidence(sample,variant);
  const sourceNumbers=numbers(evidence.replace(sample.home,'').replace(sample.away,''));
  assert.equal(sourceNumbers.length,12,'two source samples each supply six numeric facts');
  if(reference)assert.deepEqual(sourceNumbers,reference,'translated source facts agree');else reference=sourceNumbers;
  const result=extract({home:sample.home,away:sample.away,language:variant.language,evidence,context:variant.paragraphs.context});
  assert(result,`${variant.language} supported source samples are recognized`);
  assert.deepEqual([result.home.name,result.away.name],[sample.home,sample.away]);
  assert.deepEqual([result.home,result.away].flatMap(t=>[t.sample,t.scored,t.conceded,2.5,t.over25.hits,t.over25.n]),sourceNumbers);
  const context=plain(variant.paragraphs.context);
  assert(context.includes(sample.home)&&context.includes(sample.away),'context belongs to the heading teams');
 }
}
test('current public sample conserves the published context and never converts a league sample into team facts',()=>{
 const sample=proSample(readFileSync(new URL('../meciuri.html',import.meta.url),'utf8'));
 if (sample.fixtureId==='1618012') {
  for (const variant of sample.variants) {
   const {context,model}=variant.paragraphs;
   assert(plain(context).includes(sample.home) && plain(context).includes(sample.away));
   assert.deepEqual(numbers(plain(model)),[40,77],variant.language);
   assert.equal(extract({home:sample.home,away:sample.away,language:variant.language,evidence:model,context}),null);
  }
  return;
 }
 // The legacy model text can contain recognized paired team facts. When it
 // does, retain the exact extraction contract covered by the fixed archive fixtures.
 const first=sample.variants[0];
 if (extract({home:sample.home,away:sample.away,language:first.language,evidence:first.paragraphs.model,context:first.paragraphs.context})) {
  assertSampleFacts(sample);
 }
});
test('escaped team names in legitimate source HTML conserve the same context facts',()=>{
 const html=readFileSync(new URL('../analize/2026-11-16.html',import.meta.url),'utf8').replace(/\bSorrento\b/g,'Sorrento &amp; Co &#x27;A&#x27;');
 const sample=proSample(html);assert.equal(sample.home,"Sorrento & Co 'A'");
 assertSampleFacts(sample);
});
test('only complete exact paired home-away samples are extracted',()=>{
 const input=fixture('analize/2026-11-16.html','en');
 for(const variant of [{...input,away:'Monopoli'},{...input,home:'Other Sorrento'},{...input,evidence:input.evidence.replace('last 10 away','last 10 at home')},{...input,evidence:input.evidence.replace('0.8 scored','unknown scored')},{...input,evidence:input.evidence+' Extra statement.'},{...input,evidence:''},{...input,language:'de'}])assert.equal(extract(variant),null);
 assert.equal(extract(null),null);
});
test('denominators are not assumed and contradictory counts fail closed',()=>{
 const input=fixture('analize/2026-11-16.html','en');
 const varied=input.evidence.replace('last 10 at home','last 8 at home').replace('3 of 10','3 of 8');
 const result=extract({...input,evidence:varied});assert.equal(result.home.sample,8);assert.deepEqual(result.home.over25,{hits:3,n:8});assert.equal(result.away.sample,10);
 for(const evidence of [input.evidence.replace('3 of 10','11 of 10'),input.evidence.replace('3 of 10','3 of 9'),input.evidence.replace('last 10 at home','last 0 at home'),input.evidence.replace('1.2 scored','-1.2 scored')])assert.equal(extract({...input,evidence}),null);
});
test('missing or uncertain rankings stay null, form is never fabricated',()=>{
 const input=fixture('analize/2026-11-16.html','en');
 const result=extract({...input,context:'Sorrento may be ninth. Recent form L W.'});
 assert.equal(result.home.rank,null);assert.equal(result.away.points,null);assert.equal(result.home.form,undefined);
});
test('browser classic global and escaped team names preserve literal source identity',()=>{
 const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../assets/pro-context.js',import.meta.url),'utf8'),context);assert.equal(typeof context.PoseidonProContext.extract,'function');
 const input=fixture('analize/2026-11-16.html','en');const home='Sorrento (A+)';const evidence=input.evidence.replaceAll('Sorrento',home);
 assert.equal(extract({...input,home,evidence}).home.name,home);
 assert.equal(extract({...input,home:'Sorrento.*'}),null);
});
