"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
test("staging health endpoint has no database or secret access", () => {
  const s = fs.readFileSync(path.join(root,"src/app/api/health/route.ts"), "utf8");
  assert.match(s, /status: "ok"/);
  assert.match(s, /"no-store"/);
  assert.doesNotMatch(s, /prisma|DATABASE_URL|CLERK_SECRET_KEY|LIVEKIT_API_SECRET/);
});
