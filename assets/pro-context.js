/* 17 Nov 2026: conservative extraction of explicitly stated home/away samples.
 * Presentation adapter only. Unrecognized or contradictory prose stays prose. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PoseidonProContext = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const number = '(\\d+(?:[.,]\\d+)?)';
  const count = '(\\d+)';
  const phrases = {
    ro: ['ultimele '+count+' acasă', 'ultimele '+count+' în deplasare', number+' marcate și '+number+' primite pe meci, peste 2[.,]5 în '+count+' din '+count],
    en: ['last '+count+' at home', 'last '+count+' away', number+' scored and '+number+' conceded per match, over 2[.,]5 in '+count+' of '+count],
    es: ['últimos '+count+' en casa', 'últimos '+count+' fuera', number+' marcados y '+number+' recibidos por partido, más de 2[.,]5 en '+count+' de '+count],
    it: ['ultime '+count+' in casa', 'ultime '+count+' in trasferta', number+' gol fatti e '+number+' subiti a partita, over 2[.,]5 in '+count+' su '+count],
    fr: [count+' derniers matchs à domicile', count+" derniers matchs à l'extérieur", number+' buts marqués et '+number+' encaissés par match, plus de 2[.,]5 dans '+count+' sur '+count],
    id: [count+' laga kandang terakhir', count+' laga tandang terakhir', number+' gol dicetak dan '+number+' kebobolan per laga, di atas 2[.,]5 dalam '+count+' dari '+count]
  };
  function text(html) {
    // Source headings carry no match data; remove only a leading label element.
    return String(html || '').replace(/^\s*<p[^>]*>\s*(?:(?:🧮|📊)\s*)?<strong[^>]*>[^<]*<\/strong>/iu,'')
      .replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&')
      .replace(/&#39;|&#x27;|&apos;/g,"'").replace(/&quot;/g,'"')
      .replace(/\s+/g,' ').trim();
  }
  function escape(value) { return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function ranks(source, home, away, language) {
    const h=escape(home),a=escape(away);
    const patterns={
      ro:`^${h} e pe locul (\\d+) cu (\\d+) de puncte, ${a} pe locul (\\d+) cu (\\d+)\\.`,
      en:`^${h} are (\\d+)(?:st|nd|rd|th) on (\\d+) points, ${a} (\\d+)(?:st|nd|rd|th) on (\\d+)\\.`,
      es:`^${h} es (\\d+)\\.º con (\\d+) puntos, ${a} (\\d+)\\.º con (\\d+)\\.`,
      it:`^${h} è (\\d+)° con (\\d+) punti, ${a} (\\d+)° con (\\d+)\\.`,
      fr:`^${h} est (\\d+)e avec (\\d+) points, ${a} (\\d+)e avec (\\d+)\\.`,
      id:`^${h} di peringkat (\\d+) dengan (\\d+) poin, ${a} di peringkat (\\d+) dengan (\\d+)\\.`
    };
    const match=source.match(new RegExp(patterns[language],'u'));
    if (!match) return null;
    const values=match.slice(1).map(Number);
    return values.every(Number.isSafeInteger)&&values[0]>0&&values[2]>0 ? values : null;
  }
  function extract(input) {
    if (!input || !phrases[input.language] || typeof input.home!=='string' || typeof input.away!=='string') return null;
    const home=input.home.trim(),away=input.away.trim();
    if (!home || !away || home===away) return null;
    const [homePhrase,awayPhrase,stats]=phrases[input.language];
    const expression=`^${escape(home)}, ${homePhrase}\\s*:\\s*${stats}\\. ${escape(away)}, ${awayPhrase}\\s*:\\s*${stats}\\.?$`;
    const match=text(input.evidence).match(new RegExp(expression,'u'));
    if (!match) return null;
    const values=match.slice(1).map(value=>Number(value.replace(',','.')));
    function team(name,offset) {
      const [sample,scored,conceded,hits,n]=values.slice(offset,offset+5);
      if (![sample,hits,n].every(Number.isSafeInteger) || sample<=0 || sample!==n || hits<0 || hits>n || !Number.isFinite(scored) || !Number.isFinite(conceded) || scored<0 || conceded<0) return null;
      return {name,sample,scored,conceded,over25:{hits,n},rank:null,points:null};
    }
    const h=team(home,0),a=team(away,5);
    if (!h || !a) return null;
    const rank=ranks(text(input.context),home,away,input.language);
    if (rank) {h.rank=rank[0];h.points=rank[1];a.rank=rank[2];a.points=rank[3];}
    return {home:h,away:a};
  }
  function timestamp(value) {
    if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) return NaN;
    const utc=/Z$|[+-]\d{2}:?\d{2}$/i.test(value)?value:value+'Z';
    return Date.parse(utc.replace(' ','T'));
  }
  function venueHistory(dossier, fixture, includeEmpty=false) {
    if (!Number.isSafeInteger(fixture) || fixture<=0 || dossier?.fixture_id !== fixture
      || (dossier.history_context!==undefined && dossier.history_context!=='same_competition_season')
      || !Array.isArray(dossier.teams) || dossier.teams.length !== 2) return null;
    const kickoff=timestamp(dossier.match_date),cutoff=timestamp(dossier.as_of);
    if (!(cutoff<kickoff)) return null;
    function venue(home) {
      const team=dossier.teams.find(team=>team?.home===home);
      if (typeof team?.name!=='string' || !team.name.trim() || !Array.isArray(team.matches)) return null;
      const seen=new Set();
      const matches=team.matches.filter(row=>{
        // The API accepts old day-only rows when the full day is before the snapshot.
        const date=row?.date;
        const start=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)
          ? Date.parse(date+'T23:59:59.999Z') : timestamp(date);
        if (row?.home!==home || !Number.isSafeInteger(row.id) || row.id<=0 || row.id===fixture || seen.has(row.id)
          || !(start<cutoff) || !Number.isSafeInteger(row.scored) || row.scored<0
          || !Number.isSafeInteger(row.conceded) || row.conceded<0) return false;
        seen.add(row.id);
        return true;
      });
      return matches.length || includeEmpty ? {name:team.name,home,matches} : null;
    }
    const home=venue(true),away=venue(false);
    return home && away ? [home,away] : null;
  }
  function marketFrequency(dossier, fixture, key) {
    const sizes=venueHistory(dossier,fixture,true);
    if (!sizes || typeof key!=='string') return null;
    const halfTime=key.startsWith('ht_');
    const market=halfTime?key.slice(3):key;
    const total=market.match(/^(over|under)_([0-9]+)_5$/);
    const results={home:(h,a)=>h>a, draw:(h,a)=>h===a, away:(h,a)=>a>h,
      '1x2_home':(h,a)=>h>a, '1x2_draw':(h,a)=>h===a, '1x2_away':(h,a)=>a>h,
      dc_1x:(h,a)=>h>=a, dc_x2:(h,a)=>h<=a, dc_12:(h,a)=>h!==a,
      btts:(h,a)=>h>0&&a>0, btts_no:(h,a)=>h===0||a===0};
    const threshold=total?Number(total[2])+.5:null;
    const qualifies=total?(h,a)=>total[1]==='over'?h+a>threshold:h+a<threshold
      : Object.hasOwn(results,market)?results[market]:null;
    if (!qualifies) return null;
    return sizes.map(({name,home,matches})=>{
      let hits=0,n=0;
      for (const row of matches) {
        const scored=halfTime?row.halfScored:row.scored;
        const conceded=halfTime?row.halfConceded:row.conceded;
        if (!Number.isSafeInteger(scored) || scored<0 || scored>row.scored
          || !Number.isSafeInteger(conceded) || conceded<0 || conceded>row.conceded) continue;
        n++;
        if (home?qualifies(scored,conceded):qualifies(conceded,scored)) hits++;
      }
      return {name,home,hits,n};
    });
  }
  function goalEvidence(dossier, fixture, goals) {
    const sizes=venueHistory(dossier,fixture);
    if (!sizes || ![2,3].includes(goals)) return null;
    const [home,away]=sizes.map(({name,home,matches})=>{
      const worst=matches.reduce((a,b)=>a.conceded>=b.conceded?a:b);
      return {name,home,n:matches.length,
        scoring:matches.filter(row=>row.scored>0).length,once:matches.filter(row=>row.scored===1).length,
        threshold:matches.filter(row=>row.scored>=goals).length,
        total:matches.filter(row=>row.scored+row.conceded>=goals).length,
        both:matches.filter(row=>row.scored>0&&row.conceded>0).length,
        scored:matches.reduce((sum,row)=>sum+row.scored,0),
        concededBelow:matches.filter(row=>row.conceded<goals).length,
        conceded:matches.reduce((sum,row)=>sum+row.conceded,0),
        worst:{scored:worst.scored,conceded:worst.conceded,opponent:worst.opponent}};
    });
    return {home,away};
  }
  function resultEvidence(dossier, fixture, key) {
    const sizes=venueHistory(dossier,fixture);
    if (!sizes || !['dc_1x','dc_x2'].includes(key)) return null;
    const [covered,opponent]=(key==='dc_1x'?sizes:[sizes[1],sizes[0]]).map(({name,home,matches})=>({name,home,n:matches.length,
      wins:matches.filter(row=>row.scored>row.conceded).length,
      draws:matches.filter(row=>row.scored===row.conceded).length}));
    return {covered,opponent};
  }
  return {extract,goalEvidence,resultEvidence,marketFrequency};
});
