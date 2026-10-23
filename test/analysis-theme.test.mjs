import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/i18n-lite.js', import.meta.url), 'utf8');
const dictionary = JSON.parse(readFileSync(new URL('../assets/i18n.json', import.meta.url), 'utf8'));

// Explicit DOM and network mocks: the script runs in the header, before main exists.
class Element {
  constructor(tag, attrs = {}) { this.tagName = tag; this.attrs = {...attrs}; this.children = []; this.parentElement = null; this.hidden = false; this.events = {}; this.textContent = ''; this._html = ''; }
  get className() { return this.attrs.class || ''; }
  set className(value) { this.attrs.class = value; }
  get classList() { return {add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); }, contains: name => this.className.split(/\s+/).includes(name)}; }
  get innerHTML() { return this._html; }
  set innerHTML(value) { this._html = value; this.children = []; if (value.startsWith('<select ')) this.appendChild(new Element('select')); }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return this.attrs[key] ?? null; }
  removeAttribute(key) { delete this.attrs[key]; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  insertBefore(child, before) { child.parentElement = this; const index = this.children.indexOf(before); this.children.splice(index < 0 ? 0 : index, 0, child); return child; }
  get firstChild() { return this.children[0] || null; }
  addEventListener(name, handler) { this.events[name] = handler; }
  matches(selector) {
    const match = selector.match(/^([\w-]+)?(?:\.([\w-]+))?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/);
    if (!match) throw new Error(`Unsupported mock selector: ${selector}`);
    return (!match[1] || this.tagName === match[1]) && (!match[2] || this.classList.contains(match[2])) && (!match[3] || this.getAttribute(match[3]) !== null && (match[4] === undefined || this.getAttribute(match[3]) === match[4]));
  }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
}

async function run({canonical = 'https://poseidonstats.com/analize/index.html', pathname = '/analize/index.html', language = 'ro', preloaded = false, fallback = false, prefix = '../', entries = [], loading = false} = {}) {
  const head = new Element('head'), body = new Element('body'), header = body.appendChild(new Element('header'));
  const container = header.appendChild(new Element('div', {class:'container'}));
  const brand = container.appendChild(new Element('a', {class:'brand', href:'../index.html'})); brand.innerHTML = '<img>POSEIDON';
  const tagline = container.appendChild(new Element('p', {class:'tagline', 'data-i18n':'arhiva.tagline'})); tagline.textContent = 'Archive context';
  const nav = container.appendChild(new Element('nav')); nav.appendChild(new Element('a', {href:'../index.html', 'data-i18n':'nav.predictii'}));
  const script = container.appendChild(new Element('script', {'data-sus':prefix}));
  if (canonical) head.appendChild(new Element('link', {rel:'canonical', href:canonical}));
  if (preloaded) for (const name of ['home-modern', 'pages-modern']) head.appendChild(new Element('link', {rel:'stylesheet', href:`https://poseidonstats.com/assets/${name}.css`}));
  const requests = [], storage = [], location = {href:`https://poseidonstats.com${pathname}`, pathname, reload() { this.reloaded = true; }};
  const root = new Element('html'); root.appendChild(head); root.appendChild(body);
  const mainQueries = [], listeners = {}, contentElements = [];
  const document = {head, body, documentElement:root, currentScript:script, baseURI:location.href, readyState: loading ? "loading" : "complete",
    addEventListener:(name,handler) => { listeners[name] = handler; },
    createElement:tag => new Element(tag), getElementById:id => root.querySelector(`[id="${id}"]`),
    querySelector(selector) { if (/main|article/.test(selector)) mainQueries.push(selector); return root.querySelector(selector); },
    querySelectorAll:selector => root.querySelectorAll(selector)};
  // Content becomes available only after synchronous bootstrap and selector setup.
  let article, group, english, romanian;
  const context = vm.createContext({document, navigator:{language}, localStorage:{getItem:() => language, setItem:(...args) => storage.push(args)}, location, URL, Intl, Date,
    fetch:async path => {
      requests.push(path);
      const main = body.appendChild(new Element('main'));
      entries.forEach(entry => { const node = new Element(entry.tag || 'p', entry.attrs); node.innerHTML = entry.original || 'Original content'; main.appendChild(node); contentElements.push(node); });
      if (fallback) {
        group = main.appendChild(new Element('div', {'data-lang-grup':''}));
        romanian = group.appendChild(new Element('div', {'data-lang':'ro'}));
        english = group.appendChild(new Element('div', {'data-lang':'en'}));
        article = main.appendChild(new Element('article', {class:'pro-card-full', id:'original-match'}));
        article.appendChild(new Element('div', {class:'pro-visible'}));
      }
      return {json:async () => dictionary};
    }});
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return {document, body, head, brand, nav, tagline, script, container, requests, storage, location, context, mainQueries, article, group, english, romanian, contentElements, finishParsing() { document.readyState = "interactive"; listeners.DOMContentLoaded?.(); }};
}

test('archive index and dated canonical paths get the navy theme before content parsing', async () => {
  for (const filename of ['index.html','2026-10-22.html','2026-07-09.html']) {
    const state = await run({canonical:`https://poseidonstats.com/analize/${filename}`, pathname:'/preview.html'});
    for (const name of ['home-modern','secondary-modern','analysis-modern']) assert(state.body.classList.contains(name));
    assert.deepEqual(state.head.querySelectorAll('link[rel="stylesheet"]').map(link => link.getAttribute('href')), ['../assets/home-modern.css','../assets/pages-modern.css']);
    assert.deepEqual(state.mainQueries, []);
    assert.equal(state.script.parentElement, state.container);
    assert.equal(state.tagline.getAttribute('data-i18n'), 'arhiva.tagline');
    assert.match(state.brand.innerHTML, /brand-icon/);
    assert.match(state.brand.innerHTML, /POSEIDON<span>STATS/);
    assert.match(state.brand.innerHTML, /<svg/);
    assert.equal(state.brand.getAttribute('href'), '../index.html');
    assert.deepEqual(state.requests, ['../assets/i18n.json']);
  }
});

test('navigation keeps analyses active and correctly prefixes every internal destination', async () => {
  const {nav} = await run();
  assert.deepEqual(nav.querySelectorAll('a').map(link => link.getAttribute('href')), [
    '../index.html', '../index.html#dashboard', '../analize/index.html', '../track-record.html', '../metodologie.html', '../index.html#abonament',
    '../predictii/index.html', '../simulator.html', '../istoric.html', '../index.html#intrebari', 'mailto:contact@poseidonstats.com'
  ]);
  const active = nav.querySelectorAll('a').filter(link => link.classList.contains('active'));
  assert.equal(active.length, 1); assert.equal(active[0].getAttribute('data-i18n'), 'nav.analize');
  assert.equal(active[0].getAttribute('aria-current'), 'page');
  assert.equal(nav.querySelectorAll('details.nav-more').length, 1);
  assert.equal(nav.querySelectorAll('.lang-switcher').length, 1);
});

test('preloaded styles are reused and running the bootstrap again does not duplicate styles or controls', async () => {
  const state = await run({preloaded:true});
  const switcher = state.nav.querySelector('.lang-switcher');
  vm.runInContext(source, state.context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.head.querySelectorAll('link[rel="stylesheet"]').length, 2);
  assert.equal(state.nav.querySelector('.lang-switcher'), switcher);
  assert.equal(state.nav.querySelectorAll('details.nav-more').length, 1);
});

test('missing canonical falls back to analysis pathname, but canonical unknown routes win', async () => {
  assert((await run({canonical:null})).body.classList.contains('analysis-modern'));
  for (const pathname of ['/membru.html','/index.html','/other/analize/example.html','/predictii-other/index.html','/statistici-pariuri.html/other']) {
    const state = await run({canonical:`https://poseidonstats.com${pathname}`, pathname:'/analize/index.html'});
    assert.equal(state.body.className, ''); assert.equal(state.brand.innerHTML, '<img>POSEIDON');
    assert.equal(state.head.querySelectorAll('link[rel="stylesheet"]').length, 0);
    assert.equal(state.nav.querySelectorAll('details').length, 0);
    assert.deepEqual(state.requests, ['../assets/i18n.json']);
  }
});

test('all six languages translate the new nav while the original selector continues storing and reloading', async () => {
  for (const language of ['ro','en','es','it','fr','id']) for (const pathname of ['/analize/index.html','/predictii/index.html','/predictii/arhiva/index.html','/en/predictions/example.html','/statistici-pariuri.html','/en/betting-odds-statistics.html']) {
    const prefix = pathname.split('/').length > 3 ? '../../' : pathname.split('/').length > 2 ? '../' : '';
    const state = await run({language,canonical:`https://poseidonstats.com${pathname}`,pathname,prefix});
    assert.equal(state.document.documentElement.lang, language);
    for (const node of state.nav.querySelectorAll('[data-i18n]')) assert.equal(node.innerHTML, dictionary[language][node.getAttribute('data-i18n')]);
    const switcher = state.nav.querySelector('.lang-switcher');
    assert.match(switcher.innerHTML, new RegExp(`value="${language}" selected`));
    assert.equal((switcher.innerHTML.match(/<option /g) || []).length, 6);
    switcher.querySelector('select').events.change({target:{value:'en'}});
    assert.deepEqual(state.storage, [['poseidon_lang','en']]); assert.equal(state.location.reloaded, true);
  }
});

test('original language fallback reveals English and keeps the old Romanian archive notice', async () => {
  const state = await run({language:'it',fallback:true});
  assert.equal(state.english.hidden, false); assert.equal(state.romanian.hidden, true);
  assert.equal(state.article.getAttribute('id'), 'original-match');
  assert.equal(state.article.querySelector('.nota-ro').textContent, dictionary.it['arhiva.nota_ro']);
  assert.equal(state.article.querySelector('.pro-visible').children.length, 1);
});


test('prediction, nested archive and future English helper routes use real root prefixes and current navigation', async () => {
  for (const [pathname,prefix] of [['/predictii/index.html','../'], ['/predictii/anglia-premier-league.html','../'], ['/predictii/arhiva/2026-10-22.html','../../'], ['/en/predictions/england-premier-league.html','../../'], ['/en/predictions/index.html','../../']]) {
    const state = await run({canonical:`https://poseidonstats.com${pathname}`, pathname, prefix});
    assert(state.body.classList.contains('prediction-modern'));
    assert(!state.body.classList.contains('analysis-modern'));
    assert.deepEqual(state.head.querySelectorAll('link[rel="stylesheet"]').map(link => link.getAttribute('href')), [`${prefix}assets/home-modern.css`,`${prefix}assets/pages-modern.css`]);
    assert.equal(state.brand.getAttribute('href'), `${prefix}index.html`);
    const active = state.nav.querySelectorAll('a').filter(link => link.classList.contains('active'));
    assert.equal(active.length,1); assert.equal(active[0].getAttribute('data-i18n'),'nav.ligi');
    assert.equal(active[0].getAttribute('aria-current'), ['/predictii/index.html','/en/predictions/index.html'].includes(pathname) ? 'page' : 'location');
    assert.equal(active[0].getAttribute('href'), `${prefix}${pathname.startsWith('/en/') ? 'en/predictions/index.html' : 'predictii/index.html'}`);
    assert(state.nav.querySelector('summary').classList.contains('active'));
    assert.equal(state.nav.querySelector('a[data-i18n="nav.analize"]').getAttribute('href'), `${prefix}analize/index.html`);
    assert.deepEqual(state.requests,[`${prefix}assets/i18n.json`]);
  }
});

test('root statistics use local assets and do not falsely mark another section as current', async () => {
  const state = await run({canonical:'https://poseidonstats.com/statistici-pariuri.html', pathname:'/statistici-pariuri.html',prefix:''});
  assert(state.body.classList.contains('stats-modern'));
  assert.deepEqual(state.head.querySelectorAll('link[rel="stylesheet"]').map(link => link.getAttribute('href')), ['assets/home-modern.css','assets/pages-modern.css']);
  assert.equal(state.brand.getAttribute('href'),'index.html');
  assert.equal(state.nav.querySelectorAll('a').filter(link => link.classList.contains('active')).length,0);
  assert.deepEqual(state.requests,['assets/i18n.json']);
});

test('every existing public HTML using lite is accepted with its actual canonical and prefix', async () => {
  function htmlFiles(folder) {
    return readdirSync(folder,{withFileTypes:true}).flatMap(item => item.isDirectory() && ['analize','predictii','arhiva','en','predictions'].includes(item.name) ? htmlFiles(new URL(`${item.name}/`,folder)) : item.isFile() && item.name.endsWith('.html') ? [new URL(item.name,folder)] : []);
  }
  const files = htmlFiles(new URL('../',import.meta.url)).filter(path => /<script[^>]*src="[^"]*assets\/i18n-lite\.js"/.test(readFileSync(path,'utf8')));
  assert(files.length > 100, 'inventory contains the actual generated helper pages');
  for (const file of files) {
    const html=readFileSync(file,'utf8');
    const canonical=html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    const prefix=html.match(/<script[^>]*src="[^"]*assets\/i18n-lite\.js"[^>]*data-sus="([^"]*)"/)?.[1];
    assert(canonical && prefix !== undefined, file.pathname);
    const state = await run({canonical,pathname:new URL(canonical).pathname,prefix});
    assert(state.body.classList.contains('secondary-modern'), file.pathname);
    assert.equal(state.script.parentElement,state.container);
    assert.deepEqual(state.requests,[`${prefix}assets/i18n.json`]);
    assert.equal(state.nav.querySelectorAll('.lang-switcher').length,1);
  }
});


function realVariableEntries(html) {
  const decode = text => text.replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  const entries=[];
  for (const match of html.matchAll(/<([a-z][\w-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)) {
    const attrs={};
    for (const attr of match[2].matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) attrs[attr[1]]=decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
    if (attrs['data-i18n'] && attrs['data-i18n-vars']) entries.push({tag:match[1],attrs});
  }
  return entries;
}

test('actual malformed archive heading is repaired without changing its date markup', async () => {
  const entry=realVariableEntries(readFileSync(new URL('../analize/2026-10-22.html',import.meta.url),'utf8')).find(entry => entry.attrs['data-i18n']==='arhiva.zi.h1');
  assert.throws(() => JSON.parse(entry.attrs['data-i18n-vars']));
  for (const language of ['ro','en','es','it','fr','id']) {
    const state=await run({language,entries:[entry]});
    const node=state.contentElements[0];
    assert.doesNotMatch(node.innerHTML,/\{data\}/);
    assert.equal(JSON.parse(node.getAttribute('data-i18n-vars')).data,'<span data-date="2026-10-22">22 octombrie 2026</span>');
    assert(node.innerHTML.includes('<span data-date="2026-10-22">22 octombrie 2026</span>'));
  }
});

test('cached translations wait for DOMContentLoaded before processing parsed archive content', async () => {
  const entry=realVariableEntries(readFileSync(new URL('../analize/2026-10-22.html',import.meta.url),'utf8')).find(entry => entry.attrs['data-i18n']==='arhiva.zi.h1');
  const state=await run({language:'en',entries:[entry],loading:true});
  assert.equal(state.contentElements[0].innerHTML,'Original content');
  // Explicitly add a late-parsed main node after dictionary response and before DOMContentLoaded.
  const late=state.body.querySelector('main').appendChild(new Element('p',{'data-i18n':'arhiva.zi.p','data-i18n-vars':'{"n":"12","rez":"10"}'}));
  late.innerHTML='Late original';
  state.finishParsing();
  assert.doesNotMatch(state.contentElements[0].innerHTML,/\{data\}/);
  assert.match(state.contentElements[0].innerHTML,/2026-10-22/);
  assert.doesNotMatch(late.innerHTML,/\{n\}|\{rez\}|Late original/);
  assert.match(late.innerHTML,/12/); assert.match(late.innerHTML,/10/);
});

test('unrecoverable variables keep existing content and never evaluate executable text', async () => {
  const raw='{"data":globalThis.injected=true}';
  const state=await run({entries:[{attrs:{'data-i18n':'arhiva.zi.h1','data-i18n-vars':raw},original:'Existing safe date'}]});
  assert.equal(state.contentElements[0].innerHTML,'Existing safe date');
  assert.equal(state.contentElements[0].getAttribute('data-i18n-vars'),raw);
  assert.equal(state.context.injected,undefined);
});

test('real variable attributes across all helper pages interpolate in six languages with dates and counts intact', async t => {
  const folders=['../analize/','../predictii/','../en/'];
  function files(folder) { return readdirSync(folder,{withFileTypes:true}).flatMap(item => item.isDirectory() ? files(new URL(`${item.name}/`,folder)) : item.isFile() && item.name.endsWith('.html') ? [new URL(item.name,folder)] : []); }
  let malformed=0, checked=0;
  for (const path of folders.flatMap(folder => files(new URL(folder,import.meta.url)))) {
    const html=readFileSync(path,'utf8'); if (!html.includes('i18n-lite.js')) continue;
    const entries=realVariableEntries(html);
    const expected=entries.map(entry => { const raw=entry.attrs['data-i18n-vars']; try {return JSON.parse(raw);} catch {malformed++;return JSON.parse(raw.replace(/data-date="([0-9-]+)"/g, 'data-date=\\"$1\\"'));} });
    for (const language of ['ro','en','es','it','fr','id']) {
      const state=await run({language,entries});
      state.contentElements.forEach((node,index) => {
        const vars=expected[index], key=entries[index].attrs['data-i18n'];
        assert.deepEqual(JSON.parse(node.getAttribute('data-i18n-vars')),vars,`${path.pathname} ${key}`);
        try { JSON.parse(entries[index].attrs['data-i18n-vars']); assert.equal(node.getAttribute('data-i18n-vars'),entries[index].attrs['data-i18n-vars']); } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
        let translation=dictionary[language][key] || dictionary.ro[key];
        if (!translation) return;
        Object.entries(vars).forEach(([name,value]) => {translation=translation.split(`{${name}}`).join(value);});
        assert.equal(node.innerHTML,translation,`${path.pathname} ${language} ${key}`);
        assert.doesNotMatch(node.innerHTML,/\{(?:data|n|de_la)\}/);
        checked++;
      });
    }
  }
  assert(malformed > 0); assert(checked > 1000);
  t.diagnostic(`${malformed} real malformed date attributes repaired; ${checked} actual interpolations verified across six languages`);
});
