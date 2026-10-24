import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createContext, runInContext } from 'node:vm';
const require = createRequire(import.meta.url);
const dashboard = require('../assets/home-dashboard.js');
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const predictions = read('data/predictions.json');
const history = read('data/history.json');
const audit = read('data/audit.json');
const i18n = read('assets/i18n.json');
const tr = key => i18n.en[key] || key;

test('KPI values come directly from their distinct real source samples', () => {
  const metrics = dashboard.extractMetrics(audit, history);
  const record = history.cumulated_markets.find(m => m.name === 'Over 1.5');
  const market = audit.piete.find(m => m.cheie === 'over_1_5');
  assert.equal(metrics.resolved, audit.n_rezolvate);
  assert.equal(metrics.auditedMarkets, audit.piete.length);
  assert.equal(metrics.brier, market.brier);
  assert.equal(metrics.brierN, market.n);
  assert.equal(metrics.hit, record.hit_pct);
  assert.equal(metrics.n, record.n);
  assert.equal(metrics.wlo, record.wlo_pct);
  assert.equal(record.n, record.wins + record.losses);
  // Samples are selected by their own source keys; their sizes may coincide on a future export.
});

test('real recent journal sums resolved selections chronologically, never pending or profit', () => {
  const points = dashboard.cumulativeResolved(history);
  const sorted = history.days.filter(d => d.totals.wins + d.totals.losses > 0).sort((a,b) => a.date.localeCompare(b.date));
  let independentSum = 0;
  assert.equal(points.length, sorted.length);
  if (!sorted.length) {
    assert.deepEqual(points,[]);
    assert.match(dashboard.renderChart(points,tr,'en-GB','test-chart'),/Data temporarily unavailable/);
    return;
  }
  for (let i = 0; i < sorted.length; i++) {
    independentSum += sorted[i].totals.wins + sorted[i].totals.losses;
    assert.equal(points[i].date, sorted[i].date);
    assert.equal(points[i].cumulative, independentSum);
  }
  const partialDays=sorted.filter(day => ['partial','in_progress'].includes(day.status)).map(day => day.date);
  assert.deepEqual(points.filter(p => p.partial).map(p => p.date),partialDays);
  const chart = dashboard.renderChart(points,tr,'en-GB','test-chart');
  const number=new Intl.NumberFormat('en-GB').format(independentSum);
  const date=day=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'Europe/Bucharest'}).format(new Date(day+'T12:00:00Z'));
  assert(chart.includes(number));
  assert(chart.includes(date(sorted[0].date)));
  assert(chart.includes(date(sorted[sorted.length-1].date)));
  if (partialDays.length) assert.match(chart,/Partial days/);
  assert.doesNotMatch(chart,/profit/i);
});

test('public real rows preserve exact probabilities and prioritize free chronological matches', () => {
  const days = dashboard.availableDays(predictions);
  const firstPublic=predictions.matches.find(m => m.free === true && m.locked !== true);
  const sourceDay=firstPublic ? dashboard.dayOf(firstPublic.match_date) : days[0] || '';
  const day=sourceDay ? dashboard.chooseDay(days,new Date(sourceDay+'T12:00:00Z')) : dashboard.chooseDay(days);
  assert.equal(day,sourceDay);
  const selection = dashboard.selectRows(predictions, day);
  const free = predictions.matches.filter(m => m.free === true && !m.locked && dashboard.dayOf(m.match_date) === day).sort((a,b) => Date.parse(a.match_date)-Date.parse(b.match_date));
  assert.equal(selection.free, free.length);
  assert.equal(selection.rows.length,Math.min(7,selection.total));
  assert.deepEqual(selection.rows.slice(0,Math.min(7,free.length)).map(r => r.fixture_id),free.slice(0,7).map(m => m.fixture_id));
  for (const row of selection.rows) {
    const original = predictions.matches.find(m => m.fixture_id === row.fixture_id);
    assert.equal(row.home,original.home_team);
    if (!row.locked) assert.deepEqual(row.probabilities,[original.prob_home,original.prob_draw,original.prob_away]);
    else assert.deepEqual(row.probabilities,[null,null,null]);
  }
});

test('locked preview stays identity-only and preserves escaped full hover identities', () => {
  const fixture = { matches:[{fixture_id:1,match_date:'2026-10-23T14:00:00Z',home_team:'<script>alert(1)</script>',away_team:'A & B',country:'C <D>',league:'L "x"',locked:true,free:true,prob_home:.999,prob_draw:.001,prob_away:0}] };
  const rows = dashboard.selectRows(fixture,'2026-10-23').rows;
  assert.deepEqual(rows[0].probabilities,[null,null,null]);
  const html = dashboard.renderRows(rows,tr,'en-GB');
  assert.doesNotMatch(html, /99\.9%|0\.1%|<script>/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/A &amp; B/);
  assert.equal((html.match(/>—<\/td>/g)||[]).length,3);
  assert.match(html,/dashboard-lock/);
  assert(html.includes('title="&lt;script&gt;alert(1)&lt;/script&gt; – A &amp; B"'));
  assert(html.includes('title="C &lt;D&gt; · L &quot;x&quot;"'));
});

test('compact chart layouts retain full data descriptions and readable undistorted SVG labels', () => {
  const points=[{date:'2026-10-21',resolved:10,cumulative:10,partial:false},{date:'2026-10-22',resolved:20,cumulative:30,partial:true}];
  for (const width of [560,340]) {
    const html=dashboard.renderChart(points,tr,'en-GB',`chart-${width}`,{width,height:95});
    assert(html.includes(`viewBox="0 0 ${width} 95"`));
    assert(html.includes('preserveAspectRatio="xMidYMid meet"'));
    assert(html.includes('font-size="12"'));
    assert(html.includes('21 Oct – 22 Oct. 30.'));
    assert.match(html,/Partial days/);
  }
});

test('Bucharest date boundaries and absent-current-day fallback use available dates', () => {
  assert.equal(dashboard.dayOf('2026-10-23T22:30:00Z'),'2026-10-24');
  const days = ['2026-10-23','2026-10-25'];
  assert.equal(dashboard.chooseDay(days,new Date('2026-10-24T10:00:00Z')),'2026-10-25');
  assert.equal(dashboard.chooseDay(days,new Date('2026-11-01T10:00:00Z')),'2026-10-25');
  assert.equal(dashboard.chooseDay([],new Date('2026-10-23T10:00:00Z')),'');
  assert.equal(dashboard.dayOf('invalid'),'');
});

test('date and league filters return only matching real identities', () => {
  const source = predictions.matches.find(m => m.free) || predictions.matches[0];
  if (!source) {assert.deepEqual(dashboard.selectRows(predictions,'').rows,[]);return;}
  const selected = dashboard.selectRows(predictions,dashboard.dayOf(source.match_date),source.league);
  assert(selected.rows.length > 0);
  assert(selected.rows.every(m => m.league === source.league && dashboard.dayOf(m.match_date) === dashboard.dayOf(source.match_date)));
  assert.deepEqual(dashboard.selectRows(predictions,'1999-01-01').rows,[]);
});

test('missing exports raise errors, missing metrics remain null instead of becoming invented zero', () => {
  assert.throws(() => dashboard.selectRows(null,'2026-10-23'), /Missing public predictions/);
  assert.throws(() => dashboard.extractMetrics(null,history), /Missing public audit/);
  assert.throws(() => dashboard.cumulativeResolved(null), /Missing public journal/);
  const incomplete = dashboard.extractMetrics({n_rezolvate:0,piete:[]},{cumulated_markets:[]});
  assert.equal(incomplete.hit,null);
  assert.equal(incomplete.brier,null);
  assert.equal(incomplete.resolved,0);
  const source = {matches:[{match_date:'2026-10-23T09:00:00Z',free:true,prob_home:null,prob_draw:'0.2',prob_away:NaN}]};
  assert.deepEqual(dashboard.selectRows(source,'2026-10-23').rows[0].probabilities,[null,null,null]);
});

test('fixture links reset legacy filters before selecting source UTC date, league and zero threshold', () => {
  const calls = [];
  const elements = Object.fromEntries(['filter-day','filter-league','filter-minprob'].map(id => [id,{value:'stale',dispatchEvent:event => calls.push([id,event.type])}]));
  elements['filter-reset']={click:()=>calls.push(['reset'])};
  dashboard.revealMatch({getElementById:id=>elements[id]}, {match_date:'2026-10-23T22:30:00Z',league:'Test league'});
  assert.deepEqual(calls[0],['reset']);
  assert.equal(elements['filter-day'].value,'2026-10-23');
  assert.equal(elements['filter-league'].value,'Test league');
  assert.equal(elements['filter-minprob'].value,'0');
  assert.equal(calls.length,4);
});

test('all six dictionaries preserve original values except the explicitly authorized hero title and fully translate new dashboard keys', () => {
  const original = JSON.parse(execFileSync('git',['show','HEAD:assets/i18n.json'],{encoding:'utf8',cwd:new URL('..',import.meta.url)}));
  const heroTitles = {
    ro:'Statistici avansate<br>pentru <span>decizii corecte</span>',
    en:'Advanced statistics<br>for <span>correct decisions</span>',
    es:'Estadísticas avanzadas<br>para <span>decisiones correctas</span>',
    it:'Statistiche avanzate<br>per <span>decisioni corrette</span>',
    fr:'Statistiques avancées<br>pour <span>des décisions correctes</span>',
    id:'Statistik mendalam<br>untuk <span>keputusan yang tepat</span>'
  };
  const keys = Object.keys(i18n.ro).filter(key => key.startsWith('dashboard.')).sort();
  assert(keys.length >= 47);
  for (const lang of ['ro','en','es','it','fr','id']) {
    for (const [key,value] of Object.entries(original[lang])) {
      if (key !== 'dashboard.hero.title') assert.equal(i18n[lang][key],value,`${lang}.${key}`);
    }
    assert.equal(i18n[lang]['dashboard.hero.title'],heroTitles[lang]);
    assert.deepEqual(Object.keys(i18n[lang]).filter(key => key.startsWith('dashboard.')).sort(),keys);
    for (const key of keys) assert.equal(typeof i18n[lang][key],'string');
    for (const key of ['dashboard.sources.title','dashboard.illustration','dashboard.why.title','dashboard.nav.login']) assert(i18n[lang][key]?.trim(),`${lang}.${key}`);
    assert.match(i18n[lang]['dashboard.kpi.hit'], /Over 1.5 ≥75%/);
    assert(i18n[lang]['dashboard.table.rawnote'].startsWith('1/X/2'));
  }
});

test('compact KPI disclosure and right-side summaries preserve each real source sample', async () => {
  const kpis = [{innerHTML:''},{innerHTML:''}], summary = {innerHTML:''};
  const charts=[{innerHTML:'',clientWidth:334},{innerHTML:'',clientWidth:334}];
  let resize;
  const doc = {
    documentElement:{lang:'en'},
    defaultView:{innerWidth:390,addEventListener:(type,callback)=>{if(type==='resize') resize=callback;}},
    querySelector:selector => selector === '[data-dashboard-kpis]' ? kpis[0] : null,
    querySelectorAll:selector => selector === '[data-dashboard-kpis]' ? kpis : selector === '[data-dashboard-chart]' ? charts : [],
    getElementById:id => id === 'dashboard-track-summary' ? summary : null,
    addEventListener:()=>{}
  };
  const previousFetch=globalThis.fetch, previousT=globalThis.t;
  globalThis.fetch=async path => path === 'analize/index.html' ? {ok:false} : {ok:true,json:async()=>({'data/predictions.json':predictions,'data/history.json':history,'data/audit.json':audit})[path]};
  globalThis.t=tr;
  try {
    await dashboard.mount(doc);
    const record=history.cumulated_markets.find(m => m.name === 'Over 1.5');
    const brierSample=audit.piete.find(m => m.cheie === 'over_1_5');
    const num=n=>new Intl.NumberFormat('en-GB').format(n);
    for (const panel of kpis) {
      assert.equal((panel.innerHTML.match(/class="dashboard-kpi"/g)||[]).length,4);
      const details=panel.innerHTML.match(/<details class="dashboard-kpi-context dashboard-source-context">([\s\S]*?)<\/details>/)?.[1];
      assert(details,'source/sample disclosure remains available beside compact values');
      assert(details.includes(tr('dashboard.sources.title')));
      for (const value of [audit.de_la,audit.pana_la,audit.generat_la,`N=${num(record.n)}`,`Wlo 95%=${num(record.wlo_pct)}%`,`N=${num(brierSample.n)}`,tr('dashboard.kpi.lower')]) assert(details.includes(value),value);
      for (const path of ['data/audit.json','data/history.json']) assert(details.includes(`href="${path}"`));
      assert.doesNotMatch(panel.innerHTML.split('<details')[0],/<small>/,'compact cards defer their notes to the disclosure');
    }
    assert.equal((summary.innerHTML.match(/class="dashboard-market-summary"/g)||[]).length,3);
    for (const value of [num(record.n),`${num(record.wlo_pct)}%`,num(brierSample.n),audit.generat_la]) assert(summary.innerHTML.includes(value),value);
    assert(summary.innerHTML.includes(tr('dashboard.track.context').replace('{date}',audit.generat_la)));
    assert(charts.every(chart=>chart.innerHTML.includes('viewBox="0 0 334 160"')),'mobile charts keep viewport-matched label sizing');
    doc.defaultView.innerWidth=1440;charts[0].clientWidth=560;charts[1].clientWidth=340;
    resize();
    assert(charts[0].innerHTML.includes('viewBox="0 0 560 95"'));
    assert(charts[1].innerHTML.includes('viewBox="0 0 340 95"'));
  } finally {
    globalThis.fetch=previousFetch;
    if (previousT === undefined) delete globalThis.t; else globalThis.t=previousT;
  }
});

test('fetch failure renders a visible unavailable state and calls only local public files', async () => {
  // Explicit minimal DOM/network mocks; no production requests or browser dependencies.
  const table = {innerHTML:''}, status = {textContent:''}, kpis = [{textContent:''},{textContent:''}], charts = [{innerHTML:''},{innerHTML:''}];
  const doc = {
    documentElement:{lang:'en'},
    querySelector:selector => selector === '[data-dashboard-kpis]' ? kpis[0] : null,
    querySelectorAll:selector => selector === '[data-dashboard-kpis]' ? kpis : selector === '[data-dashboard-chart]' ? charts : [],
    getElementById:id => ({'dashboard-predictions':table,'dashboard-table-status':status})[id] || null,
    addEventListener:()=>{}
  };
  const requests = [];
  const previousFetch = globalThis.fetch, previousT = globalThis.t;
  globalThis.fetch = async path => {requests.push(path);throw new Error('Explicit unavailable-export mock');};
  globalThis.t = tr;
  try {
    await dashboard.mount(doc);
    assert.match(table.innerHTML,/Data temporarily unavailable/);
    assert.match(status.textContent,/Public data could not load/);
    assert(kpis.every(k => k.textContent === tr('dashboard.data.unavailable')));
    assert(charts.every(chart => /Data temporarily unavailable/.test(chart.innerHTML)));
    assert.deepEqual(requests,['data/predictions.json','data/history.json','data/audit.json','analize/index.html']);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousT === undefined) delete globalThis.t; else globalThis.t = previousT;
  }
});

test('navigation and date accessibility labels use attribute-only translations in all six languages', () => {
  const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const nav = html.match(/<nav\b[^>]*>/)?.[0];
  const date = Array.from(html.matchAll(/<select\b[^>]*>/g), m => m[0]).find(tag => /\bid="dashboard-date"/.test(tag));
  for (const [tag,key] of [[nav,'dashboard.nav.label'],[date,'filters.day']]) {
    assert(tag,'actual control opening tag exists');
    const mapping = tag.match(/\bdata-i18n-attr="([^"]+)"/)?.[1];
    assert(mapping,'control uses supported data-i18n-attr mapping');
    const attrs = Object.fromEntries(mapping.split(',').map(pair => pair.split(':').map(s=>s.trim())));
    assert.equal(attrs['aria-label'],key);
    assert.doesNotMatch(tag,/\sdata-i18n=/,'translation must not replace children');
    for (const lang of ['ro','en','es','it','fr','id']) assert(i18n[lang][key]?.trim(),`${lang}.${key}`);
  }
  assert.match(nav,/aria-label="Navigare principală"/);
  assert.match(date,/aria-label="Zi:"/);
});

test('analysis actions route anonymous, Basic and Pro visitors to accessible existing destinations', () => {
  assert.deepEqual(dashboard.analysisAction(null),{href:'#exemplu-pro',key:'dashboard.analysis.read',sample:true});
  assert.deepEqual(dashboard.analysisAction('basic'),{href:'analize/index.html',key:'dashboard.analysis.readarchive',sample:false});
  assert.deepEqual(dashboard.analysisAction('pro'),{href:'#pro-analize',key:'dashboard.analysis.member',sample:false});
  const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for (const state of [null,'basic','pro']) {
    const action=dashboard.analysisAction(state);
    if (action.href.startsWith('#')) assert(html.includes(`id="${action.href.slice(1)}"`));
    for (const lang of ['ro','en','es','it','fr','id']) assert(i18n[lang][action.key]?.trim(),`${lang}.${action.key}`);
  }
});

test('asynchronous membership class transitions refresh analysis routing without private requests', () => {
  const classes = new Set();
  const body = {classList:{contains:cls=>classes.has(cls)}};
  let callback, watched, options;
  class ObserverStub {
    constructor(cb) {callback=cb;}
    observe(target,opts) {watched=target;options=opts;}
  }
  const routes=[];
  const render=()=>routes.push(dashboard.analysisAction(dashboard.membershipTier(body)).href);
  render();
  dashboard.observeMembership(body,render,ObserverStub);
  assert.equal(watched,body);
  assert.deepEqual(options,{attributes:true,attributeFilter:['class']});
  classes.add('is-member');classes.add('tier-basic');callback();
  classes.add('unrelated-page-class');callback();
  classes.delete('tier-basic');classes.add('tier-pro');callback();
  classes.clear();callback();
  assert.deepEqual(routes,['#exemplu-pro','analize/index.html','#pro-analize','#exemplu-pro']);
});

test('analysis language fallback is explicit for missing Italian, but absent for available French and Indonesian', () => {
  const languages=['ro','en','es','fr','id'];
  assert.deepEqual(dashboard.chooseAnalysisLanguage('fr',languages),{language:'fr',fallback:false});
  assert.deepEqual(dashboard.chooseAnalysisLanguage('id',languages),{language:'id',fallback:false});
  assert.deepEqual(dashboard.chooseAnalysisLanguage('it',languages),{language:'en',fallback:true});
  assert.deepEqual(dashboard.chooseAnalysisLanguage('it',['ro']),{language:'ro',fallback:true});
  assert.deepEqual(dashboard.chooseAnalysisLanguage('it',[]),{language:null,fallback:true});
  assert.equal(dashboard.analysisLanguageNotice({language:'fr',fallback:false},tr),'');
  assert.equal(dashboard.analysisLanguageNotice({language:'en',fallback:true},tr),'Analysis content is available in English.');
  assert.equal(dashboard.analysisLanguageNotice({language:'ro',fallback:true},tr),'Analysis content is available in Romanian.');
  assert.equal(dashboard.analysisLanguageNotice({language:null,fallback:true},tr),tr('dashboard.data.unavailable'));
});

test('language switcher gets translated attribute-only labels, including late-created controls', () => {
  const attrs={};let select=null,callback,disconnected=false,observed;
  const nav={};
  const doc={querySelectorAll:selector=>selector==='.lang-select'&&select?[select]:[],querySelector:selector=>selector==='header nav'?nav:null};
  class ObserverStub {
    constructor(cb) {callback=cb;}
    observe(target,options) {observed=[target,options];}
    disconnect() {disconnected=true;}
  }
  dashboard.watchLanguageSelector(doc,tr,ObserverStub);
  assert.deepEqual(observed,[nav,{childList:true,subtree:true}]);
  select={setAttribute:(key,value)=>{attrs[key]=value;}};
  callback();
  assert.equal(attrs['data-i18n-attr'],'aria-label:dashboard.language.label');
  assert.equal(attrs['aria-label'],'Language');
  assert.equal(disconnected,true);
  dashboard.decorateLanguageSelector(doc,key=>i18n.fr[key]);
  assert.equal(attrs['aria-label'],'Langue');
  assert.equal(attrs['data-i18n'],undefined);
});

test('concise login decoration preserves destination and full accessible labels after late insertion and language changes', () => {
  const attributes={href:'https://members.invalid/login','data-i18n':'members.login'};
  let visible=tr('members.login'), textWrites=0, inserted=false, callback, watched, options;
  const link={
    getAttribute:key=>attributes[key],
    setAttribute:(key,value)=>{attributes[key]=value;},
    get textContent() {return visible;},
    set textContent(value) {visible=value;textWrites++;}
  };
  const bar={};
  const doc={querySelectorAll:selector=>selector === '.members-login' && inserted ? [link] : [],getElementById:id=>id === 'members-bar' ? bar : null};
  class ObserverStub {constructor(cb) {callback=cb;} observe(target,opts) {watched=target;options=opts;}}
  let language='en';
  const translate=key=>i18n[language][key];
  dashboard.watchMemberLogin(doc,translate,ObserverStub);
  assert.equal(watched,bar);
  assert.deepEqual(options,{childList:true,subtree:true});
  inserted=true;callback();
  assert.equal(attributes.href,'https://members.invalid/login');
  assert.equal(visible,'Sign in');
  assert.equal(attributes['data-i18n'],'dashboard.nav.login');
  assert.equal(attributes['data-i18n-attr'],'aria-label:members.login,title:members.login');
  assert.equal(attributes['aria-label'],i18n.en['members.login']);
  assert.equal(attributes.title,i18n.en['members.login']);
  callback();
  assert.equal(textWrites,1,'an unchanged label cannot trigger an observer text-mutation loop');
  language='fr';dashboard.decorateMemberLogin(doc,translate);
  assert.equal(visible,'Connexion');
  assert.equal(attributes['aria-label'],i18n.fr['members.login']);
  assert.equal(attributes.title,i18n.fr['members.login']);
  assert.equal(attributes.href,'https://members.invalid/login');
});

test('dashboard translations keep correct-decision/evaluated terminology and preserve markup and placeholders', () => {
  assert.equal(i18n.id['dashboard.hero.title'],'Statistik mendalam<br>untuk <span>keputusan yang tepat</span>');
  for (const [lang,words] of [['es',['Predicciones evaluadas','Selecciones evaluadas']],['it',['Previsioni valutate','Selezioni valutate']],['fr',['Prédictions évaluées','Sélections évaluées']]]) {
    assert.equal(i18n[lang]['dashboard.kpi.resolved'],words[0]);
    assert(i18n[lang]['dashboard.chart.title'].startsWith(words[1]));
    assert.doesNotMatch(i18n[lang]['dashboard.chart.total'],/resueltas|risolte|réglées/);
  }
  for (const key of Object.keys(i18n.ro).filter(key=>key.startsWith('dashboard.'))) {
    const tokens = text => ({variables:(text.match(/\{\w+\}/g)||[]).sort(),tags:text.match(/<\/?[^>]+>/g)||[]});
    for (const lang of ['en','es','it','fr','id']) assert.deepEqual(tokens(i18n[lang][key]),tokens(i18n.ro[key]),`${lang}.${key}`);
  }
});

test('new dashboard and header links avoid member-hidden intro targets', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const start=html.indexOf('<header>'), end=html.indexOf('<div class="dashboard-detail-heading">');
  assert(start >= 0 && end > start);
  const newUI=html.slice(start,end);
  const marketAnchor=Array.from(newUI.matchAll(/<a\b[^>]*>/g),m=>m[0]).find(tag=>/data-i18n="dashboard\.track\.market"/.test(tag));
  assert(marketAnchor);
  assert.match(marketAnchor,/href="track-record\.html"/);
  const allowed=new Set(['dashboard','dashboard-analyses','abonament','abonament-detalii','matches','intrebari']);
  const introStart=html.indexOf('<section class="intro">');
  assert(introStart >= 0);
  let depth=0,introEnd=-1;
  for (const match of html.slice(introStart).matchAll(/<\/?section\b[^>]*>/g)) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {introEnd=introStart+match.index+match[0].length;break;}
  }
  assert(introEnd > introStart);
  for (const match of newUI.matchAll(/<a\b[^>]*\bhref="#([^"]+)"[^>]*>/g)) {
    const id=match[1];
    if (id === 'exemplu-pro') {
      assert.match(match[0], /class="conversion-visitor-proof"/);
      const css=readFileSync(new URL('../assets/home-modern.css',import.meta.url),'utf8');
      assert.match(css,/body\.home-modern\.tier-basic[^{}]*\.conversion-visitor-proof[^{}]*\{ display: none; \}/);
      assert.match(css,/body\.home-modern\.tier-pro \.conversion-plans \{ display: none; \}/);
      continue;
    }
    assert(allowed.has(id),`new fragment #${id} must stay in the member-visible set`);
    const target=Array.from(html.matchAll(/<[a-z][^>]*\bid="([^"]+)"[^>]*>/g)).find(m=>m[1]===id);
    assert(target,`target #${id} exists`);
    assert(target.index < introStart || target.index >= introEnd,`#${id} is outside the intro hidden for members`);
  }
});

test('service worker shell includes homepage assets once and leaves external or non-GET requests alone', () => {
  const current=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const handlers=new Map();
  const context=createContext({
    URL,
    self:{location:{origin:'https://preview.invalid'},addEventListener:(type,handler)=>handlers.set(type,handler)},
    caches:{},
    fetch:()=>{throw new Error('No network call permitted in this service-worker unit test');}
  });
  runInContext(current,context);
  assert.match(runInContext('CACHE',context),/^poseidon-v\d+$/);
  const shell=Array.from(runInContext('SHELL',context));
  for (const asset of ['./assets/home-modern.css','./assets/home-dashboard.js']) {
    assert.equal(shell.filter(value=>value===asset).length,1);
    assert(readFileSync(new URL('../'+asset.slice(2),import.meta.url)).length>0);
  }
  assert.deepEqual([...handlers.keys()],['install','activate','fetch']);
  for (const request of [{url:'https://external.invalid/api/data',method:'GET'},{url:'https://preview.invalid/member',method:'POST'}]) {
    handlers.get('fetch')({request,respondWith:()=>assert.fail('must not intercept external or non-GET requests')});
  }
});


test('explicit synthetic public fixture preserves finite probabilities when daily exports have no free rows', () => {
  // UI unit fixture only; these values are never presented as real match predictions.
  const fixture={matches:[{fixture_id:1,match_date:'2026-10-23T12:00:00Z',home_team:'Test home',away_team:'Test away',league:'Test league',free:true,prob_home:.6,prob_draw:.25,prob_away:.15}]};
  const selected=dashboard.selectRows(fixture,'2026-10-23');
  assert.equal(selected.rows.length,1);
  assert.equal(selected.free,1);
  assert.equal(selected.rows[0].locked,false);
  assert.deepEqual(selected.rows[0].probabilities,[.6,.25,.15]);
});

test('demonstration and honest evidence precede truthful plans and activation', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const hero=html.indexOf('<div class="dashboard-hero">');
  const plans=html.indexOf('<section class="conversion-plans" id="abonament"');
  const dashboardIndex=html.indexOf('id="dashboard"');
  const evidence=html.indexOf('<section class="simplify-evidence">');
  const activation=html.indexOf('<section class="simplify-activation">');
  assert(hero >= 0 && hero < dashboardIndex && dashboardIndex < evidence && evidence < plans && plans < activation);
  const strip=html.slice(plans,activation);
  assert.match(strip,/conversion-plan-free[\s\S]*conversion-price">\$0</);
  assert.match(strip,/conversion-plan-basic[\s\S]*conversion-price">\$5 /);
  assert.match(strip,/conversion-plan-pro[\s\S]*conversion-price">\$20 /);
  for (const [tier,rid] of [['basic','28975826'],['pro','28975836']]) {
    const tag=Array.from(strip.matchAll(/<a\b[^>]*>/g),m=>m[0]).find(tag=>tag.includes(`data-conversion-tier="${tier}"`));
    assert(tag);
    assert(tag.includes(`href="https://www.patreon.com/checkout/PoseidonPredictions?rid=${rid}"`));
    assert(tag.includes(`plan-btn-${tier}`));
    assert(tag.includes('data-conversion="plan-outbound"'));
    assert(tag.includes('data-conversion-source="planstrip"'));
  }
  assert.match(strip,/<a href="#dashboard"[^>]*data-i18n="conversion.free.cta"/);
  assert.match(strip,/<a href="#exemplu-pro"[^>]*data-dashboard-analysis/);
  assert.match(strip,/<a href="analize\/index.html" class="conversion-member-proof"/);
  assert.match(html,/<section class="plans" id="abonament-detalii" data-conversion-view="pricing">/);
  for (const id of ['abonament','abonament-detalii','exemplu-pro','dashboard']) assert.equal((html.match(new RegExp(`\\bid="${id}"`,'g'))||[]).length,1,id);
});

test('conversion labels are complete in six languages and legacy dictionary values stay unchanged', () => {
  const original=JSON.parse(execFileSync('git',['show','HEAD:assets/i18n.json'],{encoding:'utf8',cwd:new URL('..',import.meta.url)}));
  const keys=Object.keys(i18n.ro).filter(key=>key.startsWith('conversion.')).sort();
  assert(keys.length >= 14);
  const tokens=text=>({variables:(text.match(/\{\w+\}/g)||[]).sort(),tags:text.match(/<\/?[^>]+>/g)||[]});
  for (const lang of ['ro','en','es','it','fr','id']) {
    for (const [key,value] of Object.entries(original[lang])) assert.equal(i18n[lang][key],value,`${lang}.${key}`);
    assert.deepEqual(Object.keys(i18n[lang]).filter(key=>key.startsWith('conversion.')).sort(),keys);
    for (const key of keys) {
      assert(i18n[lang][key].trim(),`${lang}.${key}`);
      assert.deepEqual(tokens(i18n[lang][key]),tokens(i18n.ro[key]),`${lang}.${key}`);
    }
    assert.match(i18n[lang]['conversion.free.body'],/5/);
    assert.match(i18n[lang]['conversion.note'],/\bUSD\b/);
  }
});

test('conversion member visibility, privacy script order and numeric display contracts are retained', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../assets/home-modern.css',import.meta.url),'utf8');
  const scripts=Array.from(html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g),m=>({tag:m[0],src:m[1],index:m.index}));
  const bootstrap=scripts.find(script=>script.src.startsWith('assets/conversion.js?'));
  const counter=scripts.find(script=>script.src==='//gc.zgo.at/count.js');
  assert(bootstrap && counter && bootstrap.index < counter.index);
  assert.doesNotMatch(bootstrap.tag,/\b(?:async|defer)\b/);
  const privacy=counter.tag.match(/data-goatcounter-settings='([^']+)'/)?.[1];
  assert(privacy,'static analytics safety defaults survive a failed conversion-module load');
  assert.deepEqual(JSON.parse(privacy),{no_onload:true,no_events:true});
  const member=scripts.find(script=>script.src.startsWith('assets/members.js?'));
  const app=scripts.find(script=>script.src.startsWith('assets/app.js?'));
  assert(member.index < app.index);
  assert.match(css,/body\.home-modern\.tier-pro \.conversion-plans \{ display: none; \}/);
  assert.match(css,/body\.home-modern\.tier-basic[^{}]*\.conversion-plan-free[^{}]*\.conversion-plan-basic[^{}]*\{ display: none; \}/);
  assert.match(css,/body\.home-modern\.tier-basic[^{}]*\.conversion-member-proof[^{}]*\{ display: inline; \}/);
  assert.match(css,/body\.home-modern\.tier-pro #abonament-detalii[^{}]*\.support-cta[^{}]*\{ display: none; \}/);
  assert.match(css,/\.dashboard-hero-evidence \{ display: none; \}/);
  assert.equal((html.match(/\bdata-dashboard-kpis\b/g)||[]).length,2);
  assert.equal((html.match(/\bdata-dashboard-chart\b/g)||[]).length,2);
  assert.match(css,/\.dashboard-col-time \{ width: 48px; \}/);
  assert.match(css,/\.dashboard-col-prob \{ width: 56px; \}/);
  assert.match(css,/td\.dashboard-prob \{ overflow: visible; white-space: nowrap; text-overflow: clip; \}/);
  assert.match(css,/\.home-modern \.simplify-demo \.dashboard-table th:nth-child\(2\),\s*\.home-modern \.simplify-demo \.dashboard-table td\.dashboard-team \{ text-align: left; \}/);
  assert.match(css,/body\.home-modern \.salt-meciuri \{ display: none; \}/);
});

test('long original content and metric mounts remain reachable inside named closed disclosures', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const stack=[],ranges=[];
  for (const match of html.matchAll(/<details\b[^>]*>|<\/details\s*>/g)) {
    if (match[0].startsWith('</')) {
      const opening=stack.pop();assert(opening,'balanced details close');ranges.push({...opening,end:match.index+match[0].length});
    } else stack.push({tag:match[0],start:match.index});
  }
  assert.equal(stack.length,0,'all details are balanced');
  const disclosure=id=>{
    const found=ranges.filter(item=>item.tag.includes(`id="${id}"`));assert.equal(found.length,1,id);
    assert.doesNotMatch(found[0].tag,/\sopen(?:\s|=|>)/,`${id} starts closed`);
    const body=html.slice(found[0].start,found[0].end);assert.match(body,/<summary[^>]*data-i18n="simplify\.[^"]+"/);return body;
  };
  const metrics=disclosure('dashboard-evidence-details');
  assert.equal((metrics.match(/\bdata-dashboard-kpis\b/g)||[]).length,2);
  assert.equal((metrics.match(/\bdata-dashboard-chart\b/g)||[]).length,2);
  assert(metrics.includes('id="dashboard-track-summary"'));
  const full=disclosure('full-predictions-details');
  for (const id of ['filter-day','filter-market','filter-league','filter-reset','match-count','matches']) assert(full.includes(`id="${id}"`),id);
  const legacy=disclosure('legacy-information-details');
  for (const name of ['PRO_SAMPLE_CARD','PRO_TODAY_LIST','PROOF_STATIC','DAILY_STATIC','LEAGUES_LINKS']) {
    assert(legacy.includes(`<!-- ${name}_START -->`));assert(legacy.includes(`<!-- ${name}_END -->`));
  }
  for (const id of ['exemplu-pro','dovada','repere-azi','abonament-detalii','intrebari','dashboard-analyses']) assert(legacy.includes(`id="${id}"`),id);
  assert(disclosure('discord-access-details').includes('id="acces"'));
  assert.match(html,/<div data-dashboard-pro-summary><\/div>/);
  assert.match(html,/<a href="https:\/\/poseidon-members\.poseidonstats\.workers\.dev\/login"[^>]*class="gold-button simplify-activation-login"[^>]*data-conversion="login"/);
  const login=html.match(/<a[^>]*class="gold-button simplify-activation-login"[^>]*>/)[0];assert(!login.includes('members-login'));
});

test('search, league choice, honest copy and activation labels are complete without rewriting existing translations', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const original=JSON.parse(execFileSync('git',['show','HEAD:assets/i18n.json'],{encoding:'utf8',cwd:new URL('..',import.meta.url)}));
  const keys=Object.keys(i18n.ro).filter(key=>key.startsWith('simplify.')).sort();assert(keys.length>=19);
  for (const lang of ['ro','en','es','it','fr','id']) {
    assert.deepEqual(Object.keys(i18n[lang]).filter(key=>key.startsWith('simplify.')).sort(),keys);
    for (const [key,value] of Object.entries(original[lang])) assert.equal(i18n[lang][key],value,`${lang}.${key}`);
    for (const key of keys) {
      assert(i18n[lang][key].trim(),`${lang}.${key}`);
      const tags=text=>text.match(/<\/?[^>]+>/g)||[];
      assert.deepEqual(tags(i18n[lang][key]),tags(i18n.ro[key]),`${lang}.${key}`);
    }
  }
  assert.match(html,/<input id="dashboard-search" type="search"[^>]*data-i18n-attr="placeholder:simplify.search.placeholder,aria-label:simplify.search.label"/);
  assert.match(html,/<button id="dashboard-search-clear" type="button" data-i18n="simplify.search.clear"/);
  assert.match(html,/<select id="dashboard-league-menu"[^>]*data-i18n-attr="aria-label:simplify.leagues.label"/);
});
