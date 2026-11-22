import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function harness(now, session = null) {
  const calls = [];
  const window = { location: { search: "" } };
  runInNewContext(readFileSync(new URL("../assets/members.js", import.meta.url), "utf8"), {
    window, Buffer, Date: { parse: Date.parse, now: () => Date.parse(now) },
    document: { addEventListener() {} },
    localStorage: { getItem: () => session },
    fetch: (url, options) => {
      calls.push({url, options});
      return Promise.resolve(Response.json({matches: []}));
    },
  });
  return { members: window.PoseidonMembers, calls };
}

test("guest route is anonymous, fixed to the Bucharest day and never cached", async () => {
  const {members, calls} = harness("2026-11-22T21:59:59.999Z");
  await members.getWebFree("dosar/123");
  assert.equal(calls[0].url, members.MEMBERS_API + "/api/web-free/2026-11-22/dosar/123");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(calls[0].options.headers, undefined);
  assert.throws(() => members.getWebFree("dosar/../analize"));
  assert.equal(calls.length, 1);
});

test("guest routes close at local midnight and preserve subscriptions", () => {
  const token = Buffer.from(JSON.stringify({tier:"pro", exp:1900000000})).toString("base64url") + ".sig";
  for (const [time, session] of [
    ["2026-11-21T21:59:59.999Z", null],
    ["2026-11-22T22:00:00.000Z", null],
    ["2026-11-22T10:00:00.000Z", token],
  ]) {
    const {members, calls} = harness(time, session);
    assert.equal(members.webFreeDay(), null);
    assert.throws(() => members.getWebFree("analize"));
    assert.equal(calls.length, 0);
  }
  assert.equal(harness("2026-11-21T22:00:00.000Z").members.webFreeDay(), "2026-11-22");
});

test("Basic users can fetch the promoted Pro analyses without changing their tier", async () => {
  const token = Buffer.from(JSON.stringify({tier:"basic", exp:1900000000})).toString("base64url") + ".sig";
  const {members, calls} = harness("2026-11-22T10:00:00.000Z", token);
  assert.equal(members.tier(), "basic");
  await members.getWebFree("analize");
  assert.throws(() => members.getWebFree("predictions"));
  assert.equal(calls.length, 1);
});
