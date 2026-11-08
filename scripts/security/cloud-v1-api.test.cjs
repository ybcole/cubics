"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = rel => fs.readFileSync(path.join(root,rel),"utf8");
test("v1 read endpoints explicitly verify identity and room membership", () => {
  for (const p of ["src/app/v1/workspaces/route.ts","src/app/v1/identity/route.ts"]) {
    assert.match(read(p), /await auth\(\)/);
    assert.match(read(p), /UNAUTHORIZED/);
  }
  for (const p of ["src/app/v1/workspaces/[id]/route.ts",
    "src/app/v1/workspaces/[id]/widgets/route.ts"]) {
    assert.match(read(p), /getRoomAccess/);
    assert.match(read(p), /!canView/);
    assert.match(read(p), /NOT_FOUND/);
  }
});
test("v1 compatibility exposes no fake room revision or private tab URL", () => {
  assert.match(read("src/app/v1/workspaces/route.ts"), /revision: null/);
  assert.match(read("src/app/v1/workspaces/[id]/route.ts"), /revision: null/);
  const w = read("src/app/v1/workspaces/[id]/widgets/route.ts");
  assert.match(w, /canReadPersonalMetadata/);
  assert.match(w, /"Private tab"/);
  assert.match(w, /url\.origin \+ url\.pathname/);
  assert.doesNotMatch(w, /return v1Json\(widgets\)/);
});
test("hosted API remains opt-in, never silently enabled", () => {
  const config = read("src/lib/cloud/feature-flags.ts");
  assert.match(config, /NEXT_PUBLIC_CUBICS_HOSTED_API_ENABLED === "true"/);
  assert.match(config, /throw new Error\("Hosted Cubics API has not been enabled/);
});
