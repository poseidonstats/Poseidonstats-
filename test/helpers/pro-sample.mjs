import assert from 'node:assert/strict';

export const languages=['ro','en','es','it','fr','id'];
export const plain=html=>html.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#39;|&#x27;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
export const marketProbability=item=>Number(item.match(/[—–]\s*(?:<strong>)?(\d+(?:[.,]\d+)?)%/)[1].replace(',','.'));
export const numbers=text=>(text.match(/\d+(?:[.,]\d+)?/g)||[]).map(n=>Number(n.replace(',','.')));

// Read the generated source, independently of the presentation parsers.
export function proSample(html) {
 const start='<!-- PRO_SAMPLE_CARD_START -->',end='<!-- PRO_SAMPLE_CARD_END -->';
 if(html.includes(start))html=html.split(start)[1].split(end)[0];
 const dailyExample=html.includes('data-public-pro-report');
 const heading=html.match(/<div class="pro-card-head">([\s\S]*?)<\/div>/)?.[1];
 assert(heading,'sample heading exists');
 const teams=plain(heading).split(' · ')[0].split(' – ');assert.equal(teams.length,2,'sample identifies both teams');
 const group=html.split(/<div(?: class="pro-archive-match"(?: id="m\d+")?)? data-lang-grup>/)[1];
 assert(group,'language group exists');
 const tags=[...group.matchAll(/<div data-lang="([^"]+)"[^>]*>/g)];
 assert.deepEqual(tags.map(m=>m[1]),languages,'one source variant per supported language');
 const variants=tags.map((tag,i)=>{
  const variant=group.slice(tag.index+tag[0].length,tags[i+1]?.index);
  const marker='<div class="pro-visible">',offset=variant.indexOf(marker);assert(offset>=0,'visible original exists');
  const tail=variant.slice(offset+marker.length);let depth=1,finish;
  for(const token of tail.matchAll(/<div\b[^>]*>|<\/div>/g)){depth+=token[0].startsWith('</')?-1:1;if(!depth){finish=token.index;break;}}
  assert(finish!==undefined,'original div is balanced');
  const original=tail.slice(0,finish);
  const paragraphs=Object.fromEntries(['verdict','context','model','urmarit'].map(key=>{
   const paragraph=original.match(new RegExp('<p><strong data-i18n="arhiva\\.sect\\.'+key+'">[\\s\\S]*?<\\/p>'))?.[0];
   assert(paragraph,`${tag[1]} ${key} source exists`);return[key,paragraph];
  }));
  if(dailyExample) {
   const selected=original.match(/class="dossier-published">[\s\S]*?<strong>([^<]+) · (\d+(?:[.,]\d+)?)%<\/strong>/);
   assert(selected,'daily example identifies its principal selection');
   return{language:tag[1],original,paragraphs,selection:{market:selected[1],probability:Number(selected[2].replace(',','.'))}};
  }
  const list=original.match(/data-i18n="arhiva\.sect\.piete"[^>]*>[\s\S]*?<\/p>\s*<ul>([\s\S]*?)<\/ul>/)?.[1];assert(list,'market list exists');
  // Supplied predictions put a probability immediately after the market dash.
  // Declined recommendations have explanatory prose there instead.
  const markets=[...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m=>m[1]).filter(item=>/[—–]\s*(?:<strong>)?\d+(?:[.,]\d+)?%/.test(item));
  assert(markets.length>0,'at least one supplied prediction exists');
  return{language:tag[1],original,paragraphs,markets};
 });
 return{home:teams[0],away:teams[1],variants};
}

export function pairedEvidence(sample,variant) {
 const text=plain(variant.paragraphs.model),home=text.indexOf(sample.home+', '),away=text.indexOf('. '+sample.away+', ');
 assert(home>=0&&away>home,'source states both home and away samples');
 const end=text.indexOf('. ',away+sample.away.length+4);
 return text.slice(home,end<0?undefined:end+1);
}
