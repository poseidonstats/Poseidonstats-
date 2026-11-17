/* 17 Nov 2026 — presentation of supplied Pro text only. No scoring, fetching or entitlement decisions. */
(function (root) {
  'use strict';
  const words = {
    en: ['Analysis','Team context','Result review','Match thesis','Supporting evidence','What to watch','Market outlook','Original report','No result review has been supplied yet.','Team context has not been supplied for this report.','PRO REPORT'],
    ro: ['Analiză','Context echipe','Verificare rezultat','Concluzia analizei','Argumentele analizei','De urmărit','Perspective pe piețe','Raportul original','Verificarea rezultatului nu este încă disponibilă.','Contextul echipelor nu este disponibil în acest raport.','RAPORT PRO'],
    es: ['Análisis','Contexto','Resultado','Conclusión del análisis','Evidencia','Qué observar','Perspectiva de mercados','Informe original','La revisión del resultado aún no está disponible.','No hay contexto de los equipos en este informe.','INFORME PRO'],
    it: ['Analisi','Contesto','Risultato','Conclusione dell’analisi','Elementi a supporto','Da seguire','Quadro dei mercati','Rapporto originale','La verifica del risultato non è ancora disponibile.','Il contesto delle squadre non è disponibile in questo rapporto.','RAPPORTO PRO'],
    fr: ['Analyse','Contexte','Résultat','Conclusion de l’analyse','Éléments à l’appui','À surveiller','Perspectives des marchés','Rapport original','La vérification du résultat n’est pas encore disponible.','Le contexte des équipes n’est pas disponible dans ce rapport.','RAPPORT PRO'],
    id: ['Analisis','Konteks tim','Ulasan hasil','Kesimpulan analisis','Bukti pendukung','Yang perlu diamati','Gambaran pasar','Laporan asli','Ulasan hasil belum tersedia.','Konteks tim belum tersedia dalam laporan ini.','LAPORAN PRO']
  };
  // Observed historical tier labels; anchored to the start, never narrative words.
  const tierNames = 'Base|Main pick|Main|Bold pick|Bold|Curajos|Arriesgado|Atrevido|Coraggioso|Bază|Baza|Principal|Principale|Principali|Audaz|Audace|Audacieux|Utama|Berani|Dasar|Siguranță|Safe pick|Safe|Safety|Seguridad|Sicurezza|Sécurité|Aman|Keamanan|Banker|Core|Foundation|Value pick|Risky pick|Audacios';
  const tierPrefix = new RegExp('^(?:\\s|-|[🔒🎯💎]|\\*|<strong>)*?(?:'+tierNames+')\\s*:\\s*(?:\\*\\*)?\\s*(?:</strong>)?\\s*','iu');
  const tierCell = new RegExp('^(?:'+tierNames+')$','iu');
  function plain(html) { return html.replace(/<[^>]*>/g, '').trim(); }
  function stripTier(html) {
    let text=html, prefix;
    // Some archived generators prepended a tier to a source line which already had one.
    while ((prefix=text.match(tierPrefix))) {
      const opens=(prefix[0].match(/<strong>/g)||[]).length;
      const closes=(prefix[0].match(/<\/strong>/g)||[]).length;
      text='<strong>'.repeat(Math.max(0,opens-closes))+text.slice(prefix[0].length);
    }
    return text;
  }
  function sections(html) {
    const out = {thesis:[],context:[],evidence:[],watch:[],markets:[],review:[],other:[],original:html};
    const ri = html.search(/<div\s+class=["']pro-verificare["']/);
    let body = ri < 0 ? html : html.slice(0,ri);
    if (ri >= 0) out.review.push(html.slice(ri));
    // Members endpoint sends escaped Markdown as line breaks; generated archives use paragraphs.
    if (!/<p\b/i.test(body)) body = body.split(/<br\s*\/?>/i).filter(s=>s.trim()).map(s=>`<p>${s}</p>`).join('');
    const blocks = body.match(/<p\b[^>]*>[\s\S]*?<\/p>|<ul\b[^>]*>[\s\S]*?<\/ul>|[^<]+|<(?!p\b|ul\b)[\s\S]*?(?=<p\b|<ul\b|$)/gi) || [];
    let group='other';
    for (const block of blocks) {
      if (!block.trim()) continue;
      const text=plain(block);
      if (/arhiva\.sect\.verdict/.test(block)||/^⚡/.test(text)) group='thesis';
      else if (/arhiva\.sect\.context/.test(block)||/^📊/.test(text)) group='context';
      else if (/arhiva\.sect\.model/.test(block)||/^🧮/.test(text)) group='evidence';
      else if (/arhiva\.sect\.urmarit/.test(block)||/^👁/.test(text)) group='watch';
      else if (/arhiva\.sect\.piete/.test(block)||/^🎯\s*(Picks|Pron|Pilihan)/i.test(text)) group='markets';
      if (/pro-verificat|pro\.card\.(?:maine|verif)/.test(block)) {out.review.push(block);continue;}
      if (group==='markets') {
        if (/arhiva\.sect\.piete/.test(block)||/^🎯\s*(Picks|Pron|Pilihan)/i.test(text)) continue;
        const items=block.match(/<li\b[^>]*>([\s\S]*?)<\/li>/gi) || [block];
        for (const item of items) {
          const inner=item.replace(/^<(?:li|p)\b[^>]*>/i,'').replace(/<\/(?:li|p)>$/i,'');
          // A declined selection is not a historical prediction. Retain it in the original report only.
          if (/^(?:-?\s*💎\s*)?(?:<strong>)?(?:Bold|Curajos|Arriesgado|Audaz|Audace|Audacieux|Berani)[^:]*:/i.test(inner) && !/\d+(?:[.,]\d+)?\s*%/.test(inner.split(/[—–]/)[0]) && /no bold|no odds|no hay|ningún|nessun|aucun|sin |fără|nu |tidak /i.test(plain(inner))) continue;
          out.markets.push(stripTier(inner));
        }
      } else out[group].push(block);
    }
    return out;
  }
  function cleanReview(html) {
    // The first audit column is an editorial tier, not an outcome. Keep every market and result.
    return html.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi,(row,inside)=>{
      const first=inside.match(/^\s*<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/i);
      if (!first) return row;
      if (/arhiva\.th\.pick/.test(first[0]) || tierCell.test(plain(first[2]))) return row.replace(first[0],'');
      return row;
    });
  }
  function marketMarkup(html) {
    const match=html.match(/^([\s\S]*?)\s+[—–]\s*(?:<strong>)?(\d+(?:[.,]\d+)?%)(?:<\/strong>)?([\s\S]*)$/);
    if (!match) return `<div class="report-market">${html}</div>`;
    return `<div class="report-market"><div class="report-market-top"><h4>${match[1]}</h4><span class="report-prob">${match[2]}</span></div><div class="report-market-reason">${match[3].replace(/^\s*[.—–]\s*/, '')}</div></div>`;
  }
  const contextWords={en:['At home','Away','Goals scored / match','Goals conceded / match','Over 2.5 goals','matches','Position','points','Context & recent form'],ro:['Acasă','În deplasare','Goluri marcate / meci','Goluri primite / meci','Peste 2,5 goluri','meciuri','Loc','puncte','Context și forma recentă'],es:['En casa','Fuera','Goles marcados / partido','Goles recibidos / partido','Más de 2,5 goles','partidos','Posición','puntos','Contexto y forma reciente'],it:['In casa','In trasferta','Gol fatti / partita','Gol subiti / partita','Over 2,5 gol','partite','Posizione','punti','Contesto e forma recente'],fr:['À domicile','À l’extérieur','Buts marqués / match','Buts encaissés / match','Plus de 2,5 buts','matchs','Position','points','Contexte et forme récente'],id:['Kandang','Tandang','Gol dicetak / laga','Gol kebobolan / laga','Di atas 2,5 gol','laga','Posisi','poin','Konteks dan performa terbaru']};
  function escapeText(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function comparison(data,container,lang) {
    if(!root.PoseidonProContext)return '';
    const heading=container.closest('.pro-card')?.querySelector('.pro-card-head')?.textContent||'';
    const pair=heading.replace(/^\s*💎\s*/,'').split(' · ')[0].split(' – ');
    if(pair.length!==2)return '';
    const facts=root.PoseidonProContext.extract({evidence:data.evidence.join(''),context:data.context.join(''),home:pair[0].trim(),away:pair[1].trim(),language:lang});
    if(!facts)return '';
    const w=contextWords[lang]||contextWords.en;
    const sides=[facts.home,facts.away];
    const heads=sides.map((team,i)=>`<div><span class="report-team-role">${w[i]}</span><h4>${escapeText(team.name)}</h4><span class="report-team-sample">${team.sample} ${w[5]}</span>${team.rank!=null?`<p>${w[6]} ${team.rank} · ${team.points} ${w[7]}</p>`:''}</div>`).join('');
    const rows=[[w[2],facts.home.scored,facts.away.scored],[w[3],facts.home.conceded,facts.away.conceded],[w[4],facts.home.over25.hits+'/'+facts.home.over25.n,facts.away.over25.hits+'/'+facts.away.over25.n]];
    return `<div class="report-team-heads">${heads}</div><div class="report-team-rows">${rows.map(([label,h,a])=>`<div><b>${escapeText(h)}</b><span>${label}</span><b>${escapeText(a)}</b></div>`).join('')}</div><details class="report-context-detail"><summary>${w[8]}</summary>${data.context.join('')}${data.evidence.join('')}</details>`;
  }
  function reviewMarkup(html,lang) {
    const neutral={en:'Market',ro:'Piața',es:'Mercado',it:'Mercato',fr:'Marché',id:'Pasar'};
    let text=cleanReview(html);
    text=text.replace(/<div class="table-wrap">\s*<table\b[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>\s*<\/table>\s*<\/div>/gi,(table,body)=>{
      const rows=[...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row=>[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell=>cell[1]));
      if(!rows.length||rows.some(row=>row.length!==3))return table;
      return '<div class="report-outcomes">'+rows.map(([market,pct,result])=>`<div class="report-outcome"><div class="report-outcome-top"><h4>${market}</h4><span>${pct}</span></div><div class="report-outcome-status">${result}</div></div>`).join('')+'</div>';
    });
    // Old editorial tier explanation is accessible in the original, not presented as new analysis.
    text=text.replace(/<p class="pro-lectie">[\s\S]*?<\/p>/gi,'');
    text=text.replace(/The base pick|Pick-ul de bază|El pick base|Il pick base|Le pick de base|Pick base/g,neutral[lang]||neutral.en);
    return text;
  }
  let serial=0;
  function enhance(container) {
    // i18n translates hidden source variants too. Do not freeze their display until selected.
    const languageVariant = container.closest('[data-lang]');
    if (languageVariant && languageVariant.hidden) return;
    if (container.dataset.proEnhanced || container.closest('.pro-locked, [data-pro-locked]')) return;
    const original=container.innerHTML;
    const data=sections(original);
    if (!data.thesis.length) return; // Unknown document structure: leave the original readable.
    const lang=container.closest('[data-lang]')?.getAttribute('data-lang') || document.documentElement.lang || 'en';
    const w=words[lang]||words.en;
    const id='pro-report-'+(++serial);
    function block(title,items,css) {return items.length?`<section class="report-section ${css||''}"><h3>${title}</h3>${items.join('')}</section>`:'';}
    const thesis=data.thesis.map(s=>s.replace(/<strong\b[^>]*(?:data-i18n="arhiva\.sect\.verdict")[^>]*>[\s\S]*?<\/strong>\s*/,'').replace(/^(<p[^>]*>)\s*⚡\s*<strong>[^<]*<\/strong>\s*/,'$1'));
    const analysis=block(w[3],thesis,'report-thesis')+block(w[6],data.markets.map(marketMarkup),'report-markets')+block(w[4],data.evidence)+block(w[5],data.watch)+data.other.join('');
    const context=comparison(data,container,lang)||(data.context.join('')+block(w[4],data.evidence));
    const review=data.review.map(html=>reviewMarkup(html,lang)).join('');
    container.dataset.proEnhanced='true';
    container.classList.add('pro-report');
    container.innerHTML=`<div class="report-kicker">${w[10]}</div><div class="report-tabs" role="tablist" aria-label="${w[10]}">${[0,1,2].map((n)=>`<button type="button" id="${id}-tab-${n}" role="tab" aria-selected="${n===0}" aria-controls="${id}-panel-${n}">${w[n]}</button>`).join('')}</div>${[analysis,context||`<p>${w[9]}</p>`,review||`<p>${w[8]}</p>`].map((content,n)=>`<div class="report-panel" role="tabpanel" id="${id}-panel-${n}" aria-labelledby="${id}-tab-${n}" ${n?'hidden':''}>${content}</div>`).join('')}<details class="report-original"><summary>${w[7]}</summary><div>${original}</div></details>`;
    // Clones must not be translated a second time into old labels. Original remains untouched.
    container.querySelectorAll('.report-panel [data-i18n]').forEach(el=>el.removeAttribute('data-i18n'));
    const tabs=Array.from(container.querySelectorAll('.report-tabs [role="tab"]'));
    function activate(n) {tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===n));container.querySelector('#'+id+'-panel-'+i).hidden=i!==n;});}
    tabs.forEach((tab,n)=>{tab.addEventListener('click',()=>activate(n));tab.addEventListener('keydown',e=>{if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(n+(e.key==='ArrowRight'?1:2))%3;activate(next);tabs[next].focus();});});
  }
  function scan() {document.querySelectorAll('.pro-card .pro-visible').forEach(enhance);}
  const api={sections,stripTier,cleanReview,marketMarkup,reviewMarkup,words,enhance,scan};
  if (typeof module!=='undefined'&&module.exports) module.exports=api;
  if (typeof document==='undefined') return;
  root.PoseidonProReport=api;
  function start() {
    scan();
    let queued=false;
    new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;scan();});}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:globalThis);
