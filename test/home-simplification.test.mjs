import {proSample} from './fixtures/pro-sample.mjs';
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
    defaultView:{
      innerWidth:390,location:{pathname:'/',hash:''},
      addEventListener:(type,fn)=>{viewListeners[type]=fn;},
      removeEventListener:(type,fn)=>{if (viewListeners[type]===fn) delete viewListeners[type];},
    },
    querySelector:selector=>selector==='[data-dashboard-kpis]'?{}:null,
    querySelectorAll:()=>[],getElementById:id=>nodes[id]||null,
    addEventListener:(type,fn)=>{listeners[type]=fn;}};
  return {doc,nodes,listeners,viewListeners};
}
async function withMounted(run,failed=false,prepare,supplemental){
  const env=mountedDocument(),priorFetch=globalThis.fetch,priorT=globalThis.t,requests=[];
  prepare?.(env);
  globalThis.t=translate;
  globalThis.fetch=async path=>{requests.push(path);if(failed)throw Error('explicit export failure');if(supplemental && path==='data/dashboard-market-history.json')return supplemental;return {ok:path!=='analize/index.html',json:async()=>({'data/predictions.json':predictions,'data/history.json':history,'data/audit.json':audit})[path]};};
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
    assert.deepEqual(requests,['data/predictions.json','data/history.json','data/audit.json','data/dashboard-market-history.json','analize/index.html']);
  });
});

test('a pending or failed market archive leaves today usable without resetting the chosen market',async()=>{
  let complete;
  const supplemental=new Promise(resolve=>{complete=resolve;});
  await withMounted(async({nodes,listeners})=>{
    const table=nodes['dashboard-predictions'];
    const forecastCount=(table.innerHTML.match(/class="dashboard-match-row"/g)||[]).length;
    assert.equal(forecastCount,5);
    const button={dataset:{homeMarket:'btts'}};
    listeners.click({target:{closest:selector=>selector==='[data-home-market]'?button:null}});
    assert.match(table.innerHTML,/dashboard-market-cell/);
    assert.match(table.innerHTML,/Loading/);
    complete({ok:false});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(nodes['dashboard-date'].value,day);
    assert.equal((table.innerHTML.match(/class="dashboard-match-row"/g)||[]).length,forecastCount);
    assert.match(table.innerHTML,/dashboard-market-cell/);
    assert.match(table.innerHTML,/History unavailable/);
  },false,undefined,supplemental);
});

test('an export failure remains unavailable rather than becoming a no-search-results claim',async()=>{
  await withMounted(async({nodes})=>{
    assert.match(nodes['dashboard-predictions'].innerHTML,/Data temporarily unavailable/);
    assert.match(nodes['dashboard-table-status'].textContent,/Public data could not load/);
    assert.equal(nodes['dashboard-search'].disabled,true);assert.equal(nodes['dashboard-league-menu'].disabled,true);
  },true);
});

test('generated Pro fallback shows only the match, public editorial selection and one reading control before expansion',()=>{
  const html=readFileSync(new URL('../meciuri.html',import.meta.url),'utf8');
  const [preview,source]=proSample(html);
  assert.match(preview,/<article class="dashboard-pro-summary pro-card"[^>]+data-dashboard-pro-fallback/);
  assert.match(preview,/<div class="pro-card-head"><h3>[^<]+ – [^<]+<\/h3><\/div>/);
  const languages=markup=>[...markup.matchAll(/<div data-lang="([a-z]+)"[^>]*>/g)].map(match=>match[1]);
  assert.deepEqual(languages(preview),languages(source));
  for(const lang of Object.keys(dictionary)) assert(dictionary[lang]['dashboard.analysis.preview.read']);
  const variants=preview.split('<div class="pro-visible">').slice(1);
  const locales=languages(preview);
  if (!locales.length) locales.push('ro');
  assert.equal(variants.length,locales.length);
  for(const [index,variant] of variants.entries()){
    const t=dictionary[locales[index]];
    const [closed,opened]=variant.split('<details class="dossier-context">');
    assert.match(closed,/sample-preview-selection.*redesign\.edition\.pick.*<strong>[^<]+<\/strong>/);
    assert(closed.includes(`>${t['redesign.edition.pick']}</span>`));
    assert.doesNotMatch(closed,/%|<p|dossier-published|dossier-review/);
    assert(opened.startsWith(`<summary data-i18n="dashboard.analysis.preview.read">${t['dashboard.analysis.preview.read']}</summary>`));
    assert.match(opened,/dossier-published[\s\S]*arhiva\.sect\.verdict[\s\S]*dossier-review/);
  }
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
  const scrolled=[];
  const target={parentElement:outer,scrollIntoView:()=>scrolled.push('matches')};
  env.nodes.matches=target;
  env.nodes.intrebari={parentElement:outer,scrollIntoView:()=>scrolled.push('intrebari')};
  env.doc.defaultView.location.hash='#matches';
  const priorFetch=globalThis.fetch;globalThis.fetch=async path=>({ok:path!=='analize/index.html',json:async()=>({'data/predictions.json':predictions,'data/history.json':history,'data/audit.json':audit})[path]});
  try {
    await dashboard.mount(env.doc);assert.equal(outer.open,true);
    outer.open=false;env.doc.defaultView.location.hash='#intrebari';env.viewListeners.hashchange();assert.equal(outer.open,true);
    assert.deepEqual(scrolled,['matches'],'restore a fresh deep link once and let the browser own later fragment traversal');
    outer.open=false;const anchor={getAttribute:()=> '#matches'};
    env.listeners.click({target:{closest:selector=>selector==='a[href^="#"]'?anchor:null}});assert.equal(outer.open,true);
    const calls=[];env.nodes['filter-reset']={click:()=>calls.push('reset')};
    for(const id of ['filter-day','filter-league','filter-minprob'])env.nodes[id]={value:'stale',dispatchEvent:()=>{}};
    outer.open=false;dashboard.revealMatch(env.doc,source);assert(outer.open);assert.deepEqual(calls,['reset']);assert.equal(env.nodes['filter-day'].value,dashboard.dayOf(source.match_date));
  } finally {globalThis.fetch=priorFetch;}
});

test('reload with a retained fragment restores the saved viewport without scrolling to the old target',async()=>{
  const moves=[],saved=[];
  await withMounted(({doc,viewListeners})=>{
    assert.deepEqual(moves,[[0,15]]);
    doc.defaultView.scrollY=85;
    viewListeners.pagehide();
    assert.deepEqual(saved,[{page:'/#matches',y:85}]);
  },false,({doc,nodes})=>{
    const view=doc.defaultView;
    view.location.hash='#matches';
    view.performance={getEntriesByType:()=>[{type:'reload'}]};
    view.sessionStorage={
      getItem:()=>JSON.stringify({page:'/#matches',y:15}),
      setItem:(_key,value)=>saved.push(JSON.parse(value)),
    };
    view.requestAnimationFrame=fn=>fn();
    view.scrollTo=(x,y)=>moves.push([x,y]);
    nodes.matches={scrollIntoView:()=>moves.push('old fragment')};
  });
});

test('fragment history returns to each entry’s viewport after the user scrolls away from its target',async()=>{
  const moves=[];
  await withMounted(({doc,viewListeners})=>{
    const view=doc.defaultView;
    const matchesEntry=view.history.state;
    assert.equal(matchesEntry.externalState,'retained');
    view.scrollY=0;
    viewListeners.scroll();
    view.location.hash='#dashboard';
    view.history.state=null;
    viewListeners.popstate();
    assert.deepEqual(moves,[],'a new fragment keeps native scrolling');
    const dashboardEntry=view.history.state;
    view.scrollY=975;
    viewListeners.scroll();
    view.location.hash='#matches';
    view.history.state=matchesEntry;
    viewListeners.popstate();
    viewListeners.hashchange();
    view.location.hash='#dashboard';
    view.history.state=dashboardEntry;
    viewListeners.popstate();
    viewListeners.hashchange();
    assert.deepEqual(moves,[[0,0],[0,975]]);
  },false,({doc})=>{
    const view=doc.defaultView;
    view.location.hash='#matches';
    view.scrollY=3066;
    view.history={state:{externalState:'retained'},replaceState(state){this.state=state;}};
    view.requestAnimationFrame=fn=>fn();
    view.scrollTo=(x,y)=>moves.push([x,y]);
  });
});

async function withMountedCharts(journal, run) {
  const env=mountedDocument(),charts=[{innerHTML:'',clientWidth:0},{innerHTML:'',clientWidth:0}];
  const evidence=control();evidence.open=false;env.nodes['dashboard-evidence-details']=evidence;
  env.doc.querySelectorAll=selector=>selector==='[data-dashboard-chart]'?charts:[];
  const priorFetch=globalThis.fetch,priorT=globalThis.t;
  globalThis.t=translate;
  globalThis.fetch=async path=>({ok:path!=='analize/index.html',json:async()=>({'data/predictions.json':predictions,'data/history.json':journal,'data/audit.json':audit})[path]});
  try {
    await dashboard.mount(env.doc);
    await run({...env,charts,evidence});
  } finally {
    globalThis.fetch=priorFetch;
    if(priorT===undefined)delete globalThis.t;else globalThis.t=priorT;
  }
}

// Synthetic UI-only journal: the layout check must not depend on daily settlement.
// Removing the toggle/resize handlers must break these assertions.
const chartJournal={cumulated_markets:[],days:[
  {date:'2026-10-21',status:'complete',totals:{wins:6,losses:4,pending:0}},
  {date:'2026-10-22',status:'partial',totals:{wins:12,losses:8,pending:3}}
]};

test('opening initially closed evidence redraws charts at their actual available width',async()=>{
  await withMountedCharts(chartJournal,async({doc,charts,evidence,viewListeners})=>{
    assert(charts[0].innerHTML.includes('viewBox="0 0 560 160"'));
    assert(charts[1].innerHTML.includes('viewBox="0 0 340 160"'));
    charts.forEach(chart=>{chart.clientWidth=368;});evidence.open=true;evidence.listeners.toggle();
    assert(charts.every(chart=>chart.innerHTML.includes('viewBox="0 0 368 160"')&&chart.innerHTML.includes('preserveAspectRatio="xMidYMid meet"')));
    charts.forEach(chart=>{chart.clientWidth=320;});viewListeners.resize();
    assert(charts.every(chart=>chart.innerHTML.includes('viewBox="0 0 320 160"')));
    doc.defaultView.innerWidth=1440;charts[0].clientWidth=560;charts[1].clientWidth=340;
    viewListeners.resize();
    assert(charts[0].innerHTML.includes('viewBox="0 0 560 95"'));
    assert(charts[1].innerHTML.includes('viewBox="0 0 340 95"'));
  });
});

for(const [label,days] of [
  ['empty',[]],
  ['pending-only',[{date:'2026-10-22',status:'in_progress',totals:{wins:0,losses:0,pending:12}}]]
]) {
  test(`${label} evidence stays explicitly unavailable after opening and resizing`,async()=>{
    await withMountedCharts({cumulated_markets:[],days},async({charts,evidence,viewListeners})=>{
      const assertUnavailable=()=>charts.forEach(chart=>{
        assert(chart.innerHTML.includes(translate('dashboard.data.unavailable')));
        assert.doesNotMatch(chart.innerHTML,/<svg\b/);
      });
      assertUnavailable();
      charts.forEach(chart=>{chart.clientWidth=368;});evidence.open=true;evidence.listeners.toggle();
      assertUnavailable();viewListeners.resize();assertUnavailable();
    });
  });
}
