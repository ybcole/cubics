"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { execFileSync } = require("node:child_process");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { serviceOrigin, realtimeServiceToken } = require("../../src/lib/security/realtime-service-config.cjs");
const { getRoomRole } = require("../../src/lib/security/realtime-membership.cjs");

test("M03 local defaults share a private random token across processes, isolated by checkout", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cubics-authority-test-"));
  try {
    const options = { cwd: path.join(tempRoot, "project"), tempRoot };
    const env = { NODE_ENV: "development" };
    assert.equal(serviceOrigin(env), "http://127.0.0.1:3000");
    const key = realtimeServiceToken(env, options);
    assert.match(key, /^[A-Za-z0-9_-]{43}$/);
    const helper = path.resolve(__dirname, "../../src/lib/security/realtime-service-config.cjs");
    const other = execFileSync(process.execPath, ["-e", `process.stdout.write(require(${JSON.stringify(helper)}).realtimeServiceToken(${JSON.stringify(env)},${JSON.stringify(options)}))`], { encoding: "utf8" });
    assert.equal(key, other);
    assert.notEqual(key, realtimeServiceToken(env, { ...options, cwd: options.cwd + "-other" }));
    for (const dir of fs.readdirSync(tempRoot)) {
      const folder = path.join(tempRoot, dir);
      if (process.platform !== "win32") {
        assert.equal(fs.statSync(folder).mode & 0o077, 0);
        assert.equal(fs.statSync(path.join(folder, "service-token")).mode & 0o077, 0);
      }
    }
  } finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
});

test("M03 production and remote services require explicit credentials and secure origins", () => {
  for (const env of [
    { NODE_ENV: "production" },
    { NODE_ENV: "development", CUBICS_INTERNAL_API_ORIGIN: "https://remote.example" },
    { NODE_ENV: "development", CUBICS_REALTIME_SERVICE_TOKEN: "short" },
  ]) assert.throws(() => realtimeServiceToken(env));
  for (const origin of ["http://remote.example", "https://u:p@example.com", "https://api.example/path", "file:///tmp"]) {
    assert.throws(() => serviceOrigin({ NODE_ENV: "production", CUBICS_INTERNAL_API_ORIGIN: origin }));
  }
  const configured = "explicit-test-service-token-of-sufficient-length";
  assert.equal(realtimeServiceToken({ NODE_ENV: "production", CUBICS_REALTIME_SERVICE_TOKEN: configured }), configured);
});

test("M03 concurrent API/socket startup publishes one complete development credential", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cubics-concurrent-key-"));
  try {
    const helper = path.resolve(__dirname, "../../src/lib/security/realtime-service-config.cjs");
    const script = `process.stdout.write(require(${JSON.stringify(helper)}).realtimeServiceToken({NODE_ENV:'development'},${JSON.stringify({ cwd: tempRoot, tempRoot })}))`;
    const results = await Promise.all(Array.from({ length: 4 }, () => promisify(execFile)(process.execPath, ["-e", script])));
    assert.equal(new Set(results.map(r => r.stdout)).size, 1);
    assert.match(results[0].stdout, /^[A-Za-z0-9_-]{43}$/);
  } finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
});

test("M03 local insecure token files fail closed instead of silently rotating credentials", { skip: process.platform === "win32" }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cubics-unsafe-key-"));
  try {
    const opts = { cwd: tempRoot, tempRoot };
    realtimeServiceToken({ NODE_ENV: "development" }, opts);
    const dir = path.join(tempRoot, fs.readdirSync(tempRoot)[0]);
    const file = path.join(dir, "service-token");
    fs.chmodSync(file, 0o644);
    assert.throws(() => realtimeServiceToken({ NODE_ENV: "development" }, opts), /Unsafe/);
    fs.chmodSync(file, 0o600);
    fs.renameSync(file, file + ".original");
    fs.symlinkSync(file + ".original", file);
    assert.throws(() => realtimeServiceToken({ NODE_ENV: "development" }, opts), /Unsafe/);
  } finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
});

test("M03 membership HTTP failures distinguish temporary outages from bad service credentials", async () => {
  const env = { NODE_ENV: "production", CUBICS_INTERNAL_API_ORIGIN: "https://api.example",
    CUBICS_REALTIME_SERVICE_TOKEN: "test-only-token-with-at-least-32-characters" };
  for (const status of [401, 403, 404, 429, 500, 503]) {
    await assert.rejects(getRoomRole("userA", "roomA", { env,
      fetchImpl: async () => ({ ok: false, status }) }), error =>
      error.status === status && error.retryable === (status === 429 || status >= 500));
  }
  await assert.rejects(getRoomRole("userA", "roomA", { env,
    fetchImpl: async () => { throw new Error("network down"); } }), { code: "AUTHORITY_UNAVAILABLE", retryable: true });
});

test("M03 loopback API and realtime client authenticate with the same development configuration", async () => {
  const env = { NODE_ENV: "development" };
  const token = realtimeServiceToken(env);
  const server = http.createServer(async (req, res) => {
    if (req.headers["x-cubics-internal-service-token"] !== token) {
      res.writeHead(403).end(); return;
    }
    let text = ""; for await (const chunk of req) text += chunk;
    const input = JSON.parse(text);
    const allowed = input.userId === "userA" && input.roomId === "roomA";
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ allowed, role: allowed ? "MEMBER" : null }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  env.CUBICS_INTERNAL_API_ORIGIN = "http://127.0.0.1:" + server.address().port;
  try {
    assert.equal(await getRoomRole("userA", "roomA", { env }), "MEMBER");
    assert.equal(await getRoomRole("outsider", "roomA", { env }), null);
    await assert.rejects(getRoomRole("userA", "roomA", { env: { ...env,
      CUBICS_REALTIME_SERVICE_TOKEN: "different-test-token-with-at-least-32-characters" } }), { code: "SERVICE_AUTH_FAILED", retryable: false });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
