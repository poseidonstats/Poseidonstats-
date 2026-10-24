import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { incarcaPredictii } from '../assets/members.js';
const require=createRequire(import.meta.url);
const dashboard=require('../assets/home-dashboard.js');
let conversion={};
try { conversion=require('../assets/conversion.js'); } catch (error) { if(error.code!=='MODULE_NOT_FOUND') throw error; }

function environment(search='',storage=new Map()) {
  const timers=new Map(),listeners={},observers=[],calls=[];let timerId=0;
  const document={readyState:'complete',querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>null,
    addEventListener:(type,callback)=>{(listeners[type] ||= []).push(callback);}};
  const root={document,location:{pathname:'/',search,origin:'https://poseidonstats.com'},
    sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    setTimeout:callback=>{timers.set(++timerId,callback);return timerId;},clearTimeout:id=>timers.delete(id),
    addEventListener:(type,callback)=>{(listeners[type] ||= []).push(callback);},
    IntersectionObserver:class {constructor(callback){this.callback=callback;observers.push(this);}observe(){}unobserve(){}disconnect(){}}};
  const ready=()=>Object.assign(root.goatcounter,{
    get_data:vars=>({p:vars.path,r:'https://example.test/?email=person@example.test',t:vars.title,e:!!vars.event,q:root.location.search}),
    count(vars){calls.push(this.get_data(vars));}
  });
  return {root,calls,timers,listeners,observers,ready,runTimers(){let n=0;while(timers.size&&n<100){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();n++;}return n;}};
}
function link(attributes={},classes=[],ancestors={}) {
  const element={getAttribute:key=>attributes[key]??null,setAttribute:(key,value)=>{attributes[key]=value;},
    classList:{contains:value=>classes.includes(value)}};
  element.closest=selector=>selector==='a,button'?element:ancestors[selector]||null;
  return element;
}
function tracker(env) {
  assert.equal(typeof conversion.create,'function','anonymous funnel implementation exists');
  return conversion.create(env.root);
}

test('late GoatCounter receives queued pageview and intent once, after a privacy adapter is installed',()=>{
  const env=environment('?utm_source=discord&utm_campaign=launch&members_token=secret-token&email=person@example.test');
  const funnel=tracker(env);funnel.mount();funnel.track('plan-intent','hero','basic');
  assert.equal(env.root.goatcounter.no_onload,true);assert.equal(env.root.goatcounter.no_events,true);
  assert.equal(env.calls.length,0);
  env.ready();env.runTimers();funnel.flush();
  assert.deepEqual(env.calls.map(v=>v.p),['/','funnel/plan-intent/hero/basic']);
  for(const event of env.calls){assert.equal(event.q,'?utm_source=discord&utm_campaign=launch');assert.equal(event.r,'');}
  assert(!JSON.stringify(env.calls).includes('secret-token'));assert(!JSON.stringify(env.calls).includes('@'));
});

test('blocked or incompatible GoatCounter stops retrying and bounds pending events',()=>{
  const env=environment();const funnel=tracker(env);funnel.mount();
  for(let i=0;i<100;i++)funnel.track('plan-intent','hero','basic');
  const retries=env.runTimers();assert(retries>0&&retries<=20);assert.equal(env.timers.size,0);
  env.root.goatcounter.count=()=>assert.fail('no get_data privacy contract means no tracking');
  funnel.flush();assert.equal(env.runTimers(),0);
  env.ready();funnel.flush();assert(env.calls.length>0&&env.calls.length<=32);
});

test('a throwing counter cannot start an infinite retry loop or block navigation',()=>{
  const env=environment();const funnel=tracker(env);env.ready();let attempts=0;
  env.root.goatcounter.count=()=>{attempts++;throw Error('blocked');};
  assert.doesNotThrow(()=>funnel.mount());env.runTimers();assert(attempts<=21);assert.equal(env.timers.size,0);
});

test('campaign allowlists reject PII, tokens, long IDs, unexpected keys and arbitrary values',()=>{
  const env=environment('?utm_source=person%40example.test&utm_campaign=eyJtoken.123&utm_medium=email&members_token=x&utm_content=12345678901234567890&ref=secret');
  const funnel=tracker(env);env.ready();funnel.mount();
  assert.equal(env.calls[0].q,'?utm_medium=email');
  assert.equal(conversion.campaignQuery('?utm_campaign=launch&utm_source=discord&utm_medium=social&utm_content=hero'),'?utm_source=discord&utm_medium=social&utm_campaign=launch&utm_content=hero');
  assert.equal(conversion.campaignQuery('?utm_source=discord&utm_source=person%40example.test'),'');
  assert.equal(conversion.campaignQuery('?utm_campaign='+'a'.repeat(100)), '');
});

test('pageviews and events preserve only the safe http(s) referral origin, without credentials, paths or query PII',()=>{
  for(const [input,expected] of [
    ['https://www.google.com/search?q=person%40example.test&members_token=secret#fragment','https://www.google.com'],
    ['https://chatgpt.com/c/private-thread?email=person@example.test','https://chatgpt.com'],
    ['https://name:private-token@www.patreon.com/c/private-member?token=secret','https://www.patreon.com'],
    ['http://example.test/a?token=secret','http://example.test'],
    ['javascript:alert(1)',''],['data:text/plain,secret',''],['not a URL',''],['','']
  ]) {
    const env=environment();env.root.document.referrer=input;
    const funnel=tracker(env);env.ready();funnel.mount();funnel.track('plan-intent','hero');
    assert.equal(env.calls.length,2);
    for(const call of env.calls){assert.equal(call.r,expected);assert(!JSON.stringify(call).match(/private|person|secret|fragment|@/));}
  }
});

test('delegated clicks route every approved CTA with finite source/tier semantics and no payment claims',()=>{
  const env=environment();const funnel=tracker(env);env.ready();funnel.mount();funnel.mount();
  const cases=[
    [{'data-conversion':'plan-intent','data-conversion-source':'hero','data-conversion-tier':'basic',href:'#abonament'},[], 'funnel/plan-intent/hero/basic'],
    [{'data-conversion':'plan-outbound','data-conversion-source':'planstrip','data-conversion-tier':'basic',href:'https://www.patreon.com/checkout/PoseidonPredictions?rid=28975826'},[], 'funnel/plan-outbound/planstrip/basic'],
    [{'data-conversion':'plan-outbound','data-conversion-source':'legacy','data-conversion-tier':'pro',href:'https://www.patreon.com/checkout/PoseidonPredictions?rid=28975836'},[], 'funnel/plan-outbound/legacy/pro'],
    [{href:'https://poseidon-members.poseidonstats.workers.dev/login'},['members-login'],'funnel/login/legacy'],
    [{href:'#dashboard','data-conversion-source':'hero'},[], 'funnel/predictions/hero'],
    [{href:'#exemplu-pro','data-conversion-source':'dashboard'},[], 'funnel/sample/dashboard'],
    [{href:'track-record.html','data-conversion-source':'dashboard'},[], 'funnel/track-record/dashboard'],
    [{href:'metodologie.html','data-conversion-source':'header'},[], 'funnel/methodology/header'],
    [{href:'analize/index.html','data-conversion-source':'dashboard'},[], 'funnel/analyses/dashboard'],
    [{href:'#abonament'},['unlock-btn-basic'],'funnel/plan-intent/legacy/basic'],
    [{href:'#abonament'},['members-sub'],'funnel/plan-intent/legacy']
  ];
  for(const [attrs,classes,expected] of cases){
    const before=env.calls.length;env.listeners.click[0]({target:link(attrs,classes)});
    assert.equal(env.calls.length,before+1);assert.equal(env.calls.at(-1).p,expected);
  }
  assert.equal(env.listeners.click.length,1);
  const count=env.calls.length;
  env.listeners.click[0]({target:link({'data-conversion':'purchase','data-conversion-source':'email@example.test',href:'#x'})});
  funnel.track('payment','hero','pro');funnel.track('plan-intent','person@example.test','pro');
  assert.equal(env.calls.length,count);assert(!JSON.stringify(env.calls).match(/purchase|payment|@/));
});

test('real anonymous/Basic/Pro analysis actions and static feature/legacy anchors emit their navigation semantics',()=>{
  const env=environment();const funnel=tracker(env);env.ready();funnel.mount();
  for(const [tier,action] of [[null,'sample'],['basic','analyses'],['pro','analyses']]){
    const actual=dashboard.analysisAction(tier),element=link({href:actual.href},[],{'#dashboard':{}});
    const before=env.calls.length;env.listeners.click[0]({target:element});
    assert.equal(env.calls.length,before+1,`${tier || 'anonymous'} analysis CTA is counted`);
    assert.equal(env.calls.at(-1).p,`funnel/${action}/dashboard`);
    assert.equal(element.getAttribute('href'),actual.href,'tracking preserves the actual destination');
  }
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const feature=html.match(/<div class="dashboard-feature-strip">([\s\S]*?)<\/div>/)?.[1];
  const legacy=html.match(/<div class="legacy-links">([\s\S]*?)<\/div>/)?.[1];
  assert(feature&&legacy,'actual homepage CTA groups exist');
  const anchors=markup=>Array.from(markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g),match=>({attributes:Object.fromEntries(Array.from(match[1].matchAll(/([\w-]+)="([^"]*)"/g),value=>[value[1],value[2]])),body:match[2]}));
  const analysis=anchors(feature).find(value=>value.body.includes('data-i18n="nav.analize"'));
  const predictions=anchors(legacy).find(value=>value.attributes['data-i18n']==='hero.cta.primary');
  assert(analysis&&predictions,'real translated navigation actions exist');
  for(const [actual,ancestors,expected] of [[analysis,{'.dashboard-feature-strip':{}},'funnel/analyses/dashboard'],[predictions,{},'funnel/predictions/legacy']]){
    const before=env.calls.length,element=link(actual.attributes,[],ancestors);
    env.listeners.click[0]({target:element});assert.equal(env.calls.length,before+1);
    assert.equal(env.calls.at(-1).p,expected);assert.equal(element.getAttribute('href'),actual.attributes.href);
  }
});

test('explicit plan links including generated Pro CTAs use only verified fixed checkout URLs',()=>{
  const env=environment();const basic=link({href:'https://patreon.com/PoseidonPredictions'},['plan-btn-basic']);
  const pro=link({href:'https://patreon.com/PoseidonPredictions'},['pro-cta']);
  const combined=link({href:'#abonament'},['members-sub']);
  env.root.document.querySelectorAll=selector=>selector.includes('plan-btn')?[basic,pro,combined]:[];
  const funnel=tracker(env);env.ready();funnel.mount();
  assert.equal(basic.getAttribute('href'),'https://www.patreon.com/checkout/PoseidonPredictions?rid=28975826');
  assert.equal(pro.getAttribute('href'),'https://www.patreon.com/checkout/PoseidonPredictions?rid=28975836');
  assert.equal(combined.getAttribute('href'),'#abonament');
});

test('section impressions are once per logical section per session, even after repeat mounts',()=>{
  const storage=new Map();
  for(let visit=0;visit<2;visit++){
    const env=environment('',storage),section=link({'data-conversion-view':'pricing','data-conversion-source':'legacy'});
    env.root.document.querySelectorAll=selector=>selector==='[data-conversion-view]'?[section]:[];
    const funnel=tracker(env);env.ready();funnel.mount();funnel.mount();
    for(const observer of env.observers){observer.callback([{target:section,isIntersecting:true,intersectionRatio:.5}]);observer.callback([{target:section,isIntersecting:true,intersectionRatio:.5}]);}
    assert.equal(env.calls.filter(v=>v.p==='funnel/view/pricing/legacy').length,visit===0?1:0);
  }
});

test('a tall section uses its small heading for visibility and hidden member sections never count',()=>{
  const env=environment();env.root.innerHeight=568;const heading=link({});
  const section=link({'data-conversion-view':'dashboard','data-conversion-source':'dashboard'});
  section.getBoundingClientRect=()=>({height:2219});section.querySelector=()=>heading;
  let observed;
  env.root.IntersectionObserver=class {constructor(callback){this.callback=callback;env.observers.push(this);}observe(target){observed=target;}unobserve(){} };
  env.root.document.querySelectorAll=selector=>selector==='[data-conversion-view]'?[section]:[];
  const funnel=tracker(env);env.ready();funnel.mount();assert.equal(observed,heading);
  env.observers[0].callback([{target:heading,isIntersecting:false,intersectionRatio:0}]);
  assert(!env.calls.some(v=>v.p==='funnel/view/dashboard/dashboard'));
  env.observers[0].callback([{target:heading,isIntersecting:true,intersectionRatio:1}]);
  assert.equal(env.calls.filter(v=>v.p==='funnel/view/dashboard/dashboard').length,1);
});

test('Basic and Pro API success requires actual member API 200 plus parsed JSON, never JWT/classes',async()=>{
  for(const tier of ['basic','pro']){
    const env=environment();env.root.PoseidonMembers={tier:()=>tier};
    const funnel=tracker(env);env.ready();funnel.mount();
    assert(!env.calls.some(v=>v.p.includes('access')));
    const result=await incarcaPredictii({api:'https://member.test',token:'private-'+tier+'-jwt',publicUrl:'public.json',
      fetchImpl:async(url,options)=>{assert.equal(url,'https://member.test/api/predictions');assert.equal(options.headers.authorization,'Bearer private-'+tier+'-jwt');return new Response('{"matches":[]}',{status:200});},onAccess:funnel.access});
    assert.equal(result.sursa,'membru');assert.equal(env.calls.at(-1).p,'funnel/access-verified');
    assert(!JSON.stringify(env.calls).match(/private-|"pro"|"basic"|purchase|payment/));
  }
});

test('member API 401/403 and network failure preserve public fallback and report failures without private data',async t=>{
  const quiet=t.mock.method(console,'warn',()=>{});
  for(const status of [401,403,503,'network']){
    const env=environment();const funnel=tracker(env);env.ready();funnel.mount();let deleted=0;
    const result=await incarcaPredictii({api:'https://member.test',token:'private-jwt',publicUrl:'public.json',sterge:()=>deleted++,onAccess:funnel.access,
      fetchImpl:async url=>{if(url==='public.json')return new Response('{"public":true}');if(status==='network')throw Error('private detail');return new Response('{}',{status});}});
    assert.equal(result.sursa,'public');assert.equal(result.data.public,true);assert.equal(deleted,status===401||status===403?1:0);
    assert.equal(env.calls.at(-1).p,`funnel/access-failure/${status}`);
    assert(!env.calls.some(v=>v.p==='funnel/access-verified'));assert(!JSON.stringify(env.calls).includes('private'));
  }
  quiet.mock.restore();
});

test('existing app delegates once to the funnel instead of installing duplicate legacy listeners',()=>{
  const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
  const start=source.indexOf('function _instaleazaUrmarireClicuri() {'),end=source.indexOf('\nif (typeof document',start);
  let mounts=0,listeners=0;
  const context={window:{PoseidonConversion:{mount:()=>mounts++}},document:{addEventListener:()=>listeners++}};
  runInNewContext(source.slice(start,end)+'\n_instaleazaUrmarireClicuri();',context);
  assert.equal(mounts,1);assert.equal(listeners,0);
});

test('a failed local funnel script fails closed instead of falling through to raw-query legacy events',()=>{
  const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
  const start=source.indexOf('function _instaleazaUrmarireClicuri() {'),end=source.indexOf('\nif (typeof document',start);
  let listeners=0;
  const document={addEventListener:()=>listeners++,getElementById:()=>null,querySelector:selector=>selector.startsWith('script[')?{}:null};
  runInNewContext(source.slice(start,end)+'\n_instaleazaUrmarireClicuri();',{window:{},document});
  assert.equal(listeners,0);
});

test('browser bootstrap disables automatic counting before a late library and safely mounts once',()=>{
  const env=environment('?members_token=secret-token&utm_campaign=launch');env.root.document.readyState='loading';
  const source=readFileSync(new URL('../assets/conversion.js',import.meta.url),'utf8');
  runInNewContext(source,{window:env.root,URL,URLSearchParams,Set,Map});
  assert.equal(env.root.goatcounter.no_onload,true);assert.equal(env.root.goatcounter.no_events,true);
  env.ready();assert.equal(env.calls.length,0);
  env.listeners.DOMContentLoaded[0]();env.root.PoseidonConversion.mount();
  assert.equal(env.calls.length,1);assert.equal(env.calls[0].q,'?utm_campaign=launch');assert.equal(env.calls[0].r,'');
});

test('malformed member API 200 cannot produce a verified-access or payment event',async t=>{
  t.mock.method(console,'warn',()=>{});
  const env=environment();const funnel=tracker(env);env.ready();funnel.mount();
  const result=await incarcaPredictii({api:'https://member.test',token:'private-jwt',publicUrl:'public.json',onAccess:funnel.access,
    fetchImpl:async url=>new Response(url==='public.json'?'{}':'invalid JSON',{status:200})});
  assert.equal(result.sursa,'public');assert.equal(env.calls.at(-1).p,'funnel/access-failure/invalid-response');
  assert(!env.calls.some(v=>v.p==='funnel/access-verified'));
});

test('sample insertion targets relocated legacy pricing and retains old-page fallback',()=>{
  const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
  const start=source.indexOf('function puneRezumatInCaseta() {'),end=source.indexOf('\nfunction renderUnlockCta',start);
  for(const relocated of [true,false]){
    const queries=[],removed=[],inserted=[];
    const grid={insertAdjacentHTML:(where,html)=>inserted.push([where,html])};
    const document={querySelector:selector=>{queries.push(selector);return selector.includes('abonament-detalii')?(relocated?grid:null):grid;},querySelectorAll:selector=>{queries.push(selector);return [{remove:()=>removed.push(1)}];}};
    runInNewContext(source.slice(start,end)+'\npuneRezumatInCaseta();',{document,rezumatExemplu:()=>'<div>real existing sample</div>'});
    assert.equal(queries[0],'#abonament-detalii .plan-grid');assert.equal(removed.length,1);assert.equal(inserted[0][0],'beforebegin');
  }
});
