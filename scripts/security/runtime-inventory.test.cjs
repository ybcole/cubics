"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const inventory = require("../../docs/security/runtime-inventory.json");
test("all current private-room API endpoints have documented access policy", () => {
  const privateRoutes = inventory.apis.filter(x => x.file.includes("/spaces/"));
  assert.ok(privateRoutes.length >= 4);
  for (const route of privateRoutes) assert.match(route.access, /Authenticated|owner|member/);
});
test("IPCs and realtime messages have explicit target permissions", () => {
  assert.ok(inventory.ipc.every(x => x.permission.length > 30));
  assert.ok(Object.entries(inventory.socketIncoming).every(([key, p]) =>
    key && p.access.length > 10 && Array.isArray(p.target)));
});
test("realtime server no longer has wildcard CORS or client-claimed identity", () => {
  const source = fs.readFileSync(path.join(root, "socket-server.cjs"), "utf8");
  assert.doesNotMatch(source, /cors:\s*\{\s*origin:\s*"\*"\s*\}/);
  assert.doesNotMatch(source, /socket\.data\.userId\s*=\s*userId/);
  assert.match(source, /await authorizeRoom\(socket\.data\.userId, roomId\)/);
  assert.match(fs.readFileSync(path.join(root, "docs/security/THREAT_MODEL.md"), "utf8"), /T01/);
});
