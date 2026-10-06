/* POSEIDON — zona de membri pe site (28 sept 2026). Script clasic (fără module) ca să fie gata înaintea lui app.js.
   Basic ($5) = toate meciurile zilei cu probabilități + simulator; Pro ($20) = și analizele. Evidența cine plătește și
   până când o ține PATREON: la login worker-ul întreabă Patreon și dă un token semnat pe 7 zile; când expiră, un click
   „Intră cu Patreon” îl reînnoiește (Patreon ține sesiunea). Un abonament oprit se stinge deci în cel mult 7 zile. */
(function (root) {
  const MEMBERS_API = "https://poseidon-members.poseidonstats.workers.dev";                       // se completează după `wrangler deploy`: https://poseidon-members.<cont>.workers.dev
  const CHEIE = "poseidon_members_token";

  function tokenDinUrl(search) {
    try { return new URLSearchParams(search || "").get("members_token") || null; } catch { return null; }
  }
  // 29 sept 2026 — FIX cursă: app.js pornește renderIndex() la încărcarea scriptului (nu la DOMContentLoaded), deci tokenul din
  // URL trebuie salvat SINCRON, aici, înainte să se execute app.js; altfel prima pagină după login vine cu lacăte.
  function captureaza(search, storage) {
    const t = tokenDinUrl(search);
    if (t) { try { storage.setItem(CHEIE, t); } catch {} }
    return t;
  }
  function _unb64u(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/"); s += "=".repeat((4 - s.length % 4) % 4);
    return (typeof atob === "function") ? atob(s) : Buffer.from(s, "base64").toString("binary");
  }
  function tierDinToken(token, acum) {
    try {
      if (!token) return null;
      const p = JSON.parse(decodeURIComponent(escape(_unb64u(String(token).split(".")[0]))));
      const now = acum ?? Math.floor(Date.now() / 1000);
      return p && p.exp > now && (p.tier === "basic" || p.tier === "pro") ? p.tier : null;
    } catch { return null; }
  }
  async function incarcaPredictii({ api, token, publicUrl, fetchImpl, sterge }) {
    const f = fetchImpl || ((u, o) => fetch(u, o));
    let eroare = null;
    if (api && token) {
      try {
        const r = await f(api + "/api/predictions", { headers: { authorization: "Bearer " + token }, cache: "no-store" });
        if (r.ok) return { sursa: "membru", data: await r.json() };
        if (r.status === 401 || r.status === 403) sterge && sterge();
        eroare = r.status;                                   // 6 oct 2026: 404/5xx la un membru valid NU mai cade tăcut pe public
      } catch (e) { console.warn("[membri] API indisponibil, cad pe public", e); eroare = "rețea"; }
    }
    try {
      const r = await f(publicUrl, { cache: "no-cache" });
      return { sursa: "public", data: r.ok ? await r.json() : null, eroare };
    } catch { return { sursa: "public", data: null, eroare }; }
  }
  function textBara(tier, api) {
    // textele implicite sunt în română; app.js (applyI18n) le rescrie după limba aleasă, prin data-i18n
    if (!tier) return `<span class="members-hint" data-i18n="members.hint">Vrei să deblochezi toate meciurile zilei? <strong>5 $/lună</strong>. Vrei și analizele Pro? <strong>20 $/lună</strong>.</span>`
      + `<a class="members-sub" href="index.html#abonament" data-i18n="members.sub">Abonează-te</a>`
      + `<a class="members-login" href="${api}/login" data-i18n="members.login">🔑 Ai deja abonament? Intră cu Patreon</a>`;
    const et = tier === "pro" ? `<span class="members-badge" data-i18n="members.badge.pro">💎 Membru Pro</span>` : `<span class="members-badge" data-i18n="members.badge.basic">⭐ Membru Basic</span>`;
    return et + `<a class="members-logout" href="#" data-members-logout data-i18n="members.logout">Ieși</a>`;
  }

  // ---- doar în browser
  function token() { try { return localStorage.getItem(CHEIE); } catch { return null; } }
  function sterge() { try { localStorage.removeItem(CHEIE); } catch {} }
  if (typeof window !== "undefined") {
    try {
      if (captureaza(window.location.search, localStorage)) history.replaceState({}, "", window.location.pathname + window.location.hash);
    } catch {}
  }
  function init() {
    if (typeof window === "undefined") return;
    const bara = document.getElementById("members-bar");
    if (bara && MEMBERS_API) {
      const tier = tierDinToken(token());
      if (!tier) sterge();
      bara.innerHTML = textBara(tier, MEMBERS_API);
      if (new URLSearchParams(window.location.search).get("members") === "none") bara.innerHTML += `<span class="members-hint">Contul Patreon nu are un abonament activ Basic sau Pro.</span>`;
      const out = bara.querySelector("[data-members-logout]");
      if (out) out.addEventListener("click", (e) => { e.preventDefault(); sterge(); location.reload(); });
    }
  }
  const api = {
    MEMBERS_API, tokenDinUrl, captureaza, tierDinToken, incarcaPredictii, textBara,
    tier: () => tierDinToken(token()),
    incarca: (publicUrl) => incarcaPredictii({ api: MEMBERS_API, token: token(), publicUrl, sterge }),
  };
  if (typeof window !== "undefined") { root.PoseidonMembers = api; document.addEventListener("DOMContentLoaded", init); }
  if (typeof module !== "undefined" && module.exports) module.exports = { tokenDinUrl, captureaza, tierDinToken, incarcaPredictii, textBara };
})(typeof window !== "undefined" ? window : globalThis);
