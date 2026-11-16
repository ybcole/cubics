"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");

test("Next.js 16 Clerk auth proxy is discoverable next to src/app", () => {
  const pkg = require(path.join(root, "package.json"));
  assert.equal(Number(pkg.dependencies.next.split(".")[0]), 16);
  assert.equal(fs.existsSync(path.join(root, "middleware.ts")), false,
    "Do not reintroduce the root legacy middleware.ts with src/app and Next 16");
  const source = fs.readFileSync(path.join(root, "src/proxy.ts"), "utf8");
  assert.match(source, /import \{ clerkMiddleware \} from ["']@clerk\/nextjs\/server["']/);
  assert.match(source, /export default clerkMiddleware\(\)/);
  assert.ok(source.includes('"/(api|trpc)(.*)"'),
    "All Clerk-backed APIs, including GET/POST /api/spaces, need proxy matching");
  assert.ok(source.includes('"/__clerk/(.*)"'));
});

test("Home-space routes call Clerk only after the discoverable proxy", () => {
  const source = fs.readFileSync(path.join(root, "src/app/api/spaces/route.ts"), "utf8");
  assert.match(source, /await auth\(\)/);
  assert.match(source, /export async function GET\(/);
  assert.match(source, /export async function POST\(/);
});
