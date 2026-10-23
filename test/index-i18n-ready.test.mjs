import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const translations=JSON.parse(readFileSync(new URL('../assets/i18n.json',import.meta.url),'utf8'));
function actual(start,end) {
  const first=source.indexOf(start), last=source.indexOf(end,first+start.length);
  assert(first>=0 && last>first,`actual app source boundaries: ${start}`);
  return source.slice(first,last);
}
function harness(member=false) {
  // Explicit isolated DOM/network mocks. No real API, session or model is used.
  const events=[],writes=[],elements=new Map(),listeners=new Map();
  function element(id) {
    if (!elements.has(id)) {
      let html='';
      const options=[{value:'',text:'Placeholder'}];
      elements.set(id,{
        value:id==='filter-sort'?'time':'',checked:false,textContent:'',options,
        classList:{toggle:()=>{}},add:option=>options.push(option),addEventListener:()=>{},
        get innerHTML() {return html;},
        set innerHTML(value) {html=value;writes.push({id,html:value,language:context.LANG});events.push('render:'+context.LANG);}
      });
    }
    return elements.get(id);
  }
  const document={getElementById:element,body:{classList:{add:()=>{}}},addEventListener:(type,callback)=>listeners.set(type,callback)};
  const publicFixture={matches:[{fixture_id:1,match_date:'2026-10-23T12:00:00Z',country:'Test country',league:'Test league',home_team:'Test home',away_team:'Test away',locked:true}]};
  const payloads=new Map([['data/predictions.json',publicFixture],['data/calibration.json',{}],['data/scorecard.json',{}]]);
  const context=createContext({
    document,I18N:null,LANG:'ro',CALIB_URL:'data/calibration.json',SCORECARD_URL:'data/scorecard.json',PRED_URL:'data/predictions.json',
    MARKET_CERT:{},SCORECARD:{},LOCKED_PREVIEW:40,PRED_CU_TOKEN:false,PRED_SURSA:'public',SCRIPT_V:'UNIT-TEST',
    // Hold the readiness timeout; release happens explicitly in each test.
    setTimeout:()=>0,
    Option:class {constructor(text,value) {this.text=text;this.value=value;}},
    renderMatch:()=>{events.push('detail:'+context.LANG);return '';},
    renderLockedMatch:()=>'<div class="explicit-detail-renderer-stub"></div>',rezumatExemplu:()=>'',renderProAnalize:()=>{},
    fetch:async url=>{
      if (String(url).startsWith('https://members.invalid/api/ping?')) return {ok:true};
      assert(payloads.has(url),`only mocked local export is allowed: ${url}`);
      events.push('fetch:'+url);
      return {ok:true,json:async()=>payloads.get(url)};
    },console
  });
  if (member) context.window={PoseidonMembers:{
    MEMBERS_API:'https://members.invalid',tier:()=> 'pro',
    incarca:async()=>{events.push('member-load');return {data:publicFixture,sursa:'membru'};}
  }};
  const executable=[
    actual('function t(key) {','function _loc()'),
    actual('let _i18nGataResolve = null;','async function initI18n()'),
    actual('async function fetchJSON(url) {','function pctClass('),
    actual('async function loadPredictions() {','const SCRIPT_V ='),
    actual('function tt(key, fallbackRo) {','function honestEmptyHtml('),
    actual('function nUnits(n) {','function matchWhen('),
    actual('function renderUnlockCta(nLocked, nLockedAzi = null) {','/* ============== SIMULATOR COMBINATE'),
    actual('async function renderIndex() {','function pickBadge('),
    actual('// 29 sept — plasă de siguranță:','async function fetchJSON(url) {')
  ].join('\n');
  runInContext(executable,context);
  return {context,events,writes,element,listeners,ready:()=>{
    context.I18N=translations;context.LANG='en';events.push('ready:en');
    runInContext('_i18nGataResolve()',context);
  }};
}

test('actual homepage renderer waits for i18n before its first DOM render and uses ready English unlock text', async () => {
  const h=harness();
  const pending=runInContext('renderIndex()',h.context);
  // All explicit mocked fetches settle while the real i18n gate remains held.
  await new Promise(resolve=>setImmediate(resolve));
  const beforeReady=h.writes.slice();
  h.ready();await pending;
  assert.deepEqual(beforeReady,[],'translated homepage DOM stays untouched before i18n readiness');
  assert.equal(h.events.filter(value=>value==='fetch:data/predictions.json').length,1);
  assert(h.writes.length>0,'actual renderer proceeds after the gate is released');
  assert(h.writes.every(write=>write.language==='en'));
  const html=h.element('matches').innerHTML;
  assert.match(html,/class="unlock-cta"/);
  assert(html.includes(translations.en['unlock.h']),'actual unlock renderer uses loaded English translations');
  assert(!html.includes(translations.ro['unlock.h']),'first render contains no Romanian unlock fallback');
  assert(h.events.indexOf('ready:en') < h.events.indexOf('render:en'));
});

test('actual member safety listener does not duplicate the initial request while translation readiness is held', async () => {
  const h=harness(true);
  const pending=runInContext('renderIndex()',h.context);
  assert.equal(h.context.PRED_CU_TOKEN,true,'existing synchronous membership flag is set before the i18n wait');
  h.listeners.get('DOMContentLoaded')();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.events.filter(value=>value==='member-load').length,1);
  assert.equal(h.writes.length,0);
  h.ready();await pending;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.events.filter(value=>value==='member-load').length,1);
  assert(h.writes.every(write=>write.language==='en'));
});


test('actual homepage rerender across languages keeps filter options unique and preserves selections', async () => {
  const h=harness();
  const first=runInContext('renderIndex()',h.context);h.ready();await first;
  const chosen={'filter-day':'2026-10-23','filter-league':'Test league','filter-country':'Test country'};
  const before={};
  for (const [id,value] of Object.entries(chosen)) {
    h.element(id).value=value;before[id]=h.element(id).options.map(option=>option.value);
  }
  h.context.LANG='ro';await runInContext('renderIndex()',h.context);
  for (const [id,value] of Object.entries(chosen)) {
    const select=h.element(id),values=select.options.map(option=>option.value);
    assert.deepEqual(values,before[id],`${id}: rerender appends no duplicate options`);
    assert.equal(new Set(values).size,values.length);
    assert.equal(select.value,value,`${id}: selected value survives rerender`);
    assert.equal(values[0],'','placeholder survives rerender');
  }
});
