/* Public fixture identity, browser storage and market settlement for the homepage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PoseidonWatchlist = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const storageKey = 'poseidon:home-watchlist:v1';
  const markets = Object.freeze(['1x2', 'btts', 'over_2_5', 'ht_over_0_5']);
  const calendar = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit'
  });

  function validDay(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
  }

  function dayKey(value) {
    if (typeof value === 'string') {
      if (validDay(value)) return value;
      const timestamp = /^(\d{4}-\d{2}-\d{2})[T ]([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?$/.exec(value);
      if (!timestamp || !validDay(timestamp[1])) return '';
      // The public archival input uses UTC for timestamp strings without an offset.
      value = value.replace(' ', 'T') + (timestamp[3] ? '' : 'Z');
    }
    const date = new Date(value);
    return value != null && Number.isFinite(+date) ? calendar.format(date) : '';
  }

  function shiftDay(day, offset) {
    if (!validDay(day) || !Number.isInteger(offset)) return '';
    const date = new Date(day + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + offset);
    return Number.isFinite(+date) ? date.toISOString().slice(0, 10) : '';
  }

  const identity = value => /^[1-9]\d*$/.test(String(value ?? '')) ? String(value) : '';
  const text = value => typeof value === 'string' ? value.trim() : '';

  function entry(match, market = match?.market) {
    const fixture_id = identity(match?.fixture_id);
    const kickoff = match?.match_date;
    const day = dayKey(kickoff ?? match?.day);
    const home = text(match?.home_team ?? match?.home);
    const away = text(match?.away_team ?? match?.away);
    if (!fixture_id || !day || !home || !away || !markets.includes(market)) return null;
    return { fixture_id, day, home, away, league: text(match.league), country: text(match.country), market };
  }

  function key(watched) {
    const saved = entry(watched);
    return saved ? [saved.day, saved.fixture_id, saved.market].join('/') : '';
  }

  function clean(items) {
    const saved = new Map();
    for (const raw of Array.isArray(items) ? items : []) {
      const row = entry(raw);
      const id = key(row);
      if (id && !saved.has(id)) saved.set(id, row);
    }
    return [...saved.values()];
  }

  function read(storage) {
    try { return clean(JSON.parse(storage?.getItem(storageKey) ?? '[]')); }
    catch (_) { return []; }
  }

  function write(storage, items) {
    try {
      storage.setItem(storageKey, JSON.stringify(clean(items)));
      return true;
    } catch (_) { return false; }
  }

  function toggle(items, watched) {
    const saved = clean(items);
    const row = entry(watched);
    if (!row) return saved;
    const id = key(row);
    return saved.some(item => key(item) === id) ? saved.filter(item => key(item) !== id) : [row, ...saved];
  }

  const scorePair = (home, away) => [home, away].every(n => Number.isSafeInteger(n) && n >= 0) ? [home, away] : null;
  const compatible = (ft, ht) => !!ft && !!ht && ht.every((goals, team) => goals <= ft[team]);
  const normalizedName = name => text(name).normalize('NFC').replace(/\s+/g, ' ').toLowerCase();

  function sameFixture(watched, result) {
    return identity(result.fixture_id) === watched.fixture_id
      && normalizedName(result.home_team ?? result.home) === normalizedName(watched.home)
      && normalizedName(result.away_team ?? result.away) === normalizedName(watched.away)
      && !['country', 'league'].some(field => watched[field] && result[field] &&
        normalizedName(watched[field]) !== normalizedName(result[field]));
  }

  function truth(pick, [h, a]) {
    const result = h > a ? '1' : h === a ? 'X' : '2';
    if (['1 (Home)', 'X (Draw)', '2 (Away)', '1X', 'X2', '12'].includes(pick)) {
      return (pick.includes('(') ? pick[0] : pick).includes(result);
    }
    if (['BTTS', 'BTTS Da', 'BTTS Nu'].includes(pick)) return (h > 0 && a > 0) === (pick !== 'BTTS Nu');
    const line = /^(?:HT )?(Over|Under) ([0-3]\.5)$/.exec(pick);
    if (line) return line[1] === 'Over' ? h + a > Number(line[2]) : h + a < Number(line[2]);
    return null;
  }

  function validatedPick(picks, score, half) {
    if (!score || !Array.isArray(picks)) return false;
    const evidence = picks.flatMap(pick => {
      if (!['WIN', 'LOSS'].includes(pick?.outcome) || !pick.market || /^HT /.test(pick.market) !== half) return [];
      const occurred = truth(pick.market, score);
      return occurred === null ? [] : [occurred === (pick.outcome === 'WIN')];
    });
    return evidence.length > 0 && evidence.every(Boolean);
  }

  function verifiedPairs(result, legacy = false) {
    const ft = scorePair(result.ft_h, result.ft_a);
    const ht = scorePair(result.ht_h, result.ht_a);
    if (ft && ht && !compatible(ft, ht)) return { ft: null, ht: null };
    // A public history row may contain pending data. Its own settled picks certify the two
    // time scopes independently, only when all recognized pick outcomes agree with the score.
    const verifiedFt = legacy && !validatedPick(result.picks, ft, false) ? null : ft;
    return { ft: verifiedFt, ht: compatible(verifiedFt, ht) && (!legacy || validatedPick(result.picks, ht, true)) ? ht : null };
  }

  function combine(a, b) {
    if (!a || !b) return a ?? b;
    return a[0] === b[0] && a[1] === b[1] ? a : null;
  }

  function settle(watched, marketHistory, history = null) {
    const row = entry(watched);
    const unavailable = { ft: null, ht: null, outcome: 'unavailable' };
    if (!row) return unavailable;
    const result = marketHistory?.days?.[row.day]?.results?.[row.fixture_id];
    const legacy = Array.isArray(history?.days) ? history.days.flatMap(day =>
      day?.date === row.day && Array.isArray(day.matches)
        ? day.matches.filter(match => identity(match?.fixture_id) === row.fixture_id) : []
    ) : [];
    if ((result && (!sameFixture(row, result) || dayKey(result.match_date) !== row.day))
      || legacy.length > 1 || (legacy[0] && !sameFixture(row, legacy[0]))) return unavailable;

    const current = result ? verifiedPairs(result) : unavailable;
    const old = legacy[0] ? verifiedPairs(legacy[0], true) : unavailable;
    const ft = combine(current.ft, old.ft);
    const half = combine(current.ht, old.ht);
    const ht = compatible(ft, half) ? half : null;
    let outcome = 'unavailable';
    if (row.market === '1x2' && ft) outcome = ft[0] > ft[1] ? 'home' : ft[0] === ft[1] ? 'draw' : 'away';
    if (row.market === 'btts' && ft) outcome = ft.every(Boolean) ? 'hit' : 'miss';
    if (row.market === 'over_2_5' && ft) outcome = ft[0] + ft[1] >= 3 ? 'hit' : 'miss';
    if (row.market === 'ht_over_0_5' && ht) outcome = ht.some(Boolean) ? 'hit' : 'miss';
    return { ft, ht, outcome };
  }

  return { markets, dayKey, shiftDay, entry, key, read, write, toggle, settle };
});
