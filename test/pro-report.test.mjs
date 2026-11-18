import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import report from '../assets/pro-report.js';
import protectedContext from '../assets/pro-context.js';
import {proSample,plain,marketProbability} from './helpers/pro-sample.mjs';
const source=readFileSync(new URL('../analize/2026-11-16.html',import.meta.url),'utf8');
const bodies=[...source.matchAll(/<div class="pro-visible">([\s\S]*?)\n      <\/div>\n    <\/article>/g)].map(m=>m[1]);

test('dossier shows verified counts and similar estimates for the exact official market and match', t=>{
 t.mock.method(protectedContext,'marketFrequency',()=>[{name:'Away',home:false,n:5,hits:3}]);
 globalThis.PoseidonProContext=protectedContext;
 t.after(()=>{delete globalThis.PoseidonProContext;});
 const day='2026-11-18',cutoff='2026-11-18T05:20:00Z';
 const record={key:'over_1_5',fixture_id:123,date:day,from:'2026-10-31',to:'2026-11-17',as_of:cutoff};
 const item={match:{fixture_id:123},site_published_at_utc:'2026-11-18T06:00:00Z',provenance:{
  original_kickoff_utc:'2026-11-18T14:00:00Z',generated_at_utc:cutoff,inputs:{picks:[{rol:'Principal',key:'over_1_5',p:79.5}]}},
  league_record:{...record,criteria:'verified_league_ft90_v1',league_id:7,season:2026,phase:'2. Lig White Group',hits:31,settled:45},
  pro_market_record:{...record,criteria:'verified_pro_primary_ft90_v1',hits:19,settled:24,band:{min_pct:78,max_pct:82,hits:7,settled:9}}};
 const render=(override={})=>report.dossierReport('',{...item,...override},null,day,'ro');
 const markup=render();
 assert.match(markup,/Pronostic publicat înainte de meci[\s\S]*Peste 1,5 goluri în meci · 79,5%/);
 assert.match(markup,/Liga, grupa albă<\/b> · 31 din 45 de meciuri \(68,89\s*%\)/);
 assert.match(markup,/19 din 24 decontate/);
 assert.match(markup,/Estimări similare \(78–82%\) · 7 din 9/);
 assert.match(markup,/Away în deplasare · 3 din 5/);
 assert.match(render({site_published_at_utc:'2026-11-18T14:00:00Z'}),/Pronostic arhivat/);
 assert.match(render({site_published_at_utc:undefined}),/Pronostic arhivat/);
 for(const patch of [{key:'over_2_5'},{fixture_id:124},{date:'2026-11-17'},{to:day},{as_of:'2026-11-18T06:00:00Z'}]){
  const rejected=render({pro_market_record:{...item.pro_market_record,...patch}});
  assert.doesNotMatch(rejected,/19 din 24|Estimări similare/);
  assert.match(rejected,/aceeași piață<\/b> · Date indisponibile/);
 }
 const empty=render({pro_market_record:{...item.pro_market_record,hits:0,settled:0}});
 assert.match(empty,/0 selecții eligibile/);
 assert.doesNotMatch(empty,/0 din 0|NaN|Estimări similare/);
});
test('real six-language archive retains source, probabilities and loss in each report',()=>{
 assert.equal(bodies.length,12);
 for(const html of bodies){
  const r=report.sections(html);assert.equal(r.original,html);assert.equal(r.thesis.length,1);assert.equal(r.context.length,1);assert.equal(r.evidence.length,1);assert.equal(r.review.length,1);
  const review=report.cleanReview(r.review[0]);
  assert.equal((review.match(/<tr>/g)||[]).length,(r.review[0].match(/<tr>/g)||[]).length);
  for(const value of r.review[0].match(/\d+(?:[.,]\d+)?%/g)||[])assert(review.includes(value));
  assert(review.includes('arhiva.semn.nu'),'historical losing selections remain visible');
 }
});
test('leading labels removed without touching market, percent, team or argument',()=>{
 for(const label of ['Base','Main','Bold','Bază','Principal','Principale','Audaz','Audacieux','Utama']){
  const tail='Under 3.5 — <strong>82%</strong>. Main Road FC averaged 1.9.';
  assert.equal(report.stripTier('🎯 <strong>'+label+':</strong> '+tail),tail);
 }
 assert.equal(report.stripTier('Main Road FC — 82%'),'Main Road FC — 82%');
});
test('a real Bold loss is retained; declined recommendation is only in untouched original',()=>{
 const html='<p><strong data-i18n="arhiva.sect.verdict">Verdict:</strong> x</p><p><strong data-i18n="arhiva.sect.piete">Markets</strong></p><ul><li>💎 <strong>Bold:</strong> Over 2.5 — 60%. Reason.</li><li>💎 <strong>Bold:</strong> no bold pick today — no odds market reaches 55%.</li></ul>';
 const r=report.sections(html);assert.deepEqual(r.markets,['Over 2.5 — 60%. Reason.']);assert.equal(r.original,html);
 const review='<table><tr><th data-i18n="arhiva.th.pick">Pick</th><th>Market</th><th>Result</th></tr><tr><td>Bold</td><td>Over 2.5 — 60%</td><td>LOSS</td></tr></table>';
 assert.equal(report.cleanReview(review),'<table><tr><th>Market</th><th>Result</th></tr><tr><td>Over 2.5 — 60%</td><td>LOSS</td></tr></table>');
});
test('member line-break format, missing sections and unknown text keep honest source',()=>{
 const html='⚡ <strong>Verdict:</strong> 74% &lt;unsafe&gt;<br>📊 <strong>Context:</strong> 6 of 10<br>🧮 <strong>Model:</strong> 2.39<br>🎯 <strong>Picks</strong><br>🔒 <strong>Base:</strong> Over 1.5 — 82%<br>👁️ <strong>Watch:</strong> missing line-ups';
 const r=report.sections(html);assert.equal(r.thesis.length,1);assert.equal(r.context.length,1);assert.equal(r.markets.length,1);assert.equal(r.review.length,0);assert(r.thesis[0].includes('&lt;unsafe&gt;'));
 const unknown=report.sections('Unstructured source');assert.equal(unknown.thesis.length,0);assert.equal(unknown.original,'Unstructured source');
 assert.deepEqual(Object.keys(report.words).sort(),['en','es','fr','id','it','ro']);
 for(const word of Object.values(report.words))assert.equal(word.length,11);
});
function assertSampleConserved(sample) {
 let reference;
 for(const variant of sample.variants){
  const data=report.sections(variant.original);
  assert.equal(data.original,variant.original,'original HTML stays byte-for-byte intact');
  for(const [target,key] of [['thesis','verdict'],['context','context'],['evidence','model'],['watch','urmarit']])assert.deepEqual(data[target],[variant.paragraphs[key]],`${variant.language} ${key} retained`);
  // In the source, the editorial role ends at the first colon.
  // Preserve everything after it: market, probability, argument and their order.
  const expected=variant.markets.map(item=>{const text=plain(item);assert(text.includes(':'));return text.slice(text.indexOf(':')+1).trim();});
  assert.deepEqual(data.markets.map(plain),expected,`${variant.language} supplied markets conserved without editorial labels`);
  const probabilities=variant.markets.map(marketProbability);
  if(reference)assert.deepEqual(probabilities,reference,'translated source probabilities agree');else reference=probabilities;
 }
}
test('current public sample keeps one principal selection, context and the review in every language',()=>{
 const sample=proSample(readFileSync(new URL('../index.html',import.meta.url),'utf8'));
 const probability=sample.variants[0].selection.probability;
 for(const variant of sample.variants){
  assert.equal(variant.selection.probability,probability,variant.language);
  assert.match(variant.original,/<details class="dossier-context">/);
  assert.match(variant.original,/<details class="dossier-review">/);
  assert.doesNotMatch(variant.original,/arhiva\.sect\.piete|🔒|💎|dossier-market-evidence/);
 }
});
test('legitimate archived samples with two and three markets satisfy the same conservation contract',()=>{
 for(const [file,teams,probabilities] of [
  ['analize/2026-11-16.html',['Sorrento','SS Monopoli'],[82,66]],
  ['analize/2026-11-17.html',['Burgess Hill Town','Brentwood Town'],[87,70,64]]
 ]){
  const sample=proSample(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  assert.deepEqual([sample.home,sample.away],teams);
  for(const variant of sample.variants)assert.deepEqual(variant.markets.map(marketProbability),probabilities);
  assertSampleConserved(sample);
 }
});
test('hyphenated member picks and six translated leading tiers retain markets',()=>{
 for(const label of ['Bază','Base','Principal','Principale','Curajos','Arriesgado','Audace','Audacieux','Dasar','Utama','Berani']){
  const data=report.sections('⚡ <strong>Verdict:</strong> reason<br>🎯 <strong>Picks</strong><br>- 🔒 <strong>'+label+':</strong> Over 1.5 — 82%<br>👁️ <strong>Watch:</strong> risk');
  assert.deepEqual(data.markets,['Over 1.5 — 82%']);
 }
});
test('new review uses distinct outcomes without hiding a historical loss',()=>{
 const html=report.sections(bodies[1]).review[0],shown=report.reviewMarkup(html,'en');
 assert.equal((shown.match(/class="report-outcome"/g)||[]).length,2);assert(shown.includes('82%'));assert(shown.includes('66%'));assert(shown.includes('arhiva.semn.nu'));assert.doesNotMatch(shown,/class="pro-lectie"/);assert(!shown.includes('<td>Main</td>'));
});
test('enhancement keeps original, builds comparison, supports keyboard tabs and is idempotent',async()=>{
 const {default: context}=await import('../assets/pro-context.js');globalThis.PoseidonProContext=context;
 const original=bodies[1];const tabs=[],panels=new Map();let writes=0;
 globalThis.document={documentElement:{lang:'en'}};
 const container={dataset:{},classList:{add(){}},closest(selector){if(selector.includes('locked'))return null;if(selector==='[data-lang]')return{getAttribute(){return'en';}};if(selector==='.pro-card')return{querySelector(){return{textContent:'Sorrento – SS Monopoli · Serie C'};}};return null;},
 _html:original,get innerHTML(){return this._html;},set innerHTML(value){writes++;this._html=value;for(const m of value.matchAll(/<button type="button" id="([^"]+)" role="tab" aria-selected="([^"]+)" aria-controls="([^"]+)"/g)){const tab={attrs:{'aria-selected':m[2]},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.events[k]=v;},focus(){this.focused=true;}};tabs.push(tab);panels.set('#'+m[3],{hidden:m[2]!=='true'});}},
 querySelectorAll(selector){return selector.includes('.report-tabs')?tabs:[];},querySelector(selector){return panels.get(selector);}};
 report.enhance(container);assert.equal(writes,1);assert(container.innerHTML.includes('report-team-rows'));assert(container.innerHTML.includes('1.2'));assert(container.innerHTML.includes('0.8'));
 assert.equal(report.sourceMarkup(container),original);
 assert(!container.innerHTML.includes(original),'the original tiers and Markdown do not reappear in a disclosure');
 tabs[1].events.click();assert.equal(tabs[1].attrs['aria-selected'],'true');assert.equal([...panels.values()][1].hidden,false);assert.equal([...panels.values()][0].hidden,true);
 let prevented=false;tabs[1].events.keydown({key:'ArrowRight',preventDefault(){prevented=true;}});assert(prevented);assert(tabs[2].focused);assert.equal([...panels.values()][2].hidden,false);
 report.enhance(container);assert.equal(writes,1);
 globalThis.document.querySelectorAll=()=>[container,container];
 report.scan();assert.equal(writes,1,'the scanner does not treat a NodeList index as a refresh request');
 report.enhance(container,true);assert.equal(writes,2);assert.match(container.innerHTML,/aria-selected="true" aria-controls="pro-report-\d+-panel-2"/);
 delete globalThis.document;delete globalThis.PoseidonProContext;
});
test('locked and unrecognized content are left intact; no speculative view is generated',()=>{
 for(const locked of [true,false]){let writes=0;const body=locked?bodies[1]:'Unknown format';const container={dataset:{},closest(){return locked?{}:null;},get innerHTML(){return body;},set innerHTML(v){writes++;}};report.enhance(container);assert.equal(writes,0);}
});
test('EN → RO → EN only freezes the selected language, keeping review labels in that language',()=>{
 const dictionary=JSON.parse(readFileSync(new URL('../assets/i18n.json',import.meta.url),'utf8'));
 function fixture(language,html){
  const variant={hidden:language!=='en',getAttribute(){return language;}};
  const c={dataset:{},classList:{add(){}},_html:html,get innerHTML(){return this._html;},set innerHTML(v){this._html=v;},closest(selector){return selector==='[data-lang]'?variant:null;},querySelectorAll(){return[];},querySelector(){return null;}};
  return {c,variant};
 }
 function translated(html,language){return html.replace(/(<span data-i18n="(arhiva\.semn\.(?:da|nu))"[^>]*>)[\s\S]*?(<\/span>)/g,(_,a,key,z)=>a+dictionary[language][key]+z);}
 const en=fixture('en',translated(bodies[1],'en')),ro=fixture('ro',translated(bodies[0],'en'));
 globalThis.document={documentElement:{lang:'en'},querySelectorAll(){return[en.c,ro.c];}};
 report.scan();assert(en.c.dataset.proEnhanced);assert(!ro.c.dataset.proEnhanced);
 assert(en.c.innerHTML.includes(dictionary.en['arhiva.semn.nu']));
 en.variant.hidden=true;ro.variant.hidden=false;document.documentElement.lang='ro';
 ro.c._html=translated(ro.c._html,'ro');report.scan();assert(ro.c.dataset.proEnhanced);
 const roDisplayed=ro.c.innerHTML.split('<details class="report-original">')[0];
 assert(roDisplayed.includes('Verificare rezultat'));assert(roDisplayed.includes(dictionary.ro['arhiva.semn.nu']));assert(!roDisplayed.includes(dictionary.en['arhiva.semn.nu']));
 ro.variant.hidden=true;en.variant.hidden=false;document.documentElement.lang='en';report.scan();
 const enDisplayed=en.c.innerHTML.split('<details class="report-original">')[0];
 assert(enDisplayed.includes('Result review'));assert(enDisplayed.includes(dictionary.en['arhiva.semn.nu']));assert(!enDisplayed.includes(dictionary.ro['arhiva.semn.nu']));
 const source=readFileSync(new URL('../assets/pro-report.js',import.meta.url),'utf8');assert(source.includes("attributeFilter:['hidden']"));
 delete globalThis.document;
});
test('historical mixed Markdown/strong prefixes preserve market, probability and balanced markup',()=>{
 const html=readFileSync(new URL('../analize/2026-07-30.html',import.meta.url),'utf8');
 const original=html.match(/<li>(Principal: <strong>🎯 \*\*Principal: Pafos nu pierde \(1X\)<\/strong>[\s\S]*?)<\/li>/)?.[1];assert(original,'real archived regression fixture exists');
 const stripped=report.stripTier(original);assert(stripped.startsWith('<strong>Pafos nu pierde (1X)</strong>'));assert(stripped.includes('66%'));assert.equal((stripped.match(/<strong>/g)||[]).length,(stripped.match(/<\/strong>/g)||[]).length);
 for(const label of ['Atrevido','Coraggioso','Sécurité','Seguridad','Safety','Sicurezza','Aman','Keamanan','Main pick','Bold pick','Safe','Banker','Core','Foundation']){
  assert.equal(report.stripTier('💎 <strong>'+label+':</strong> X2 — 66%'),'X2 — 66%');
  assert.equal(report.cleanReview('<tr><td>'+label+'</td><td>X2</td><td>66%</td><td>LOSS</td></tr>'),'<tr><td>X2</td><td>66%</td><td>LOSS</td></tr>');
 }
});
test('all existing recognized archive bodies keep evaluated rows and remove observed leading tiers',t=>{
 const dir=new URL('../analize/',import.meta.url);let bodiesCount=0,markets=0,files=0;
 const tier=/^(?:\s|[🔒🎯💎]|\*|-)*(?:Base|Main pick|Main|Bold pick|Bold|Curajos|Arriesgado|Atrevido|Coraggioso|Bază|Principal|Principale|Audaz|Audace|Audacieux|Utama|Berani|Dasar|Siguranță|Safe pick|Safe|Safety|Seguridad|Sicurezza|Sécurité|Aman|Keamanan|Banker|Core|Foundation)\s*:/iu;
 for(const name of readdirSync(dir).filter(x=>/^\d.*\.html$/.test(x))){files++;const html=readFileSync(new URL(name,dir),'utf8');for(const m of html.matchAll(/<div class="pro-visible">([\s\S]*?)\n      <\/div>\n    <\/article>/g)){
  const r=report.sections(m[1]);if(!r.thesis.length)continue;bodiesCount++;assert.equal(r.original,m[1]);for(const market of r.markets){markets++;assert(!tier.test(market.replace(/<[^>]+>/g,'')),name+' '+market.slice(0,120));}
  for(const old of r.review){const clean=report.cleanReview(old);assert.equal((old.match(/<tr\b/g)||[]).length,(clean.match(/<tr\b/g)||[]).length);for(const p of old.match(/\d+(?:[.,]\d+)?\s*%/g)||[])assert(clean.includes(p));}
 }}
 assert(bodiesCount>7000);t.diagnostic(`${files} files; ${bodiesCount} recognized report bodies; ${markets} market entries checked`);
});

test('editorial focuses on the recorded selection and explains contrasting pre-match venue evidence', async () => {
 const {default: context}=await import('../assets/pro-context.js');
 const html='⚡ <strong>Verdict:</strong> Published prose.<br>🎯 <strong>Pronosticuri</strong><br>- 🔒 <strong>Bază:</strong> X2 — 86%.<br>- 🎯 <strong>Principal:</strong> Peste 1,5 goluri — 83%. A recorded argument.<br>- 💎 <strong>Curajos:</strong> Peste 2,5 — 63%.';
 const data=report.sections(html);
 assert.deepEqual(data.selection,{market:'Peste 1,5 goluri',probability:'83%',goals:2});
 const hist=(scored,conceded,home)=>scored.map((score,i)=>({id:i+10,date:'2026-11-0'+(i+1)+'T14:00:00Z',home,scored:score,conceded:conceded[i]}));
 const match={fixture_id:1, match_date:'2026-11-18T10:00:00Z', as_of:'2026-11-17T21:00:00Z', history_context:'same_competition_season', teams:[
  {name:'Home',home:true,matches:[...hist([0,0,0,0,2],[3,3,2,1,0],true),{id:1,date:'2026-11-09T14:00:00Z',home:true,scored:9,conceded:0}]},
  {name:'Away',home:false,matches:[...hist([3,3,2,1,1],[1,1,1,1,0],false),{id:77,date:'2026-11-18T14:00:00Z',home:false,scored:9,conceded:0}]}
 ]};
 const facts=context.goalEvidence(match,1,2);
 assert.deepEqual([facts.home,facts.away].map(({n,scoring,threshold,total,both,scored})=>[n,scoring,threshold,total,both,scored]),
  [[5,1,1,4,0,2],[5,5,3,4,4,10]]);
 const markup=report.editorialMarkup(data,'ro',facts,true);
 assert.match(markup,/Lectură retrospectivă din date premeci/);
 assert.ok(markup.indexOf('83%') < markup.indexOf('Home a marcat în doar 1 din 5'));
 assert.match(markup,/report-argument-support/);
 assert.match(markup,/report-argument-risk/);
 assert.match(markup,/Away[^<]*3 din 5/);
 assert.match(markup,/Home a marcat în doar 1 din 5/);
 assert.match(markup,/Away a înscris o singură dată în 2 din 5/);
 assert.doesNotMatch(markup,/86%|63%|report-prob|Curajos/);
 assert.match(markup,/83%/);
 assert.equal(report.recordMarkup(data,'ro'),'');
 assert.doesNotMatch(markup,/în campionat/);
 assert.match(report.editorialMarkup(data,'ro',null),/A recorded argument/);
 assert.doesNotMatch(report.editorialMarkup(data,'ro',null),/report-argument-risk/);
 assert.equal(context.goalEvidence({...match,as_of:'invalid'},1,2),null);
 assert.equal(context.goalEvidence({...match,as_of:match.match_date},1,2),null);
 assert.equal(context.goalEvidence(match,9,2),null);
 // The protected Worker allowlist sends these fields without a history_context key.
 const {fixture_id,match_date,as_of,teams}=match;
 const workerDossier={fixture_id,match_date,as_of,league:'League',season:2026,teams};
 assert.deepEqual(context.goalEvidence(workerDossier,1,2),facts);
 assert.equal(context.goalEvidence({...workerDossier,history_context:'unavailable'},1,2),null);
 const legacyDate={...workerDossier,match_date:match_date.slice(0,-1),as_of:as_of.slice(0,-1),
  teams:teams.map(team=>({...team,matches:[...team.matches,{id:75,date:'2026-11-17',home:team.home,scored:4,conceded:3}]}))};
 assert.deepEqual(context.goalEvidence(legacyDate,1,2),facts,'a date-only row on the snapshot day is not included');
 const selections=[{rol:'Bază',key:'dc_1x',p:90},{rol:'Principal',key:'dc_x2',p:77}];
 data.selection=report.structuredSelection(selections,'ro');
 assert.deepEqual(data.selection,{market:'X2',probability:'77%',goals:null,key:'dc_x2'});
 const direction=context.resultEvidence(match,1,data.selection.key);
 const doubleChance=report.editorialMarkup(data,'ro',direction);
 assert.equal(direction.covered.wins,4);
 assert.equal(direction.covered.draws,1);
 assert.equal(direction.opponent.wins,1);
 assert.match(doubleChance,/Away[^<]*5 din 5/);
 assert.match(doubleChance,/Home[^<]*1 din 5/);
 assert.doesNotMatch(doubleChance,/90%/);
 const contrary={covered:{...direction.covered,wins:1,draws:1},opponent:{...direction.opponent,wins:3}};
 const conflicts=report.editorialMarkup(data,'ro',contrary);
 assert.match(conflicts,/Istoricul pune selecția sub semnul întrebării/);
 assert.doesNotMatch(conflicts,/Ce susține|report-argument-support/);
 assert.match(conflicts,/1 victorie, 1 egal/);
 const botev={covered:{...direction.covered,name:'Botev',home:true,wins:4},opponent:{...direction.opponent,name:'Aksakovo',home:false,n:6,wins:0}};
 const favorable=report.editorialMarkup(data,'ro',botev);
 assert.match(favorable,/Aksakovo are zero victorii în 6 meciuri în deplasare/);
 assert.match(favorable,/report-argument-support/);
 assert.doesNotMatch(favorable,/report-argument-risk/);
});

test('Elazığspor keeps the recorded selection and uses Menemen’s defensive resistance as the objection',()=>{
 const data=report.sections('🎯 <strong>Pronosticuri</strong><br>🎯 <strong>Principal:</strong> Peste 1,5 goluri — 81%.<br>👁️ <strong>De urmărit:</strong> Prima repriză.<br>ℹ️ xG din model, nu din șuturi.');
 const home={name:'Elazığspor',home:true,n:5,threshold:4,scoring:5,once:1};
 const away={name:'Menemen',home:false,n:5,threshold:0,scoring:3,concededBelow:4,conceded:7,
  worst:{scored:0,conceded:4,opponent:'Muş Menderesspor'}};
 const markup=report.editorialMarkup(data,'ro',{home,away});
 assert.match(markup,/Elazığspor a marcat de cel puțin 2 ori în 4 din 5/);
 assert.match(markup,/Menemen a primit cel mult 1 gol în 4 din 5 deplasări/);
 assert.match(markup,/0–4 cu Muş Menderesspor/);
 assert.match(markup,/O înfrângere grea schimbă imaginea apărării lui Menemen/);
 assert.equal((markup.match(/81%/g)||[]).length,1);
 assert.doesNotMatch(data.watch.join(''),/ℹ|xG/);
 const english=report.editorialMarkup(data,'en',{home,away});
 assert.match(english,/One heavy defeat skews the defensive record for Menemen/);
 assert.match(english,/Menemen conceded at most 1 goal in 4 of 5 away games/);
 assert.match(english,/0–4 defeat against Muş Menderesspor/);
 assert.match(english,/>Risk</);
 for (const scored of [3,4,5]) {
  const alternate={...away,worst:{...away.worst,scored}};
  assert.doesNotMatch(report.editorialMarkup(data,'en',{home,away:alternate}),/heavy defeat|The exception/);
 }
 const twoExceptions={...away,concededBelow:3};
 assert.doesNotMatch(report.editorialMarkup(data,'en',{home,away:twoExceptions}),/heavy defeat|The exception/);
});

test('Adana uses the visiting defence as evidence and keeps weak own scoring in the objection',()=>{
 const data=report.sections('🎯 <strong>Pronosticuri</strong><br>🎯 <strong>Principal:</strong> Peste 2,5 goluri — 66%.');
 const home={name:'Adana',home:true,n:5,threshold:1,concededBelow:4,total:4,scoring:3};
 const away={name:'Kastamonuspor',home:false,n:5,threshold:0,concededBelow:1,total:4,scoring:2};
 const markup=report.editorialMarkup(data,'ro',{home,away});
 assert.match(markup,/report-argument-support[^]*?Kastamonuspor a primit cel puțin 3 goluri în 4 din 5 deplasări/);
 assert.match(markup,/report-argument-risk[^]*?Adana a marcat de cel puțin 3 ori în doar 1 din 5 meciuri acasă/);
 assert.equal((markup.match(/66%/g)||[]).length,1);
 const neutral=report.editorialMarkup(data,'ro',{home:{...home,total:2},away:{...away,concededBelow:3,total:2}});
 assert.doesNotMatch(neutral,/report-argument-support/);
 assert.match(neutral,/Ce arată scorurile recente/);
});

test('protected Markdown labels preserve the context comparison',async()=>{
 const {default: context}=await import('../assets/pro-context.js');
 const evidence='<p>🧮 <strong>Modelul și echipele:</strong> A, ultimele 5 acasă: 1,2 marcate și 0,8 primite pe meci, peste 2,5 în 2 din 5. B, ultimele 5 în deplasare: 1,1 marcate și 1,9 primite pe meci, peste 2,5 în 3 din 5.</p>';
 const facts=context.extract({evidence,home:'A',away:'B',language:'ro'});
 assert.deepEqual(facts?.away.over25,{hits:3,n:5});
});
