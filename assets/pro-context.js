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
    return String(html || '').replace(/^\s*<p[^>]*>\s*<strong[^>]*>[^<]*<\/strong>/i,'')
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
  return {extract};
});
