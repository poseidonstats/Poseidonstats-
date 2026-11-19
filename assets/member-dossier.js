/* Dosarul statistic folosește exclusiv datele servite de zona de membri. */
(function (root) {
  "use strict";
  const siteDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" });
  const labels = {
    ro: {
      open: "Dosarul meciului", member: "Membru", close: "Închide", tabs: ["Echipe", "Goluri", "Reprize", "Cornere"],
      scope: "Meciuri din competiție", scopes: ["Acasă / deplasare", "Toate meciurile"],
      home: "Acasă", away: "În deplasare", match: "meci", matches: "meciuri", metric: "Indicator",
      updated: "Date până la", season: "Sezon", loading: "Se încarcă dosarul…",
      missing: "Dosarul nu este disponibil pentru acest meci.", partial: "Acoperire parțială. Numitorul arată meciurile cu date confirmate din selecția curentă.",
      emptyHistory: "Încă nu avem meciuri confirmate în această competiție și în acest sezon.",
      emptyScope: "Nu avem meciuri confirmate pentru terenul selectat.", emptyHalves: "Nu avem scoruri confirmate la pauză pentru selecția curentă.",
      cornerCoverage: "Meciuri cu date / meciuri selectate. Valorile lipsă sunt marcate cu —.",
      perGame: "/ meci", latest: "Rezultate · cele mai recente primele",
      headers: ["Data", "Adversar", "Scor (echipa prima)"], outcomes: ["Victorii", "Egaluri", "Înfrângeri", "Puncte / meci"],
      goals: ["Goluri marcate", "Goluri primite", "Peste 2,5", "Ambele echipe au marcat", "Fără gol marcat", "Fără gol primit"],
      halves: ["Marcate în prima repriză", "Primite în prima repriză", "Marcate în a doua repriză", "Primite în a doua repriză", "În avantaj la pauză", "La egalitate la pauză", "Condusă la pauză"],
      corners: ["Cornere obținute", "Cornere cedate", "Total în meci"],
      login: "Sesiunea de membru trebuie reînnoită.", retry: "Încearcă din nou peste câteva momente.",
      viewEditorial: "Vezi analiza Pro", editorial: "Analiza Pro", editorialLoading: "Se încarcă analiza…", editorialMissing: "Nu există o analiză Pro publicată pentru acest meci.",
    },
    en: {
      open: "Match stats", member: "Member", close: "Close", tabs: ["Teams", "Goals", "By half", "Corners"],
      scope: "Matches in this competition", scopes: ["Home / away", "All matches"],
      home: "Home", away: "Away", match: "match", matches: "matches", metric: "Metric",
      updated: "Data as of", season: "Season", loading: "Loading match stats…",
      missing: "Match stats are unavailable.", partial: "Partial coverage. The denominator shows matches with confirmed data in this selection.",
      emptyHistory: "There are no confirmed matches in this competition and season yet.",
      emptyScope: "There are no confirmed matches for the selected venue.", emptyHalves: "There are no confirmed half-time scores for this selection.",
      cornerCoverage: "Matches with data / selected matches. Missing values show as —.",
      perGame: "/ match", latest: "Results · most recent first",
      headers: ["Date", "Opponent", "Score (team first)"], outcomes: ["Wins", "Draws", "Losses", "Points / match"],
      goals: ["Goals scored", "Goals conceded", "Over 2.5", "Both teams scored", "Failed to score", "Clean sheets"],
      halves: ["First-half goals scored", "First-half goals conceded", "Second-half goals scored", "Second-half goals conceded", "Ahead at half-time", "Level at half-time", "Behind at half-time"],
      corners: ["Corners won", "Corners conceded", "Match total"],
      login: "Renew your member session.", retry: "Try again in a moment.",
      viewEditorial: "View Pro report", editorial: "Pro match report", editorialLoading: "Loading the Pro report…", editorialMissing: "No Pro report was published for this match.",
    },
    es: {
      open: "Ficha del partido", member: "Miembro", close: "Cerrar", tabs: ["Equipos", "Goles", "Por parte", "Córneres"],
      scope: "Partidos en esta competición", scopes: ["Local / visitante", "Todos los partidos"],
      home: "Local", away: "Visitante", match: "partido", matches: "partidos", metric: "Indicador",
      updated: "Datos hasta", season: "Temporada", loading: "Cargando la ficha…",
      missing: "La ficha de este partido no está disponible.", partial: "Cobertura parcial. El denominador indica los partidos seleccionados con datos confirmados.",
      emptyHistory: "Aún no hay partidos confirmados en esta competición y temporada.",
      emptyScope: "No hay partidos confirmados en la sede seleccionada.", emptyHalves: "No hay resultados confirmados al descanso para esta selección.",
      cornerCoverage: "Partidos con datos / partidos seleccionados. Los valores ausentes se muestran con —.",
      perGame: "/ partido", latest: "Resultados · más recientes primero",
      headers: ["Fecha", "Rival", "Marcador (equipo primero)"], outcomes: ["Victorias", "Empates", "Derrotas", "Puntos / partido"],
      goals: ["Goles a favor", "Goles en contra", "Más de 2,5", "Ambos equipos marcaron", "Sin marcar", "Portería a cero"],
      halves: ["Goles a favor en la primera parte", "Goles en contra en la primera parte", "Goles a favor en la segunda parte", "Goles en contra en la segunda parte", "En ventaja al descanso", "Empate al descanso", "En desventaja al descanso"],
      corners: ["Córneres a favor", "Córneres en contra", "Total en el partido"],
      login: "Renueva tu sesión de miembro.", retry: "Inténtalo de nuevo en unos instantes.",
      viewEditorial: "Ver análisis Pro", editorial: "Análisis Pro", editorialLoading: "Cargando el análisis…", editorialMissing: "No se ha publicado un análisis Pro para este partido.",
    },
    it: {
      open: "Scheda della partita", member: "Membro", close: "Chiudi", tabs: ["Squadre", "Gol", "Per tempo", "Corner"],
      scope: "Partite in questa competizione", scopes: ["Casa / trasferta", "Tutte le partite"],
      home: "In casa", away: "In trasferta", match: "partita", matches: "partite", metric: "Indicatore",
      updated: "Dati aggiornati al", season: "Stagione", loading: "Caricamento della scheda…",
      missing: "La scheda non è disponibile per questa partita.", partial: "Copertura parziale. Il denominatore indica le partite selezionate con dati confermati.",
      emptyHistory: "Nessuna partita confermata in questa competizione e stagione.",
      emptyScope: "Nessuna partita confermata per il campo selezionato.", emptyHalves: "Nessun risultato confermato all’intervallo per questa selezione.",
      cornerCoverage: "Partite con dati / partite selezionate. I valori mancanti sono indicati con —.",
      perGame: "/ partita", latest: "Risultati · dal più recente",
      headers: ["Data", "Avversario", "Risultato (squadra per prima)"], outcomes: ["Vittorie", "Pareggi", "Sconfitte", "Punti / partita"],
      goals: ["Gol fatti", "Gol subiti", "Oltre 2,5", "Entrambe a segno", "Nessun gol fatto", "Nessun gol subito"],
      halves: ["Gol fatti nel primo tempo", "Gol subiti nel primo tempo", "Gol fatti nel secondo tempo", "Gol subiti nel secondo tempo", "In vantaggio all’intervallo", "In parità all’intervallo", "In svantaggio all’intervallo"],
      corners: ["Corner a favore", "Corner concessi", "Totale nella partita"],
      login: "Rinnova la sessione da membro.", retry: "Riprova tra qualche istante.",
      viewEditorial: "Vedi analisi Pro", editorial: "Analisi Pro", editorialLoading: "Caricamento dell’analisi…", editorialMissing: "Nessuna analisi Pro è stata pubblicata per questa partita.",
    },
    fr: {
      open: "Fiche du match", member: "Membre", close: "Fermer", tabs: ["Équipes", "Buts", "Par mi-temps", "Corners"],
      scope: "Matchs dans cette compétition", scopes: ["Domicile / extérieur", "Tous les matchs"],
      home: "Domicile", away: "Extérieur", match: "match", matches: "matchs", metric: "Indicateur",
      updated: "Données au", season: "Saison", loading: "Chargement de la fiche…",
      missing: "La fiche de ce match est indisponible.", partial: "Couverture partielle. Le dénominateur indique les matchs sélectionnés aux données confirmées.",
      emptyHistory: "Aucun match confirmé dans cette compétition et cette saison.",
      emptyScope: "Aucun match confirmé sur le terrain sélectionné.", emptyHalves: "Aucun score à la mi-temps confirmé pour cette sélection.",
      cornerCoverage: "Matchs avec données / matchs sélectionnés. Les valeurs manquantes sont indiquées par —.",
      perGame: "/ match", latest: "Résultats · du plus récent au plus ancien",
      headers: ["Date", "Adversaire", "Score (équipe en premier)"], outcomes: ["Victoires", "Nuls", "Défaites", "Points / match"],
      goals: ["Buts marqués", "Buts encaissés", "Plus de 2,5", "Les deux équipes ont marqué", "Aucun but marqué", "Aucun but encaissé"],
      halves: ["Buts marqués en première mi-temps", "Buts encaissés en première mi-temps", "Buts marqués en seconde mi-temps", "Buts encaissés en seconde mi-temps", "En tête à la pause", "À égalité à la pause", "Menée à la pause"],
      corners: ["Corners obtenus", "Corners concédés", "Total dans le match"],
      login: "Renouvelez votre session de membre.", retry: "Réessayez dans quelques instants.",
      viewEditorial: "Voir l’analyse Pro", editorial: "Analyse Pro", editorialLoading: "Chargement de l’analyse…", editorialMissing: "Aucune analyse Pro n’a été publiée pour ce match.",
    },
    id: {
      open: "Ringkasan pertandingan", member: "Anggota", close: "Tutup", tabs: ["Tim", "Gol", "Per babak", "Sepak pojok"],
      scope: "Pertandingan dalam kompetisi ini", scopes: ["Kandang / tandang", "Semua pertandingan"],
      home: "Kandang", away: "Tandang", match: "pertandingan", matches: "pertandingan", metric: "Indikator",
      updated: "Data per", season: "Musim", loading: "Memuat ringkasan…",
      missing: "Ringkasan tidak tersedia untuk pertandingan ini.", partial: "Cakupan sebagian. Penyebut menunjukkan jumlah pertandingan terpilih dengan data terkonfirmasi.",
      emptyHistory: "Belum ada pertandingan terkonfirmasi pada kompetisi dan musim ini.",
      emptyScope: "Tidak ada pertandingan terkonfirmasi untuk lokasi terpilih.", emptyHalves: "Tidak ada skor paruh waktu terkonfirmasi untuk pilihan ini.",
      cornerCoverage: "Pertandingan dengan data / pertandingan terpilih. Data yang tidak tersedia ditandai dengan —.",
      perGame: "/ laga", latest: "Hasil · terbaru dulu",
      headers: ["Tanggal", "Lawan", "Skor (tim lebih dulu)"], outcomes: ["Menang", "Seri", "Kalah", "Poin / laga"],
      goals: ["Gol dicetak", "Gol kebobolan", "Di atas 2,5", "Kedua tim mencetak gol", "Tanpa gol", "Tanpa kebobolan"],
      halves: ["Gol dicetak pada babak pertama", "Gol kebobolan pada babak pertama", "Gol dicetak pada babak kedua", "Gol kebobolan pada babak kedua", "Unggul saat jeda", "Imbang saat jeda", "Tertinggal saat jeda"],
      corners: ["Sepak pojok didapat", "Sepak pojok lawan", "Total dalam laga"],
      login: "Perbarui sesi keanggotaan.", retry: "Coba lagi sebentar.",
      viewEditorial: "Lihat analisis Pro", editorial: "Analisis Pro", editorialLoading: "Memuat analisis…", editorialMissing: "Belum ada analisis Pro untuk pertandingan ini.",
    },
  };
  const keys = ["teams", "goals", "halves", "corners"];
  let verifiedPredictions = null;
  const publicGet = (path, signal) => fetch(root.PoseidonMembers.MEMBERS_API + path, {
    credentials: "omit", cache: "no-store", signal,
  });
  const sampleRequests = new Map();
  const sampleRenders = new WeakMap();
  const catalogDays = new Map();
  let current = null;
  let dialog, nativeDialog, readingPage;
  let readingEntry = 0;
  let publicPredictions;

  const words = (lang = document.documentElement.lang) => labels[lang] || labels.en;
  const integer = x => Number.isSafeInteger(x) && x >= 0;
  const text = (tag, value, cls) => {
    const el = document.createElement(tag);
    if (value !== undefined) el.textContent = value;
    if (cls) el.className = cls;
    return el;
  };
  const timed = value => {
    if (typeof value !== "string" || !value) return NaN;
    const utc = /(?:Z|[+-]\d\d:?\d\d)$/i.test(value) ? value : value + "Z";
    return Date.parse(utc.replace(" ", "T"));
  };
  const esc = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const tier = () => root.PoseidonMembers?.tier();
  const authorized = () => !!verifiedPredictions && ["basic", "pro"].includes(tier());

  function setPredictions(data) {
    verifiedPredictions = Array.isArray(data?.matches) ? data : null;
    if (!verifiedPredictions) {
      catalogDays.clear();
      if (dossierIsOpen() && !current?.publicAccess) {
        if (dialog === readingPage?.surface) expireReading(current);
        else dialog.close();
      }
    }
    root.dispatchEvent(new Event("poseidon:member-predictions"));
  }

  const dossierIsOpen = () => !!dialog && (dialog.open || dialog === readingPage?.surface);
  const listPosition = () => ({x:root.scrollX,y:root.scrollY});

  function clearReadingEntry() {
    if (!root.history.state?.poseidonDossierReading) return;
    const {poseidonDossierReading, ...state} = root.history.state;
    root.history.replaceState(state,"");
  }

  function returnToMatch() {
    if (!readingPage || readingPage.closing) return;
    readingPage.closing = true;
    root.history.back();
  }

  // A history entry switches views inside the existing URL. It carries no report or session data.
  function openReading(source, position, returnFocus) {
    if (!root.matchMedia("(max-width: 767px)").matches || readingPage) return null;
    const entry = `${Date.now()}-${++readingEntry}`;
    try { root.history.pushState({...root.history.state,poseidonDossierReading:entry},""); }
    catch (_) { return null; }
    const restoration = root.history.scrollRestoration;
    root.history.scrollRestoration = "manual";
    const page = text("main",undefined,"dossier-reading-page");
    const toolbar = text("div",undefined,"dossier-reading-toolbar");
    const back = text("button");
    const arrow = text("span","←");
    const backLabel = text("span",label("backMatch"));
    arrow.setAttribute("aria-hidden","true");
    back.type = "button";
    back.addEventListener("click",returnToMatch);
    back.append(arrow,backLabel);
    toolbar.append(back);
    const surface = text("article",undefined,source.className + " dossier-reading-surface");
    surface.lang = source.lang || document.documentElement.lang;
    page.setAttribute("aria-label",source.getAttribute("aria-label") || label("heading"));
    surface.append(...source.childNodes);
    const originalHeading = surface.querySelector(".edition-heading h3, [data-dossier-title]");
    const heading = text("h1");
    if (originalHeading) {
      for (const attr of originalHeading.attributes) heading.setAttribute(attr.name,attr.value);
      heading.append(...originalHeading.childNodes);
      originalHeading.replaceWith(heading);
    }
    page.append(toolbar,surface);
    document.body.append(page);
    readingPage = {entry,page,back,backLabel,surface,source,heading,originalHeading,position,returnFocus,restoration};
    document.body.classList.add("dossier-reading-active");
    back.focus({preventScroll:true});
    root.scrollTo(0,0);
    return surface;
  }

  function leaveReading() {
    const view = readingPage;
    if (!view) return;
    readingPage = null;
    if (nativeDialog.open) nativeDialog.close();
    if (view.originalHeading) {
      view.originalHeading.append(...view.heading.childNodes);
      view.heading.replaceWith(view.originalHeading);
    }
    view.source.append(...view.surface.childNodes);
    view.page.remove();
    document.body.classList.remove("dossier-reading-active");
    view.returnFocus()?.focus({preventScroll:true});
    const restore = () => root.scrollTo(view.position.x,view.position.y);
    restore();
    root.history.scrollRestoration = view.restoration;
    root.requestAnimationFrame(()=>{
      if (readingPage) return;
      restore();
    });
  }

  function expireReading(state) {
    if (!state || current !== state || state.expired || dialog !== readingPage?.surface) return;
    state.expired = true;
    state.controller.abort();
    state.item = state.dossier = state.statistics = state.editorialLookup = null;
    const message = text("p",state.copy.login,"dossier-note");
    message.setAttribute("role","status");
    dialog.querySelector("[data-dossier-title]").textContent = label("heading");
    dialog.querySelector("[data-dossier-body]").replaceChildren(message);
    readingPage.back.focus({preventScroll:true});
    root.scrollTo(0,0);
  }

  function checkReadingAccess() {
    if (current && dialog === readingPage?.surface && tier() !== "pro") expireReading(current);
  }

  async function loadCatalog(day) {
    if (!authorized() || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const now = Date.now(), cached = catalogDays.get(day);
    if (cached && cached.expiry > now) return;
    const entry = { expiry: now + 60_000, matches: cached?.matches || [] };
    catalogDays.set(day,entry);
    try {
      const response = await root.PoseidonMembers.getProtected("/api/dosare/" + day);
      const data = response.ok ? await response.json() : null;
      if (catalogDays.get(day) !== entry || !authorized()) return;
      entry.matches = data?.date === day && Array.isArray(data.matches) ? data.matches : [];
      root.dispatchEvent(new Event("poseidon:dossier-catalog"));
    } catch (_) {
      entry.expiry = now + 10_000;
    }
  }

  function catalog(day) {
    if (!authorized()) return [];
    const fromIndex = catalogDays.get(day)?.matches || [];
    const known = new Set(fromIndex.map(m=>m.fixture_id));
    const now = Date.now();
    const justStarted = verifiedPredictions.matches.filter(match=>{
      const time = timed(match.match_date);
      return time <= now && siteDay.format(new Date(time)) === day && !known.has(match.fixture_id);
    }).map(({ fixture_id, match_date, home_team, away_team, country, league }) => ({
      fixture_id, match_date, home_team, away_team, country, league, dossier_only:true,
    }));
    return [...fromIndex,...justStarted];
  }

  function publicFixtureIds(data) {
    const none = new Set();
    const now = Date.now(), today = siteDay.format(now);
    const generated = timed(data?.generated_at);
    if (!(generated <= now) || siteDay.format(generated) !== today || !Array.isArray(data?.matches)) return none;

    const free = data.matches.filter(match => match?.free === true);
    if (free.length === 0 || free.length > 5 || data.freemium?.free !== free.length) return none;
    const ids = new Set(free.map(match => match.fixture_id));
    if (ids.size !== free.length || free.some(match => {
      const kickoff = timed(match.match_date);
      return !Number.isSafeInteger(match.fixture_id) || match.fixture_id <= 0 || match.locked ||
        !Number.isFinite(kickoff) || siteDay.format(kickoff) !== today;
    })) return none;
    for (const id of ids) {
      if (data.matches.filter(match => match?.fixture_id === id).length !== 1) ids.delete(id);
    }
    return ids;
  }

  function button(match, offerPublic = false) {
    const kickoff = timed(match.match_date);
    const fid = Number(match.fixture_id);
    if (!Number.isSafeInteger(fid) || fid < 1 || !Number.isFinite(kickoff)) return "";
    const member = authorized();
    const publicAccess = !member && offerPublic && match.free === true && !match.locked
      && siteDay.format(kickoff) === siteDay.format(Date.now());
    if (!member && !publicAccess) return "";
    return `<button type="button" class="dossier-open" data-dossier-fixture="${fid}" data-dossier-kickoff="${new Date(kickoff).toISOString()}"${publicAccess ? ' data-dossier-public="true"' : ""} aria-haspopup="dialog" aria-controls="member-dossier" aria-label="${esc(words().open + " · " + (match.home_team || "") + " – " + (match.away_team || ""))}">${words().open}</button>`;
  }

  const sum = values => values.reduce((total, value) => total + value, 0);
  const count = (matches, predicate) => matches.filter(predicate).length;
  const rate = (matches, predicate) => ({ value: matches.length ? count(matches, predicate) + " / " + matches.length : "—" });
  function average(matches, get, number, total = matches.length) {
    const values = matches.map(get).filter(integer);
    const coverage = values.length === total && total > 0 ? "" : values.length + " / " + total;
    return { value: values.length ? number.format(sum(values) / values.length) : "—",
      note: coverage };
  }
  function goalTotal(matches, get, number, copy) {
    if (!matches.length) return { value: "—" };
    const total = sum(matches.map(get));
    return { value: total, note: number.format(total / matches.length) + " " + copy.perGame };
  }

  function rowValues(kind, group, number, c) {
    const m = group.matches;
    if (kind === "teams") {
      return [
        rate(m, x => x.scored > x.conceded), rate(m, x => x.scored === x.conceded), rate(m, x => x.scored < x.conceded),
        { value: m.length ? number.format((3 * count(m,x=>x.scored>x.conceded) + count(m,x=>x.scored===x.conceded)) / m.length) : "—" },
      ];
    }
    if (kind === "goals") {
      return [
        goalTotal(m,x=>x.scored,number,c), goalTotal(m,x=>x.conceded,number,c),
        rate(m,x=>x.scored+x.conceded>2), rate(m,x=>x.scored>0&&x.conceded>0),
        rate(m,x=>x.scored===0), rate(m,x=>x.conceded===0),
      ];
    }
    if (kind === "halves") {
      return [
        goalTotal(m,x=>x.halfScored,number,c), goalTotal(m,x=>x.halfConceded,number,c),
        goalTotal(m,x=>x.scored-x.halfScored,number,c), goalTotal(m,x=>x.conceded-x.halfConceded,number,c),
        rate(m,x=>x.halfScored>x.halfConceded), rate(m,x=>x.halfScored===x.halfConceded), rate(m,x=>x.halfScored<x.halfConceded),
      ];
    }
    const withCoverage = (get) => {
      const result = average(m, get, number);
      return { ...result, note: result.note || `${m.length} / ${m.length}` };
    };
    return [
      withCoverage(x=>x.cornersFor), withCoverage(x=>x.cornersAgainst),
      withCoverage(x=>integer(x.cornersFor)&&integer(x.cornersAgainst) ? x.cornersFor+x.cornersAgainst : null),
    ];
  }

  function headerRow(table, columns) {
    const row = table.createTHead().insertRow();
    for (const [title, note] of columns) {
      const th = text("th", title);
      th.scope = "col";
      if (note) th.append(text("small", note));
      row.append(th);
    }
  }

  function compare(groups, state) {
    const { kind, all, copy: c, number } = state;
    const table = text("table", undefined, "dossier-table");
    table.setAttribute("role", "table");
    const coverage = group => {
      const location = all ? "" : (group.home ? c.home : c.away) + " · ";
      const n = group.matches.length, total = group.total;
      const halves = kind === "halves";
      const noun = (halves ? total : n) === 1 ? c.match : c.matches;
      return location + (halves ? `${n} / ${total}` : n) + " " + noun;
    };
    headerRow(table, [[c.metric], ...groups.map(group => [group.name, coverage(group)])]);
    table.tHead.setAttribute("role", "rowgroup");
    table.tHead.rows[0].setAttribute("role", "row");
    for (const cell of table.tHead.rows[0].cells) cell.setAttribute("role", "columnheader");
    const values = groups.map(group => rowValues(kind,group,number,c));
    const body = table.createTBody();
    body.setAttribute("role", "rowgroup");
    const names = { teams:c.outcomes, goals:c.goals, halves:c.halves, corners:c.corners };
    names[kind].forEach((name, i) => {
      const row = body.insertRow(), th = text("th", name);
      row.setAttribute("role", "row");
      th.setAttribute("role", "rowheader");
      th.scope = "row";
      row.append(th);
      values.forEach((team, index) => {
        const { value, note } = team[i];
        const cell = row.insertCell();
        cell.setAttribute("role", "cell");
        const teamName = text("span", groups[index].name, "dossier-comparison-team");
        teamName.setAttribute("aria-hidden", "true");
        cell.append(teamName, String(value));
        if (note) cell.append(text("small",note));
      });
    });
    return table;
  }

  function results(group, state) {
    const c = state.copy, table = text("table", undefined, "dossier-results-table");
    table.createCaption().textContent = group.name;
    headerRow(table,c.headers.map(label=>[label]));
    const body = table.createTBody();
    for (const m of group.matches) {
      const row = body.insertRow();
      const date = text("time", state.date.format(new Date(m.date.slice(0,10) + "T12:00:00Z")));
      date.dateTime = m.date.slice(0,10);
      row.insertCell().append(date);
      const opponent = row.insertCell();
      opponent.textContent = m.opponent;
      if (state.all) opponent.append(text("small",m.home ? c.home : c.away));
      row.insertCell().textContent = m.scored + "–" + m.conceded;
    }
    return table;
  }

  function switchTab(state, kind, focus = false) {
    state.kind = kind;
    const { pane, tabs, data, copy } = state;
    const tab = [...tabs.children].find(el => el.dataset.dossierTab === kind);
    for (const item of tabs.children) {
      item.setAttribute("aria-selected", String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    }
    pane.setAttribute("aria-labelledby",tab.id);
    pane.replaceChildren();
    const groups = data.teams.map(team => {
      const available = team.matches.filter(m => state.all || m.home === team.home);
      const matches = kind === "halves" ? available.filter(m => integer(m.halfScored) && integer(m.halfConceded)) : available;
      return { ...team, matches, total: available.length };
    });
    if (kind !== "corners" && groups.every(team => !team.matches.length)) {
      const allEmpty = data.teams.every(team => !team.matches.length);
      pane.append(text("p", allEmpty ? copy.emptyHistory
        : groups.every(team => !team.total) ? copy.emptyScope : copy.emptyHalves, "dossier-note"));
      if (focus) tab.focus({ preventScroll: true });
      return;
    }
    pane.append(compare(groups,state));
    if (kind === "halves" && groups.some(team => team.matches.length !== team.total)) {
      pane.append(text("p",copy.partial,"dossier-note"));
    }
    if (kind === "corners") pane.append(text("p",copy.cornerCoverage,"dossier-note"));
    if (kind === "teams") {
      const grid = text("div",undefined,"dossier-results");
      grid.append(...groups.map(group=>results(group,state)));
      if (state.foldResults) {
        const details = text("details",undefined,"sample-dossier-results");
        details.append(text("summary",copy.latest),grid);
        pane.append(details);
      } else {
        pane.append(text("h3",copy.latest,"dossier-results-title"),grid);
      }
    }
    if (focus) tab.focus({ preventScroll: true });
  }

  function mountStatistics(body, data, lang, prefix, previous, foldResults = false) {
    const c = words(lang);
    const locale = lang === "en" ? "en-GB" : lang;
    const state = {
      all:previous?.all ?? false, data, copy:c, foldResults,
      number:new Intl.NumberFormat(locale,{ minimumFractionDigits:2, maximumFractionDigits:2 }),
      date:new Intl.DateTimeFormat(locale,{ day:"numeric",month:"short",timeZone:"Europe/Bucharest" }),
    };
    const tabs = text("div",undefined,"dossier-tabs");
    state.tabs = tabs;
    tabs.setAttribute("role","tablist");
    tabs.setAttribute("aria-label",c.open);
    const hasCorners = data.teams.some(team => team.matches.some(m => integer(m.cornersFor) || integer(m.cornersAgainst)));
    (hasCorners ? keys : keys.slice(0,3)).forEach((key,i) => {
      const tab = text("button",c.tabs[i]);
      tab.type = "button";
      tab.id = prefix + "-tab-" + key;
      tab.dataset.dossierTab = key;
      tab.setAttribute("role","tab");
      tab.setAttribute("aria-controls",prefix + "-panel");
      tab.addEventListener("click",()=>switchTab(state,key,true));
      tabs.append(tab);
    });
    tabs.addEventListener("keydown",ev=>{
      const items = [...tabs.children], i = items.indexOf(ev.target);
      if (i < 0) return;
      const next = { ArrowLeft:(i+items.length-1)%items.length, ArrowRight:(i+1)%items.length, Home:0, End:items.length-1 }[ev.key];
      if (next === undefined) return;
      ev.preventDefault();
      switchTab(state,items[next].dataset.dossierTab,true);
    });
    const fieldset = text("fieldset",undefined,"dossier-scope");
    fieldset.append(text("legend",c.scope));
    c.scopes.forEach((label,i)=>{
      const item = text("label");
      const input = text("input");
      input.type = "radio";
      input.name = prefix + "-scope";
      input.checked = state.all === (i === 1);
      input.addEventListener("change",()=>{
        state.all = i === 1;
        switchTab(state,state.kind);
      });
      item.append(input, document.createTextNode(label));
      fieldset.append(item);
    });
    const panel = text("section");
    panel.id = prefix + "-panel";
    state.pane = panel;
    panel.dataset.dossierPanel = "";
    panel.setAttribute("role","tabpanel");
    panel.tabIndex = 0;
    body.append(tabs,fieldset,panel);
    switchTab(state,previous?.kind || "teams");
    return state;
  }

  function dossierMatches(data, fixture, day, kickoff) {
    const start = timed(data?.match_date);
    return Number(data?.fixture_id) === fixture && Number.isFinite(start)
      && siteDay.format(new Date(start)) === day && (kickoff === undefined || start === kickoff)
      && timed(data?.as_of) < start
      && Array.isArray(data.teams) && data.teams.length === 2
      && data.teams[0]?.home === true && data.teams[1]?.home === false
      && data.teams.every(team => typeof team?.name === "string" && Array.isArray(team.matches));
  }

  function show(state, status) {
    const {copy:c, dossier:data, item} = state;
    const body = dialog.querySelector("[data-dossier-body]");
    state.status = status;
    const title = data?.teams.map(team=>team.name) || [item?.match?.home,item?.match?.away];
    dialog.querySelector("[data-dossier-title]").textContent = title.filter(Boolean).join(" – ") || state.matchLabel || c.open;
    body.replaceChildren();
    const readingPro = state.readingPro ?? state.fromPro;
    if (readingPro && item?.match) {
      body.append(text("p",matchMetadata(item,state.lang),"dossier-note"));
    } else if (data) {
      body.append(text("p",dossierMetadata(data,state.lang,c),"dossier-note"));
    } else if (item?.match?.league) {
      body.append(text("p",item.match.league,"dossier-note"));
    }
    dialog.classList.toggle("dossier-basic-view",!readingPro);
    if (!readingPro) {
      body.prepend(text("h3",label("stats"),"dossier-basic-title"));
      const feed = authorized() ? verifiedPredictions : publicFixtureIds(publicPredictions).has(state.fixture) ? publicPredictions : null;
      const match = feed?.matches?.find(m => m.fixture_id === state.fixture && timed(m.match_date) === timed(data?.match_date));
      let probabilities = match && [match.prob_home,match.prob_draw,match.prob_away];
      if (!probabilities && state.publicSnapshot && state.archiveMatch) {
        const m = state.archiveMatch;
        if ([m.p_home,m.p_draw,m.p_away].every(n=>Number.isFinite(n) && n>=0 && n<=100)) probabilities = [m.p_home,m.p_draw,m.p_away].map(n=>n/100);
      }
      if (data && probabilities?.every(n=>Number.isFinite(n) && n>=0 && n<=1)) {
        const values = text("div",undefined,"dossier-1x2");
        values.setAttribute("aria-label",label("oneXtwo"));
        const percent = new Intl.NumberFormat(state.lang,{style:"percent",maximumFractionDigits:1});
        ["1","X","2"].forEach((key,i)=>{
          const line = text("span",key + " ");
          line.append(text("strong",percent.format(probabilities[i])));
          values.append(line);
        });
        body.append(text("h4",label("oneXtwo")),values);
      }
    }
    if (!state.publicAccess && !state.basicOnly && tier() === "pro" && (state.fixture || item)) {
      const anchor = document.createComment("Pro analysis");
      body.append(anchor);
      showEditorial(state, anchor);
    }
    if (readingPro && (state.fixture || item)) return;
    if (data) {
      const stats = text("div");
      body.append(stats);
      state.statistics = mountStatistics(stats,data,dialog.lang,"member-dossier",state.statistics);
    } else {
      const message = text("p",c[status] || c.missing,"dossier-note");
      message.setAttribute("role","status");
      body.append(message);
    }
  }

  function matchMetadata(item, lang) {
    const match = item.match;
    const kickoff = timed(match.match_date ?? item.provenance?.original_kickoff_utc);
    const date = Number.isFinite(kickoff) ? new Intl.DateTimeFormat(lang === "en" ? "en-GB" : lang,
      {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",
        timeZone:"Europe/Bucharest",timeZoneName:"short"}).format(kickoff) : "";
    const country = root.PoseidonCountry?.label?.(match.country,lang) || match.country;
    return [match.league,country,date].filter(Boolean).join(" · ");
  }

  function dossierMetadata(data,lang,c) {
    if (!data) return "";
    const cutoff = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : lang,
      { day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",
        timeZone:"Europe/Bucharest",timeZoneName:"short" });
    const asOf = timed(data.as_of);
    return [data.league, data.season && c.season + " " + data.season,
      Number.isFinite(asOf) && c.updated + " " + cutoff.format(asOf)].filter(Boolean).join(" · ");
  }

  const stillOpen = state => current === state && !state.expired && dossierIsOpen()
    && (state.publicAccess || (state.fromPro ? tier() === "pro" : authorized()));

  async function lookupEditorial(state) {
    try {
      const response = await root.PoseidonMembers.getProtected("/api/analize/" + state.day,state.controller.signal);
      if (response.status === 401 || response.status === 403) return { status: "login" };
      if (response.status === 404) return {};
      if (!response.ok) return { status: "retry" };
      const payload = await response.json();
      if (!Array.isArray(payload?.items) || (payload.date && payload.date !== state.day)) return { status: "retry" };
      return { item: proAnalysisForFixture(payload,state.day,state.fixture) };
    } catch (_) {
      return { status: "retry" };
    }
  }

  const fallback = {
    basicSummary:"Dosarul Basic compară meciurile gazdelor acasă cu deplasările oaspeților și arată câte meciuri intră în fiecare eșantion.",
    badge:"Exemplu public · Pro", pick:"Pronostic editorial", probability:"Probabilitatea modelului",
    league:"Frecvență în ligă", history:"Istoric selecții Pro", outcomes:"{hits} confirmate, {misses} ratate",
    verdict:"Verdict", arguments:"Argumente", limitations:"Ce poate contrazice analiza",
    samples:"Eșantionul editorial cuprinde {home} meciuri acasă și {away} în deplasare.", verification:"Verificarea rezultatului", original:"Textul integral publicat înainte de meci",
    read:"Citește analiza completă", heading:"Dosar Pro", basic:"Vezi dosarul Basic", stats:"Dosarul statistic Basic",
    oneXtwo:"Probabilități 1 / X / 2", back:"Înapoi la analiza Pro", backMatch:"Înapoi la meci",
  };
  const label = key => tt("redesign.edition." + key,fallback[key]);
  const metric = (name,value,detail) => `<div class="edition-metric"><span>${esc(name)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`;
  function originalReading(html,lang) {
    const original = text("details",undefined,"edition-original");
    original.append(text("summary",label("original")));
    const reading = text("div");
    reading.lang = lang;
    reading.innerHTML = html;
    original.append(reading);
    return original;
  }

  async function showEditorial(state, anchor) {
    const c = state.copy;
    let target;
    try {
      const { item, status } = state.item ? { item: state.item } : await (state.editorialLookup ??= lookupEditorial(state));
      if (!anchor.isConnected || !stillOpen(state) || tier() !== "pro") return;
      if (status) {
        const message = text("p",c[status],"dossier-note dossier-editorial-status");
        message.setAttribute("role","status");
        anchor.replaceWith(message);
        return;
      }
      if (!item?.analysis?.trim()) {
        if (state.readingPro ?? state.fromPro) {
          const message = text("p",c.editorialMissing,"dossier-note");
          message.setAttribute("role","status");
          anchor.replaceWith(message);
        }
        return;
      }
      state.item = item;
      if (!(state.readingPro ?? state.fromPro)) {
        const read = text("button",state.fromPro ? label("back") : c.viewEditorial,"edition-read-member");
        read.type = "button";
        read.addEventListener("click",()=>{
          if (!stillOpen(state) || tier() !== "pro") return;
          state.readingPro = true;
          state.focusReturn = "basic";
          if (dialog === nativeDialog) openMemberReading(state);
          show(state,state.status);
          (dialog === readingPage?.surface ? readingPage.back : dialog.querySelector("[data-dossier-close]")).focus();
        });
        anchor.replaceWith(read);
        if (state.focusReturn === "pro") { state.focusReturn = null; read.focus(); }
        return;
      }
      const editorial = text("details",undefined,"dossier-analysis");
      editorial.open = true;
      const summary = text("summary",c.editorial,"dossier-open");
      summary.dataset.dossierEditorial = "";
      target = text("section",c.editorialLoading,"dossier-editorial");
      target.id = "dossier-editorial";
      target.setAttribute("aria-live","polite");
      editorial.append(summary,target);
      anchor.replaceWith(editorial);
      const report = await loadProReport();
      if (!target.isConnected || !stillOpen(state) || tier() !== "pro") return;
      const analysis = proAnalysisText(item,state.lang);
      const html = _md(analysis.text);
      target.classList.add("edition-member");
      target.innerHTML = report.dossierReport(html,item,state.dossier,state.day,state.lang,analysis.lang,false,{compact:false,label,metric});
      target.append(originalReading(html,analysis.lang));
      if (state.dossier) {
        const basic = text("button",label("basic"),"edition-basic");
        basic.type = "button";
        basic.addEventListener("click",()=>{
          if (!stillOpen(state) || tier() !== "pro") return;
          state.readingPro = false;
          state.focusReturn = "pro";
          show(state,state.status);
          if (dialog === readingPage?.surface) root.scrollTo(0,0);
          else dialog.scrollTop = 0;
        });
        target.append(text("p",label("basicSummary"),"edition-basic-summary"),basic);
        if (state.focusReturn === "basic") { state.focusReturn = null; basic.focus(); }
      } else {
        target.append(text("p",c.missing,"dossier-note"));
      }
      for (const selector of state.openDetails || []) target.querySelector(selector)?.setAttribute("open", "");
      watchResult(target,state,report);
      if (analysis.lang !== state.lang) {
        const english = analysis.lang === "en";
        const language = tt(english ? "dashboard.language.english" : "dashboard.language.romanian", english ? "English" : "română");
        const notice = tt("dashboard.analysis.fallback","Textul analizei este disponibil în {language}.").replace("{language}",language);
        target.prepend(text("p",notice,"dossier-note"));
      }
    } catch (_) {
      if (target?.isConnected && stillOpen(state) && tier() === "pro") target.textContent = c.retry;
    }
  }

  function watchResult(target,state,report) {
    const review = target.querySelector(".dossier-review[data-review-lookup]");
    if (!review || !state.fixture) return;
    const panel = review.querySelector("[data-dossier-review-content]");
    const path = `analize/${state.day}.html`;
    const id = "m" + state.fixture;
    async function load() {
      if (!review.open && (!state.publicSample || Date.now() < state.kickoff)) return;
      if (review.dataset.requested) return;
      review.dataset.requested = "true";
      panel.setAttribute("aria-busy","true");
      const lang = state.lang;
      const labels = report.archiveReviewLabels(lang);
      try {
        const response = await fetch(path,{credentials:"omit",signal:state.controller.signal});
        if (!response.ok) return;
        const archive = new DOMParser().parseFromString(await response.text(),"text/html");
        if ((state.publicSample ? state.controller.signal.aborted : !stillOpen(state)) || !target.isConnected || state.lang !== lang) return;
        if (archive.querySelector(".intro h1 [data-date]")?.dataset.date !== state.day) return;
        const candidates = [...archive.querySelectorAll(`.pro-archive-match[id="${id}"] article.pro-card-full, article[id="${id}"]`)]
          .filter(card => card.querySelector(".pro-verificare"));
        const selected = [lang,"en","ro"].map(code => candidates.find(card => (card.closest("[data-lang]")?.dataset.lang || "ro") === code)).find(Boolean);
        const score = selected?.querySelector("[data-i18n='arhiva.rezfinal']")?.textContent.match(/\b\d+\s*[-–]\s*\d+\b/)?.[0];
        if (!score) return;
        const line = text("p",labels.final + " " + score.replace(/\s*[-–]\s*/,"–"));
        const link = text("a",labels.open);
        link.href = path + "#" + id;
        panel.replaceChildren(line,link);
        if (state.publicSample || target.classList.contains("edition-member")) {
          review.querySelector("summary").textContent = line.textContent;
        }
      } catch (_) { /* Keep the localized availability message on a missing archive. */ }
      finally { panel.removeAttribute("aria-busy"); }
    }
    review.addEventListener("toggle",load);
    load();
  }

  async function fetchDossier(state, message) {
    try {
      const path = `/api/dosar/${state.day}/${state.fixture}`;
      const response = await (state.publicAccess
        ? fetch(root.PoseidonMembers.MEMBERS_API + path, {
            credentials: "omit", cache: "no-store", signal: state.controller.signal,
          })
        : root.PoseidonMembers.getProtected(path,state.controller.signal));
      if (!stillOpen(state)) return;
      if (state.publicAccess && (response.status === 401 || response.status === 403)) {
        show(state,"missing");
        return;
      }
      if (response.status === 401 || response.status === 403) {
        state.status = "login";
        message.textContent = state.copy.login;
        return;
      }
      const data = response.ok ? await response.json() : null;
      if (!stillOpen(state)) return;
      if (dossierMatches(data,state.fixture,state.day,state.kickoff)) state.dossier = data;
      show(state,response.ok || response.status === 404 ? "missing" : "retry");
    } catch (_) {
      if (stillOpen(state)) show(state,"retry");
    }
  }

  async function fetchCardMatch(state,message) {
    try {
      const response = await root.PoseidonMembers.getProtected("/api/analize/" + state.day,state.controller.signal);
      if (!stillOpen(state)) return;
      if (response.status === 401 || response.status === 403) {
        state.status = "login";
        message.textContent = state.copy.login;
        return;
      }
      if (!response.ok && response.status !== 404) throw new Error("Pro archive unavailable");
      const payload = response.ok ? await response.json() : null;
      if (!stillOpen(state)) return;
      const items = payload?.date === state.day && Array.isArray(payload.items) ? payload.items : [];
      const matches = items.filter(item => [item.match?.home,item.match?.away].join(" – ") === state.matchLabel);
      if (matches.length === 1) state.item = matches[0];
      const fixture = Number(state.item?.match?.fixture_id);
      if (Number.isSafeInteger(fixture) && fixture>0) {
        state.fixture = fixture;
        return fetchDossier(state,message);
      }
      show(state,state.item ? "missing" : "editorialMissing");
    } catch (_) {
      if (stillOpen(state)) show(state,"retry");
    }
  }

  function start(state) {
    if (!nativeDialog || dossierIsOpen()) return false;
    current?.controller.abort();
    const lang = document.documentElement.lang;
    Object.assign(state,{ lang, copy:words(lang), controller:new AbortController(), position:listPosition() });
    current = state;
    dialog = nativeDialog;
    if (state.fromPro) dialog.classList.remove("dossier-basic-view");
    dialog.lang = labels[lang] ? lang : "en";
    const match = state.item?.match;
    const title = [match?.home,match?.away].filter(Boolean).join(" – ");
    dialog.querySelector("[data-dossier-title]").textContent = title || state.matchLabel || state.copy.open;
    const close = dialog.querySelector("[data-dossier-close]");
    close.textContent = state.copy.close;
    const message = text("p",state.copy.loading);
    message.setAttribute("role","status");
    dialog.querySelector("[data-dossier-body]").replaceChildren(message);
    if (!state.fromPro || !openMemberReading(state)) {
      dialog.showModal();
      close.focus({preventScroll:true});
    }
    dialog.scrollTop = 0;
    if (state.publicSnapshot) show(state,"missing");
    else if (state.matchLabel) fetchCardMatch(state,message);
    else if (state.fixture) fetchDossier(state,message);
    else show(state,"missing");
    return true;
  }

  function finishMember(state) {
    if (!state || current !== state) return null;
    current = null;
    root.clearInterval(state.accessMonitor);
    state.controller.abort();
    nativeDialog.querySelector("[data-dossier-body]").replaceChildren();
    dialog = nativeDialog;
    const byId = state.trigger.id && document.getElementById(state.trigger.id);
    const equivalent = state.matchLabel
      ? [...(state.focusRoot?.querySelectorAll("[data-pro-match]") || [])]
        .find(link => link.dataset.proMatch === state.matchLabel && link.dataset.proDay === state.day)
      : state.focusRoot?.querySelector(`[data-dossier-fixture="${state.fixture}"]`);
    return state.trigger.isConnected ? state.trigger : byId || equivalent;
  }

  function openMemberReading(state) {
    const page = openReading(nativeDialog,state.position,()=>finishMember(state));
    if (!page) return false;
    dialog = page;
    if (nativeDialog.open) nativeDialog.close();
    state.accessMonitor = root.setInterval(checkReadingAccess,1000);
    return true;
  }

  function open(trigger) {
    const kickoff = timed(trigger.dataset.dossierKickoff), fixture = Number(trigger.dataset.dossierFixture);
    if (!Number.isSafeInteger(fixture) || fixture < 1 || !Number.isFinite(kickoff)) return;
    const day = siteDay.format(kickoff);
    const publicAccess = trigger.dataset.dossierPublic === "true" && day === siteDay.format(Date.now());
    if (!publicAccess && !authorized()) return;
    const focusRoot = trigger.closest("#dashboard-predictions, #matches");
    return start({ fixture,kickoff,trigger,focusRoot,day,publicAccess,basicOnly:trigger.hasAttribute("data-dossier-basic") });
  }

  function openPro(trigger, item, day) {
    if (tier() !== "pro" || !item?.analysis || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const fixture = Number(item.match?.fixture_id);
    return start({ trigger,item,day,fromPro:true,fixture:Number.isSafeInteger(fixture) && fixture>0 ? fixture : null });
  }

  function openProForMatch(trigger,day,matchLabel) {
    if (tier() !== "pro" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !matchLabel) return false;
    const focusRoot = trigger.closest("[data-dashboard-pro-summary], #dashboard-analyses");
    return start({ trigger,day,matchLabel,focusRoot,fromPro:true });
  }

  function samplePayload(day) {
    if (!sampleRequests.has(day)) {
      const request = publicGet("/api/exemplu/" + day).then(response => {
        if (!response.ok) throw new Error("Public sample unavailable");
        return response.json();
      }).catch(error => {
        sampleRequests.delete(day);
        throw error;
      });
      sampleRequests.set(day,request);
    }
    return sampleRequests.get(day);
  }

  async function mountPublicSample(target, source, lang, memberAction, predictions) {
    publicPredictions = predictions;
    sampleRenders.get(target)?.controller.abort();
    const fixture = Number(source?.dataset.sampleFixture), day = source?.dataset.sampleDay;
    if (!Number.isSafeInteger(fixture) || fixture < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const controller = new AbortController();
    const state = { controller, publicSample:true, fixture, day, lang };
    sampleRenders.set(target,state);
    try {
      const [payload, report] = await Promise.all([samplePayload(day),loadProReport()]);
      if (controller.signal.aborted || !target.isConnected || payload.date !== day || payload.item?.match?.fixture_id !== fixture) return;
      const item = payload.item;
      const kickoff = timed(item.match.match_date);
      if (!Number.isFinite(kickoff) || siteDay.format(kickoff) !== day
          || timed(item.provenance?.original_kickoff_utc) !== kickoff) return;
      state.kickoff = kickoff;
      const analysis = proAnalysisText(item,lang);
      if (!analysis.text) return;
      const data = dossierMatches(payload.dossier,fixture,day,kickoff) ? payload.dossier : null;
      const copy = words(lang);
      const card = text("article",undefined,"sample-dossier edition-preview");
      const full = text("dialog",undefined,"sample-dossier edition-dialog");
      const title = [item.match.home,item.match.away].join(" – ");
      full.setAttribute("aria-label",label("heading") + " · " + title);
      const close = text("button",copy.close,"edition-close");
      close.type = "button";
      close.addEventListener("click",()=>full.close());
      const show = text("button",label("read"),"edition-open");
      show.type = "button";
      if (!root.matchMedia("(max-width: 767px)").matches) show.setAttribute("aria-haspopup","dialog");
      show.addEventListener("click",()=>{
        if (!openReading(full,listPosition(),()=>show.isConnected ? show : target.querySelector(".edition-open"))) {
          full.showModal();
        }
      });
      full.addEventListener("close",()=>show.focus({preventScroll:true}));
      const html = _md(analysis.text);
      const meta = matchMetadata(item,lang);
      for (const surface of [card,full]) {
        const compact = surface === card;
        const header = text("header",undefined,"edition-heading");
        header.append(text("span",label(compact ? "badge" : "heading"),"edition-kicker"),text("h3",title),text("p",meta));
        if (!compact) header.append(close);
        const editorial = text("div",undefined,"edition-content");
        editorial.innerHTML = report.dossierReport(html,item,data,day,lang,analysis.lang,true,{compact,label,metric});
        surface.append(header,editorial);
        if (analysis.lang !== lang) {
          const english = analysis.lang === "en";
          const language = tt(english ? "dashboard.language.english" : "dashboard.language.romanian", english ? "English" : "română");
          header.append(text("p",tt("dashboard.analysis.fallback","Textul analizei este disponibil în {language}.").replace("{language}",language)));
        }
      }
      full.append(originalReading(html,analysis.lang));
      const match = predictions?.matches?.find(m => m.fixture_id === fixture && timed(m.match_date) === kickoff);
      const offerPublic = publicFixtureIds(predictions).has(fixture);
      const nativeAction = data && match && button(match,offerPublic);
      let basic;
      if (nativeAction) {
        const holder = text("div");
        holder.innerHTML = nativeAction;
        basic = holder.firstElementChild;
        basic.textContent = label("basic");
        basic.setAttribute("aria-label",label("basic") + " · " + title);
        basic.dataset.dossierBasic = "";
      } else if (data) {
        basic = text("button",label("basic"));
        basic.setAttribute("aria-haspopup","dialog");
        basic.setAttribute("aria-controls","member-dossier");
        basic.addEventListener("click",()=>start({trigger:basic,fixture,day,kickoff,publicAccess:true,publicSnapshot:true,dossier:data,archiveMatch:item.match}));
      }
      if (basic) {
        basic.type = "button";
        basic.classList.add("edition-basic");
        full.append(text("p",label("basicSummary"),"edition-basic-summary"),basic);
      } else {
        full.append(text("p",copy.missing,"edition-unavailable"));
      }
      card.append(show,full);
      target.replaceChildren(card);
      if (memberAction) target.append(memberAction);
      watchResult(card.querySelector(".edition-content"),state,report);
      watchResult(full,state,report);
    } catch (_) { /* The generator's selected public sample remains available. */ }
  }

  function switchLanguage(lang) {
    if (!current || !dossierIsOpen() || current.lang === lang) return;
    const state = current;
    state.lang = lang;
    state.copy = words(lang);
    dialog.lang = labels[lang] ? lang : "en";
    const close = dialog.querySelector("[data-dossier-close]");
    close.textContent = state.copy.close;
    if (dialog === readingPage?.surface) readingPage.backLabel.textContent = label("backMatch");
    if (state.expired || !state.status || state.status === "login") {
      const message = dialog.querySelector("[data-dossier-body] [role='status']");
      if (message) message.textContent = state.copy[state.expired ? "login" : state.status || "loading"];
      if (!state.item && !state.matchLabel) dialog.querySelector("[data-dossier-title]").textContent = state.copy.open;
      return;
    }
    const offset = dialog.scrollTop;
    const focused = document.activeElement;
    const tab = focused?.dataset.dossierTab;
    state.editorialOpen = dialog.querySelector(".dossier-analysis")?.open;
    state.openDetails = ["[data-pro-history]", ".dossier-review"].filter(selector => dialog.querySelector(selector)?.open);
    show(state,state.status);
    if (!focused?.isConnected) (tab ? dialog.querySelector(`[data-dossier-tab="${tab}"]`) : close)?.focus({preventScroll:true});
    dialog.scrollTop = offset;
  }

  function mount() {
    dialog = nativeDialog = document.getElementById("member-dossier");
    if (!nativeDialog) return;
    clearReadingEntry(); // A reload cannot reconstruct a private view from history.
    root.addEventListener("popstate",()=>{
      if (readingPage && root.history.state?.poseidonDossierReading !== readingPage.entry) leaveReading();
      else if (!readingPage) clearReadingEntry();
    });
    root.addEventListener("pageshow",checkReadingAccess);
    root.addEventListener("storage",checkReadingAccess);
    document.addEventListener("click",event=>{
      const trigger = event.target.closest("button[data-dossier-fixture]");
      if (trigger) open(trigger);
    });
    document.addEventListener("keydown",event=>{
      if (readingPage && !nativeDialog.open && event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        returnToMatch();
      }
    });
    nativeDialog.querySelector("[data-dossier-close]").addEventListener("click",()=>nativeDialog.close());
    nativeDialog.addEventListener("cancel",event=>{
      if (current?.fromPro && current.readingPro === false) {
        event.preventDefault();
        current.readingPro = true;
        current.focusReturn = "basic";
        show(current,current.status);
      }
    });
    nativeDialog.addEventListener("close",()=>{
      if (!current || dialog !== nativeDialog || nativeDialog.open) return;
      finishMember(current)?.focus({preventScroll:true});
    });
  }

  root.PoseidonDossier = {
    setPredictions, predictions:()=>authorized() ? verifiedPredictions : null, publicFixtureIds, button, copy:words,
    loadCatalog, catalog, openPro, openProForMatch, switchLanguage,
    mountPublicSample,
    recentDays:()=>[siteDay.format(new Date(Date.now()-86_400_000)),siteDay.format(new Date())],
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",mount);
  else mount();
})(window);
