// Teste (înaintea codului) — assets/members.js: tokenul din URL, tier-ul afișat, încărcarea datelor complete cu revenire la public.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenDinUrl, tierDinToken, incarcaPredictii, textBara } from "../assets/members.js";

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const tokBasic = b64u({ sub: "u1", tier: "basic", exp: 1_900_000_000 }) + ".sig";
const tokExpirat = b64u({ sub: "u1", tier: "basic", exp: 1 }) + ".sig";

test("tokenul din URL se extrage și se curăță", () => {
  assert.equal(tokenDinUrl("?members_token=abc.def&x=1"), "abc.def");
  assert.equal(tokenDinUrl("?x=1"), null);
  assert.equal(tokenDinUrl("?members=none"), null);
});

test("tier-ul se citește din token pentru afișare; expirat sau stricat → null", () => {
  assert.equal(tierDinToken(tokBasic, 1_800_000_000), "basic");
  assert.equal(tierDinToken(tokExpirat, 1_800_000_000), null);
  assert.equal(tierDinToken("gunoi", 1_800_000_000), null);
  assert.equal(tierDinToken(null, 1_800_000_000), null);
});

test("membru → datele complete de la API; 401/403 → token șters și date publice; fără token → public", async () => {
  const full = { matches: [{ home_team: "A", prob_home: 0.5 }, { home_team: "B", prob_home: 0.4 }] };
  const pub = { matches: [{ home_team: "A", locked: true }] };
  const fetchImpl = async (url, opt) => {
    if (String(url).endsWith("/api/predictions")) {
      const ok = (opt?.headers?.authorization || "") === "Bearer " + tokBasic;
      return new Response(JSON.stringify(ok ? full : { error: "x" }), { status: ok ? 200 : 401 });
    }
    return new Response(JSON.stringify(pub), { status: 200 });
  };
  const sters = [];
  const r1 = await incarcaPredictii({ api: "https://m.example", token: tokBasic, publicUrl: "data/predictions.json", fetchImpl, sterge: () => sters.push(1) });
  assert.equal(r1.sursa, "membru"); assert.equal(r1.data.matches.length, 2); assert.equal(sters.length, 0);
  const r2 = await incarcaPredictii({ api: "https://m.example", token: "alt.tok", publicUrl: "data/predictions.json", fetchImpl, sterge: () => sters.push(1) });
  assert.equal(r2.sursa, "public"); assert.equal(r2.data.matches[0].locked, true); assert.equal(sters.length, 1);
  const r3 = await incarcaPredictii({ api: "https://m.example", token: null, publicUrl: "data/predictions.json", fetchImpl, sterge: () => sters.push(1) });
  assert.equal(r3.sursa, "public"); assert.equal(sters.length, 1);
  const r4 = await incarcaPredictii({ api: "", token: tokBasic, publicUrl: "data/predictions.json", fetchImpl, sterge: () => {} });
  assert.equal(r4.sursa, "public");                                                     // API neconfigurat încă → public
});

test("textul din bară: neautentificat → buton de login; basic/pro → etichetă + ieșire", () => {
  const h = textBara(null, "https://m.example");
  assert.match(h, /Vrei să deblochezi toate meciurile zilei\? .*5 \$\/lună/);
  assert.match(h, /Vrei și analizele Pro\? .*20 \$\/lună/);
  assert.match(h, /href="#abonament"[^>]*>[^<]*Abonează-te/);
  assert.match(h, /Ai deja abonament\? Intră cu Patreon/);
  assert.match(h, /https:\/\/m\.example\/login/);
  assert.match(textBara("basic", "https://m.example"), /Basic/);
  assert.match(textBara("pro", "https://m.example"), /Pro/);
  assert.match(textBara("basic", "https://m.example"), /Ieși/);
});


test("bara de membri e traductibilă: chei data-i18n prezente în toate cele 4 limbi", async () => {
  const fs = await import("node:fs"); const i18n = JSON.parse(fs.readFileSync(new URL("../assets/i18n.json", import.meta.url), "utf8"));
  const h0 = textBara(null, "https://m.example"), hb = textBara("basic", "https://m.example"), hp = textBara("pro", "https://m.example");
  for (const k of ["members.hint", "members.sub", "members.login"]) assert.match(h0, new RegExp(`data-i18n="${k}"`));
  assert.match(hb, /data-i18n="members.badge.basic"/); assert.match(hp, /data-i18n="members.badge.pro"/); assert.match(hb, /data-i18n="members.logout"/);
  for (const lang of ["ro", "en", "es", "it"]) for (const k of ["members.hint", "members.sub", "members.login", "members.badge.basic", "members.badge.pro", "members.logout"]) assert.ok(i18n[lang][k], `${lang} ${k}`);
  assert.match(i18n.en["members.login"], /Sign in with Patreon/);
});

test("tokenul din URL se salvează SINCRON, la încărcarea scriptului, nu la DOMContentLoaded (cursa cu renderIndex)", async () => {
  const { captureaza } = await import("../assets/members.js");
  const st = new Map(); const storage = { setItem: (k, v) => st.set(k, v), getItem: (k) => st.get(k) ?? null, removeItem: (k) => st.delete(k) };
  assert.equal(captureaza("?members_token=" + tokBasic + "&x=1", storage), tokBasic);
  assert.equal(storage.getItem("poseidon_members_token"), tokBasic);
  assert.equal(captureaza("?x=1", storage), null);
  assert.equal(storage.getItem("poseidon_members_token"), tokBasic);     // fără token în URL nu ștergem ce era
});
