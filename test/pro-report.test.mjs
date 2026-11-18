import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import report from '../assets/pro-report.js';
import {proSample,plain,marketProbability} from './helpers/pro-sample.mjs';
const source=readFileSync(new URL('../analize/2026-11-16.html',import.meta.url),'utf8');
const bodies=[...source.matchAll(/<div class="pro-visible">([\s\S]*?)\n      <\/div>\n    <\/article>/g)].map(m=>m[1]);
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
test('current public sample retains its actual translated content and every supplied market',()=>{
 assertSampleConserved(proSample(readFileSync(new URL('../index.html',import.meta.url),'utf8')));
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
 report.enhance(container);assert.equal(writes,1);assert(container.innerHTML.includes('report-team-rows'));assert(container.innerHTML.includes('1.2'));assert(container.innerHTML.includes('0.8'));assert(container.innerHTML.includes(original));
 tabs[1].events.click();assert.equal(tabs[1].attrs['aria-selected'],'true');assert.equal([...panels.values()][1].hidden,false);assert.equal([...panels.values()][0].hidden,true);
 let prevented=false;tabs[1].events.keydown({key:'ArrowRight',preventDefault(){prevented=true;}});assert(prevented);assert(tabs[2].focused);assert.equal([...panels.values()][2].hidden,false);
 report.enhance(container);assert.equal(writes,1);delete globalThis.document;delete globalThis.PoseidonProContext;
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
