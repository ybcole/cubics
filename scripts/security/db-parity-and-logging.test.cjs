"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Prisma queries cannot be logged by default in production", () => {
  const code = read("src/lib/prisma.ts");
  assert.match(code, /process\.env\.NODE_ENV === "development"/);
  assert.match(code, /process\.env\.CUBICS_DEBUG_SQL === "true"/);
  assert.match(code, /\? \["query", "error"\]/);
  assert.match(code, /: \["error"\]/);
  assert.doesNotMatch(code, /log:\s*\["query"\]/);
});

test("applied Supabase username repair matches Prisma schema", () => {
  const source = read("prisma/schema.prisma");
  const patch = read("supabase/migrations/20261108074105_cubics_add_missing_username_columns.sql");
  assert.match(source, /username\s+String\?/);
  assert.match(source, /usernameKey\s+String\?\s+@unique/);
  assert.match(patch, /ADD COLUMN IF NOT EXISTS "username" text/);
  assert.match(patch, /ADD COLUMN IF NOT EXISTS "usernameKey" text/);
  assert.match(patch, /CREATE UNIQUE INDEX IF NOT EXISTS "User_usernameKey_key"/);
  assert.doesNotMatch(patch, /\b(DROP TABLE|DELETE FROM|TRUNCATE|DROP COLUMN)\b/i);
});
test("deployment docs must ban unmatched legacy Prisma SQLite migrations", () => {
  const docs = read("deploy/README.md");
  assert.match(docs, /migration_lock\.toml/);
  assert.match(docs, /sqlite/);
  assert.match(docs, /DO NOT run/);
});
