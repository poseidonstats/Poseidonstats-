import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const dictionary=JSON.parse(readFileSync(new URL('../assets/i18n.json',import.meta.url),'utf8'));
const cut=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function runtime(language='en') {
  const events={};
  const context=vm.createContext({LANG:language,I18N:dictionary,window:{innerWidth:390},document:{addEventListener:(type,fn)=>(events[type]??=[]).push(fn)},
    // Popover generators are existing independently tested widgets; explicit output sentinels ensure placement retained.
    warnMark:key=>`<button class="warn-fixture" data-key="${key}">i</button>`,
    marketCertMark:key=>`<button class="cert-fixture" data-key="${key}">i</button>`,
    skillMark:key=>`<span class="skill-fixture" data-key="${key}"></span>`});
  vm.runInContext([
    cut('function t(key) {','function applyI18n()'),
    cut('function pctClass(p) {','/* ============== Cifre vii'),
    cut('function tt(key, fallbackRo) {','function honestEmptyHtml('),
    cut('function isLocked(m) {','// 14 oct 2026 — rezumatul'),
    cut('function rawNote(raw, cal) {','/* ============== Marcaj onestitate'),
    cut('function xgBar(xgH, xgA) {','/* ============== TRACK RECORD')
  ].join('\n'),context);
  return {context,events,render:m=>context.renderMatch(m)};
}
const match={fixture_id:123,home_team:'Oman',away_team:'Brunei',country:'World',league:"King's Cup",match_date:'2026-11-17T09:00:00Z',free:true,calibrated:false,
  prob_home:.74,prob_draw:.16,prob_away:.10,prob_over_1_5:.82,prob_over_2_5:.62,prob_over_3_5:.40,prob_btts:.50,prob_btts_raw:.46,
  prob_1x:.90,prob_x2:.26,prob_12:.84,xg_home:2.39,xg_away:.71,top_score_h:2,top_score_a:0,top_score_prob:.13,
  prob_ht_over_0_5:.72,prob_ht_over_1_5:.37,prob_ht_btts:.245,ht_prob_home:.53,ht_prob_draw:.38,ht_prob_away:.09,ht_top_score_h:0,ht_top_score_a:0,ht_top_score_prob:.30,xg_home_ht:.97,xg_away_ht:.25};
const segment=(html,market)=>html.split(`data-market="${market}"`)[1]?.split('</div></div>')[0] || '';
test('approved match keeps source probabilities, calibrated/raw notes, missing semantics and correct HT BTTS schema',()=>{
  const {render}=runtime();const html=render(match);
  for(const value of ['74%','16%','10%','82%','62%','40%','50%','46%','90%','26%','84%','38%','60%','72%','37%','25%','53%','9%','30%','2.39','0.71','0.97','0.25'])assert(html.includes(value),value);
  assert.match(html,/uncalibrated league/);assert.match(html,/data-key="O2.5"/);assert.match(html,/data-key="HT O0.5"/);
  assert.match(segment(html,'HT BTTS'),/25%/);
  const missing=render({...match,prob_over_2_5:null,prob_over_3_5:undefined,prob_ht_btts:null,ht_prob_btts:.99,top_score_h:null,xg_home:null});
  assert.match(segment(missing,'U2.5'),/>—</);assert.match(segment(missing,'U3.5'),/>—</);assert.match(segment(missing,'HT BTTS'),/>—</);
  assert.doesNotMatch(missing,/NaN|undefined|null–|99%/);
  const invalid=render({...match,prob_btts:NaN,prob_ht_over_1_5:Infinity});assert.doesNotMatch(invalid,/NaN|Infinity/);
});
test('explicit locked flag cannot leak probability fields even when caller sends complete record',()=>{
 const html=runtime().render({...match,locked:true});assert.match(html,/match-locked/);assert.doesNotMatch(html,/74%|report-tabs|2\.39/);
});
test('names are escaped; unique IDs and per-card tab links survive repeated renders',()=>{
 const {render}=runtime();const html=render({...match,home_team:'<img src=x onerror=evil()>',away_team:'A & B'})+render(match);
 assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);assert.match(html,/A &amp; B/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 for(const [,id]of html.matchAll(/aria-(?:controls|labelledby)="([^"]+)"/g))assert(ids.includes(id),id);
});
test('market filter selects the relevant panel while cards wait for a selection',()=>{
 const {context}=runtime();
 for(const [market,panel]of [['over_2_5','goals'],['under_3_5','goals'],['btts','goals'],['ht_over_0_5','half'],['dc_x2','overview'],['1x2','overview']]){
  const html=context.renderMatch(match,market);assert.match(html,new RegExp(`aria-controls="match-report-\\d+-${panel}-panel" aria-selected="true" tabindex="0"`));
  assert.doesNotMatch(html,/match-free open/);assert.match(html,/aria-expanded="false"/);assert.match(html,/market-filtered/);
 }
});
test('six languages expose translated tabs and conserve identical numeric values',()=>{
 for(const [lang,label]of [['ro','Prezentare'],['en','Overview'],['es','Resumen'],['it','Panoramica'],['fr','Vue d’ensemble'],['id','Ringkasan']]){
  const html=runtime(lang).render(match);assert(html.includes(`>${label}</button>`));assert(html.includes('74%'));assert(html.includes(lang==='en'?'2.39':'2,39'));
 }
});
test('click and arrow-key handlers change local panel visibility and selection only',()=>{
 const {context,events}=runtime();const panels=['overview','goals','half'].map(id=>({id,hidden:id!=='overview'}));
 const tabs=panels.map(p=>({attrs:{'aria-controls':p.id,'aria-selected':String(!p.hidden)},getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v},focus(){this.focused=true}}));
 const report={querySelectorAll:s=>s==='.report-panel'?panels:tabs};
 for(const tab of tabs){tab.closest=()=>report;tab.parentElement={querySelectorAll:()=>tabs};}
 events.click[0]({target:{closest:()=>tabs[1]}});assert.deepEqual(panels.map(p=>p.hidden),[true,false,true]);
 let prevented=false;events.keydown[0]({target:{closest:()=>tabs[1]},key:'ArrowRight',preventDefault(){prevented=true}});
 assert(prevented);assert(tabs[2].focused);assert.deepEqual(panels.map(p=>p.hidden),[true,true,false]);
 events.keydown[0]({target:{closest:()=>tabs[2]},key:'Home',preventDefault(){}});assert.equal(tabs[0].attrs['aria-selected'],'true');
 context.selectMatchReportTab({closest:()=>null}); // detached or removed card: safe no-op
});
