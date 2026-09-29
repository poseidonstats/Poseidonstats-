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
