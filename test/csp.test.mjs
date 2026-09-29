// 29 sept 2026 — regresie: CSP-ul paginilor trebuie să permită cererile către zona de membri (connect-src), altfel browserul
// blochează fetch-ul către Worker fără nicio cerere pe rețea (bug-ul găsit după 8 login-uri reușite și 0 cereri de date).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const WORKER = "https://poseidon-members.poseidonstats.workers.dev";
for (const f of ["index.html", "simulator.html"]) {
  test(`${f}: connect-src include Worker-ul de membri`, () => {
    const html = fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
    const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
    assert.ok(m, "are CSP");
    const connect = m[1].split(";").map(s => s.trim()).find(s => s.startsWith("connect-src"));
    assert.ok(connect && connect.includes(WORKER), `connect-src: ${connect}`);
  });
}
