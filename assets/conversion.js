/* Anonymous homepage funnel. GoatCounter only; no payment inference or member identifiers. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    root.PoseidonConversion = api.create(root);
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', root.PoseidonConversion.mount);
    else root.PoseidonConversion.mount();
  }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const CHECKOUT = Object.freeze({
    basic: 'https://www.patreon.com/checkout/PoseidonPredictions?rid=28975826',
    pro: 'https://www.patreon.com/checkout/PoseidonPredictions?rid=28975836'
  });
  const SOURCES = ['hero', 'header', 'planstrip', 'legacy', 'dashboard'];
  const ACTIONS = ['plan-intent', 'plan-outbound', 'login', 'predictions', 'sample', 'track-record', 'methodology', 'analyses'];
  const VIEWS = ['pricing', 'planstrip', 'sample', 'dashboard'];
  const CAMPAIGNS = {
    utm_source: ['instagram', 'facebook', 'tiktok', 'youtube', 'discord', 'telegram', 'newsletter', 'patreon', 'google', 'bing', 'direct'],
    utm_medium: ['social', 'organic', 'email', 'referral', 'cpc', 'community'],
    utm_campaign: ['homepage', 'basic', 'pro', 'launch', 'poseidonstats', 'site-conversion-20261024'],
    utm_content: ['hero', 'header', 'planstrip', 'legacy', 'dashboard', 'basic', 'pro']
  };
  function campaignQuery(search) {
    const input = new URLSearchParams(search || ''), safe = new URLSearchParams();
    Object.keys(CAMPAIGNS).forEach(key => {
      const values = input.getAll(key);
      if (values.length !== 1) return;
      const value = values[0].toLowerCase();
      if (value.length <= 32 && CAMPAIGNS[key].includes(value)) safe.set(key, value);
    });
    const query = safe.toString();
    return query ? '?' + query : '';
  }
  function referralOrigin(referrer) {
    try {
      const url = new URL(referrer);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : '';
    } catch (_) { return ''; }
  }
  function create(root) {
    const doc = root.document, queue = [], seen = new Set();
    const query = campaignQuery(root.location && root.location.search);
    const referrer = referralOrigin(doc.referrer);
    const goat = root.goatcounter = root.goatcounter || {};
    // Must run before async count.js. Its automatic calls would otherwise include raw location.search.
    goat.no_onload = true;
    goat.no_events = true;
    let mounted = false, timer = null, retries = 0, adapted = null;
    function privacyReady() {
      const gc = root.goatcounter;
      if (!gc || typeof gc.count !== 'function' || typeof gc.get_data !== 'function') return false;
      if (adapted !== gc.get_data) {
        const original = gc.get_data;
        // Verified upstream get_data is used by url()/count(). Fail closed if that contract is absent.
        // https://github.com/arp242/goatcounter/blob/master/public/count.js
        adapted = function (vars) {
          const data = original.call(gc, vars);
          const event = vars && vars.event === true;
          return Object.assign({}, data, {
            p: event ? vars.path : '/', t: event ? vars.path : 'PoseidonStats', r: referrer, q: query
          });
        };
        gc.get_data = adapted;
      }
      return true;
    }
    function schedule() {
      if (!queue.length || timer !== null || retries >= 20 || typeof root.setTimeout !== 'function') return;
      timer = root.setTimeout(() => { timer = null; retries++; flush(); }, 500);
    }
    function flush() {
      if (privacyReady()) {
        while (queue.length) {
          try { root.goatcounter.count(queue[0]); queue.shift(); }
          catch (_) { break; }
        }
      }
      if (!queue.length && timer !== null) { root.clearTimeout(timer); timer = null; }
      schedule();
    }
    function send(payload) {
      if (queue.length >= 32) return false;
      queue.push(payload);
      flush();
      return true;
    }
    function once(key) {
      if (seen.has(key)) return false;
      const storageKey = 'poseidon_conversion_seen_v1:' + key;
      try { if (root.sessionStorage.getItem(storageKey) === '1') { seen.add(key); return false; } } catch (_) {}
      seen.add(key);
      try { root.sessionStorage.setItem(storageKey, '1'); } catch (_) {}
      return true;
    }
    function event(path) { return send({path, title: path, referrer, event: true}); }
    function track(action, source, tier) {
      if (!ACTIONS.includes(action) || !SOURCES.includes(source) || (tier && tier !== 'basic' && tier !== 'pro')) return false;
      return event('funnel/' + action + '/' + source + (tier ? '/' + tier : ''));
    }
    function sourceOf(element) {
      const explicit = element.getAttribute('data-conversion-source');
      if (explicit) return SOURCES.includes(explicit) ? explicit : null;
      if (element.closest('header')) return 'header';
      if (element.closest('.dashboard-hero')) return 'hero';
      if (element.closest('[data-conversion-view="planstrip"]')) return 'planstrip';
      if (element.closest('#dashboard') || element.closest('.dashboard-feature-strip') || element.closest('.dashboard-benefits')) return 'dashboard';
      return 'legacy';
    }
    function planTier(element) {
      const explicit = element.getAttribute('data-conversion-tier');
      if (explicit === 'basic' || explicit === 'pro') return explicit;
      if (element.classList.contains('plan-btn-basic') || element.classList.contains('unlock-btn-basic') || element.classList.contains('oferta-btn-basic')) return 'basic';
      if (element.classList.contains('plan-btn-pro') || element.classList.contains('pro-cta') || element.classList.contains('oferta-btn-pro')) return 'pro';
      return null;
    }
    function patreonURL(href) {
      try {
        const url = new URL(href, 'https://poseidonstats.com');
        return url.protocol === 'https:' && ['patreon.com', 'www.patreon.com'].includes(url.hostname) &&
          ['/PoseidonPredictions', '/checkout/PoseidonPredictions', '/cw/PoseidonPredictions/membership', '/c/PoseidonPredictions/membership'].includes(url.pathname) ? url : null;
      } catch (_) { return null; }
    }
    function decoratePlan(element) {
      const href = element.getAttribute('href') || '';
      if (!patreonURL(href)) return;
      const tier = planTier(element);
      if (tier) element.setAttribute('href', CHECKOUT[tier]);
    }
    function classify(element) {
      const href = element.getAttribute('href') || '', explicit = element.getAttribute('data-conversion');
      const source = sourceOf(element), tier = planTier(element), patreon = patreonURL(href);
      if (!source) return null;
      let action = explicit;
      if (explicit && !ACTIONS.includes(explicit)) return null;
      if (!action) {
        if (patreon) action = 'plan-outbound';
        else if (href === 'https://poseidon-members.poseidonstats.workers.dev/login') action = 'login';
        else if (href === '#abonament' || href === 'index.html#abonament' || href === '#abonament-detalii') action = 'plan-intent';
        else if (href === '#dashboard' || href === '#matches' || href === '#repere-azi') action = 'predictions';
        else if (href === '#exemplu-pro') action = 'sample';
        else if (/^(?:\.\/)?track-record\.html(?:#.*)?$/.test(href)) action = 'track-record';
        else if (/^(?:\.\/)?metodologie\.html(?:#.*)?$/.test(href)) action = 'methodology';
        else if (href === '#pro-analize' || href === '#dashboard-analyses' || /^(?:\.\/)?analize\//.test(href)) action = 'analyses';
      }
      if (!action || (action === 'plan-outbound' && !patreon)) return null;
      return {action, source, tier: action.startsWith('plan-') ? tier : null};
    }
    function access(detail) {
      if (!detail) return;
      if (detail.outcome === 'verified' && detail.status === 200) {
        if (once('access-verified')) event('funnel/access-verified');
      } else if (detail.outcome === 'failure') {
        const status = [401, 403, 404, 429, 500, 502, 503].includes(detail.status) ? String(detail.status) : ['network', 'invalid-response'].includes(detail.status) ? detail.status : 'other';
        if (once('access-failure-' + status)) event('funnel/access-failure/' + status);
      }
    }
    function mount() {
      if (mounted) { flush(); return; }
      mounted = true;
      doc.querySelectorAll('a.plan-btn-basic,a.plan-btn-pro,a.pro-cta').forEach(decoratePlan);
      doc.addEventListener('click', ev => {
        const element = ev.target && ev.target.closest && ev.target.closest('a,button');
        if (!element) return;
        decoratePlan(element);
        const target = classify(element);
        if (target) track(target.action, target.source, target.tier);
      }, {passive: true});
      const script = doc.querySelector('script[data-goatcounter]');
      if (script) script.addEventListener('load', flush);
      if (typeof root.addEventListener === 'function') root.addEventListener('pageshow', flush);
      if (typeof root.IntersectionObserver === 'function') {
        const sections = new Map();
        doc.querySelectorAll('[data-conversion-view]').forEach(element => {
          const view = element.getAttribute('data-conversion-view'), source = sourceOf(element);
          const heading = element.querySelector && element.querySelector('h2, h3, .pro-card-head');
          if (VIEWS.includes(view) && source) sections.set(heading || element, {view, source});
        });
        const observer = new root.IntersectionObserver(entries => {
          entries.forEach(entry => {
            const section = sections.get(entry.target);
            if (!section || !entry.isIntersecting || entry.intersectionRatio < 0.3) return;
            if (once('view-' + section.view)) event('funnel/view/' + section.view + '/' + section.source);
            observer.unobserve(entry.target);
          });
        }, {threshold: 0.3});
        sections.forEach((_, element) => observer.observe(element));
      }
      send({path: '/', title: 'PoseidonStats', referrer, event: false});
    }
    return {mount, track, flush, access};
  }
  return {create, campaignQuery};
});
