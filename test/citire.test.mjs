// „Propunerea noastră” (24 oct 2026): blocul de citire din echipe de pe cardul meciului — textul se compune din data/citire.json,
// fără cote; echipa care deschide apare doar când e numită; nota de onestitate are cifrele din test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../assets/citire.js', import.meta.url), 'utf8');
function incarca(lang = 'ro', data = null, now = Date.now()) {
  const i18n = JSON.parse(readFileSync(new URL('../assets/i18n.json', import.meta.url), 'utf8'));
  const ctx = {
    window: {}, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    tt: (key, fallback) => (i18n[lang] && i18n[lang][key]) || fallback,
    _loc: () => ({ro:'ro-RO',en:'en-GB',es:'es-ES',it:'it-IT',fr:'fr-FR',id:'id-ID'})[lang], fetch: data ? async()=>({ok:true,json:async()=>data}) : undefined, console,
    Date: class extends Date { static now() { return now; } },
  };
  ctx.window = ctx;
  vm.runInNewContext(src, ctx);
  return Object.assign(ctx.POSEIDON_CITIRE,{setLanguage:value=>{lang=value;},setClock:value=>{now=value;}});
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

test('canonical cards keep their match-header attachment without any new kickoff or probability-detail attribute',async()=>{
  const data={generated_at:'2026-10-24T08:00:00Z',meciuri:{'123':citire},test:testNr};
  const C=incarca('ro',data,Date.parse('2026-10-24T09:00:00Z'));await C.incarca();
  const inserted=[];
  const header={insertAdjacentHTML:(position,html)=>{assert.equal(position,'afterend');inserted.push(html);}};
  const card={classList:{contains:()=>false},getAttribute:key=>{assert.equal(key,'data-fid');return '123';},
    querySelector:selector=>selector==='.match-header'?header:selector==='.citire'&&inserted.length?{}:null};
  const root={querySelectorAll:selector=>{assert.equal(selector,'.match[data-fid]');return [card];}};
  assert.equal(C.aplica(root),1);assert(inserted[0].includes('Propunerea noastră'));
  assert.equal(C.aplica(root),0,'original cards do not duplicate their reading');
  card.classList.contains=()=>true;inserted.length=0;
  assert.equal(C.aplica(root),0,'locked cards never receive a reading');
});

test('reading numeric schema rejects hostile interpolation and keeps source separate in six locales',()=>{
  for(const lang of ['ro','en','es','it','fr','id']) {
    const C=incarca(lang),html=C.html({...citire,lam:3.04},testNr);
    assert(html.includes('formule_psg') && !html.includes('POSEIDON'));
    assert(!html.includes('3.41') && !html.includes('3.04'));
    for(const bad of [{p1x2:['<img src=x onerror=1>',27,26]}, {goluri:{...citire.goluri,interval:[2,'<img>']}},
      {p00_pauza:NaN},{deschide:{echipa:'gazda',p:Infinity}},{familia:['<img>','1-1']}]) {
      assert.equal(C.html({...citire,...bad},testNr),'');
    }
  }
});

test('homepage reading waits for async data then uses the same validated six-column visible renderer',async()=>{
  const now=Date.parse('2026-10-24T09:00:00Z');
  const identity={fixture_id:123,home_team:'Home',away_team:'Away',match_date:'2026-10-24T14:00:00Z',locked:false};
  const reading={...citire,echipe:['Home','Away'],ko_utc:identity.match_date,versiune:'formule_psg 23 oct 2026'};
  const data={generated_at:'2026-10-24T08:00:00Z',meciuri:{'123':reading},test:testNr};
  for(const lang of ['ro','en','es','it','fr','id']) {
    const C=incarca(lang,data,now);
    assert.equal(C.dashboardRow(identity),'');
    await C.incarca();
    const html=C.dashboardRow(identity);
    assert.match(html,/^<tr class="dashboard-reading-row"/);
    assert(html.includes('<td colspan="6">') && html.includes('class="citire"'));
    assert(!html.includes('<details') && !/class="match\b/.test(html));
    assert(html.includes('47 / 27 / 26') && html.includes('2-4') && html.includes('formule_psg'));
    if(lang==='en') assert(html.includes('Our reading'));
    for(const bad of [{locked:true},{fixture_id:999},{home_team:'Wrong'},{match_date:'2026-10-24T15:00:00Z'}]) assert.equal(C.dashboardRow({...identity,...bad}),'');
  }
});

test('HOME rejects stale/future/naive timestamps, malformed mapping and non-fixture identities',async()=>{
  const now=Date.parse('2026-10-24T09:00:00Z');
  const identity={fixture_id:123,home_team:'Home',away_team:'Away',match_date:'2026-10-24T14:00:00Z',locked:false};
  const reading={...citire,echipe:['Home','Away'],ko_utc:identity.match_date,versiune:'formule_psg 23 oct 2026'};
  const data={generated_at:'2026-10-24T08:00:00Z',meciuri:{'123':reading},test:testNr};
  const C=incarca('en',data,now);await C.incarca();
  for(const id of [true,0,-1,1.5,'0123','123"',[123],NaN]) assert.equal(C.dashboardRow({...identity,fixture_id:id}),'');
  assert.equal(C.dashboardRow({...identity,locked:undefined}),'');
  for(const bad of [{generated_at:'2026-10-23T08:59:59Z'},{generated_at:'2026-10-24T10:00:00Z'},
    {generated_at:'2026-10-24T08:00:00'},{generated_at:'2026-02-31T08:00:00Z'},{meciuri:[reading]}]) {
    const invalid=incarca('en',{...data,...bad},now);await invalid.incarca();assert.equal(invalid.dashboardRow(identity),'');
  }
  C.setClock(Date.parse(identity.match_date));assert.equal(C.dashboardRow(identity),'');
});

test('homepage handles data-before/render-before order, language and filtered rerenders without duplicates',async()=>{
  const now=Date.parse('2026-10-24T09:00:00Z');
  const identity={fixture_id:'123',home_team:'Home',away_team:'Away',match_date:'2026-10-24T14:00:00Z'};
  const data={generated_at:'2026-10-24T08:00:00Z',meciuri:{'123':{...citire,echipe:['Home','Away'],ko_utc:identity.match_date,versiune:'formule_psg 23 oct 2026'}},test:testNr};
  for(const renderBeforeData of [false,true]) {
    let children=[],callback;
    const table={querySelectorAll:selector=>{assert.equal(selector,'[data-reading-fixture]');return children.filter(n=>n.attributes['data-reading-fixture']);}};
    function node(classes,attributes={},content='') {
      const item={attributes,content,classList:{contains:c=>classes.includes(c)},getAttribute:k=>attributes[k],
        remove:()=>{children.splice(children.indexOf(item),1);},
        insertAdjacentHTML:(position,html)=>{assert.equal(position,'afterend');const attrs=Object.fromEntries(Array.from(html.matchAll(/(data-reading-[\w-]+)="([^"]*)"/g),m=>[m[1],m[2]]));children.splice(children.indexOf(item)+1,0,node(['dashboard-reading-row'],attrs,html));}};
      Object.defineProperty(item,'nextElementSibling',{get:()=>children[children.indexOf(item)+1]||null});return item;
    }
    function render(options={}) {
      const attrs={'data-reading-fixture':options.fixture||identity.fixture_id,'data-reading-home':identity.home_team,'data-reading-away':identity.away_team,'data-reading-kickoff':options.kickoff||identity.match_date,'data-reading-free':options.locked?'false':'true'};
      children=[node([],attrs)];
    }
    class Observer {constructor(fn){callback=fn;}observe(target,options){assert.equal(target,table);assert.equal(options.childList,true);}}
    const C=incarca('en',data,now);
    if(renderBeforeData) render();
    else await C.incarca();
    await C.porneste({getElementById:id=>id==='dashboard-predictions'?table:null},Observer);
    if(!renderBeforeData) {render();callback();}
    const readings=()=>children.filter(n=>n.classList.contains('dashboard-reading-row'));
    assert.equal(readings().length,1);
    assert.equal(children.indexOf(readings()[0]),1,'reading follows the fixture directly');
    callback();callback();assert.equal(readings().length,1);
    C.setLanguage('ro');callback();assert.equal(readings().length,1);assert(readings()[0].content.includes('Propunerea noastră'));
    for(const options of [{fixture:'999'},{kickoff:'2026-10-24T15:00:00Z'},{locked:true},{}]) {
      render(options);callback();callback();
      assert.equal(readings().length,options.fixture||options.kickoff||options.locked?0:1);
    }
    render();callback();assert.equal(children.indexOf(readings()[0]),1,'reading needs no quote or selection function');
    C.setClock(Date.parse(identity.match_date));callback();assert.equal(readings().length,0,'started fixtures lose an existing home reading');
  }
});
