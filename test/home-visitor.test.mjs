import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const require = createRequire(import.meta.url);
const {compactRoute, selectFreeMatches, selectLockedMatches, selectSample} = require('../assets/home-visitor.js');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../assets/home-visitor.js', import.meta.url), 'utf8');

function mockFeed(start) {
  let now = Date.parse(start);
  const requests = [], published = [];
  const document = {documentElement:{classList:{add(){},toggle(){}}},readyState:'loading',addEventListener(){},querySelector(){return null;}};
  const window = {
    document,location:new URL('https://poseidonstats.com/'),setTimeout,clearTimeout,
    fetch(path,options) {
      return new Promise(resolve => requests.push({path,options,resolve}));
    },
    PoseidonDossier:{setPublicPredictions(data){published.push(data);}},
  };
  class Clock extends Date { static now() { return now; } }
  runInNewContext(source,{window,URLSearchParams,AbortController,Date:Clock});
  return {load:window.PoseidonVisitor.loadPublicPredictions,requests,published,advance:time=>{now=Date.parse(time);}};
}

test('public feed shares the initial request, retries a failure and retains today on a stale refresh', async () => {
  const {load,requests,published} = mockFeed('2026-11-23T12:00:00Z');
  const first = load();
  assert.equal(load(),first);
  assert.equal(requests[0].path,'data/predictions.json');
  assert.equal(requests[0].options.credentials,'omit');
  requests[0].resolve({ok:false});
  assert.equal(await first,null);
  const retry = load();
  const today = {generated_at:'2026-11-23T10:00:00Z',matches:[]};
  requests[1].resolve({ok:true,json:async()=>today});
  assert.equal(await retry,today);
  assert.equal(await load(),today);
  assert.equal(requests.length,2);
  const refresh = load(true);
  requests[2].resolve({ok:true,json:async()=>({generated_at:'2026-11-22T10:00:00Z',matches:[]})});
  assert.equal(await refresh,today);
  assert.deepEqual(published,[today]);
});

test('a late response for the previous Bucharest day cannot replace the new day', async () => {
  const {load,requests,published,advance} = mockFeed('2026-11-23T21:59:59Z');
  const previous = load();
  advance('2026-11-23T22:00:01Z');
  const next = load();
  const today = {generated_at:'2026-11-23T22:00:00Z',matches:[]};
  requests[1].resolve({ok:true,json:async()=>today});
  requests[0].resolve({ok:true,json:async()=>({generated_at:'2026-11-23T10:00:00Z',matches:[]})});
  assert.equal(await next,today);
  assert.equal(await previous,null);
  assert.deepEqual(published,[today]);
});

test('the homepage layout does not depend on fragment, campaign query or account state', () => {
  const route = path => new URL(path,'https://poseidonstats.com/');
  for (const url of ['/', '/index', '/index?lang=en', '/index.html', '/?view=full', '/?lang=en&utm_source=uk', '/#dashboard', '/?members=none', '/?members_token=return']) {
    for (const state of ['guest','basic','pro','none','login']) assert(compactRoute(route(url),state),url);
  }
  assert(!compactRoute(route('/meciuri.html#dashboard')));
});

test('subscriber rows require an explicitly locked current local fixture and are ordered and deduplicated', () => {
  const make = (id,time,more={}) => ({fixture_id:id,match_date:time,home_team:'Home',away_team:'Away',locked:true,...more});
  const first = make(1,'2026-11-22T22:04:00Z'), last = make(2,'2026-11-23T21:59:59Z');
  const matches = [last, first, first, make(3,'2026-11-23T22:00:00Z'), {...first,fixture_id:4,free:true},
    {...first,fixture_id:5,locked:false}, {...first,fixture_id:6,away_team:' '}, {...first,fixture_id:null}];
  assert.deepEqual(selectLockedMatches({matches},'2026-11-23'),[first,last]);
  assert.deepEqual(selectLockedMatches(null,'2026-11-23'),[]);
});

test('compact list takes at most five unlocked current Bucharest fixtures with all three probabilities', () => {
  const row = (fixture_id, time) => ({fixture_id,match_date:`2026-11-23T${time}Z`,home_team:'A',away_team:'B',free:true,prob_home:.42,prob_draw:.27,prob_away:.31});
  const matches = [row(6,'18:00:00'), row(5,'16:00:00'), row(4,'15:00:00'), row(3,'14:00:00'),row(2,'13:00:00'),row(1,'12:00:00'),
    {...row(8,'20:00:00'),locked:true},{...row(9,'01:00:00'),free:false},row(10,'22:02:00'),{...row(11,'10:00:00'),prob_draw:null}];
  assert.deepEqual(selectFreeMatches({matches},'2026-11-23').map(m=>m.fixture_id),[1,2,3,4,5]);
  assert.deepEqual(selectFreeMatches({matches},'2026-11-24').map(m=>m.fixture_id),[10]);
  assert.deepEqual(selectFreeMatches({matches},'2026-11-25'),[]);
});

test('public sample rejects a stale day, a moved kickoff or an incomplete identity', () => {
  const today = '2026-11-23';
  const match = {fixture_id:24, match_date:'2026-11-23T20:00:00Z', home:'Home', away:'Away', league:'League'};
  const make = row => ({date:today,item:{match:row,provenance:{original_kickoff_utc:match.match_date}}});
  assert.equal(selectSample(make(match),today),match);
  assert.equal(selectSample(make(match),'2026-11-24'),null);
  assert.equal(selectSample(make({...match,match_date:'2026-11-23T19:00:00Z'}),today),null);
  assert.equal(selectSample(make({...match,league:''}),today),null);
  assert.equal(selectSample({date:today},today),null);
});

test('one homepage presents free fixtures, the daily Pro sample and subscriber fixtures before any offer', () => {
  const markup = html.match(/<main[^>]*data-compact-home[^>]*>[\s\S]*?<\/main>/)?.[0];
  assert(markup);
  const sections = [...markup.matchAll(/<section[^>]* id="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(sections,['dashboard','public-pro-demo','meciuri-cu-abonament']);
  for (const part of ['data-visitor-locked-first','data-visitor-locked-rest','data-visitor-locked-more','data-visitor-member-pro']) assert(markup.includes(part));
  assert(!html.includes('visitor-expanded'));
  const catalog = readFileSync(new URL('../meciuri.html',import.meta.url),'utf8');
  for (const [tier,id,price] of [['basic',28975826,5],['pro',28975836,20]]) {
    const plan = catalog.match(new RegExp('<article class="conversion-plan conversion-plan-'+tier+'">[\\s\\S]*?</article>'))?.[0];
    assert(plan?.includes('$'+price));
    assert(plan.includes('rid='+id) && plan.includes('data-conversion-tier="'+tier+'"'));
  }
  for (const link of ['meciuri.html#dashboard','meciuri.html#pro-analize','meciuri.html#abonament','track-record.html','metodologie.html']) assert(markup.includes('href="'+link+'"'));
  assert.match(markup,/data-i18n="banner.legal"/);
  const dictionary = JSON.parse(readFileSync(new URL('../assets/i18n.json',import.meta.url), 'utf8'));
  for (const [lang,words] of Object.entries(dictionary)) {
    for (const key of markup.matchAll(/data-i18n="([^"]+)"/g)) assert(words[key[1]],lang+':'+key[1]);
    assert(words['visitor.home.lockedMore'].includes('{n}'));
    assert(words['visitor.home.lockedLess']);
  }
});

test('the Pro selection follows the last chosen language while a previous report is loading', async () => {
  const renders = new Map(), events = {}, fields = new Map();
  const pick = {textContent:''};
  const card = {hidden:true,querySelector(selector) {
    if (selector === '[data-visitor-sample-pick]') return pick;
    if (!fields.has(selector)) fields.set(selector,{});
    return fields.get(selector);
  }};
  const document = {
    readyState:'complete',documentElement:{lang:'ro',classList:{add(){},toggle(){}}},
    querySelector:s=>s === '[data-compact-home]' ? {} : s === '[data-visitor-sample]' ? card : null,
    querySelectorAll:()=>[],getElementById:()=>null,addEventListener:(name,listener)=>{events[name]=listener;},
  };
  const now = '2026-11-23T12:00:00Z';
  const match = {fixture_id:42,home:'Home',away:'Away',league:'League',match_date:now};
  const window = {
    document,location:new URL('https://poseidonstats.com/'),addEventListener(){},
    setTimeout,clearTimeout,setInterval(){},fetch:async()=>({ok:true,json:async()=>({matches:[],generated_at:now})}),
    PoseidonDossier:{samplePayload:async()=>({date:'2026-11-23',item:{match,provenance:{original_kickoff_utc:now}}}),
      mountPublicSample:(_,marker,lang)=>new Promise(resolve=>renders.set(lang,resolve))},
  };
  class Clock extends Date { static now() {return Date.parse(now);} }
  runInNewContext(source,{window,Date:Clock,AbortController});
  const flush = () => new Promise(resolve=>setImmediate(resolve));
  await flush();
  assert(renders.has('ro'));
  const choose = async lang => {
    document.documentElement.lang = lang;
    events.change({target:{matches:()=>true}});
    await flush();
    assert(renders.has(lang),'started report in '+lang);
  };
  await choose('en');
  await choose('fr');
  renders.get('fr')({market:'marché français'});
  await flush();
  assert.equal(card.hidden,false);
  assert.equal(pick.textContent,'marché français');
  renders.get('en')({market:'English market'});
  renders.get('ro')({market:'selecție românească'});
  await flush();
  assert.equal(pick.textContent,'marché français');
});
