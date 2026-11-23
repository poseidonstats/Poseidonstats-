import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
const require=createRequire(import.meta.url);
const dashboard=require('../assets/home-dashboard.js');
const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const dictionary=JSON.parse(readFileSync(new URL('../assets/i18n.json',import.meta.url),'utf8'));
const languages=['ro','en','es','it','fr','id'];

test('the hero shows both store badges under its actions without a separate English language link', () => {
  const homepage = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const hero = homepage.slice(homepage.indexOf('<section class="dashboard-opening">'), homepage.indexOf('id="dashboard"'));
  const downloads = hero.match(/class="dashboard-hero-actions">[\s\S]*?<\/div>\s*<div class="app-store-download">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(downloads, 'store badges directly follow the hero actions');
  assert.match(downloads, /href="https:\/\/apps\.apple\.com\/ro\/app\/poseidon-stats\/id6824537161"/);
  assert.match(downloads, /href="https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.poseidonstats\.app"/);
  assert.doesNotMatch(hero, /dashboard-language-entry|href="\/en\/predictions\/index\.html"/);
});

function actual(start,end) {
  const first=source.indexOf(start),last=source.indexOf(end,first+start.length);
  assert(first>=0 && last>first,`actual source boundaries: ${start}`);
  return source.slice(first,last);
}
test('a language in the membership link overrides the saved preference until the user chooses another', () => {
  const location={href:'https://poseidonstats.com/index.html?lang=en&ref=example#abonament',
    search:'?lang=en&ref=example'};
  const localStorage={getItem:()=> 'ro'};
  const history={state:{example:1}, replaceState(state, _title, url) {
    assert.equal(state,this.state);
    location.href=String(url);
    location.search=new URL(url).search;
  }};
  const ctx=createContext({location, localStorage, history, navigator:{language:'ro'}, URL, URLSearchParams});
  runInContext(actual('const LIMBI_SITE','function t('),ctx);
  assert.equal(runInContext('detectLang()',ctx),'en');
  runInContext('updateRouteLanguage("fr")',ctx);
  assert.equal(location.href,'https://poseidonstats.com/index.html?lang=fr&ref=example#abonament');
  assert.equal(runInContext('detectLang()',ctx),'fr');
  location.search='?lang=invalid';
  assert.equal(runInContext('detectLang()',ctx),'ro');
});
// Fixed authentic public fixture copied from the 2026-10-23 export.
// Used only to exercise static UI; no outcomes or statistical claims are inferred.
const fixture={
  "fixture_id": 1603063,
  "match_date": "2026-10-23T13:30:00Z",
  "country": "Saudi-Arabia",
  "league": "Pro League",
  "home_team": "Al-Faisaly FC",
  "away_team": "Al-Nassr",
  "xg_home": 1.3,
  "xg_away": 1.96,
  "prob_home": 0.266,
  "prob_draw": 0.209,
  "prob_away": 0.525,
  "prob_1x": 0.475,
  "prob_x2": 0.734,
  "prob_12": 0.791,
  "prob_over_1_5": 0.835,
  "prob_over_2_5": 0.642,
  "prob_over_3_5": 0.428,
  "prob_btts": 0.594,
  "prob_ht_over_0_5": 0.779,
  "prob_ht_over_1_5": 0.455,
  "ht_prob_home": 0.262,
  "ht_prob_draw": 0.369,
  "ht_prob_away": 0.369,
  "ht_top_score_h": 0,
  "ht_top_score_a": 0,
  "ht_top_score_prob": 0.228,
  "xg_home_ht": 0.66,
  "xg_away_ht": 0.84,
  "prob_over_2_5_raw": 0.627,
  "prob_btts_raw": 0.617,
  "top_score_h": 1,
  "top_score_a": 1,
  "top_score_prob": 0.098,
  "calibrated": true,
  "free": true
};

function renderer(language) {
  const context=createContext({
    I18N:dictionary,LANG:language,window:{innerWidth:1440},
    // Explicit UI-only tooltip state: no dataset, outcomes or production rules are changed.
    SCORECARD:{ui_test:{tier:'PICK',skill_stars:2,threshold:.75,lift_pp:5,hit_at_threshold:.8}}
  });
  runInContext([
    actual('function t(key) {','function applyI18n()'),
    actual('function tt(key, fallbackRo) {','function honestEmptyHtml('),
    actual('function pctClass(p) {','/* ============== Cifre vii'),
    actual('const PICK_PROB = {','/* ============== i18n'),
    actual('function nUnits(n) {','// 14 oct 2026 — rezumatul exemplului Pro'),
    actual('function pickBadge(name, prob, stars = 0) {','/* ============== Marcaj onestitate'),
    actual('const PROMOTED_MARKETS = [','/* Popover singleton'),
    actual('function xgBar(xgH, xgA) {','/* ============== TRACK RECORD')
  ].join('\n'),context);
  context.fixture=fixture;
  return {context,call:code=>runInContext(code,context)};
}

test('actual match cards and accessibility labels translate static UI and localize xG without changing its value', () => {
  let numbers;
  for (const language of languages) {
    const r=renderer(language),html=r.call('renderMatch(fixture)');
    for (const key of ['match.calibrated','match.phase.ft']) {
      assert(html.includes(dictionary[language][key]),`${language}.${key}`);
    }
    // Approved report replaces the collapsed legacy market grid with three tabs.
    const tabs={ro:['Prezentare','Goluri','Prima repriză'],en:['Overview','Goals','First half'],es:['Resumen','Goles','Primera parte'],it:['Panoramica','Gol','Primo tempo'],fr:['Vue d’ensemble','Buts','Première période'],id:['Ringkasan','Gol','Babak pertama']};
    const renderedTabs=Array.from(html.matchAll(/<button type="button" role="tab"[^>]*>([^<]+)<\/button>/g),m=>m[1]);
    assert.deepEqual(renderedTabs,tabs[language]);
    assert.equal((html.match(/role="tabpanel"/g)||[]).length,3);
    assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
    const xg=language==='en'?['1.30','1.96']:['1,30','1,96'];
    for (const value of ['27%','21%','53%','84%','64%','43%','59%','78%','46%',...xg,'1–1']) assert(html.includes(value),`${language} preserves ${value}`);
    const uncalibrated=r.call('renderMatch({...fixture,calibrated:false})');
    assert(uncalibrated.includes(dictionary[language]['match.uncalibrated']));
    const locked=r.call('renderLockedMatch({...fixture,locked:true})');
    assert(locked.includes(`aria-label="${dictionary[language]['match.locked']}"`));
    const expectedDate=new Date(fixture.match_date).toLocaleString(r.call('_loc()'),{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Bucharest'});
    assert(html.includes(expectedDate),`${language} date locale keeps Bucharest timezone`);
    assert(locked.includes(expectedDate));
    const values=Array.from(html.matchAll(/class="(?:val[^"\n]*|lead-pct|score-val|score-pct)">([^<]+)</g),m=>m[1]);
    if (!numbers) numbers=values;else assert.deepEqual(values,numbers,'translations preserve all numeric values and score output');
    assert(html.includes(fixture.home_team) && html.includes(fixture.away_team));
  }
});

test('actual tooltip renderers translate raw/calibration/skill text and keep attribute boundaries valid', () => {
  const fill=(text,vars)=>Object.entries(vars).reduce((value,[key,replacement])=>value.split(`{${key}}`).join(String(replacement)),text);
  for (const language of languages) {
    const r=renderer(language),d=dictionary[language];
    const raw=r.call('rawNote(.9,.8)');
    assert(raw.includes(d['match.raw']));
    assert(raw.includes('90%'));
    for (const [kind,key,pct] of [['raw','market.warn.raw',null],['eligible','market.warn.eligible',null],['eligible','market.warn.eligible.pct',72],['below','market.warn.below',null],['below','market.warn.below.pct',68]]) {
      const expected=fill(d[key],{pct});
      const html=r.call(`warnMark(${JSON.stringify(kind)},${pct})`);
      const attributes=Object.fromEntries(Array.from(html.matchAll(/(title|aria-label|data-tip)="([^"]*)"/g),m=>[m[1],m[2]]));
      assert.deepEqual(attributes,{'data-tip':expected,title:expected,'aria-label':expected});
    }
    const badge=r.call('pickBadge("Over 1.5",.83,2)');
    assert(badge.includes(`title="${fill(d['match.pick.tip'],{name:'Over 1.5',prob:'83%',stars:2})}"`));
    const skill=r.call('skillMark("ui_test",.9)');
    assert(skill.includes(`title="${fill(d['match.skill.tip'],{stars:2,lift:5,hit:'80%'})}"`));
    for (const key of ['match.pick.tip','match.skill.tip','match.locked','match.xg.tip','market.warn.eligible','market.warn.eligible.pct','market.warn.below','market.warn.below.pct']) assert(!d[key].includes('"'),`${language}.${key} contains no attribute-breaking quote`);
  }
});

test('homepage market filters use translated labels and homepage assets use their expected release versions', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for (const market of ['btts','1x2','dc_1x','dc_x2','dc_12']) {
    const tag=Array.from(html.matchAll(/<option\b[^>]*>/g),m=>m[0]).find(value=>value.includes(`value="${market}"`));
    const key=tag?.match(/data-i18n="([^"]+)"/)?.[1];
    assert.equal(key,`filters.market.${market}`);
    for (const language of languages) assert(dictionary[language][key]);
  }
  const release='20261123-grouped-matches-r2';
  for (const asset of ['country-label.js','app.js','member-dossier.js','member-dossier.css','home-dashboard.js','home-watchlist.js','home-modern.css','conversion.js']) {
    assert(html.includes(`assets/${asset}?release=${release}`));
  }
  const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
  for (const asset of ['i18n.json','pro-report.js']) {
    assert(app.includes(`assets/${asset}?release=${release}`));
  }
  const worker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert(worker.includes(`const RELEASE = "${release}";`));
  const releaseHashes=worker.match(/const RELEASE_ASSET_SHA256 = \{([\s\S]*?)\n\};/)?.[1] ?? '';
  for (const asset of ['country-label.js','app.js','member-dossier.js','member-dossier.css','home-dashboard.js','home-watchlist.js','home-modern.css','conversion.js','pro-report.js','pro-report.css','pro-context.js','members.js','home-watchlist.js','conversion.js']) {
    const bytes=readFileSync(new URL(`../assets/${asset}`,import.meta.url));
    const digest=createHash('sha256').update(bytes).digest('hex');
    assert(releaseHashes.includes(`"assets/${asset}": "${digest}"`), `Update the service worker release for ${asset}`);
  }
  assert(html.includes(`assets/members.js?release=${release}`));
  // The per-metric TEST-N honesty contract superseded reading-frozen1. Check the current asset and cache key together.
  const readingSource=readFileSync(new URL('../assets/citire.js',import.meta.url),'utf8');
  assert(readingSource.includes('nN(t.familia)') && readingSource.includes('nN(t.interval)') && readingSource.includes('nN(t.directia)'));
  assert(html.includes('assets/citire.js?v=20261024-onestitate3'));
  assert(!html.includes('assets/citire.js?v=20261024-reading-frozen1'));
});

test('approved presentation keys are translated in every locale with matching placeholders', () => {
  const keys=Object.keys(dictionary.ro).filter(key=>key.startsWith('redesign.') || key.startsWith('approved.') || key.startsWith('matchlist.'));
  assert(keys.includes('redesign.edition.basicSummary'));
  assert(keys.includes('redesign.edition.backMatch'));
  assert(keys.includes('approved.audit.period'));
  for (const language of languages) for (const key of keys) {
    const translated=dictionary[language][key];
    assert(translated?.trim(), `${language}: ${key}`);
    const placeholders=text=>[...text.matchAll(/\{\w+\}/g)].map(match=>match[0]).sort();
    assert.deepEqual(placeholders(translated),placeholders(dictionary.ro[key]),`${language}: ${key}`);
  }
});

test('historical proof notice stays singular, translates on rerender, and links to the current audit', () => {
  function node(tag) {
    const result={tag,attributes:{},children:[],className:'',setAttribute:(key,value)=>{result.attributes[key]=value;},appendChild:child=>result.children.push(child)};
    let text='';Object.defineProperty(result,'textContent',{get:()=>text,set:value=>{text=value;result.children=[];}});return result;
  }
  const parent={children:[],insertBefore:(notice,reference)=>{assert.equal(reference,metrics);parent.children.unshift(notice);}};
  const metrics={parentNode:parent};parent.children.push(metrics);
  const document={querySelector:selector=>selector==='.proof-metrici'?metrics:parent.children.find(value=>value.className?.includes('dashboard-proof-note')),createElement:node};
  for (const language of ['ro','ro','en','fr','id','it','es']) {
    dashboard.ensureProofNotice(document,key=>dictionary[language][key]);
    const notices=parent.children.filter(value=>value.className?.includes('dashboard-proof-note'));
    assert.equal(notices.length,1);
    assert.equal(parent.children[0],notices[0]);
    assert.equal(notices[0].textContent,dictionary[language]['proof.previous.note']+' ');
    assert.equal(notices[0].children.length,1);
    assert.equal(notices[0].children[0].attributes.href,'track-record.html');
    assert.equal(notices[0].children[0].textContent,dictionary[language]['proof.previous.link']);
  }
});
