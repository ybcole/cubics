"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { inspectDesktopServer } = require("../verify-desktop-distribution.cjs");

test("distribution guard rejects a privileged local API or any bundled environment file", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cubics-dist-"));
  try {
    const api = path.join(temp, ".next/server/app/api/spaces");
    fs.mkdirSync(api, { recursive: true });
    fs.writeFileSync(path.join(temp, "server.js"), "/* test only */");
    fs.writeFileSync(path.join(temp, ".env"), "THIS_IS_A_TEST_FIXTURE");
    const problems = inspectDesktopServer(temp);
    assert.ok(problems.some(x => x.includes(".env")));
    assert.ok(problems.some(x => x.includes("/api/spaces")));
    assert.ok(problems.some(x => x.includes("not certified")));
    fs.rmSync(path.join(temp, ".env"));
    fs.rmSync(path.join(temp, ".next"), { recursive: true });
    fs.writeFileSync(path.join(temp, "cubics-public-client-only.json"), "{}");
    assert.deepEqual(inspectDesktopServer(temp), []);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
test("standalone preparation no longer copies credentials into the app", () => {
  const source = fs.readFileSync(path.join(__dirname, "../prepare-standalone.js"), "utf8");
  assert.doesNotMatch(source, /copy\s*\(\s*["']\.env["']/);
  assert.match(source, /fs\.rmSync\(path\.join\(standalone, name\)/);
});
