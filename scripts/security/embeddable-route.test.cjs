"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname,"../../src/app/api/embeddable/route.ts"),"utf8");
test("retired server-side embeddability probe cannot SSRF arbitrary URLs", () => {
  assert.match(source, /status: 410/);
  assert.match(source, /embeddable: null/);
  assert.doesNotMatch(source, /\b(?:globalThis\.)?fetch\s*\(/);
  assert.doesNotMatch(source, /req(?:uest)?\.url|\.searchParams/);
  assert.match(source, /no-store/);
});
