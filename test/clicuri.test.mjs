// 7 oct 2026 — urmărirea clicurilor pe ofertă (GoatCounter events): butoanele și secțiunile trebuie să existe în app.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const app = fs.readFileSync(new URL("../assets/app.js", import.meta.url), "utf8");

test("app.js: evenimentele de ofertă sunt definite și folosesc goatcounter.count cu event:true", () => {
  assert.ok(app.includes("event: true"));
  for (const k of ["click/patreon/", "click/trial-banner", "click/unlock-btn", "click/login-patreon", "vazut/abonament", "vazut/exemplu-pro"]) assert.ok(app.includes(`"${k}`), k);
  assert.ok(app.includes('getElementById("abonament")') && app.includes('getElementById("exemplu-pro")'));
});
