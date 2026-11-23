import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const watch = require('../assets/home-watchlist.js');
const match = {
  fixture_id: 1553233, match_date: '2026-11-22T22:30:00Z',
  home_team: 'Wieczysta Kraków', away_team: 'Motor Lublin',
  league: 'Ekstraklasa', country: 'Poland'
};
const goal = (extra = {}) => ({ ...match, ft_h: 1, ft_a: 1, ht_h: 0, ht_a: 0, ...extra });
const source = (result = goal(), day = '2026-11-23') => ({
  days: { [day]: { results: { [match.fixture_id]: result } } }
});

test('calendar uses Bucharest midnight and shifts local dates across DST', () => {
  assert.equal(watch.dayKey(match.match_date), '2026-11-23');
  assert.equal(watch.dayKey('2026-03-29T21:30:00Z'), '2026-03-30');
  assert.equal(watch.shiftDay('2026-03-30', -1), '2026-03-29');
  assert.equal(watch.shiftDay('2026-01-01', -1), '2025-12-31');
  assert.equal(watch.dayKey('2026-02-31'), '');
  assert.equal(watch.dayKey('2026-02-31T12:00:00Z'), '');
  assert.equal(watch.dayKey('2'), '');
  assert.equal(watch.shiftDay('2026-02-31', -1), '');
});

test('stores only normalized identity and market across reload and removes only the same market', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const btts = watch.entry({ ...match, prob_btts: 0.9, picks: [{ outcome: 'WIN' }], dossier: 'private' }, 'btts');
  const over = watch.entry(match, 'over_2_5');
  assert.deepEqual(btts, {
    fixture_id: '1553233', day: '2026-11-23', home: 'Wieczysta Kraków', away: 'Motor Lublin',
    league: 'Ekstraklasa', country: 'Poland', market: 'btts'
  });
  assert.equal(watch.entry(match, 'pro'), null);
  assert.equal(watch.entry({ ...match, fixture_id: '15<script>' }, 'btts'), null);
  assert.equal(watch.write(storage, [btts, { ...over, prob: 0.9 }, btts]), true);
  assert.deepEqual(watch.read(storage), [btts, over]);
  assert.deepEqual(watch.toggle(watch.read(storage), btts), [over]);
  assert.deepEqual(watch.toggle([over], btts), [btts, over]);
  assert.equal([...values.values()][0].includes('prob'), false);
  assert.equal(watch.write({ setItem() { throw new Error('QuotaExceeded'); } }, [btts]), false);
  assert.deepEqual(watch.read({ getItem() { throw new Error('Blocked'); } }), []);
  assert.deepEqual(watch.read({ getItem: () => '{invalid' }), []);
});

test('settles the exact market from valid public scores and keeps 1X2 factual', () => {
  const settle = (market, data = source()) => watch.settle(watch.entry(match, market), data);
  assert.deepEqual(settle('btts'), { ft: [1, 1], ht: [0, 0], outcome: 'hit' });
  assert.deepEqual(settle('over_2_5'), { ft: [1, 1], ht: [0, 0], outcome: 'miss' });
  assert.deepEqual(settle('over_2_5', source(goal({ ft_h: 2 }))), { ft: [2, 1], ht: [0, 0], outcome: 'hit' });
  assert.deepEqual(settle('ht_over_0_5'), { ft: [1, 1], ht: [0, 0], outcome: 'miss' });
  assert.deepEqual(settle('ht_over_0_5', source(goal({ ht_h: 1 }))), { ft: [1, 1], ht: [1, 0], outcome: 'hit' });
  assert.equal(settle('1x2').outcome, 'draw');
  assert.equal(settle('1x2', source(goal({ ft_a: 2 }))).outcome, 'away');
  assert.equal(settle('1x2', source(goal({ ft_h: 2 }))).outcome, 'home');
});

test('missing, contradictory and wrong identities cannot settle the followed market', () => {
  const row = watch.entry(match, 'ht_over_0_5');
  for (const data of [
    null, source(goal(), '2026-11-22'), source(goal({ away_team: 'Other' })),
    source(goal({ fixture_id: 1 })), source(goal({ match_date: '2026-11-22T15:00:00Z' }))
  ]) assert.deepEqual(watch.settle(row, data), { ft: null, ht: null, outcome: 'unavailable' });
  for (const score of [{ ht_h: null }, { ht_a: '0' }]) {
    assert.deepEqual(watch.settle(row, source(goal(score))), { ft: [1, 1], ht: null, outcome: 'unavailable' });
  }
  for (const score of [{ ft_h: null }, { ht_h: 2 }]) {
    assert.deepEqual(watch.settle(row, source(goal(score))), { ft: null, ht: null, outcome: 'unavailable' });
  }
});

test('legacy history verifies match dates, settled FT/HT contracts and consistency before fallback', () => {
  const row = watch.entry(match, 'ht_over_0_5');
  const legacy = (...picks) => ({
    days: [{ date: row.day, matches: [{ ...goal({ ht_h: 1 }), home: row.home, away: row.away, picks }] }]
  });
  const result = (market, outcome) => ({ market, outcome });
  const ft = result('Over 1.5', 'WIN');
  const ht = result('HT Over 0.5', 'WIN');
  let old = legacy(ft);
  assert.deepEqual(watch.settle(row, null, old), { ft: [1, 1], ht: null, outcome: 'unavailable' });
  old = legacy(ft, ht);
  assert.deepEqual(watch.settle(row, null, old), { ft: [1, 1], ht: [1, 0], outcome: 'hit' });
  assert.deepEqual(watch.settle(row, null, legacy(result('Over 1.5', 'LOSS'), ht)), { ft: null, ht: null, outcome: 'unavailable' });
  assert.equal(watch.settle(row, null, legacy(ft, result('HT Over 0.5', 'PENDING'))).outcome, 'unavailable');
  assert.equal(watch.settle(row, null, legacy(result('Editorial Pro', 'WIN'))).outcome, 'unavailable');
  assert.equal(watch.settle(row, source(goal({ ht_h: 0 })), old).outcome, 'unavailable');
});
