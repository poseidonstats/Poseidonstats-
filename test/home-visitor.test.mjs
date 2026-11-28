import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const require = createRequire(import.meta.url);
const {compactRoute, selectFreeMatches, selectLockedMatches, selectSample} = require('../assets/home-visitor.js');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../assets/home-visitor.js', import.meta.url), 'utf8');

function publishedFeed(generated_at) {
  const date = generated_at.slice(0,10);
  const base = {fixture_id:1,match_date:date+'T16:00:00Z',home_team:'Free '+date,away_team:'Opponent',league:'L'};
  return {generated_at, n_matches:3, freemium:{free:1, locked:2},matches:[
    {...base,free:true,prob_home:.44,prob_draw:.3,prob_away:.26},
    {...base,fixture_id:2,home_team:'Locked '+date,locked:true},
    {...base,fixture_id:3,home_team:'Future row in old export',match_date:date+'T23:00:00Z',locked:true},
  ]};
}

function mockFeed(start, render = false, members, lang = 'en') {
  let now = Date.parse(start);
  const requests = [], published = [];
  const elements = new Map();
  function node(tag) {
    return {tag,dataset:{},children:[],attributes:{},textContent:'',querySelector:field,append(...children){this.children.push(...children);},
      get childElementCount(){return this.children.length;},replaceChildren(...children){this.children = children;},
      setAttribute(key,value){this.attributes[key]=value;},insertAdjacentHTML(_,html){this.children.push(html);}};
  }
  function field(selector) {
    if (!elements.has(selector)) elements.set(selector,node());
    return elements.get(selector);
  }
  const document = {documentElement:{lang,classList:{add(){},toggle(){}}},readyState:'loading',
    addEventListener(){},querySelector:render ? field : ()=>null,createElement:node};
  const window = {
    document,location:new URL('https://poseidonstats.com/'),setTimeout,clearTimeout,t:key=>key,PoseidonMembers:members,
    fetch(path,options) {
      return new Promise(resolve => requests.push({path,options,resolve}));
    },
    PoseidonDossier:{setPublicPredictions(data){published.push(data);},
      publicFixtureIds:()=>new Set([1]),button:()=>'<button>Open dossier</button>'},
  };
  class Clock extends Date { static now() { return now; } }
  runInNewContext(source,{window,URLSearchParams,AbortController,Date:Clock});
  return {load:window.PoseidonVisitor.loadPublicPredictions,requests,published,field,advance:time=>{now=Date.parse(time);}};
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
  const today = publishedFeed('2026-11-23T10:00:00Z');
  requests[1].resolve({ok:true,json:async()=>today});
  assert.equal(await retry,today);
  assert.equal(await load(),today);
  assert.equal(requests.length,2);
  const refresh = load(true);
  requests[2].resolve({ok:true,json:async()=>publishedFeed('2026-11-22T10:00:00Z')});
  assert.equal(await refresh,today);
  assert.deepEqual(published,[today]);
});

test('a late response for the previous Bucharest day cannot replace the new day', async () => {
  const {load,requests,published,advance} = mockFeed('2026-11-23T21:59:59Z');
  const previous = load();
  advance('2026-11-23T22:00:01Z');
  const next = load();
  const today = publishedFeed('2026-11-24T00:00:00Z');
  today.generated_at = '2026-11-23T22:00:00Z';
  requests[1].resolve({ok:true,json:async()=>today});
  requests[0].resolve({ok:true,json:async()=>publishedFeed('2026-11-23T10:00:00Z')});
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

test('a guest can choose the Basic checkout on each locked fixture, including the expanded list', async () => {
  const today = '2026-11-23', feed = publishedFeed(today+'T03:25:00Z');
  for (const fixture_id of [4,5,6]) feed.matches.push({...feed.matches[1],fixture_id,home_team:'Club '+fixture_id});
  feed.n_matches += 3;
  feed.freemium.locked += 3;
  function links(node) {
    return node.tag === 'a' ? [node] : (node.children || []).flatMap(links);
  }
  async function fixtureLinks(inBrowserAt, members, lang) {
    const {load,field,requests} = mockFeed(inBrowserAt,true,members,lang);
    const more = field('[data-visitor-locked-more]');
    more.dataset.day = today;
    more.open = true;
    const pending = load();
    requests[0].resolve({ok:true,json:async()=>feed});
    await pending;
    return ['[data-visitor-locked-first]','[data-visitor-locked-rest]'].flatMap(selector=>links(field(selector)));
  }
  const now = today+'T08:00:00Z';
  assert.match((await fixtureLinks(now,undefined,'ro'))[0].textContent,/Basic.+5 USD\/lună/,'price is readable before the dictionary loads');
  const offers = await fixtureLinks(now);
  assert.equal(offers.length,4,'each current locked match has a subscription link');
  const teams = ['Locked '+today,'Club 4','Club 5','Club 6'];
  for (const [index,link] of offers.entries()) {
    assert.equal(link.href,'https://www.patreon.com/checkout/PoseidonPredictions?rid=28975826');
    assert.equal(link.target,'_blank');
    assert.match(link.rel,/\bnoopener\b/);
    assert.equal(link.dataset.conversion,'plan-outbound');
    assert.equal(link.dataset.conversionSource,'locked-match');
    assert.equal(link.dataset.conversionTier,'basic');
    assert.match(link.textContent,/Basic.+5/);
    assert(link.attributes['aria-label'].includes(teams[index]));
  }
  for (const members of [{tier:()=>'basic'}, {tier:()=>'pro'}, {webFreeDay:()=>today}]) {
    assert.equal((await fixtureLinks(now,members)).length,0,'existing access does not ask for another subscription');
  }
  assert.equal((await fixtureLinks('2026-11-24T10:00:00Z')).length,0,'yesterday’s edition is not sold as a current prediction');
});

test('login returns to the selected member prediction once, only for a current paid fixture', async () => {
  const key = 'poseidon.basic.match', today = '2026-11-28';
  const landing = readFileSync(new URL('../membru.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const match = {fixture_id:12,match_date:today+'T09:00:00Z',home_team:'A',away_team:'B'};
  const storage = () => {const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
  class Clock extends Date { static now(){return Date.parse(today+'T08:00:00Z');} }
  async function login(pending,token='test') {
    const localStorage=storage(),sessionStorage=storage();
    localStorage.setItem(key,JSON.stringify(pending));
    const location={search:token?'?members_token='+token:'',replace(url){this.url=url;}};
    await runInNewContext(landing,{localStorage,sessionStorage,navigator:{language:'ro'},window:{},location,URLSearchParams,Date:Clock,
      document:{documentElement:{},querySelector:()=>({})}});
    return {location,localStorage,sessionStorage};
  }
  const selected={edition:today,fixture:12};
  assert(!(await login(selected,'')).location.url.includes('meciuri.html'));
  assert(!(await login({...selected,edition:'2026-11-27'})).location.url.includes('meciuri.html'));
  assert(!(await login({...selected,fixture:'bad'})).location.url.includes('meciuri.html'));
  async function resume(selectedMatch,memberRows) {
    const {location,localStorage,sessionStorage}=await login(selectedMatch);
    assert.match(location.url,/^\/meciuri\.html\?v=\d+#meci-ales$/);
    assert.equal(localStorage.getItem(key),null);
    const opened=[],focused=[];
    const document={readyState:'loading',documentElement:{classList:{add(){},toggle(){}}},addEventListener(){},
      querySelector:()=>({focus(){focused.push(true);},scrollIntoView(){}})};
    const window={document,location:new URL(location.url,'https://poseidonstats.com'),sessionStorage,
      history:{replaceState(){}},PoseidonDashboard:{revealMatch:(_,row)=>opened.push(row.fixture_id)}};
    runInNewContext(source,{window,Date:Clock,URLSearchParams});
    const data=memberRows ? {matches:memberRows} : null;
    window.PoseidonVisitor.resumeBasicMatch(data);
    window.PoseidonVisitor.resumeBasicMatch(data);
    assert.equal(sessionStorage.getItem(key),null);
    return [opened,focused.length];
  }
  assert.deepEqual(await resume(selected,[match]),[[12],1]);
  assert.deepEqual(await resume(selected,null),[[],0]);
  assert.deepEqual(await resume(selected,[{...match,fixture_id:13}]),[[],0]);
  assert.deepEqual(await resume(selected,[{...match,match_date:'2026-11-27T09:00:00Z'}]),[[],0]);
  assert.deepEqual(await resume(selected,[{...match,locked:true}]),[[],0]);
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

test('the homepage keeps the daily Pro sample, archived plan comparison and subscriber fixtures distinct', () => {
  const markup = html.match(/<main[^>]*data-compact-home[^>]*>[\s\S]*?<\/main>/)?.[0];
  assert(markup);
  const sections = [...markup.matchAll(/<section[^>]* id="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(sections,['dashboard','public-pro-demo','comparatie-basic-pro','meciuri-cu-abonament']);
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
    assert.match(words['visitor.home.unlockBasic'],/Basic.*5.*Patreon/);
  }
});

test('the public Basic and Pro comparison works without the daily sample and links to the archived fixture', () => {
  const section = html.match(/<section id="comparatie-basic-pro"([^>]*)>([\s\S]*?)<\/section>/);
  assert(section, 'the comparison is present in the initial HTML');
  assert.doesNotMatch(section[1], /\bhidden\b|data-visitor-sample/);
  const content = section[2];
  for (const key of ['basic','basicText','pro','proText','result','archive']) {
    assert.match(content,new RegExp('data-i18n="comparison\\.' + key + '"[^>]*>[^<]+<'));
  }
  const archiveLink = content.match(/href="(analize\/(\d{4}-\d{2}-\d{2})\.html)#(m\d+)"/);
  assert(archiveLink,'the reader can jump directly to the match in its original edition');
  assert(content.includes('datetime="' + archiveLink[2] + '"'));
  const archive = readFileSync(new URL('../' + archiveLink[1],import.meta.url),'utf8');
  assert(archive.includes('id="' + archiveLink[3] + '"'),'the fixture is in the linked archive');
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

test('at Bucharest midnight a refresh serves the published edition with its date, no next-day locks and no old free dossier',async()=>{
  const previous = publishedFeed('2026-11-23T03:25:00Z');
  const {load,field,advance,requests} = mockFeed('2026-11-23T21:59:59Z',true);
  async function reply(body,refresh=false) {
    const pending = load(refresh);
    requests.at(-1).resolve({ok:true,json:async()=>body});
    return pending;
  }
  const status = field('[data-visitor-status]');
  await reply(previous);
  assert.equal(status.hidden,true);
  assert.equal(field('[data-visitor-matches]').children[0].children.length,3); // Time, clickable name and arrow.
  advance('2026-11-23T22:00:01Z');
  await reply(previous);
  function verifyPrevious(input) {
    assert.equal(input('[data-visitor-today]').dateTime,'2026-11-23');
    assert.equal(input('[data-visitor-status]').dataset.i18n,'visitor.home.previousEdition');
    assert.equal(input('[data-visitor-status]').hidden,false);
    const free = input('[data-visitor-matches]').children;
    const locked = input('[data-visitor-locked-first]').children;
    assert.equal(free.length,1);
    assert.equal(free[0].children.length,2); // No clickable dossier for yesterday.
    assert.equal(free[0].children[1].children[1].textContent,'Free 2026-11-23 – Opponent');
    assert.equal(locked.length,1);
    assert.equal(locked[0].children[1].children[1].textContent,'Locked 2026-11-23 – Opponent');
    assert.match(input('[data-visitor-locked-count]').textContent,/23 November/);
  }
  verifyPrevious(field);
  // A new tab sees the same edition when the morning export is delayed until noon.
  const fresh = mockFeed('2026-11-24T10:00:00Z',true);
  const first = fresh.load();
  fresh.requests[0].resolve({ok:true,json:async()=>previous});
  await first;
  verifyPrevious(fresh.field);
  advance('2026-11-24T10:00:00Z');
  const next = publishedFeed('2026-11-24T09:30:00Z');
  for (const invalid of [{...next, matches:[]}, {...next, generated_at:'invalid'},
       {...next, generated_at:'2026-11-24T19:00:00Z'}, {...next, matches:previous.matches}]) {
    assert.equal(await reply(invalid,true),previous);
    verifyPrevious(field);
  }
  assert.equal(await reply(next,true),next);
  assert.equal(status.hidden,true);
  assert.equal(field('[data-visitor-today]').dateTime,'2026-11-24');
  assert.equal(field('[data-visitor-matches]').children[0].children.length,3);
  assert.equal(field('[data-visitor-locked-first]').children[0].children[1].children[1].textContent,'Locked 2026-11-24 – Opponent');
  assert.equal(await reply(publishedFeed('2026-11-24T05:00:00Z'),true),next);
  assert.equal(await reply(previous,true),next);
});
