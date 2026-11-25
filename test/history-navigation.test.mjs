import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const home = read('index.html');
const catalog = read('meciuri.html');
const history = read('istoric.html');
const routeScript = [...home.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('function followBookmark()'));

function route(hash, search = '') {
  const targets = [];
  runInNewContext(routeScript,{
    location:{hash,search,replace:target => targets.push(target)},
    window:{addEventListener() {}},
  });
  return targets;
}

test('old Results bookmarks land directly on the filterable history in the requested language', () => {
  assert(routeScript);
  for (const hash of ['#rezultate', '#dashboard-evidence-details']) {
    assert.deepEqual(route(hash, '?view=full&lang=en'),['istoric.html?view=full&lang=en#rezultate-recente']);
  }
  assert.deepEqual(route('#abonament','?lang=en'),['meciuri.html?lang=en#abonament']);
  assert.deepEqual(route('','#lang=en'),[]);
});

test('catalog Results and its legacy anchor link to the journal with the audit still available', () => {
  assert.match(catalog, /class="home-nav-direct" href="istoric\.html#rezultate-recente" data-i18n="redesign\.nav\.results"/);
  const section = catalog.match(/<section id="dashboard-evidence-details"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert(section);
  assert.match(section,/href="istoric\.html#rezultate-recente"/);
  assert.match(section,/href="track-record\.html#audit-section"/);
  assert.match(history,/<h2 id="rezultate-recente"[^>]*>[\s\S]*?id="filter-result"[\s\S]*?id="days-list"/);
});

test('the journal scope and recent results heading are explicit in all site languages', () => {
  const dictionary = JSON.parse(read('assets/i18n.json'));
  for (const lang of ['ro', 'en', 'es', 'it', 'fr', 'id']) {
    assert(dictionary[lang]['istoric.recent']);
    assert.match(dictionary[lang]['istoric.freemium'],/audit/i,lang);
  }
});
