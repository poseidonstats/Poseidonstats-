import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const source = read('assets/home-visitor.js');
const markup = read('index.html');
const catalogMarkup = read('meciuri.html');
const app = read('assets/app.js');
const english = JSON.parse(read('assets/i18n.json')).en;

function pageBeforeDictionary(search, catalogPage = false) {
  function node(attrs = {}, textContent = '') {
    return {textContent, classList:{add(){},toggle(){}},
      getAttribute(name){return attrs[name] ?? null;},
      setAttribute(name,value){attrs[name]=value;}};
  }
  const location = new URL((catalogPage ? '/meciuri.html' : '/index.html') + search, 'https://poseidonstats.com/');
  const title = node({'data-page-title':'page.title.home'}, 'POSEIDON — Predicții fotbal');
  const html = Object.assign(node(),{lang:'ro'});
  const catalog = Object.assign(node({'data-i18n':'dashboard.predictions.all'}, 'Vezi toate predicțiile'),
    {href:'https://poseidonstats.com/meciuri.html?ref=home#dashboard'});
  const offer = Object.assign(node({'data-i18n':'nav.abonamente'}, 'Abonamente'),
    {href:'https://poseidonstats.com/meciuri.html#abonament'});
  const nav = node({'data-i18n-attr':'aria-label:dashboard.nav.label','aria-label':'Navigare'});
  const loading = node({'data-i18n':'loading'}, 'Se încarcă…');
  const external = {href:'https://example.com/offer#details'};
  const basic = node({'data-i18n':'conversion.basic.cta','href':'https://www.patreon.com/checkout/PoseidonPredictions?rid=28975826'}, 'Alege Basic');
  const pro = node({'data-i18n':'conversion.pro.cta','href':'https://www.patreon.com/checkout/PoseidonPredictions?rid=28975836'}, 'Alege Pro');
  const searchField = node({'data-i18n-attr':'placeholder:simplify.search.placeholder','placeholder':'Numele echipei'});
  const matchFilter = node({'data-i18n':'matchlist.halfShort'},'Gol la pauză');
  const hero = node({'data-i18n':'redesign.hero.title'},'Analizează meciurile zilei');
  const heroAction = node({'data-i18n':'redesign.hero.free'},'Vezi cele 5 predicții gratuite');
  const resultsLink = {href:'https://poseidonstats.com/istoric.html#rezultate-recente'};
  const document = {
    documentElement:html,readyState:'loading',addEventListener(){},
    querySelector(selector){
      if (selector===(catalogPage ? '[data-match-catalog]' : '[data-compact-home]')) return {};
      return selector==='title[data-page-title]' ? title : null;
    },
    querySelectorAll(selector){
      if (catalogPage && selector.startsWith('#home-nav ')) return [resultsLink,external];
      return {'[data-i18n]':[catalog,offer,loading,basic,pro,matchFilter,hero,heroAction],'[data-i18n-attr]':[nav,searchField],
        '[data-visitor-language]':[catalog,offer,external]}[selector] ?? [];
    },
  };
  const window = {document, location};
  runInNewContext(source,{window,URL,URLSearchParams});
  return {visitor:window.PoseidonVisitor,catalog,offer,external,nav,loading,title,html,basic,pro,searchField,matchFilter,hero,heroAction,resultsLink,window};
}

test('the first catalog and offer links work in explicit English without the dictionary', () => {
  const page = pageBeforeDictionary('?lang=en');
  const boot = markup.indexOf('window.PoseidonVisitor?.bootstrapLanguage()');
  assert(boot > markup.indexOf('data-visitor-catalog') && boot < markup.indexOf('<script src="assets/app.js?'));
  page.visitor.bootstrapLanguage();
  assert.equal(page.html.lang,'en');
  assert.equal(page.catalog.href,'https://poseidonstats.com/meciuri.html?ref=home&lang=en#dashboard');
  assert.equal(page.offer.href,'https://poseidonstats.com/meciuri.html?lang=en#abonament');
  assert.equal(page.external.href,'https://example.com/offer#details');
  assert.equal(page.catalog.textContent,english['dashboard.predictions.all']);
  assert.equal(page.offer.textContent,english['nav.abonamente']);
  assert.equal(page.loading.textContent,english.loading);
  assert.equal(page.nav.getAttribute('aria-label'),english['dashboard.nav.label']);
  assert.equal(page.title.textContent,english['page.title.home']);
});

test('other explicit editions keep their route, while missing or invalid parameters keep existing defaults', () => {
  for (const lang of ['ro','es','it','fr','id']) {
    const page = pageBeforeDictionary('?lang='+lang);
    page.visitor.bootstrapLanguage();
    assert.equal(new URL(page.offer.href).searchParams.get('lang'),lang);
    assert.equal(page.offer.textContent,'Abonamente','wait for the existing dictionary outside explicit EN');
  }
  for (const query of ['','?lang=xx']) {
    const page = pageBeforeDictionary(query);
    page.visitor.bootstrapLanguage();
    assert.equal(new URL(page.offer.href).searchParams.get('lang'),null);
    assert.equal(page.html.lang,'ro');
  }
});

test('English catalog search, market controls and checkout labels initialize without the dictionary', () => {
  const page = pageBeforeDictionary('?lang=en#abonament',true);
  const boot = catalogMarkup.indexOf('window.PoseidonVisitor?.bootstrapLanguage()');
  assert(boot > catalogMarkup.indexOf('id="abonament"') && boot < catalogMarkup.indexOf('<script src="assets/app.js?'));
  page.visitor.bootstrapLanguage();
  assert.equal(page.html.lang,'en');
  assert.equal(page.basic.textContent,english['conversion.basic.cta']);
  assert.equal(page.pro.textContent,english['conversion.pro.cta']);
  assert.equal(new URL(page.basic.getAttribute('href')).searchParams.get('rid'),'28975826');
  assert.equal(new URL(page.pro.getAttribute('href')).searchParams.get('rid'),'28975836');
  assert.equal(page.searchField.getAttribute('placeholder'),english['simplify.search.placeholder']);
  assert.equal(page.matchFilter.textContent,english['matchlist.halfShort']);
  assert.equal(page.hero.textContent,english['redesign.hero.title']);
  assert.equal(page.heroAction.textContent,english['redesign.hero.free']);
  assert.equal(page.resultsLink.href,'https://poseidonstats.com/istoric.html?lang=en#rezultate-recente');
  const translate = app.slice(app.indexOf('function t(key)'),app.indexOf('function updateNavigationLanguage()'));
  const t = runInNewContext(translate+'\nt',{I18N:null,LANG:'en',window:page.window});
  assert.equal(t('matchlist.oneMatch'),english['matchlist.oneMatch'],'dynamic table labels also use the fallback');
});

test('English fallback retries after consecutive HTTP failures without needing a browser online event', async () => {
  const timers = [], events = [];
  let requests = 0, renders = 0;
  const dictionary = JSON.parse(read('assets/i18n.json'));
  const bootstrap = app.slice(app.indexOf('let _i18nGataResolve'),app.indexOf('function mountLangSwitcher()'));
  const window = {PoseidonVisitor:{englishText:key=>english[key]},dispatchEvent:event=>events.push(event.type)};
  const context = {
    window,document:{hidden:false},I18N:null,LANG:'ro',I18N_URL:'/assets/i18n.json',
    LIMBI_SITE:Object.keys(dictionary),Event,detectLang:()=> 'en',
    fetchJSON:async()=>++requests > 2 ? dictionary : null,
    setTimeout(callback,delay){
      if (delay === 600) queueMicrotask(callback);
      else timers.push({callback,delay});
      return 1;
    },
    applyI18n(){renders++;},updateNavigationLanguage(){},puneRezumatInCaseta(){},
    mountLangSwitcher(){},loadLiveStats:async()=>{},injectLiveStats(){},refreshTranslatedViews(){},
  };
  await runInNewContext(bootstrap+'\ninitI18n()',context);
  assert.equal(requests,2);
  assert.equal(context.LANG,'en');
  assert.deepEqual(timers.map(timer=>timer.delay),[5000]);
  timers[0].callback();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests,3);
  assert.equal(renders,1);
  assert.deepEqual(events,['poseidon:dictionary-ready']);
  assert.equal(context.I18N,dictionary);
});

test('all compact homepage fallback labels match the maintained English dictionary', () => {
  const {groups:{copy}} = source.match(/const earlyEnglish = (?<copy>\{[\s\S]*?\n  \});/);
  const fallback = runInNewContext(`(${copy})`);
  const initialLabels = [...markup.matchAll(/data-i18n="([^"]+)"/g)].map(entry=>entry[1]);
  const dynamicLabels = [...source.matchAll(/'(visitor\.home\.[\w]+|dashboard\.data\.unavailable)'/g)].map(entry=>entry[1]);
  for (const key of new Set([...Object.keys(fallback),...initialLabels,...dynamicLabels])) {
    assert.ok(Object.hasOwn(fallback,key),`Missing early English label ${key}`);
    assert.equal(fallback[key],english[key],key);
  }
});
