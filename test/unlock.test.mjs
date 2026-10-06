// 1 oct 2026 — blocul de la primul lacăt (obiecțiile 1-5 din evaluarea ChatGPT): listă concretă, dovadă înainte de preț, 3 pași după plată, anulare
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const i18n = JSON.parse(fs.readFileSync(new URL("../assets/i18n.json", import.meta.url), "utf8"));
const app = fs.readFileSync(new URL("../assets/app.js", import.meta.url), "utf8");

test("i18n: blocul de deblocare are toate cheile în 4 limbi", () => {
  for (const lang of ["ro", "en", "es", "it"]) for (const k of ["unlock.h", "unlock.list", "unlock.altof", "unlock.altof.btn", "unlock.steps", "unlock.cancel", "unlock.btn", "unlock.alt"]) assert.ok(i18n[lang][k], `${lang} ${k}`);
  assert.match(i18n.ro["unlock.altof"], /înghețate/); assert.match(i18n.ro["unlock.steps"], /Intră cu Patreon/); assert.match(i18n.ro["unlock.list"], /Simulator/);
});

test("app.js: renderUnlockCta folosește blocul nou, cu track record înainte de buton", () => {
  const i = app.indexOf("function renderUnlockCta"); const body = app.slice(i, app.indexOf("\n}\n", i));
  for (const k of ["unlock.h", "unlock.list", "unlock.altof", "unlock.steps", "unlock.cancel", "unlock.btn"]) assert.ok(body.includes(`"${k}"`), k);
  assert.ok(body.indexOf("unlock.altof") < body.indexOf("unlock.btn"), "dovada înainte de preț");
  assert.ok(body.includes('href="track-record.html"'));
});
