import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {compactRoute, selectFreeMatches, selectSample} = require('../assets/home-visitor.js');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('only the base visitor route and its plans fragment use the compact view', () => {
  const route = path => new URL(path, 'https://poseidonstats.com/');
  for (const path of ['/', '/?lang=en&utm_source=example', '/#visitor-plans']) assert(compactRoute(route(path)));
  for (const path of ['/?view=full', '/#dashboard', '/#matches', '/#public-pro-demo', '/#pro-analize', '/#intrebari', '/?members=none', '/?members_token=return']) {
    assert(!compactRoute(route(path)), path);
  }
  for (const state of ['basic','pro','none','login']) assert(!compactRoute(route('/'),state));
  assert(!compactRoute(route('/'),'guest',true));
});

test('compact list takes at most five unlocked current Bucharest fixtures with all three probabilities', () => {
  const row = (fixture_id, time) => ({fixture_id,match_date:`2026-11-23T${time}Z`,home_team:'A',away_team:'B',free:true,prob_home:.42,prob_draw:.27,prob_away:.31});
  const matches = [row(6,'18:00:00'), row(5,'16:00:00'), row(4,'15:00:00'), row(3,'14:00:00'),row(2,'13:00:00'),row(1,'12:00:00'),
    {...row(8,'20:00:00'),locked:true},{...row(9,'01:00:00'),free:false},row(10,'22:02:00'),{...row(11,'10:00:00'),prob_draw:null}];
  assert.deepEqual(selectFreeMatches({matches},'2026-11-23').map(m=>m.fixture_id),[1,2,3,4,5]);
  assert.deepEqual(selectFreeMatches({matches},'2026-11-24').map(m=>m.fixture_id),[10]);
  assert.deepEqual(selectFreeMatches({matches},'2026-11-25'),[]);
});

test('public sample rejects a stale day, a moved kickoff or an incomplete identity', () => {
  const today = '2026-11-23';
  const match = {fixture_id:24, match_date:'2026-11-23T20:00:00Z', home:'Home', away:'Away', league:'League'};
  const make = row => ({date:today,item:{match:row,provenance:{original_kickoff_utc:match.match_date}}});
  assert.equal(selectSample(make(match),today),match);
  assert.equal(selectSample(make(match),'2026-11-24'),null);
  assert.equal(selectSample(make({...match,match_date:'2026-11-23T19:00:00Z'}),today),null);
  assert.equal(selectSample(make({...match,league:''}),today),null);
  assert.equal(selectSample({date:today},today),null);
});

test('compact plan and secondary links maintain price mapping, conversion attribution and original destinations', () => {
  const markup = html.match(/<main class="visitor-home" data-compact-home>[\s\S]*?<\/main>/)?.[0];
  assert(markup);
  for (const [tier,id,price] of [['basic',28975826,5],['pro',28975836,20]]) {
    assert.match(markup,new RegExp(`${price} USD[\\s\\S]*?rid=${id}[^>]*data-conversion-tier="${tier}" data-conversion-source="planstrip"`));
  }
  for (const link of ['?view=full#dashboard','?view=full#dashboard-evidence-details','?view=full#intrebari','?view=full#discord-access-details','track-record.html','metodologie.html']) assert(markup.includes(`href="${link}"`));
  assert.match(markup,/<section[^>]*data-visitor-sample[^>]* hidden>/);
  assert.match(markup,/data-i18n="banner.legal"/);
  const dictionary = JSON.parse(readFileSync(new URL('../assets/i18n.json',import.meta.url), 'utf8'));
  for (const language of Object.keys(dictionary)) {
    for (const key of markup.matchAll(/data-i18n="([^\"]+)"/g)) assert(dictionary[language][key[1]],`${language}:${key[1]}`);
  }
});
