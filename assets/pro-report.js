/* Pro match reading from supplied analysis and protected pre-match history. */
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
  const marketCopy = {
    ro: ['Liga','grupa albă','grupa roșie','Meciurile echipelor','acasă','în deplasare','Istoric Pro · aceeași piață','{hits} din {n}','de meciuri','decontate','Estimări similare','Date indisponibile','0 selecții eligibile','Rezultate până la {cutoff}','O selecție principală pe meci și piață, publicată înainte de start și decontată înainte de data acestui meci.'],
    en: ['League','White Group','Red Group','Teams’ matches','at home','away','Pro history · same market','{hits} of {n}','matches','settled','Similar estimates','Data unavailable','0 eligible selections','Results as of {cutoff}','One main selection per fixture and market, published before kickoff and settled before this fixture date.'],
    es: ['Liga','grupo blanco','grupo rojo','Partidos de los equipos','en casa','fuera','Historial Pro · mismo mercado','{hits} de {n}','partidos','liquidadas','Estimaciones similares','Datos no disponibles','0 selecciones elegibles','Resultados hasta {cutoff}','Una selección principal por partido y mercado, publicada antes del inicio y liquidada antes de la fecha del partido.'],
    it: ['Campionato','girone bianco','girone rosso','Partite delle squadre','in casa','in trasferta','Storico Pro · stesso mercato','{hits} su {n}','partite','refertate','Stime simili','Dati non disponibili','0 selezioni idonee','Risultati al {cutoff}','Una selezione principale per partita e mercato, pubblicata prima del calcio d’inizio e risolta prima della data della partita.'],
    fr: ['Championnat','groupe blanc','groupe rouge','Matchs des équipes','à domicile','à l’extérieur','Historique Pro · même marché','{hits} sur {n}','matchs','résolues','Estimations similaires','Données indisponibles','0 sélections admissibles','Résultats au {cutoff}','Une sélection principale par match et marché, publiée avant le coup d’envoi et résolue avant la date du match.'],
    id: ['Liga','grup putih','grup merah','Pertandingan tim','di kandang','tandang','Riwayat Pro · pasar yang sama','{hits} dari {n}','laga','selesai','Estimasi serupa','Data tidak tersedia','0 pilihan yang memenuhi syarat','Hasil hingga {cutoff}','Satu pilihan utama per laga dan pasar, dipublikasikan sebelum sepak mula dan diselesaikan sebelum tanggal laga ini.'],
  };
  const sampleCopy = {
    ro: [
      "{hits} din {n}{de} {games} {had} cel puțin {goals} goluri", "{hits} din {n}{de} {games} {met} selecția «{market}»",
      "{hits} din {n}{de} {picks} «{market}» confirmate", "Campionatul · sezonul {season}", "Arhiva Pro",
      "În așteptarea meciului", "Verificarea nu este încă disponibilă",
    ],
    en: [
      "{hits} of {n} matches had at least {goals} goals", "{hits} of {n} matches met the selection “{market}”",
      "{hits} of {n} “{market}” selections confirmed", "League · {season} season", "Pro archive",
      "Awaiting kickoff", "Result review not yet available",
    ],
    es: [
      "{hits} de {n} partidos con al menos {goals} goles", "{hits} de {n} partidos cumplieron el pronóstico «{market}»",
      "{hits} de {n} pronósticos «{market}» acertados", "Liga · temporada {season}", "Archivo Pro",
      "En espera del inicio", "La verificación aún no está disponible",
    ],
    it: [
      "{hits} su {n} partite con almeno {goals} gol", "{hits} su {n} partite hanno rispettato il pronostico «{market}»",
      "{hits} su {n} pronostici «{market}» confermati", "Campionato · stagione {season}", "Archivio Pro",
      "In attesa del calcio d’inizio", "Verifica non ancora disponibile",
    ],
    fr: [
      "{hits} matchs sur {n} avec au moins {goals} buts", "{hits} matchs sur {n} ont rempli le pronostic « {market} »",
      "{hits} pronostics « {market} » confirmés sur {n}", "Championnat · saison {season}", "Archives Pro",
      "En attente du coup d’envoi", "Vérification pas encore disponible",
    ],
    id: [
      "{hits} dari {n} laga menghasilkan setidaknya {goals} gol", "{hits} dari {n} laga sesuai dengan pilihan “{market}”",
      "{hits} dari {n} pilihan “{market}” terkonfirmasi", "Liga · musim {season}", "Arsip Pro",
      "Menunggu sepak mula", "Verifikasi belum tersedia",
    ],
  };
  const archiveCopy = {
    ro: ['Pronostic publicat înainte de meci','Pronostic arhivat','Rezultat final','Vezi verificarea în arhivă'],
    en: ['Selection published before kickoff','Archived selection','Final score','View the review in the archive'],
    es: ['Pronóstico publicado antes del inicio','Pronóstico archivado','Resultado final','Ver la revisión en el archivo'],
    it: ['Pronostico pubblicato prima del calcio d’inizio','Pronostico archiviato','Risultato finale','Vedi la verifica in archivio'],
    fr: ['Pronostic publié avant le coup d’envoi','Pronostic archivé','Score final','Voir la vérification dans les archives'],
    id: ['Pilihan dipublikasikan sebelum sepak mula','Pilihan yang diarsipkan','Skor akhir','Lihat hasil verifikasi di arsip'],
  };
  function archiveReviewLabels(lang) {
    const [,,final,open]=archiveCopy[lang]||archiveCopy.en;
    return {final,open};
  }
  const bucharestDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'});
  function isoDate(day) {
    if (typeof day!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const date=new Date(day+'T00:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0,10)===day;
  }
  function instant(value) {
    return typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? Date.parse(value) : NaN;
  }
  function validCounts({hits,settled}) {
    return Number.isSafeInteger(hits) && Number.isSafeInteger(settled) && hits>=0 && hits<=settled;
  }
  function verifiedRecord(record,{fixture,day,key,kickoff,publication},kind) {
    const league=kind==='league';
    const period=key==='ht_over_0_5'?'ht':'ft90';
    const criteria=(league?'verified_league_':'verified_pro_primary_')+period+'_v1';
    if (!record || !isoDate(day) || !key || record.criteria!==criteria || record.fixture_id!==fixture
      || record.date!==day || record.key!==key || !validCounts(record)) return null;
    const cutoff=instant(record.as_of),start=instant(kickoff),published=instant(publication);
    if (!Number.isFinite(cutoff) || (Number.isFinite(start) && cutoff>=start)
      || (Number.isFinite(published) && (cutoff>published || (Number.isFinite(start) && published>=start)))) return null;
    const cutoffDay=bucharestDay.format(cutoff);
    if (cutoffDay>day || (cutoffDay===day && (!Number.isFinite(start) || !Number.isFinite(published)))) return null;
    if (league && (!Number.isSafeInteger(record.league_id) || record.league_id<=0 || !Number.isSafeInteger(record.season))) return null;
    if (record.settled && (!isoDate(record.from) || !isoDate(record.to) || record.from>record.to
      || record.to>cutoffDay || (!league && record.to>=day))) return null;
    return record;
  }
  function marketSummary(item,dossier,identity,lang,publicSample,edition) {
    const [totalLeague, otherLeague, publicPro, leagueSource, proSource] = sampleCopy[lang] || sampleCopy.en;
    const [leagueLabel,white,red,teamsLabel,atHome,away,historyLabel,count,matches,settled,similar,unavailable,empty,cutoffLabel,criteria]=marketCopy[lang]||marketCopy.en;
    const num=new Intl.NumberFormat(lang);
    const percent=new Intl.NumberFormat(lang,{style:'percent',minimumFractionDigits:2,maximumFractionDigits:2});
    const period=new Intl.DateTimeFormat(lang==='en'?'en-GB':lang,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
    const cutoff=new Intl.DateTimeFormat(lang==='en'?'en-GB':lang,publicSample
      ? {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short',timeZone:'Europe/Bucharest'}
      : {dateStyle:'short',timeStyle:'short',timeZone:'Europe/Bucharest'});
    const tally=(hits,n)=>count.replace('{hits}',num.format(hits)).replace('{n}',num.format(n));
    const range=record=>record.from===record.to?period.format(new Date(record.from))
      : period.formatRange(new Date(record.from),new Date(record.to));
    const recordDates=record=>[record.settled?range(record):'',cutoffLabel.replace('{cutoff}',cutoff.format(instant(record.as_of)))].filter(Boolean).join(' · ');
    const format=(record,unit)=>`${tally(record.hits,record.settled)} ${lang==='ro' && unit===matches && record.settled%100>0 && record.settled%100<20?'meciuri':unit} (${percent.format(record.hits/record.settled)})`;
    const candidate=verifiedRecord(item.league_record,identity,'league');
    const seasonMatches = dossier?.season != null && candidate?.season === Number(dossier.season);
    const league = publicSample
      ? ((!dossier || seasonMatches) && instant(candidate?.as_of) === identity.captured ? candidate : null)
      : (dossier?.season && !seasonMatches ? null : candidate);
    const leaguePhase=league?.phase?.toLowerCase?.();
    const group=leaguePhase==='2. lig white group'?white:leaguePhase==='2. lig red group'?red
      : leaguePhase && leaguePhase!=='regular season'?league.phase:'';
    const leagueName=group?`${leagueLabel}, ${group}`:leagueLabel;
    const teams=root.PoseidonProContext?.marketFrequency(dossier,identity.fixture,identity.key);
    const record=verifiedRecord(item.pro_market_record,identity,'pro');
    const pro=publicSample && instant(record?.as_of)!==identity.captured ? null : record;
    if (edition) {
      const metric = (title,record,description) => {
        const value = record?.settled ? tally(record.hits,record.settled) : record ? empty : unavailable;
        const detail = record?.settled ? [identity.market, description, range(record)].join(' · ') : '';
        return edition.metric(title,value,detail);
      };
      const period=identity.key==='ht_over_0_5'?'HT':'FT90';
      return metric(edition.label('league'),league,period) +
        metric(edition.label('history'),pro,pro ? edition.label('outcomes').replace('{hits}',num.format(pro.hits)).replace('{misses}',num.format(pro.settled-pro.hits)) + ' · '+period : '');
    }
    const band=pro?.band;
    const bandCovered=band && validCounts(band) && band.settled>0 && band.settled<=pro.settled
      && band.hits<=pro.hits && band.settled-band.hits<=pro.settled-pro.hits
      && Number.isFinite(band.min_pct) && Number.isFinite(band.max_pct) && band.min_pct>=0 && band.max_pct<=100
      && band.min_pct<=identity.estimate && identity.estimate<=band.max_pct;
    const notes=pro?`<small>${escapeText((publicSample ? proSource + ' · ' : '') + recordDates(pro))}</small>${!publicSample && bandCovered?`<small data-pro-similar>${escapeText(`${similar} (${num.format(band.min_pct)}–${num.format(band.max_pct)}%) · ${tally(band.hits,band.settled)}`)}</small>`:''}<small>${escapeText(criteria)}</small>`:'';
    const leaguePeriod=league?.settled?`<small>${escapeText(publicSample
      ? leagueSource.replace('{season}',String(league.season)) + ' · ' + recordDates(league)
      : leagueName + ' · ' + recordDates(league))}</small>`:'';
    const publicFormat=(record,template)=>{
      const n=record.settled;
      const roDe=n%100===0 || n%100>=20 ? ' de' : '';
      const fields={
        hits:num.format(record.hits),n:num.format(n),de:roDe,goals:num.format(identity.goals),
        games:n===1?'meci':'meciuri',picks:n===1?'pronostic':'pronosticuri',market:identity.market,
        had:record.hits===1?'a avut':'au avut',met:record.hits===1?'a îndeplinit':'au îndeplinit',
      };
      return template.replace(/\{(\w+)\}/g,(_,field)=>fields[field]) + ` (${percent.format(record.hits/n)})`;
    };
    const leagueSummary=`<b>${escapeText(leagueName)}</b> · ${escapeText(league?.settled
      ? (publicSample ? publicFormat(league,identity.goals ? totalLeague : otherLeague) : format(league,matches))
      : league ? empty : unavailable)}`;
    const leagueMarkup=publicSample && league?.settled
      ? `<details data-pro-league><summary>${leagueSummary}</summary>${leaguePeriod}</details>`
      : `<p data-pro-league>${leagueSummary}</p>`;
    const venues=`<p data-pro-venues><b>${escapeText(teamsLabel)}</b>${teams?teams.map(team=>`<span>${escapeText(`${team.name} ${team.home?atHome:away} · ${team.n?tally(team.hits,team.n):'—'}`)}</span>`).join(''):` · ${escapeText(unavailable)}`}</p>`;
    return `<div class="dossier-market-evidence">
      ${leagueMarkup}
      <details data-pro-history><summary><b>${escapeText(historyLabel)}</b> · ${escapeText(pro?.settled?(publicSample?publicFormat(pro,publicPro):format(pro,settled)):pro?empty:unavailable)}</summary>${notes}${publicSample?'':leaguePeriod}${venues}</details>
    </div>`;
  }
  const matchReading = {
    ro: ['Ce arată datele de dinaintea meciului','{team} a marcat {average} goluri pe meci în {n} deplasări (modelul estima {estimate}).','{home} a primit {one} din cele {all} goluri de acasă într-un singur meci, {score} cu {opponent}.'],
    en: ['What the pre-match data showed','{team} scored {average} goals per game across {n} league away matches. The model expected {estimate}.','{home} conceded {one} of their {all} home goals in one match, a {score} against {opponent}.'],
    es: ['Qué mostraban los datos previos al partido','{team} marcó {average} goles por partido en {n} salidas de liga. El modelo estimaba {estimate}.','{home} recibió {one} de sus {all} goles en casa en un partido, un {score} contra {opponent}.'],
    it: ['Cosa mostravano i dati prepartita','{team} ha segnato {average} gol a partita in {n} trasferte di campionato. Il modello ne stimava {estimate}.','{home} ha subito {one} dei suoi {all} gol in casa in una partita, {score} contro {opponent}.'],
    fr: ['Ce que montraient les données d’avant-match','{team} a marqué {average} buts par match en {n} déplacements de championnat. Le modèle en attendait {estimate}.','{home} a encaissé {one} de ses {all} buts à domicile en un match, un {score} contre {opponent}.'],
    id: ['Apa yang ditunjukkan data prapertandingan','{team} mencetak {average} gol per laga dalam {n} laga tandang liga. Model memperkirakan {estimate}.','{home} kebobolan {one} dari {all} gol kandang dalam satu laga, {score} melawan {opponent}.'],
  };
  function preMatchReading(item,fixture,day,facts,lang) {
    const original=item.provenance;
    const match=original?.inputs?.match;
    const kickoff=instant(original?.original_kickoff_utc),captured=instant(original?.inputs_captured_at_utc),generated=instant(original?.generated_at_utc);
    if (!facts?.away || !facts.home || match?.fixture_id!==fixture || match.date!==day
      || !(captured<=generated && generated<kickoff) || !Number.isFinite(match.xg_away)) return '';
    const {away,home}=facts;
    if (away.scored/away.n >= match.xg_away || !home.worst?.opponent || home.worst.conceded<=0) return '';
    const [title,comparison,concentration]=matchReading[lang]||matchReading.en;
    const n=new Intl.NumberFormat(lang,{minimumFractionDigits:2,maximumFractionDigits:2});
    const fill=line=>escapeText(line.replace(/\{(\w+)\}/g,(_,key)=>({
      team:away.name,average:n.format(away.scored/away.n),n:away.n,estimate:n.format(match.xg_away),
      home:home.name,one:home.worst.conceded,all:home.conceded,score:`${home.worst.scored}–${home.worst.conceded}`,opponent:home.worst.opponent,
    })[key]));
    return `<div class="dossier-reading"><h3>${title}</h3><p>${fill(comparison)} ${fill(concentration)}</p></div>`;
  }
  function dossierReport(html,item,dossier,day,lang,sourceLang=lang,publicSample=false,edition=null) {
    const data=presentationSections(sections(html),sourceLang);
    const inputs=item.provenance?.inputs;
    const contextual=inputs?.selection_mode==='contextual';
    const contextualPicks=contextual?contextualSelections(inputs?.picks,lang,item.match):[];
    const structured=contextual?contextualPicks[0]:structuredSelection(inputs?.picks,lang);
    const selection=structured || (!contextual ? data.selection : null);
    const emptySelection=(noSelection[lang] || noSelection.en);
    if (edition?.compact) {
      return `<div class="sample-preview-selection"><span>${escapeText(edition.label('pick'))}</span><strong>${escapeText(selection?.market || emptySelection)}</strong></div>`;
    }
    const dossierApi=root.PoseidonProContext;
    const fixture=Number(item.match?.fixture_id);
    const key=selection?.key || (selection?.goals ? `over_${selection.goals-1}_5` : null);
    const identity={fixture,day,key,kickoff:item.provenance?.original_kickoff_utc,
      publication:item.provenance?.generated_at_utc,captured:instant(item.provenance?.inputs_captured_at_utc),goals:selection?.goals,market:selection?.market || '',estimate:Number(selection?.probability?.replace('%','').replace(',','.'))};
    const evidence=key?marketSummary(item,dossier,identity,lang,publicSample,edition):'';
    const goals=contextual?null:structured?.goals;
    const facts=goals?dossierApi?.goalEvidence(dossier,fixture,goals):null;
    const snapshot=instant(dossier?.as_of),published=instant(identity.publication);
    const reading=snapshot<=published?preMatchReading(item,fixture,day,facts,lang):'';
    const conclusion=(data.thesis[0]||data.other[0])?.replace(/^<p\b[^>]*>\s*(?:⚡\s*)?<strong[^>]*>[^<]*<\/strong>\s*/u,'<p>')||'';
    const receipt=instant(item.site_published_at_utc);
    const kickoff = instant(identity.kickoff);
    const publishedOnTime = published<=receipt && receipt<kickoff && (!publicSample || receipt <= Date.now());
    const pickLabel=(archiveCopy[lang]||archiveCopy.en)[publishedOnTime?0:1];
    const w=words[lang]||words.en;
    const review=data.review.map(block=>reviewMarkup(block,sourceLang)).join('');
    const [,,,,,awaiting,unavailable] = sampleCopy[lang] || sampleCopy.en;
    const reviewStatus = (publicSample || edition) && !review ? ` · ${Date.now() < kickoff ? awaiting : unavailable}` : '';
    if (edition) {
      const label=edition.label;
      const hasPublicationTime = publicSample ? Number.isFinite(receipt) && receipt <= Date.now() : publishedOnTime;
      const publicationTime=hasPublicationTime ? new Intl.DateTimeFormat(lang==='en'?'en-GB':lang,
        {hour:'2-digit',minute:'2-digit',timeZone:'Europe/Bucharest',timeZoneName:'short'}).format(receipt) : '';
      const note=[(selection || !contextual) && pickLabel,publicationTime].filter(Boolean).join(' · ');
      const pick = edition.metric(label('pick'),selection?.market || (contextual ? emptySelection : '—'),note);
      const model = (selection?.probability || !contextual)
        ? edition.metric(label('probability'),selection?.probability || '—',selection?.market || '',
          publicSample && selection?.probability ? label('matchEstimate') : '') : '';
      const writing=(key,blocks)=>blocks.length ? `<section class="edition-paragraph" lang="${escapeText(sourceLang)}"><h4 lang="${escapeText(lang)}">${escapeText(label(key))}</h4>${blocks.map(contentOnly).join('')}</section>` : '';
      const counts=item.provenance?.inputs?.cifre;
      const home=counts?.gazda_acasa?.n, away=counts?.oaspeti_depl?.n;
      const sampleSize=[home,away].every(n=>Number.isSafeInteger(n) && n>=0)
        ? [`<p lang="${escapeText(lang)}">${escapeText(label('samples').replace('{home}',home).replace('{away}',away))}</p>`] : [];
      const watch = publicSample ? data.watch.filter(block => plain(contentOnly(block))) : [];
      const limitation = watch.length ? watch : sampleSize;
      const verificationHeading = `<h4>${escapeText(label('verification'))}</h4>`;
      const reviewBlock=publicSample
        ? `<section class="edition-paragraph">${verificationHeading}<p role="status" data-sample-result>${escapeText(Date.now() < kickoff ? awaiting : label('resultLoading'))}</p></section>`
        : `<section class="edition-paragraph">${verificationHeading}<details class="dossier-review"${review?' open':' data-review-lookup'}><summary>${w[2]}${reviewStatus}</summary><div data-dossier-review-content aria-live="polite">${review || `<p>${w[8]}</p>`}</div></details></section>`;
      // Keep the published reasoning and explicit limitations in the full article.
      const sourcePicks=contextual?contextualSelections(inputs?.picks,sourceLang,item.match):[];
      const sourcePick=sourcePicks[0];
      const argument=contextual ? contextualArgument(data.primaryText,
        sourcePick ? [sourcePick.market,sourcePick.sourceMarket] : [noSelection[sourceLang],noSelection.ro]) : data.selectionArgument;
      const recordedArgument = argument ? `<p>${escapeText(argument)}</p>` : '';
      const alternatives=contextualPicks.slice(1).map((pick,i)=>({
        ...pick,argument:data.alternativeText.map(line=>contextualArgument(line,[sourcePicks[i+1]?.market,sourcePicks[i+1]?.sourceMarket])).find(Boolean)
      }));
      return `<div class="edition-metrics">${pick}${model}${evidence}</div>` +
        writing('verdict',data.thesis.length ? data.thesis : data.other.slice(0,1)) +
        writing('arguments',[...(contextual && recordedArgument ? [recordedArgument] : []),...data.evidence,...data.context])
        + alternativeMarkup(alternatives,lang) + writing('limitations',limitation) + reviewBlock;
    }
    const estimate=selection?.probability ? ' · '+escapeText(selection.probability) : '';
    const heading=selection ? `<span>${pickLabel}</span> · <strong>${escapeText(selection.market)}${estimate}</strong>`
      : contextual ? `<strong>${escapeText(emptySelection)}</strong>` : '';
    return `${heading ? `<p class="dossier-published">${heading}</p>` : ''}${(!publicSample && reading) || `<div lang="${escapeText(sourceLang)}">${conclusion}</div>`}${evidence}<details class="dossier-review"${review?'':' data-review-lookup'}><summary>${w[2]}${reviewStatus}</summary><div data-dossier-review-content aria-live="polite">${review || `<p>${w[8]}</p>`}</div></details>`;
  }
  // Observed historical tier labels; anchored to the start, never narrative words.
  const tierNames = 'Base|Main pick|Main|Bold pick|Bold|Curajos|Arriesgado|Atrevido|Coraggioso|Bază|Baza|Principal|Principale|Principali|Audaz|Audace|Audacieux|Utama|Berani|Dasar|Siguranță|Safe pick|Safe|Safety|Seguridad|Sicurezza|Sécurité|Aman|Keamanan|Banker|Core|Foundation|Value pick|Risky pick|Audacios';
  const tierPrefix = new RegExp('^(?:\\s|-|[🔒🎯💎]|\\*|<strong>)*?(?:'+tierNames+')\\s*:\\s*(?:\\*\\*)?\\s*(?:</strong>)?\\s*','iu');
  const taggedTierPrefix = /^(?:\s|-|[🔒🎯💎]|\*|<strong>)*?<span\b[^>]*\bdata-archive-role=(["'])(baza|principal|curajos)\1[^>]*>[^<]*<\/span>\s*:\s*(?:<\/strong>)?\s*/iu;
  const tierCell = new RegExp('^(?:'+tierNames+')$','iu');
  const primaryPrefix = /^(?:[-–]\s*|🎯\s*|\*\*\s*)*(?:Main(?: pick)?|Principal(?:e)?|Utama)\s*:/iu;
  function plain(html) { return html.replace(/<[^>]*>/g, '').trim(); }
  function stripTier(html) {
    let text=html, prefix;
    // Some archived generators prepended a tier to a source line which already had one.
    while ((prefix=text.match(taggedTierPrefix) || text.match(tierPrefix))) {
      const opens=(prefix[0].match(/<strong>/g)||[]).length;
      const closes=(prefix[0].match(/<\/strong>/g)||[]).length;
      text='<strong>'.repeat(Math.max(0,opens-closes))+text.slice(prefix[0].length);
    }
    return text;
  }
  function recordedSelection(inner) {
    const tagged = inner.match(taggedTierPrefix);
    if (tagged ? tagged[2] !== 'principal' : !primaryPrefix.test(plain(inner))) return null;
    const match=plain(stripTier(inner)).match(/^(.+?)\s+[—–-]\s+(\d+(?:[.,]\d+)?\s*%)(?:\s|[.—–]|$)/u);
    if (!match) return null;
    const [,market,probability]=match;
    const total=market.match(/^(?:Peste|Over|Más de|Plus de|Di atas)\s+([123])[.,]5(?:\s+(?:goluri|goals|goles|buts|gol))?$/iu);
    const result={market,probability,goals:total?Number(total[1])+1:null};
    const directional=market.match(/(?:^|\()(1X|X2)\)?$/);
    if (directional) result.key='dc_'+directional[1].toLowerCase();
    return result;
  }
  const noSelection={ro:'Fără selecție',en:'No selection',es:'Sin selección',it:'Nessuna selezione',fr:'Aucune sélection',id:'Tidak ada pilihan'};
  const alternativeCopy={
    ro:['Alternative pentru același meci','Alternativă'], en:['Alternatives for this match','Alternative'],
    es:['Alternativas para este partido','Alternativa'], it:['Alternative per questa partita','Alternativa'],
    fr:['Alternatives pour ce match','Alternative'], id:['Alternatif untuk laga ini','Alternatif'],
  };
  function alternativeMarkup(picks,lang) {
    if (!picks.length) return '';
    const [heading,role]=alternativeCopy[lang] || alternativeCopy.en;
    return `<section class="edition-paragraph" data-pro-alternatives><h4>${heading}</h4><ul>${picks.map(pick=>
      `<li data-pro-alternative-key="${escapeText(pick.key)}"><strong>${role} · ${escapeText(pick.market)}${pick.probability?' · '+escapeText(pick.probability):''}</strong>${pick.argument?`<p>${escapeText(pick.argument)}</p>`:''}</li>`
    ).join('')}</ul></section>`;
  }
  function contextualArgument(text, labels) {
    text=text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g,value=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[value]));
    for (const label of labels) {
      if (typeof label!=='string' || !label || !text.startsWith(label)) continue;
      const tail=text.slice(label.length).match(/^(?:\s+[—–-]\s+\d+(?:[.,]\d+)?\s*%)?[.·]\s*(.+)$/u);
      if (tail) return tail[1];
    }
    return '';
  }
  const contextualMarkets={
    ht_over_0_5:{ro:'Peste 0,5 goluri în prima repriză',en:'Over 0.5 first-half goals',es:'Más de 0,5 goles en la primera parte',it:'Over 0,5 gol nel primo tempo',fr:'Plus de 0,5 but en première mi-temps',id:'Di atas 0,5 gol babak pertama'},
    btts:{ro:'Ambele marchează',en:'Both teams to score',es:'Ambos marcan',it:'Entrambe segnano',fr:'Les deux équipes marquent',id:'Kedua tim mencetak gol'},
    ng:{ro:'Cel puțin o echipă nu marchează',en:'At least one team fails to score',es:'Al menos un equipo no marca',it:'Almeno una squadra non segna',fr:'Au moins une équipe ne marque pas',id:'Setidaknya satu tim tidak mencetak gol'},
  };
  const teamGoalsCopy={
    ro:['{team} marchează cel puțin 2 goluri în 90 de minute','Gazda','Oaspetele'],
    en:['{team} to score at least 2 goals in 90 minutes','Home team','Away team'],
    es:['{team} marca al menos 2 goles en 90 minutos','Equipo local','Equipo visitante'],
    it:['{team} segna almeno 2 gol in 90 minuti','Squadra di casa','Squadra ospite'],
    fr:['{team} marque au moins 2 buts en 90 minutes','Équipe à domicile','Équipe à l’extérieur'],
    id:['{team} mencetak minimal 2 gol dalam 90 menit','Tim tuan rumah','Tim tamu'],
  };
  const totalRangesCopy={
    ro:'{bounds} goluri în total după 90 de minute, inclusiv',en:'{bounds} total goals after 90 minutes, inclusive',
    es:'{bounds} goles totales tras 90 minutos, ambos incluidos',it:'{bounds} gol totali dopo 90 minuti, estremi inclusi',
    fr:'{bounds} buts au total après 90 minutes, bornes incluses',id:'{bounds} gol total setelah 90 menit, batas termasuk',
  };
  function contextualSelections(picks,lang,match) {
    if (!Array.isArray(picks) || picks.length<1 || picks.length>3) return [];
    if (new Set(picks.map(pick=>pick?.key)).size!==picks.length) return [];
    const primary=picks.filter(pick=>pick?.rol==='Principal');
    const alternatives=picks.filter(pick=>pick?.rol==='Alternativă');
    if (primary.length!==1 || alternatives.length!==picks.length-1) return [];
    const normalized=[...primary,...alternatives].map(pick=>{
      const selection=structuredSelection([{...pick,rol:'Principal'}],lang,true,match);
      return selection && {...selection,sourceMarket:pick.piata};
    });
    return normalized.every(Boolean)?normalized:[];
  }
  function structuredSelection(picks,lang,contextual=false,match) {
    if (!Array.isArray(picks)) return null;
    const primary=picks.filter(pick=>pick?.rol==='Principal');
    if (primary.length!==1) return null;
    const {key,p,piata}=primary[0];
    const validProbability=Number.isFinite(p) && p>=0 && p<=100;
    if (typeof key!=='string' || (!validProbability && (!contextual || p!=null))) return null;
    const labels=Object.hasOwn(contextualMarkets,key) ? contextualMarkets[key] : null;
    const over=key.match(/^over_([123])_5$/);
    const under=key.match(/^under_([23])_5$/);
    const team=key.match(/^team_goals_(home|away)_2_plus$/);
    const bounds=key.match(/^total_goals_(2)_(3|4)$|^total_goals_(3)_(5)$/);
    if (contextual && !labels && !over && !under && !team && !bounds) return null;
    const contextualTotalCopy={
      ro:['Peste {n} goluri','Sub {n} goluri'], en:['Over {n} goals','Under {n} goals'],
      es:['Más de {n} goles','Menos de {n} goles'], it:['Over {n} gol','Under {n} gol'],
      fr:['Plus de {n} buts','Moins de {n} buts'], id:['Di atas {n} gol','Di bawah {n} gol'],
    };
    const format=contextual ? (contextualTotalCopy[lang] || contextualTotalCopy.en)[under ? 1 : 0] : under ? {ro:'Sub {n} goluri în meci',en:'Under {n} total goals',es:'Menos de {n} goles en el partido',
      it:'Under {n} gol totali',fr:'Moins de {n} buts dans le match',id:'Di bawah {n} gol total'}[lang] || 'Under {n} total goals'
      : {ro:'Peste {n} goluri în meci',en:'Over {n} total goals',es:'Más de {n} goles en el partido',
        it:'Over {n} gol totali',fr:'Plus de {n} buts dans le match',id:'Di atas {n} gol total'}[lang] || 'Over {n} total goals';
    const total=over || under;
    const number=new Intl.NumberFormat(lang,{maximumFractionDigits:2});
    const [teamFormat,homeLabel,awayLabel]=teamGoalsCopy[lang] || teamGoalsCopy.en;
    const teamMarket=team && teamFormat.replace('{team}',()=>match?.[team[1]] || (team[1]==='home'?homeLabel:awayLabel));
    const rangeMarket=bounds && (totalRangesCopy[lang] || totalRangesCopy.en).replace('{bounds}',`${bounds[1] || bounds[3]}–${bounds[2] || bounds[4]}`);
    const market=total ? format.replace('{n}',number.format(Number(total[1])+.5))
      : teamMarket || rangeMarket || (labels && (labels[lang] || labels.en)) || {dc_1x:'1X',dc_x2:'X2',dc_12:'12'}[key] || (typeof piata==='string' ? piata : '');
    return market ? {market,probability:validProbability?number.format(p)+'%':'',goals:over?Number(over[1])+1:null, key} : null;
  }
  function sections(html) {
    const out = {thesis:[],context:[],evidence:[],watch:[],markets:[],review:[],other:[],original:html,selection:null,selectionArgument:'',primaryText:'',alternativeText:[],contextual:null,contextualAlternatives:[]};
    const selections=[];
    const primaryText=[];
    let contextualEntry;
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
      if (/^\s*(?:ℹ|\*?\s*(?:informativ(?:o|e)?|informational)\b.*18\+)/iu.test(text)) continue;
      if (/arhiva\.sect\.verdict/.test(block)||/^⚡/.test(text)) group='thesis';
      else if (/arhiva\.sect\.context/.test(block)||/^📊/.test(text)) group='context';
      else if (/arhiva\.sect\.model/.test(block)||/^🧮/.test(text)) group='evidence';
      else if (/arhiva\.sect\.urmarit/.test(block)||/^👁/.test(text)) group='watch';
      else if (isMarketsHeading(block,text)) group='markets';
      if (/pro-verificat|pro\.card\.(?:maine|verif)/.test(block)) {out.review.push(block);continue;}
      if (group==='markets') {
        if (isMarketsHeading(block,text)) continue;
        const items=block.match(/<li\b[^>]*>([\s\S]*?)<\/li>/gi) || [block];
        for (const item of items) {
          const inner=item.replace(/^<(?:li|p)\b[^>]*>/i,'').replace(/<\/(?:li|p)>$/i,'');
          const contextual=item.match(/^<li\b[^>]*\bdata-pro-contextual-key="([a-z0-9_]*)"(?:\s+data-pro-contextual-p="([^"]*)")?(?:\s+data-pro-contextual-role="(principal|alternative)")?/);
          if (contextual) {
            const market=inner.match(/<strong\s+data-pro-contextual-market>([\s\S]*?)<\/strong>/)?.[1];
            contextualEntry={key:contextual[1],p:contextual[2] ? Number(contextual[2]) : undefined,market:market && plain(market)};
            if (contextual[3]==='alternative') out.contextualAlternatives.push(contextualEntry);
            else out.contextual=contextualEntry;
            continue;
          }
          if (/^<li\b[^>]*\bdata-pro-contextual-reason(?:[ >])/i.test(item)) {
            if (contextualEntry===out.contextual) out.selectionArgument=plain(inner);
            else if (contextualEntry) contextualEntry.argument=plain(inner);
            continue;
          }
          const alternate=plain(inner).match(/^\s*↪️?\s*[^:]+:\s*(.+)$/u);
          if (alternate) out.alternativeText.push(alternate[1]);
          if (primaryPrefix.test(plain(inner))) primaryText.push(plain(stripTier(inner)));
          // A declined selection is not a historical prediction. Retain it in the original report only.
          const alternative = inner.match(taggedTierPrefix)?.[2] === 'curajos'
            || /^(?:-?\s*💎\s*)?(?:<strong>)?(?:Bold|Curajos|Arriesgado|Audaz|Audace|Audacieux|Berani)[^:]*:/i.test(inner);
          if (alternative && !/^.+?\s+[—–-]\s+\d+(?:[.,]\d+)?\s*%/u.test(plain(stripTier(inner)))) continue;
          const selection=recordedSelection(inner);
          if (selection) {
            const argument = plain(stripTier(inner)).match(/^[\s\S]*?\d+(?:[.,]\d+)?\s*%[.·]\s*(.+)$/u)?.[1] || '';
            selections.push({selection,argument});
          }
          out.markets.push(stripTier(inner));
        }
      } else out[group].push(block);
    }
    if (selections.length===1) {
      out.selection=selections[0].selection;
      out.selectionArgument=selections[0].argument;
    }
    if (primaryText.length===1) out.primaryText=primaryText[0];
    return out;
  }
  function isMarketsHeading(block,text) {
    return /arhiva\.sect\.piete/.test(block)||/^🎯\s*(?:Picks\b|Pronostic(?:uri|i)?\b|Pilihan\b|Previsioni\b|Pronósticos\b|Model selections\b|Selecții\b|Selecciones\b|Selezioni\b|Sélections\b)/iu.test(text);
  }
  const legacyAdvice = {
    ro: [/E pick de cotă, cu risc asumat\./gu,'Selecție alternativă, cu risc mai ridicat.',/E pick de cotă\./gu,'Selecție alternativă.'],
    en: [/It['’]s an odds pick, with the risk accepted\./gu,'Higher-risk alternative selection.',/It['’]s an odds pick\./gu,'Alternative selection.'],
    es: [/Es un pick de cuota, con riesgo asumido\./gu,'Selección alternativa de mayor riesgo.',/Es un pick de cuota\./gu,'Selección alternativa.'],
    it: [/È un pick di quota, con rischio assunto\./gu,'Selezione alternativa con rischio più elevato.',/È un pick di quota\./gu,'Selezione alternativa.'],
    fr: [/C['’]est un pick de cote, avec un risque assumé\./gu,'Sélection alternative plus risquée.',/C['’]est un pick de cote\./gu,'Sélection alternative.'],
    id: [/Ini pick odds, dengan risiko yang disadari\./gu,'Pilihan alternatif dengan risiko lebih tinggi.',/Ini pick odds\./gu,'Pilihan alternatif.'],
  };
  function presentationSections(data, lang) {
    const copy = legacyAdvice[lang];
    if (!copy) return data;
    const [withRisk, riskCopy, generic, genericCopy] = copy;
    const display = value => value.replace(withRisk,riskCopy).replace(generic,genericCopy);
    for (const key of ['thesis','context','evidence','watch','markets','other']) data[key] = data[key].map(display);
    data.selectionArgument = display(data.selectionArgument);
    return data;
  }
  function cleanReview(html) {
    // The first audit column is an editorial tier, not an outcome. Keep every market and result.
    return html.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi,(row,inside)=>{
      const first=inside.match(/^\s*<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/i);
      if (!first) return row;
      if (/arhiva\.th\.pick|\bdata-archive-role=/.test(first[0]) || tierCell.test(plain(first[2]))) return row.replace(first[0],'');
      return row;
    });
  }
  const contextWords={en:['At home','Away','Goals scored / match','Goals conceded / match','Over 2.5 goals','matches','Position','points','Context & recent form'],ro:['Acasă','În deplasare','Goluri marcate / meci','Goluri primite / meci','Peste 2,5 goluri','meciuri','Loc','puncte','Context și forma recentă'],es:['En casa','Fuera','Goles marcados / partido','Goles recibidos / partido','Más de 2,5 goles','partidos','Posición','puntos','Contexto y forma reciente'],it:['In casa','In trasferta','Gol fatti / partita','Gol subiti / partita','Over 2,5 gol','partite','Posizione','punti','Contesto e forma recente'],fr:['À domicile','À l’extérieur','Buts marqués / match','Buts encaissés / match','Plus de 2,5 buts','matchs','Position','points','Contexte et forme récente'],id:['Kandang','Tandang','Gol dicetak / laga','Gol kebobolan / laga','Di atas 2,5 gol','laga','Posisi','poin','Konteks dan performa terbaru']};
  function escapeText(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  const editorialCopy = {
    ro: {
      premise:'Lectură pe datele de dinaintea meciului', retrospective:'Lectură retrospectivă din date premeci', support:'Ce susține', risk:'Rezerva',
      selection:'Selecția consemnată', record:'Detaliile analizei consemnate', contrary:'Istoricul pune selecția sub semnul întrebării',
      sizes:['acasă','în deplasare'],
    },
    en: {
      premise:'Reading based on pre-match data', retrospective:'Retrospective reading of pre-match data', support:'Supporting evidence', risk:'Risk',
      selection:'Recorded selection', record:'Recorded analysis details', contrary:'The venue records raise doubts about the selection',
      sizes:['at home','away'],
    },
    es: {
      premise:'Lectura con datos previos al partido', retrospective:'Lectura retrospectiva con datos previos al partido', support:'A favor', risk:'La reserva',
      selection:'Estimación registrada', record:'Detalles del análisis registrado',
      contrary:'El historial en este campo plantea dudas sobre la selección',
      sizes:['en casa','fuera'],
    },
    it: {
      premise:'Lettura basata sui dati prepartita', retrospective:'Lettura retrospettiva dei dati prepartita', support:'A favore', risk:'La riserva',
      selection:'Stima registrata', record:'Dettagli dell’analisi registrata',
      contrary:'I risultati sul campo mettono in dubbio la selezione',
      sizes:['in casa','in trasferta'],
    },
    fr: {
      premise:'Lecture à partir des données d’avant-match', retrospective:'Lecture rétrospective des données d’avant-match', support:'Arguments en faveur', risk:'La réserve',
      selection:'Estimation enregistrée', record:'Détails de l’analyse enregistrée',
      contrary:'Les résultats sur ce terrain invitent à la prudence',
      sizes:['à domicile','à l’extérieur'],
    },
    id: {
      premise:'Analisis berdasarkan data prapertandingan', retrospective:'Tinjauan retrospektif data prapertandingan', support:'Bukti pendukung', risk:'Catatan',
      selection:'Estimasi tercatat', record:'Rincian analisis tercatat',
      contrary:'Hasil di kandang dan tandang membuat pilihan ini meragukan',
      sizes:['di kandang','di tandang'],
    },
  };
  const resultCopy={
    ro:['Bilanțul lui {team} pe terenul de joc','{team} a evitat înfrângerea în {k} din {n} meciuri {venue} ({w} {win}, {d} {draw}).','{team} a câștigat {k} din {n} meciuri {venue}.','{team} are zero victorii în {n} meciuri {venue}'],
    en:['{team} at this venue','{team} avoided defeat in {k} of {n} matches {venue} ({w} {win}, {d} {draw}).','{team} won {k} of {n} matches {venue}.','{team} went winless in {n} matches {venue}'],
    es:['{team} en esta sede','{team} evitó la derrota en {k} de {n} partidos {venue} ({w} victorias, {d} empates).','{team} ganó {k} de {n} partidos {venue}.','{team} no ganó en sus {n} partidos {venue}'],
    it:['{team} su questo campo','{team} ha evitato la sconfitta in {k} partite su {n} {venue} ({w} vittorie, {d} pareggi).','{team} ha vinto {k} partite su {n} {venue}.','{team} non ha mai vinto in {n} partite {venue}'],
    fr:['{team} sur ce terrain','{team} a évité la défaite dans {k} matchs sur {n} {venue} ({w} victoires, {d} nuls).','{team} a gagné {k} matchs sur {n} {venue}.','{team} reste sans victoire en {n} matchs {venue}'],
    id:['{team} di tempat ini','{team} terhindar dari kekalahan dalam {k} dari {n} laga {venue} ({w} menang, {d} imbang).','{team} menang {k} dari {n} laga {venue}.','{team} tidak menang dalam {n} laga {venue}'],
  };
  const totalsCopy={
    ro:['De unde au venit golurile','Același prag, contribuții diferite','Pragul a fost depășit în {k} din {n} meciuri ale lui {team} {venue}.','{team} a marcat în {k} din {n} meciuri {venue} ({g} goluri).','Ambele echipe au marcat în {k} din {n} meciuri ale lui {team} {venue}.','{team} a marcat cel puțin {g} goluri în {k} din {n} meciuri {venue}.'],
    en:['Where the goals came from','Same goal line, different scoring patterns','{team}’s matches {venue} cleared the goal line in {k} of {n}.','{team} scored in {k} of {n} matches {venue} ({g} goals).','Both teams scored in {k} of {n} of {team}’s matches {venue}.','{team} scored at least {g} goals themselves in {k} of {n} matches {venue}.'],
    es:['De dónde llegaron los goles','Mismo umbral, perfiles distintos','Se superó el umbral en {k} de {n} partidos de {team} {venue}.','{team} marcó en {k} de {n} partidos {venue} ({g} goles).','Ambos equipos marcaron en {k} de {n} partidos de {team} {venue}.','{team} marcó al menos {g} goles en {k} de {n} partidos {venue}.'],
    it:['Da dove sono arrivati i gol','Stessa soglia, profili diversi','La soglia è stata superata in {k} partite su {n} di {team} {venue}.','{team} ha segnato in {k} partite su {n} {venue} ({g} gol).','Entrambe hanno segnato in {k} partite su {n} di {team} {venue}.','{team} ha segnato almeno {g} gol in {k} partite su {n} {venue}.'],
    fr:['D’où sont venus les buts','Même seuil, profils différents','Le seuil a été dépassé dans {k} matchs sur {n} de {team} {venue}.','{team} a marqué dans {k} matchs sur {n} {venue} ({g} buts).','Les deux équipes ont marqué dans {k} matchs sur {n} de {team} {venue}.','{team} a inscrit au moins {g} buts dans {k} matchs sur {n} {venue}.'],
    id:['Dari mana gol tercipta','Ambang sama, pola gol berbeda','Ambang gol terlewati dalam {k} dari {n} laga {team} {venue}.','{team} mencetak gol dalam {k} dari {n} laga {venue} ({g} gol).','Kedua tim mencetak gol dalam {k} dari {n} laga {team} {venue}.','{team} mencetak sedikitnya {g} gol dalam {k} dari {n} laga {venue}.'],
  };
  const venueGoalsCopy={
    ro: [
      ['meciuri acasă','deplasări'],
      '{team} a marcat în doar {k} din {n} {venue}',
      'O înfrângere grea schimbă imaginea apărării lui {team}',
      '{team} a primit puține goluri pe terenul relevant',
      '{team} a marcat de cel puțin {g} ori în {k} din {n} {venue}.',
      '{team} a primit cel mult {g} {unit} în {k} din {n} {venue}.',
      'Excepția a fost {score} cu {opponent}.',
      '{team} a înscris o singură dată în {k} din {n} {venue}.',
      '{team} a rămas fără gol în {k} din {n} {venue}.',
    ],
    en: [
      ['home games','away games'],
      '{team} scored in only {k} of {n} {venue}',
      'One heavy defeat skews the defensive record for {team}',
      '{team} have conceded few goals at this venue',
      '{team} scored at least {g} goals in {k} of {n} {venue}.',
      '{team} conceded at most {g} {unit} in {k} of {n} {venue}.',
      'The exception was the {score} defeat against {opponent}.',
      '{team} scored exactly once in {k} of {n} {venue}.',
      '{team} failed to score in {k} of {n} {venue}.',
    ],
    es: [
      ['partidos en casa','partidos fuera'],
      '{team} marcó en solo {k} de {n} {venue}',
      'Una goleada distorsiona el balance defensivo de {team}',
      '{team} encajó pocos goles en estos partidos',
      '{team} marcó al menos {g} goles en {k} de {n} {venue}.',
      '{team} encajó como máximo {g} {unit} en {k} de {n} {venue}.',
      'La excepción fue el {score} contra {opponent}.',
      '{team} marcó exactamente una vez en {k} de {n} {venue}.',
      '{team} se quedó sin marcar en {k} de {n} {venue}.',
    ],
    it: [
      ['partite in casa','trasferte'],
      '{team} ha segnato in appena {k} su {n} {venue}',
      'Una pesante sconfitta pesa sul bilancio difensivo di {team}',
      '{team} ha subito pochi gol in queste partite',
      '{team} ha segnato almeno {g} gol in {k} su {n} {venue}.',
      '{team} ha subito al massimo {g} {unit} in {k} su {n} {venue}.',
      'L’eccezione è il {score} contro {opponent}.',
      '{team} ha segnato una sola volta in {k} su {n} {venue}.',
      '{team} è rimasto a secco in {k} su {n} {venue}.',
    ],
    fr: [
      ['matchs à domicile','déplacements'],
      '{team} n’a marqué que dans {k} de ses {n} {venue}',
      'Une lourde défaite pèse sur le bilan défensif de {team}',
      '{team} a concédé peu de buts dans ces matchs',
      '{team} a marqué au moins {g} buts dans {k} de ses {n} {venue}.',
      '{team} a concédé au plus {g} {unit} dans {k} de ses {n} {venue}.',
      'Le {score} contre {opponent} fait exception.',
      '{team} a marqué exactement une fois dans {k} de ses {n} {venue}.',
      '{team} n’a pas marqué dans {k} de ses {n} {venue}.',
    ],
    id: [
      ['laga kandang','laga tandang'],
      '{team} hanya mencetak gol dalam {k} dari {n} {venue}',
      'Satu kekalahan telak membebani catatan pertahanan {team}',
      '{team} hanya kebobolan sedikit dalam laga-laga ini',
      '{team} mencetak sedikitnya {g} gol dalam {k} dari {n} {venue}.',
      '{team} kebobolan paling banyak {g} {unit} dalam {k} dari {n} {venue}.',
      'Pengecualiannya adalah kekalahan {score} melawan {opponent}.',
      '{team} mencetak tepat satu gol dalam {k} dari {n} {venue}.',
      '{team} gagal mencetak gol dalam {k} dari {n} {venue}.',
    ],
  };
  const goalUnits={ro:['gol','goluri'],en:['goal','goals'],es:['gol','goles'],it:['gol','gol'],fr:['but','buts'],id:['gol','gol']};
  const alternativeGoalsCopy={
    ro:['{team} a cedat multe goluri în acest lot','{team} a primit cel puțin {g} goluri în {k} din {n} {venue}.',
      '{team} a marcat de cel puțin {g} ori în doar {k} din {n} {venue}.','Ce arată scorurile recente ale echipelor'],
    en:['{team} conceded heavily in this sample','{team} conceded at least {g} goals in {k} of {n} {venue}.',
      '{team} scored at least {g} goals in only {k} of {n} {venue}.','What the recent scorelines show'],
    es:['{team} encajó muchos goles en esta muestra','{team} encajó al menos {g} goles en {k} de {n} {venue}.',
      '{team} marcó al menos {g} goles en solo {k} de {n} {venue}.','Qué muestran los últimos marcadores'],
    it:['{team} ha subito molti gol in questo campione','{team} ha subito almeno {g} gol in {k} su {n} {venue}.',
      '{team} ha segnato almeno {g} gol in appena {k} su {n} {venue}.','Cosa mostrano i risultati recenti'],
    fr:['{team} a concédé beaucoup de buts sur cet échantillon','{team} a concédé au moins {g} buts dans {k} de ses {n} {venue}.',
      '{team} n’a marqué au moins {g} buts que dans {k} de ses {n} {venue}.','Ce que montrent les derniers scores'],
    id:['{team} banyak kebobolan dalam sampel ini','{team} kebobolan sedikitnya {g} gol dalam {k} dari {n} {venue}.',
      '{team} mencetak sedikitnya {g} gol hanya dalam {k} dari {n} {venue}.','Apa yang terlihat dari skor terakhir'],
  };
  function contentOnly(html) {
    return html.replace(/^(<p\b[^>]*>)\s*(?:(?:⚡|📊|🧮|👁️?)\s*<strong\b[^>]*>|<strong\b[^>]*\bdata-i18n="arhiva\.sect\.[^"]+"[^>]*>)[^<]*<\/strong>\s*/u,'$1')
      .replace(/\*\*/g,'');
  }
  function editorialMarkup(data,lang,facts,retrospective=false) {
    const c=editorialCopy[lang]||editorialCopy.en;
    const role=team=>c.sizes[team.home?0:1];
    const {selection}=data;
    const evidence=(type,title,body)=>`<div class="report-argument report-argument-${type}"><h4>${title}</h4>${body}</div>`;
    const originalThesis=data.thesis.map(contentOnly).join('');
    const probability=selection?.probability ? ' · '+escapeText(selection.probability) : '';
    const estimate=selection?`<p class="report-estimate"><span>${c.selection}</span> <strong>${stripTags(selection.market)}${probability}</strong></p>`
      : data.contextual ? `<p class="report-estimate"><strong>${escapeText(noSelection[lang] || noSelection.en)}</strong></p>` : '';
    if (data.contextual) {
      const argument=data.selectionArgument ? `<p class="report-recorded-reason">${escapeText(data.selectionArgument)}</p>` : '';
      const alternatives=data.contextualAlternatives.map(entry=>{
        const selection=structuredSelection([{rol:'Principal',...entry}],lang,true);
        return selection && {...selection,market:entry.market || selection.market,argument:entry.argument};
      }).filter(Boolean);
      return `<section class="pro-editorial">${estimate}<div class="report-thesis">${originalThesis}</div>${argument}${alternativeMarkup(alternatives,lang)}</section>`;
    }
    const panel=(type,title,body)=>evidence(type,title,`<p>${escapeText(body)}</p>`);
    const reading=(headline,body)=>`<section class="pro-editorial">${estimate}<p class="report-premise">${retrospective?c.retrospective:c.premise}</p><div class="report-thesis"><p>${escapeText(headline)}</p></div>${body}</section>`;
    const fill=(template,team,k,g)=>template.replace(/\{([a-z]+)\}/g,(_,key)=>({
      team:team.name,k,g,n:team.n,venue:role(team),w:team.wins,d:team.draws,
      win:lang==='ro'?(team.wins===1?'victorie':'victorii'):(team.wins===1?'win':'wins'),
      draw:lang==='ro'?(team.draws===1?'egal':'egaluri'):(team.draws===1?'draw':'draws'),
    })[key]);
    if (facts?.covered) {
      const {covered,opponent}=facts;
      const [title,supportCopy,riskCopy,winless]=resultCopy[lang]||resultCopy.en;
      if ((covered.wins+covered.draws)*opponent.n<=opponent.wins*covered.n) {
        const conflict=fill(supportCopy,covered,covered.wins+covered.draws)+(opponent.wins>0?' '+fill(riskCopy,opponent,opponent.wins):'');
        return reading(c.contrary,panel('risk',c.risk,conflict));
      }
      const support=panel('support',c.support,fill(supportCopy,covered,covered.wins+covered.draws));
      if (opponent.wins===0) return reading(fill(winless,opponent),support);
      const risk=panel('risk',c.risk,fill(riskCopy,opponent,opponent.wins));
      return reading(fill(title,covered),support+risk);
    }
    if (!facts?.home || !selection?.goals) {
      const argument = data.selectionArgument ? `<p class="report-recorded-reason">${escapeText(data.selectionArgument)}</p>` : '';
      return `<section class="pro-editorial">${estimate}${selection?argument:`<div class="report-thesis">${originalThesis}</div>`}</section>`;
    }
    const {home,away}=facts;
    const [more,less]=home.threshold*away.n>=away.threshold*home.n?[home,away]:[away,home];
    const [,,cleared,scored]=totalsCopy[lang]||totalsCopy.en;
    const [venues,quiet,heavy,defensive,ownGoals,concedes,exception,once,scoreless]=venueGoalsCopy[lang]||venueGoalsCopy.en;
    const phrase=(template,team,k,g)=>template.replace(/\{([a-z]+)\}/g,(_,key)=>({
      team:team.name, k, g, n:team.n, venue:venues[team.home?0:1], unit:(goalUnits[lang]||goalUnits.en)[g===1?0:1],
      score:team.worst?`${team.worst.scored}–${team.worst.conceded}`:'', opponent:team.worst?.opponent,
    })[key]);
    const lowScoring = less.n-less.scoring;
    const resistance = less.concededBelow > lowScoring && less.concededBelow > 0;
    const outlier = less.worst?.opponent && less.concededBelow === less.n-1
      && less.worst.conceded - less.worst.scored >= 3 && less.worst.conceded * 2 > less.conceded;
    if (more.threshold*2<=more.n) {
      const [exposed,allowed,rareOwn,neutral]=alternativeGoalsCopy[lang]||alternativeGoalsCopy.en;
      const allowedHigh=team=>team.n-(team.concededBelow??team.n);
      const vulnerable=allowedHigh(home)*away.n>allowedHigh(away)*home.n?home:away;
      const other=vulnerable===home?away:home;
      if (allowedHigh(vulnerable)*2>vulnerable.n) {
        const support=panel('support',c.support,phrase(allowed,vulnerable,allowedHigh(vulnerable),selection.goals));
        const counter=panel('risk',c.risk,phrase(rareOwn,other,other.threshold,selection.goals));
        return reading(phrase(exposed,vulnerable),support+counter);
      }
      const summary=[home,away].filter(team=>team.total*2>team.n).map(team=>fill(cleared,team,team.total)).join(' ');
      return reading(neutral,(summary?panel('support',c.support,summary):'')
        +panel('risk',c.risk,phrase(rareOwn,more,more.threshold,selection.goals)));
    }
    const support=panel('support',c.support,phrase(ownGoals,more,more.threshold,selection.goals));
    if (resistance) {
      const counter=phrase(concedes,less,less.concededBelow,selection.goals-1)+(outlier?' '+phrase(exception,less):'');
      return reading(phrase(outlier?heavy:defensive,less),support+panel('risk',c.risk,counter));
    }
    const quietSide=lowScoring>=less.scoring;
    const headline=quietSide?phrase(quiet,less,less.scoring):fill(scored,more,more.scoring,more.scored);
    const counter=[
      !quietSide&&lowScoring>0?phrase(scoreless,less,lowScoring):'',
      more.once>0?phrase(once,more,more.once):'',
    ].filter(Boolean).join(' ');
    return reading(headline,support+(counter?panel('risk',c.risk,counter):''));
  }
  function stripTags(value) {
    // Source selection text has already been HTML-escaped; decoded text is never assigned as markup.
    return value.replace(/[<>"']/g,char=>({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  }
  function recordMarkup(data,lang) {
    if (data.selection || data.contextual) return '';
    const c=editorialCopy[lang]||editorialCopy.en;
    const items=data.markets.map(market=>plain(market).replace(/^(?:\s|[-–🔒🎯💎]|\*\*)+/u,'').replace(/\*\*/g,'')
      .match(/^.+?\s+[—–-]\s+\d+(?:[.,]\d+)?\s*%/u)?.[0])
      .filter(Boolean);
    if (!items.length) return '';
    return `<details class="report-original"><summary>${c.record}</summary><ul>${items.map(item=>`<li>${stripTags(item)}</li>`).join('')}</ul></details>`;
  }
  function comparison(data,container,lang) {
    if(!root.PoseidonProContext)return '';
    const header=container.closest('.pro-card')?.querySelector('.pro-card-head');
    const heading=header?.querySelector?.('h3')?.textContent||header?.textContent||'';
    const pair=heading.replace(/^\s*💎\s*/,'').split(' · ')[0].split(' – ');
    if(pair.length!==2)return '';
    const facts=root.PoseidonProContext.extract({evidence:data.evidence.join(''),context:data.context.join(''),home:pair[0].trim(),away:pair[1].trim(),language:lang});
    if(!facts)return '';
    const w=contextWords[lang]||contextWords.en;
    const sides=[facts.home,facts.away];
    const heads=sides.map((team,i)=>`<div><span class="report-team-role">${w[i]}</span><h4>${escapeText(team.name)}</h4><span class="report-team-sample">${team.sample} ${w[5]}</span>${team.rank!=null?`<p>${w[6]} ${team.rank} · ${team.points} ${w[7]}</p>`:''}</div>`).join('');
    const rows=[[w[2],facts.home.scored,facts.away.scored],[w[3],facts.home.conceded,facts.away.conceded],[w[4],facts.home.over25.hits+'/'+facts.home.over25.n,facts.away.over25.hits+'/'+facts.away.over25.n]];
    return `<div class="report-team-heads">${heads}</div><div class="report-team-rows">${rows.map(([label,h,a])=>`<div><b>${escapeText(h)}</b><span>${label}</span><b>${escapeText(a)}</b></div>`).join('')}</div>${data.context.length?`<details class="report-context-detail"><summary>${w[8]}</summary>${data.context.map(contentOnly).join('')}</details>`:''}`;
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
  const sourceStates=new WeakMap();
  const activePanels=new WeakMap();
  function enhance(container, refresh=false) {
    // i18n translates hidden source variants too. Do not freeze their display until selected.
    const languageVariant = container.closest('[data-lang]');
    if (languageVariant && languageVariant.hidden) return;
    if ((!refresh && container.dataset.proEnhanced)
      || container.closest('.pro-locked, [data-pro-locked], [data-public-pro-report]')) return;
    const original=sourceStates.get(container) ?? container.innerHTML;
    const data=sections(original);
    if (!data.thesis.length && !container.dataset.proMemberReport) return;
    const lang=container.lang || container.closest('[data-lang]')?.getAttribute('data-lang') || document.documentElement.lang || 'en';
    presentationSections(data,lang);
    sourceStates.set(container,original);
    const active=activePanels.get(container) ?? 0;
    const w=words[lang]||words.en;
    if (!data.thesis.length && data.other.length) {
      data.thesis=data.other.filter(line=>!tierPrefix.test(plain(line))).map(contentOnly);
    }
    const id='pro-report-'+(++serial);
    function block(title,items,css) {return items.length?`<section class="report-section ${css||''}"><h3>${title}</h3>${items.join('')}</section>`:'';}
    const published=structuredSelection(container.poseidonProSelection,lang);
    if (data.contextual) {
      data.selection=structuredSelection([{rol:'Principal',...data.contextual}],lang,true);
      if (data.selection && data.contextual.market) data.selection.market=data.contextual.market;
    } else if (published) {
      if (data.selection && (data.selection.goals !== published.goals || data.selection.key && data.selection.key !== published.key)) data.selectionArgument='';
      data.selection=published;
    }
    const fixture=Number(container.dataset.proFixture), dossiers=root.PoseidonProContext;
    const facts= data.selection?.goals
      ? dossiers?.goalEvidence?.(container.poseidonProDossier,fixture,data.selection.goals)
      : dossiers?.resultEvidence?.(container.poseidonProDossier,fixture,data.selection?.key);
    const analysis=editorialMarkup(data,lang,facts,Date.parse(container.poseidonProDossier?.match_date)<=Date.now());
    const context=(comparison(data,container,lang)||(data.context.map(contentOnly).join('')+block(w[4],data.evidence.map(contentOnly))))+block(w[5],data.watch.map(contentOnly));
    const review=data.review.map(html=>reviewMarkup(html,lang)).join('');
    container.dataset.proEnhanced='true';
    container.classList.add('pro-report');
    container.innerHTML=`<div class="report-tabs" role="tablist" aria-label="${w[10]}">${[0,1,2].map((n)=>`<button type="button" id="${id}-tab-${n}" role="tab" aria-selected="${n===active}" aria-controls="${id}-panel-${n}" tabindex="${n===active?0:-1}">${w[n]}</button>`).join('')}</div>${[analysis,context||`<p>${w[9]}</p>`,review||`<p>${w[8]}</p>`].map((content,n)=>`<div class="report-panel" role="tabpanel" id="${id}-panel-${n}" aria-labelledby="${id}-tab-${n}" ${n!==active?'hidden':''}>${content}</div>`).join('')}${recordMarkup(data,lang)}`;
    container.hidden=false;
    // Clones must not be translated a second time into old labels.
    container.querySelectorAll('.report-panel [data-i18n]').forEach(el=>el.removeAttribute('data-i18n'));
    const tabs=Array.from(container.querySelectorAll('.report-tabs [role="tab"]'));
    function activate(n) {activePanels.set(container,n);tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===n));tab.tabIndex=i===n?0:-1;container.querySelector('#'+id+'-panel-'+i).hidden=i!==n;});}
    tabs.forEach((tab,n)=>{tab.addEventListener('click',()=>activate(n));tab.addEventListener('keydown',e=>{if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(n+(e.key==='ArrowRight'?1:2))%3;activate(next);tabs[next].focus();});});
  }
  function scan() {document.querySelectorAll('.pro-card .pro-visible').forEach(container=>enhance(container));}
  function sourceMarkup(container) {return sourceStates.get(container) ?? container?.innerHTML;}
  function fullReading(html, lang) {
    const headings = {
      ro: 'Selecții', en: 'Selections', es: 'Selecciones', it: 'Selezioni', fr: 'Sélections', id: 'Pilihan',
    };
    return html.split(/<br\s*\/?>/i).map(line => line.trim()).filter(Boolean).map(line => {
      const content = plain(line);
      const isHeading = isMarketsHeading(line,content) || /^(?:🎯\s*)?Picks\s*:/iu.test(content);
      const paragraph = isHeading ? `<strong>${headings[lang] || headings.en}</strong>`
        : stripTier(line).replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g,'$1<em>$2</em>');
      return `<p>${paragraph}</p>`;
    }).join('');
  }
  function scan() {document.querySelectorAll('.pro-card .pro-visible').forEach(container=>enhance(container));}
  function sourceMarkup(container) {return sourceStates.get(container) ?? container?.innerHTML;}
  const api={sections,stripTier,cleanReview,editorialMarkup,recordMarkup,structuredSelection,contextualSelections,reviewMarkup,words,enhance,scan,sourceMarkup,dossierReport,archiveReviewLabels,fullReading};
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
