/* Dosarul statistic folosește exclusiv datele servite de zona de membri. */
(function (root) {
  "use strict";
  const siteDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" });
  const labels = {
    ro: {
      open: "Dosarul meciului", member: "Membru", close: "Închide", tabs: ["Echipe", "Goluri", "Reprize", "Cornere"],
      scope: "Meciuri din competiție", scopes: ["Acasă / deplasare", "Toate meciurile"],
      home: "Acasă", away: "În deplasare", matches: "meciuri", metric: "Indicator",
      updated: "Date disponibile la", season: "Sezon", loading: "Se încarcă dosarul…",
      missing: "Dosarul nu este disponibil pentru acest meci.", partial: "Acoperire parțială. Numitorul arată meciurile cu date confirmate din selecția curentă.",
      emptyHistory: "Încă nu avem meciuri confirmate în această competiție și în acest sezon.",
      emptyScope: "Nu avem meciuri confirmate pentru terenul selectat.", emptyHalves: "Nu avem scoruri confirmate la pauză pentru selecția curentă.",
      cornerCoverage: "Meciuri cu date / meciuri selectate. Valorile lipsă sunt marcate cu —.",
      perGame: "/ meci", latest: "Rezultate · cele mai recente primele",
      headers: ["Data", "Adversar", "Echipă–adversar"], outcomes: ["Victorii", "Egaluri", "Înfrângeri", "Puncte / meci"],
      goals: ["Goluri marcate", "Goluri primite", "Peste 2,5", "Ambele echipe au marcat", "Fără gol marcat", "Fără gol primit"],
      halves: ["Marcate în prima repriză", "Primite în prima repriză", "Marcate în a doua repriză", "Primite în a doua repriză", "În avantaj la pauză", "La egalitate la pauză", "Condusă la pauză"],
      corners: ["Cornere obținute", "Cornere cedate", "Total în meci"],
      login: "Sesiunea de membru trebuie reînnoită.", retry: "Încearcă din nou peste câteva momente.",
      viewEditorial: "Vezi analiza Pro", editorial: "Analiza Pro", editorialLoading: "Se încarcă analiza…", editorialMissing: "Nu există o analiză Pro publicată pentru acest meci.",
    },
    en: {
      open: "Match details", member: "Member", close: "Close", tabs: ["Teams", "Goals", "Halves", "Corners"],
      scope: "Matches in this competition", scopes: ["Home / away", "All matches"],
      home: "Home", away: "Away", matches: "matches", metric: "Metric",
      updated: "Data available at", season: "Season", loading: "Loading the dossier…",
      missing: "The dossier is unavailable for this match.", partial: "Partial coverage. The denominator shows matches with confirmed data in this selection.",
      emptyHistory: "There are no confirmed matches in this competition and season yet.",
      emptyScope: "There are no confirmed matches for the selected venue.", emptyHalves: "There are no confirmed half-time scores for this selection.",
      cornerCoverage: "Matches with data / selected matches. Missing values show as —.",
      perGame: "/ match", latest: "Results · most recent first",
      headers: ["Date", "Opponent", "Team–opponent"], outcomes: ["Wins", "Draws", "Losses", "Points / match"],
      goals: ["Goals scored", "Goals conceded", "Over 2.5", "Both teams scored", "Failed to score", "Clean sheets"],
      halves: ["First-half goals scored", "First-half goals conceded", "Second-half goals scored", "Second-half goals conceded", "Ahead at half-time", "Level at half-time", "Behind at half-time"],
      corners: ["Corners won", "Corners conceded", "Match total"],
      login: "Renew your member session.", retry: "Try again in a moment.",
      viewEditorial: "View Pro analysis", editorial: "Pro analysis", editorialLoading: "Loading the analysis…", editorialMissing: "No Pro analysis was published for this match.",
    },
    es: {
      open: "Ficha del partido", member: "Miembro", close: "Cerrar", tabs: ["Equipos", "Goles", "Partes", "Córneres"],
      scope: "Partidos en esta competición", scopes: ["Local / visitante", "Todos los partidos"],
      home: "Local", away: "Visitante", matches: "partidos", metric: "Indicador",
      updated: "Datos al", season: "Temporada", loading: "Cargando la ficha…",
      missing: "La ficha de este partido no está disponible.", partial: "Cobertura parcial. El denominador indica los partidos seleccionados con datos confirmados.",
      emptyHistory: "Aún no hay partidos confirmados en esta competición y temporada.",
      emptyScope: "No hay partidos confirmados en la sede seleccionada.", emptyHalves: "No hay resultados confirmados al descanso para esta selección.",
      cornerCoverage: "Partidos con datos / partidos seleccionados. Los valores ausentes se muestran con —.",
      perGame: "/ partido", latest: "Resultados · más recientes primero",
      headers: ["Fecha", "Rival", "Equipo–rival"], outcomes: ["Victorias", "Empates", "Derrotas", "Puntos / partido"],
      goals: ["Goles a favor", "Goles en contra", "Más de 2,5", "Ambos equipos marcaron", "Sin marcar", "Portería a cero"],
      halves: ["Goles a favor en la primera parte", "Goles en contra en la primera parte", "Goles a favor en la segunda parte", "Goles en contra en la segunda parte", "En ventaja al descanso", "Empate al descanso", "En desventaja al descanso"],
      corners: ["Córneres a favor", "Córneres en contra", "Total en el partido"],
      login: "Renueva tu sesión de miembro.", retry: "Inténtalo de nuevo en unos instantes.",
      viewEditorial: "Ver análisis Pro", editorial: "Análisis Pro", editorialLoading: "Cargando el análisis…", editorialMissing: "No se ha publicado un análisis Pro para este partido.",
    },
    it: {
      open: "Scheda della partita", member: "Membro", close: "Chiudi", tabs: ["Squadre", "Gol", "Tempi", "Corner"],
      scope: "Partite in questa competizione", scopes: ["Casa / trasferta", "Tutte le partite"],
      home: "In casa", away: "In trasferta", matches: "partite", metric: "Indicatore",
      updated: "Dati al", season: "Stagione", loading: "Caricamento della scheda…",
      missing: "La scheda non è disponibile per questa partita.", partial: "Copertura parziale. Il denominatore indica le partite selezionate con dati confermati.",
      emptyHistory: "Nessuna partita confermata in questa competizione e stagione.",
      emptyScope: "Nessuna partita confermata per il campo selezionato.", emptyHalves: "Nessun risultato confermato all’intervallo per questa selezione.",
      cornerCoverage: "Partite con dati / partite selezionate. I valori mancanti sono indicati con —.",
      perGame: "/ partita", latest: "Risultati · dal più recente",
      headers: ["Data", "Avversario", "Squadra–avversario"], outcomes: ["Vittorie", "Pareggi", "Sconfitte", "Punti / partita"],
      goals: ["Gol fatti", "Gol subiti", "Oltre 2,5", "Entrambe a segno", "Nessun gol fatto", "Nessun gol subito"],
      halves: ["Gol fatti nel primo tempo", "Gol subiti nel primo tempo", "Gol fatti nel secondo tempo", "Gol subiti nel secondo tempo", "In vantaggio all’intervallo", "In parità all’intervallo", "In svantaggio all’intervallo"],
      corners: ["Corner a favore", "Corner concessi", "Totale nella partita"],
      login: "Rinnova la sessione da membro.", retry: "Riprova tra qualche istante.",
      viewEditorial: "Vedi analisi Pro", editorial: "Analisi Pro", editorialLoading: "Caricamento dell’analisi…", editorialMissing: "Nessuna analisi Pro è stata pubblicata per questa partita.",
    },
    fr: {
      open: "Fiche du match", member: "Membre", close: "Fermer", tabs: ["Équipes", "Buts", "Mi-temps", "Corners"],
      scope: "Matchs dans cette compétition", scopes: ["Domicile / extérieur", "Tous les matchs"],
      home: "Domicile", away: "Extérieur", matches: "matchs", metric: "Indicateur",
      updated: "Données au", season: "Saison", loading: "Chargement de la fiche…",
      missing: "La fiche de ce match est indisponible.", partial: "Couverture partielle. Le dénominateur indique les matchs sélectionnés aux données confirmées.",
      emptyHistory: "Aucun match confirmé dans cette compétition et cette saison.",
      emptyScope: "Aucun match confirmé sur le terrain sélectionné.", emptyHalves: "Aucun score à la mi-temps confirmé pour cette sélection.",
      cornerCoverage: "Matchs avec données / matchs sélectionnés. Les valeurs manquantes sont indiquées par —.",
      perGame: "/ match", latest: "Résultats · du plus récent au plus ancien",
      headers: ["Date", "Adversaire", "Équipe–adversaire"], outcomes: ["Victoires", "Nuls", "Défaites", "Points / match"],
      goals: ["Buts marqués", "Buts encaissés", "Plus de 2,5", "Les deux équipes ont marqué", "Aucun but marqué", "Aucun but encaissé"],
      halves: ["Buts marqués en première mi-temps", "Buts encaissés en première mi-temps", "Buts marqués en seconde mi-temps", "Buts encaissés en seconde mi-temps", "En tête à la pause", "À égalité à la pause", "Menée à la pause"],
      corners: ["Corners obtenus", "Corners concédés", "Total dans le match"],
      login: "Renouvelez votre session de membre.", retry: "Réessayez dans quelques instants.",
      viewEditorial: "Voir l’analyse Pro", editorial: "Analyse Pro", editorialLoading: "Chargement de l’analyse…", editorialMissing: "Aucune analyse Pro n’a été publiée pour ce match.",
    },
    id: {
      open: "Ringkasan pertandingan", member: "Anggota", close: "Tutup", tabs: ["Tim", "Gol", "Babak", "Sepak pojok"],
      scope: "Pertandingan dalam kompetisi ini", scopes: ["Kandang / tandang", "Semua pertandingan"],
      home: "Kandang", away: "Tandang", matches: "pertandingan", metric: "Indikator",
      updated: "Data per", season: "Musim", loading: "Memuat ringkasan…",
      missing: "Ringkasan tidak tersedia untuk pertandingan ini.", partial: "Cakupan sebagian. Penyebut menunjukkan jumlah pertandingan terpilih dengan data terkonfirmasi.",
      emptyHistory: "Belum ada pertandingan terkonfirmasi pada kompetisi dan musim ini.",
      emptyScope: "Tidak ada pertandingan terkonfirmasi untuk lokasi terpilih.", emptyHalves: "Tidak ada skor paruh waktu terkonfirmasi untuk pilihan ini.",
      cornerCoverage: "Pertandingan dengan data / pertandingan terpilih. Data yang tidak tersedia ditandai dengan —.",
      perGame: "/ laga", latest: "Hasil · terbaru dulu",
      headers: ["Tanggal", "Lawan", "Tim–lawan"], outcomes: ["Menang", "Seri", "Kalah", "Poin / laga"],
      goals: ["Gol dicetak", "Gol kebobolan", "Di atas 2,5", "Kedua tim mencetak gol", "Tanpa gol", "Tanpa kebobolan"],
      halves: ["Gol dicetak pada babak pertama", "Gol kebobolan pada babak pertama", "Gol dicetak pada babak kedua", "Gol kebobolan pada babak kedua", "Unggul saat jeda", "Imbang saat jeda", "Tertinggal saat jeda"],
      corners: ["Sepak pojok didapat", "Sepak pojok lawan", "Total dalam laga"],
      login: "Perbarui sesi keanggotaan.", retry: "Coba lagi sebentar.",
      viewEditorial: "Lihat analisis Pro", editorial: "Analisis Pro", editorialLoading: "Memuat analisis…", editorialMissing: "Belum ada analisis Pro untuk pertandingan ini.",
    },
  };
  const keys = ["teams", "goals", "halves", "corners"];
  let verifiedPredictions = null;
  const catalogDays = new Map();
  let current = null;
  let dialog;

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
      if (dialog?.open) dialog.close();
    }
    root.dispatchEvent(new Event("poseidon:member-predictions"));
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

  function button(match) {
    const kickoff = timed(match.match_date);
    const fid = Number(match.fixture_id);
    if (!authorized() || !Number.isSafeInteger(fid) || fid < 1 || !Number.isFinite(kickoff)) return "";
    return `<button type="button" class="dossier-open" data-dossier-fixture="${fid}" data-dossier-kickoff="${new Date(kickoff).toISOString()}" aria-haspopup="dialog" aria-controls="member-dossier" aria-label="${esc(words().open + " · " + (match.home_team || "") + " – " + (match.away_team || ""))}">${words().open}</button>`;
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
    const coverage = group => {
      const location = all ? "" : (group.home ? c.home : c.away) + " · ";
      const n = group.matches.length, total = group.total;
      return location + (kind === "halves" ? `${n} / ${total}` : n) + " " + c.matches;
    };
    headerRow(table, [[c.metric], ...groups.map(group => [group.name, coverage(group)])]);
    const values = groups.map(group => rowValues(kind,group,number,c));
    const body = table.createTBody();
    const names = { teams:c.outcomes, goals:c.goals, halves:c.halves, corners:c.corners };
    names[kind].forEach((name, i) => {
      const row = body.insertRow(), th = text("th", name);
      th.scope = "row";
      row.append(th);
      values.forEach(team => {
        const { value, note } = team[i];
        const cell = row.insertCell();
        cell.textContent = value;
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
      pane.append(text("h3",copy.latest,"dossier-results-title"),grid);
    }
    if (focus) tab.focus({ preventScroll: true });
  }

  function mountStatistics(body, data, lang, prefix, previous) {
    const c = words(lang);
    const locale = lang === "en" ? "en-GB" : lang;
    const state = {
      all:previous?.all ?? false, data, copy:c,
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
    if (data) {
      const cutoff = new Intl.DateTimeFormat(state.lang === "en" ? "en-GB" : state.lang,
        { dateStyle:"short",timeStyle:"short",timeZone:"Europe/Bucharest" });
      const asOf = timed(data.as_of);
      const info = [data.league, data.season && c.season + " " + data.season,
        Number.isFinite(asOf) && c.updated + " " + cutoff.format(asOf)].filter(Boolean).join(" · ");
      body.append(text("p",info,"dossier-note"));
    } else if (item?.match?.league) {
      body.append(text("p",item.match.league,"dossier-note"));
    }
    if (tier() === "pro" && (data || item)) {
      const editorial = text("details",undefined,"dossier-analysis");
      editorial.open = state.editorialOpen ?? true;
      const summary = text("summary",c.editorial,"dossier-open");
      summary.dataset.dossierEditorial = "";
      const target = text("section",c.editorialLoading,"dossier-editorial");
      target.id = "dossier-editorial";
      target.setAttribute("aria-live","polite");
      editorial.append(summary,target);
      body.append(editorial);
      showEditorial(state,target);
    }
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

  const stillOpen = state => current === state && dialog.open
    && (state.fromPro ? tier() === "pro" : authorized());

  async function showEditorial(state, target) {
    const c = state.copy;
    try {
      let item = state.item;
      if (!item) {
        const response = await root.PoseidonMembers.getProtected("/api/analize/" + state.day,state.controller.signal);
        if (!stillOpen(state) || tier() !== "pro") return;
        if (response.status === 401 || response.status === 403) { target.textContent = c.login; return; }
        if (!response.ok && response.status !== 404) throw new Error("Pro archive unavailable");
        item = proAnalysisForFixture(response.ok ? await response.json() : null,state.day,state.fixture);
        state.item = item;
      }
      if (!stillOpen(state) || tier() !== "pro") return;
      if (!item?.analysis) { target.textContent = c.editorialMissing; return; }
      const report = await loadProReport();
      if (!stillOpen(state) || tier() !== "pro") return;
      const analysis = proAnalysisText(item,state.lang);
      target.innerHTML = report.dossierReport(_md(analysis.text), item,state.dossier,state.day,state.lang,analysis.lang);
      for (const selector of state.openDetails || []) target.querySelector(selector)?.setAttribute("open", "");
      watchResult(target,state,report);
      if (analysis.lang !== state.lang) {
        target.prepend(text("p",tt("pro.azi.ro_only","Traducerea nu este disponibilă. Textul este în română."),"dossier-note"));
      }
    } catch (_) {
      if (stillOpen(state) && tier() === "pro") target.textContent = c.retry;
    }
  }

  function watchResult(target,state,report) {
    const review = target.querySelector(".dossier-review[data-review-lookup]");
    if (!review || !state.fixture) return;
    const panel = review.querySelector("[data-dossier-review-content]");
    const path = `analize/${state.day}.html`;
    const id = "m" + state.fixture;
    async function load() {
      if (!review.open || review.dataset.requested) return;
      review.dataset.requested = "true";
      panel.setAttribute("aria-busy","true");
      const lang = state.lang;
      const labels = report.archiveReviewLabels(lang);
      try {
        const response = await fetch(path,{credentials:"omit",signal:state.controller.signal});
        if (!response.ok) return;
        const archive = new DOMParser().parseFromString(await response.text(),"text/html");
        if (!stillOpen(state) || !target.isConnected || state.lang !== lang) return;
        if (archive.querySelector(".intro h1 [data-date]")?.dataset.date !== state.day) return;
        const candidates = [...archive.querySelectorAll(`article[id="${id}"]`)].filter(card => card.querySelector(".pro-verificare"));
        const selected = [lang,"en","ro"].map(code => candidates.find(card => card.closest("[data-lang]")?.dataset.lang === code)).find(Boolean);
        const score = selected?.querySelector("[data-i18n='arhiva.rezfinal']")?.textContent.match(/\b\d+\s*[-–]\s*\d+\b/)?.[0];
        if (!score) return;
        const line = text("p",labels.final + " " + score.replace(/\s*[-–]\s*/,"–"));
        const link = text("a",labels.open);
        link.href = path + "#" + id;
        panel.replaceChildren(line,link);
      } catch (_) { /* Keep the localized availability message on a missing archive. */ }
      finally { panel.removeAttribute("aria-busy"); }
    }
    review.addEventListener("toggle",load);
    load();
  }

  async function fetchDossier(state, message) {
    try {
      const response = await root.PoseidonMembers.getProtected(`/api/dosar/${state.day}/${state.fixture}`,state.controller.signal);
      if (!stillOpen(state)) return;
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
    if (!dialog || dialog.open) return false;
    current?.controller.abort();
    const lang = document.documentElement.lang;
    Object.assign(state,{ lang, copy:words(lang), controller:new AbortController() });
    current = state;
    dialog.lang = labels[lang] ? lang : "en";
    const match = state.item?.match;
    const title = [match?.home,match?.away].filter(Boolean).join(" – ");
    dialog.querySelector("[data-dossier-title]").textContent = title || state.matchLabel || state.copy.open;
    const close = dialog.querySelector("[data-dossier-close]");
    close.textContent = state.copy.close;
    const message = text("p",state.copy.loading);
    message.setAttribute("role","status");
    dialog.querySelector("[data-dossier-body]").replaceChildren(message);
    dialog.showModal();
    close.focus({preventScroll:true});
    dialog.scrollTop = 0;
    if (state.matchLabel) fetchCardMatch(state,message);
    else if (state.fixture) fetchDossier(state,message);
    else show(state,"missing");
    return true;
  }

  function open(trigger) {
    if (!authorized()) return;
    const kickoff = timed(trigger.dataset.dossierKickoff), fixture = Number(trigger.dataset.dossierFixture);
    if (!Number.isSafeInteger(fixture) || fixture < 1 || !Number.isFinite(kickoff)) return;
    return start({ fixture,kickoff,trigger,day:siteDay.format(kickoff) });
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

  function switchLanguage(lang) {
    if (!current || !dialog.open || current.lang === lang) return;
    const state = current;
    state.lang = lang;
    state.copy = words(lang);
    dialog.lang = labels[lang] ? lang : "en";
    const close = dialog.querySelector("[data-dossier-close]");
    close.textContent = state.copy.close;
    if (!state.status || state.status === "login") {
      dialog.querySelector("[data-dossier-body] [role='status']").textContent = state.copy[state.status || "loading"];
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
    dialog = document.getElementById("member-dossier");
    if (!dialog) return;
    document.addEventListener("click",event=>{
      const trigger = event.target.closest("button[data-dossier-fixture]");
      if (trigger) open(trigger);
    });
    dialog.querySelector("[data-dossier-close]").addEventListener("click",()=>dialog.close());
    dialog.addEventListener("close",()=>{
      if (!current || dialog.open) return;
      const state = current;
      current = null;
      state.controller.abort();
      dialog.querySelector("[data-dossier-body]").replaceChildren();
      const byId = state.trigger.id && document.getElementById(state.trigger.id);
      const trigger = state.trigger.isConnected ? state.trigger : byId || [...(state.focusRoot?.querySelectorAll("[data-pro-match]") || [])]
        .find(link => link.dataset.proMatch === state.matchLabel && link.dataset.proDay === state.day);
      trigger?.focus({ preventScroll:true });
    });
  }

  root.PoseidonDossier = {
    setPredictions, predictions:()=>authorized() ? verifiedPredictions : null, button, copy:words,
    loadCatalog, catalog, openPro, openProForMatch, switchLanguage,
    recentDays:()=>[siteDay.format(new Date(Date.now()-86_400_000)),siteDay.format(new Date())],
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",mount);
  else mount();
})(window);
