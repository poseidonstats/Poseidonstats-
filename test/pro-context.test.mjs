import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),{extract}=require('../assets/pro-context.js');
function fixture(file,lang) {
 const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const block=html.split(`data-lang="${lang}"`)[1];
 const find=key=>block.match(new RegExp(`<p><strong data-i18n="arhiva\\.sect\\.${key}">[\\s\\S]*?<\\/p>`))?.[0];
 return {home:'Sorrento',away:'SS Monopoli',language:lang,evidence:find('model'),context:find('context')};
}
test('actual Sorrento archive and current sample extract identical precise paired values in all six languages',()=>{
 for(const file of ['analize/2026-11-16.html','index.html'])for(const lang of ['ro','en','es','it','fr','id']){
  const input=fixture(file,lang);assert(input.evidence,`${file} ${lang}`);
  assert.deepEqual(extract(input),{home:{name:'Sorrento',sample:10,scored:1.2,conceded:.7,over25:{hits:3,n:10},rank:9,points:20},away:{name:'SS Monopoli',sample:10,scored:.8,conceded:1,over25:{hits:2,n:10},rank:6,points:20}},`${file} ${lang}`);
 }
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
