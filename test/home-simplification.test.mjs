import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const dashboard=require('../assets/home-dashboard.js');
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const predictions=read('data/predictions.json'),history=read('data/history.json'),audit=read('data/audit.json'),dictionary=read('assets/i18n.json');
const source=predictions.matches.find(row=>row.free===true&&!row.locked);
const day=dashboard.dayOf(source.match_date);
const translate=key=>dictionary.en[key]||({'simplify.search.empty':'No teams match this search.'})[key]||key;

test('team search matches either real side with case/accent normalization and preserves public values',()=>{
  const selected=dashboard.selectRows(predictions,day,'',5,'');
  const free=predictions.matches.filter(row=>row.free===true&&!row.locked&&dashboard.dayOf(row.match_date)===day).sort((a,b)=>Date.parse(a.match_date)-Date.parse(b.match_date));
  assert.deepEqual(selected.rows.slice(0,free.length).map(row=>row.probabilities),free.slice(0,5).map(row=>[row.prob_home,row.prob_draw,row.prob_away]));
  const away=dashboard.selectRows(predictions,day,source.league,5,source.away_team.toUpperCase());
  assert(away.rows.some(row=>row.fixture_id===source.fixture_id));
  assert.equal(dashboard.normalizeSearch('  ȘTEAUA   SÃO PAULO  '),'steaua sao paulo');
  const accented=predictions.matches.find(row=>/[áéíóúăâîșțčťř]/i.test(row.home_team));
  assert(accented,'authentic export contains a team spelling with accents');
  const query=accented.home_team.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  assert(dashboard.selectRows(predictions,dashboard.dayOf(accented.match_date),accented.league,100,query).rows.some(row=>row.fixture_id===accented.fixture_id));
});

test('search composes with date/league, has honest empty/error states, and keeps locked identities private',()=>{
  assert.deepEqual(dashboard.selectRows(predictions,day,source.league,5,'   '),dashboard.selectRows(predictions,day,source.league,5));
  assert.deepEqual(dashboard.selectRows(predictions,day,source.league,5,'no-such-team-xyz').rows,[]);
  assert.deepEqual(dashboard.selectRows(predictions,'1999-01-01',source.league,5,source.home_team).rows,[]);
  assert.throws(()=>dashboard.selectRows(null,day,'',5,'team'),/Missing public predictions/);
  const locked=predictions.matches.find(row=>row.locked===true);
  const result=dashboard.selectRows(predictions,dashboard.dayOf(locked.match_date),locked.league,100,locked.home_team);
  const row=result.rows.find(value=>value.fixture_id===locked.fixture_id);
  assert(row&&row.locked);assert.deepEqual(row.probabilities,[null,null,null]);
  const injected={matches:[{...source,home_team:'<img src=x onerror=alert(1)>',away_team:'A & B',locked:true}]};
  const html=dashboard.renderRows(dashboard.selectRows(injected,day,'',5,'<img').rows,translate,'en-GB');
  assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|56\.6%/);
});

test('league shortcuts are bounded, actually available that day and retain the selected full-menu league',()=>{
  assert.equal(typeof dashboard.leagueChoices,'function');
  const all=[...new Set(predictions.matches.filter(row=>dashboard.dayOf(row.match_date)===day).map(row=>row.league).filter(Boolean))];
  const choices=dashboard.leagueChoices(predictions,day);
  assert(choices.shortlist.length<=6);assert.deepEqual(new Set(choices.available),new Set(all));
  assert(choices.shortlist.every(league=>all.includes(league)));
  const selected=all.find(league=>!choices.shortlist.includes(league));assert(selected);
  const updated=dashboard.leagueChoices(predictions,day,selected);
  assert(updated.shortlist.includes(selected));assert(updated.shortlist.length<=6);
  assert.deepEqual(dashboard.leagueChoices(predictions,'1999-01-01'),{available:[],shortlist:[]});
});

function control(value=''){
  return {value,disabled:false,innerHTML:'',textContent:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}};
}
function mountedDocument(){
  const nodes={'dashboard-date':control(day),'dashboard-search':control(),'dashboard-search-clear':control(),'dashboard-league-menu':control(),'dashboard-leagues':control(),'dashboard-predictions':control(),'dashboard-table-status':control()};
  const listeners={},viewListeners={};
  const doc={documentElement:{lang:'en'},body:{classList:{contains:()=>false}},
    defaultView:{innerWidth:390,location:{hash:''},addEventListener:(type,fn)=>{viewListeners[type]=fn;}},
    querySelector:selector=>selector==='[data-dashboard-kpis]'?{}:null,
    querySelectorAll:()=>[],getElementById:id=>nodes[id]||null,
    addEventListener:(type,fn)=>{listeners[type]=fn;}};
  return {doc,nodes,listeners,viewListeners};
}
async function withMounted(run,failed=false){
  const env=mountedDocument(),priorFetch=globalThis.fetch,priorT=globalThis.t,requests=[];
  globalThis.t=translate;
  globalThis.fetch=async path=>{requests.push(path);if(failed)throw Error('explicit export failure');return {ok:path!=='analize/index.html',json:async()=>({'data/predictions.json':predictions,'data/history.json':history,'data/audit.json':audit})[path]};};
  try {await dashboard.mount(env.doc);await run({...env,requests});}
  finally {globalThis.fetch=priorFetch;if(priorT===undefined)delete globalThis.t;else globalThis.t=priorT;}
}

test('mounted search/full league menu preserve date, league and query through language rerender without new requests',async()=>{
  await withMounted(async({doc,nodes,listeners,requests})=>{
    nodes['dashboard-league-menu'].value=source.league;nodes['dashboard-league-menu'].listeners.change();
    nodes['dashboard-search'].value=source.away_team.toUpperCase();nodes['dashboard-search'].listeners.input();
    assert(nodes['dashboard-predictions'].innerHTML.includes(`data-dashboard-fixture="${source.fixture_id}"`));
    const before=nodes['dashboard-predictions'].innerHTML;
    doc.documentElement.lang='fr';listeners.change({target:{matches:selector=>selector==='.lang-select'}});
    await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(nodes['dashboard-date'].value,day);assert.equal(nodes['dashboard-league-menu'].value,source.league);
    assert.equal(nodes['dashboard-search'].value,source.away_team.toUpperCase());
    assert.equal(nodes['dashboard-predictions'].innerHTML.match(/data-dashboard-fixture="[^"]+"/g).join(),before.match(/data-dashboard-fixture="[^"]+"/g).join());
    assert((nodes['dashboard-leagues'].innerHTML.match(/data-dashboard-league=/g)||[]).length<=7);
    nodes['dashboard-search'].value='no-such-team-xyz';nodes['dashboard-search'].listeners.input();
    assert(nodes['dashboard-predictions'].innerHTML.includes(translate('simplify.search.empty')));
    nodes['dashboard-search-clear'].listeners.click();assert.equal(nodes['dashboard-search'].value,'');
    assert.equal(nodes['dashboard-date'].value,day);assert.equal(nodes['dashboard-league-menu'].value,source.league);
    assert.equal(nodes['dashboard-search-clear'].disabled,true);
    assert.deepEqual(requests,['data/predictions.json','data/history.json','data/audit.json','analize/index.html']);
  });
});

test('an export failure remains unavailable rather than becoming a no-search-results claim',async()=>{
  await withMounted(async({nodes})=>{
    assert.match(nodes['dashboard-predictions'].innerHTML,/Data temporarily unavailable/);
    assert.match(nodes['dashboard-table-status'].textContent,/Public data could not load/);
    assert.equal(nodes['dashboard-search'].disabled,true);assert.equal(nodes['dashboard-league-menu'].disabled,true);
  },true);
});

function sampleDocument(){
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const block=html.split('<!-- PRO_SAMPLE_CARD_START -->')[1].split('<!-- PRO_SAMPLE_CARD_END -->')[0];
  const text=markup=>markup.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  const heading={textContent:text(block.match(/<div class="pro-card-head">([\s\S]*?)<\/div>/)[1])};
  const markers=[...block.matchAll(/<div data-lang="([a-z]+)"[^>]*>/g)],bodies={};
  markers.forEach((marker,index)=>{const part=block.slice(marker.index,markers[index+1]?.index);const paragraphs=[...part.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(match=>({textContent:text(match[1])}));bodies[marker[1]]={querySelectorAll:()=>paragraphs,querySelector:()=>paragraphs[0]||null};});
  const card={querySelectorAll:()=>Object.keys(bodies).map(lang=>({getAttribute:()=>lang})),querySelector:selector=>bodies[selector.match(/data-lang="([a-z]+)"/)?.[1]]||null};
  heading.closest=()=>card;
  return {doc:{querySelector:selector=>selector==='#exemplu-pro .pro-card-head'?heading:null},heading,bodies};
}

test('compact Pro demonstration uses only the actual generated sample, truthful language fallback and existing member routes',()=>{
  assert.equal(typeof dashboard.renderProSummary,'function');
  const {doc,heading,bodies}=sampleDocument();
  for(const [tier,href] of [[null,'#exemplu-pro'],['basic','analize/index.html'],['pro','#pro-analize']]){
    const markup=dashboard.renderProSummary(doc,translate,'en',tier);
    assert(markup.includes(heading.textContent.split(' · ')[0]));assert(markup.includes(`href="${href}"`));
    assert(markup.includes(bodies.en.querySelector().textContent.slice(0,70)));
    assert.equal(markup.includes('data-dashboard-analysis'),tier===null);
    assert(markup.length<2200,'summary does not clone the full generated analysis');
  }
  const italian=dashboard.renderProSummary(doc,translate,'it',null);
  assert(italian.includes(bodies.it.querySelector().textContent.slice(0,70)));
  assert(!italian.includes('class="dashboard-analysis-language"'),'an existing Italian translation needs no fallback notice');
  delete bodies.it; // Deliberately exercise the missing-language branch, independently of changing daily data.
  const fallback=dashboard.renderProSummary(doc,translate,'it',null);
  assert(fallback.includes('Analysis content is available in English.'));
  heading.textContent='<script>alert(1)</script> · original date';
  assert.doesNotMatch(dashboard.renderProSummary(doc,translate,'en',null),/<script>/);
  assert.match(dashboard.renderProSummary({querySelector:()=>null},translate,'en',null),/Data temporarily unavailable/);
});

test('fragment reveal opens every current ancestor, handles moved targets and leaves unrelated details closed',()=>{
  assert.equal(typeof dashboard.openTargetDetails,'function');
  const outer={tagName:'DETAILS',open:false,parentElement:null},inner={tagName:'DETAILS',open:false,parentElement:outer},unrelated={open:false};
  let scrolled=0;const target={parentElement:inner,scrollIntoView:()=>scrolled++};
  const doc={getElementById:id=>id==='matches'?target:null};
  assert.equal(dashboard.openTargetDetails(doc,'#matches',true),target);assert(outer.open&&inner.open);assert.equal(scrolled,1);assert.equal(unrelated.open,false);
  const moved={tagName:'DETAILS',open:false,parentElement:null};target.parentElement=moved;
  dashboard.openTargetDetails(doc,'#matches');assert.equal(moved.open,true);
  assert.equal(dashboard.openTargetDetails(doc,'#%broken'),null);assert.equal(dashboard.openTargetDetails(doc,'#missing'),null);
});

test('initial hash, hashchange and native fragment clicks reveal disclosures while fixture reset behavior survives',async()=>{
  const env=mountedDocument(),outer={tagName:'DETAILS',open:false,parentElement:null};
  const target={parentElement:outer,scrollIntoView:()=>{}};
  env.nodes.matches=target;env.nodes.intrebari={parentElement:outer,scrollIntoView:()=>{}};env.doc.defaultView.location.hash='#matches';
  const priorFetch=globalThis.fetch;globalThis.fetch=async path=>({ok:path!=='analize/index.html',json:async()=>({'data/predictions.json':predictions,'data/history.json':history,'data/audit.json':audit})[path]});
  try {
    await dashboard.mount(env.doc);assert.equal(outer.open,true);
    outer.open=false;env.doc.defaultView.location.hash='#intrebari';env.viewListeners.hashchange();assert.equal(outer.open,true);
    outer.open=false;const anchor={getAttribute:()=> '#matches'};
    env.listeners.click({target:{closest:selector=>selector==='a[href^="#"]'?anchor:null}});assert.equal(outer.open,true);
    const calls=[];env.nodes['filter-reset']={click:()=>calls.push('reset')};
    for(const id of ['filter-day','filter-league','filter-minprob'])env.nodes[id]={value:'stale',dispatchEvent:()=>{}};
    outer.open=false;dashboard.revealMatch(env.doc,source);assert(outer.open);assert.deepEqual(calls,['reset']);assert.equal(env.nodes['filter-day'].value,source.match_date.slice(0,10));
  } finally {globalThis.fetch=priorFetch;}
});

test('opening initially closed evidence redraws charts at their actual available width',async()=>{
  const env=mountedDocument(),charts=[{innerHTML:'',clientWidth:0},{innerHTML:'',clientWidth:0}];
  const evidence=control();evidence.open=false;env.nodes['dashboard-evidence-details']=evidence;
  env.doc.querySelectorAll=selector=>selector==='[data-dashboard-chart]'?charts:[];
  const priorFetch=globalThis.fetch;
  globalThis.fetch=async path=>({ok:path!=='analize/index.html',json:async()=>({'data/predictions.json':predictions,'data/history.json':history,'data/audit.json':audit})[path]});
  try {
    await dashboard.mount(env.doc);assert(charts[0].innerHTML.includes('viewBox="0 0 560 160"'));
    charts[0].clientWidth=368;charts[1].clientWidth=368;evidence.open=true;evidence.listeners.toggle();
    assert(charts.every(chart=>chart.innerHTML.includes('viewBox="0 0 368 160"')&&chart.innerHTML.includes('preserveAspectRatio="xMidYMid meet"')));
  } finally {globalThis.fetch=priorFetch;}
});
