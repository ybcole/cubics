"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  normalizeQuery, looksLikeUrl, parseSuggestPayload, combineSuggestions, createSearchSuggestions, MAX_ITEMS,
} = require("../../electron/search-suggestions.cjs");

test("M05.08 suggest payload parses Google and DuckDuckGo shapes", () => {
  assert.deepEqual(parseSuggestPayload(["meta", ["meta ai", "meta"]]), ["meta ai", "meta"]);
  assert.deepEqual(parseSuggestPayload([{ phrase: "meta ai" }, { phrase: "meta stock" }]), ["meta ai", "meta stock"]);
  assert.deepEqual(parseSuggestPayload({ suggestions: ["claude", "claude ai"] }), ["claude", "claude ai"]);
  assert.deepEqual(parseSuggestPayload(null), []);
  assert.deepEqual(parseSuggestPayload(["meta", "nope"]), []);
});

test("M05.08 suggest queries are bounded and control characters are rejected", () => {
  assert.equal(normalizeQuery("  meta  "), "meta");
  assert.equal(normalizeQuery("m"), null);
  assert.equal(normalizeQuery("x".repeat(201)), null);
  assert.equal(normalizeQuery("meta\nai"), null);
  assert.equal(normalizeQuery(42), null);
});

test("M05.08 local matches come first, then remote, with bounded safe results", () => {
  const items = combineSuggestions({
    query: "meta",
    openTabs: [
      { url: "https://www.metacritic.com/", label: "Metacritic" },
      { url: "javascript:alert(1)", label: "Unsafe" },
      { url: "https://www.metacritic.com/", label: "Duplicate" },
    ],
    history: [
      { url: "https://en.wikipedia.org/wiki/Metaphor", label: "Metaphor - Wikipedia" },
    ],
    remote: ["meta ai", "Metacritic", "metaphor meaning"],
  });
  assert.deepEqual(items.map(item => item.kind), ["tab", "history", "search", "search"]);
  assert.equal(items[0].url, "https://www.metacritic.com/");
  assert.equal(items[1].url, "https://en.wikipedia.org/wiki/Metaphor");
  assert.ok(items.length <= MAX_ITEMS);
  assert.ok(items.every(item => item.label.length <= 120));
});

test("M05.08 Google is primary, DuckDuckGo is a silent failover, both are cookie-free", async () => {
  const calls = [];
  const googleDown = createSearchSuggestions({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes("suggestqueries.google.com")) throw new Error("offline");
      return { ok: true, json: async () => ["meta", ["meta ai", "metamucil"]] };
    },
  });
  assert.deepEqual(
    await googleDown.suggest({ query: "meta" }),
    [{ kind: "search", label: "meta ai" }, { kind: "search", label: "metamucil" }],
  );
  assert.match(calls[0].url, /^https:\/\/suggestqueries\.google\.com\/complete\/search\?client=firefox&q=meta$/);
  assert.match(calls[1].url, /^https:\/\/duckduckgo\.com\/ac\/\?type=list&q=meta$/);
  for (const call of calls) {
    assert.equal(call.options.credentials, "omit");
    assert.equal(call.options.redirect, "error");
  }

  const googleEmpty = createSearchSuggestions({
    fetchImpl: async url => url.includes("google")
      ? { ok: true, json: async () => ["meta", []] }
      : { ok: true, json: async () => [{ phrase: "meta ai" }] },
  });
  assert.deepEqual(
    await googleEmpty.suggest({ query: "meta" }),
    [{ kind: "search", label: "meta ai" }],
  );
});

test("M05.08 typed URLs stay local and never reach a suggestion provider", async () => {
  assert.ok(looksLikeUrl("https://private.example/secret"));
  assert.ok(looksLikeUrl("private.example/secret"));
  assert.ok(!looksLikeUrl("meta ai"));
  assert.ok(!looksLikeUrl("node.js tutorial"));
  let fetched = false;
  const suggestions = createSearchSuggestions({
    fetchImpl: async () => { fetched = true; return { ok: true, json: async () => ["x", ["x"]] }; },
  });
  const items = await suggestions.suggest({
    query: "https://private.example/secret",
    openTabs: [{ url: "https://private.example/secret", label: "Private" }],
  });
  assert.equal(fetched, false);
  assert.deepEqual(items, [{ kind: "tab", label: "Private", url: "https://private.example/secret" }]);
});

test("M05.08 suggest IPC trusts only the owning app window", () => {
  const main = fs.readFileSync(path.resolve(__dirname, "../../electron/main.js"), "utf8");
  const start = main.indexOf('ipcMain.handle("cubics:suggest"');
  assert.ok(start > 0);
  const block = main.slice(start, main.indexOf("ipcMain.handle", start + 10));
  assert.match(block, /isTrustedRenderer\(event, mainWindow, appOrigin\)/);
  assert.match(block, /contents\.getType\(\) !== "webview"/);
  assert.match(block, /contents\.hostWebContents\?\.id !== hostId/);
  assert.match(block, /guestHistory/);
  assert.match(block, /safeGuestUrl\(url, isDev\)/);
});

test("M05.08 failed providers never throw and still return local suggestions", async () => {
  const suggestions = createSearchSuggestions({
    fetchImpl: async () => { throw new Error("network down"); },
  });
  const items = await suggestions.suggest({
    query: "docs",
    openTabs: [{ url: "https://docs.example.com/guide", label: "Docs guide" }],
    history: [],
  });
  assert.deepEqual(items, [{ kind: "tab", label: "Docs guide", url: "https://docs.example.com/guide" }]);
  assert.deepEqual(await suggestions.suggest({ query: "x" }), []);
});
