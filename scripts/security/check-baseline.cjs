"use strict";
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const inventory = require("../../docs/security/runtime-inventory.json");
const errors = [];
function assert(condition, reason) { if (!condition) errors.push(reason); }
function read(p) { return fs.readFileSync(path.join(root, p), "utf8"); }
function files(dir) {
  const result = [];
  const visit = folder => {
    if (!fs.existsSync(folder)) return;
    for (const name of fs.readdirSync(folder)) {
      const full = path.join(folder, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) visit(full);
      else if (st.isFile()) result.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  visit(path.join(root, dir));
  return result;
}
const routes = [...files("src/app/api"), ...files("src/app/v1")].filter(p => p.endsWith("/route.ts")).sort();
const declared = inventory.apis.map(x => x.file).sort();
assert(routes.join("\0") === declared.join("\0"), "API route inventory differs from source; update permissions and inventory before adding/removing routes");
for (const route of inventory.apis) {
  const actualMethods = [...read(route.file).matchAll(/export async function (GET|POST|PUT|PATCH|DELETE|HEAD)/g)].map(x => x[1]).sort();
  assert(actualMethods.join() === [...route.methods].sort().join(), "API method inventory differs: " + route.file);
  assert(typeof route.access === "string" && route.access.length >= 12, "Missing API permission notes: " + route.file);
}
const socketSource = read("socket-server.cjs");
const events = [...new Set([...socketSource.matchAll(/socket\.on\("([^"]+)"/g)].map(x => x[1]))].sort();
assert(events.join("\0") === Object.keys(inventory.socketIncoming).sort().join("\0"), "Socket event inventory differs; document new event permissions");
const ipc = [...new Set([...read("electron/main.js").matchAll(/ipcMain\.handle\("([^"]+)"/g)].map(x => x[1]))].sort();
assert(ipc.join("\0") === inventory.ipc.map(x => x.event).sort().join("\0"), "Electron IPC inventory differs; document its permission contract");

const tracked = cp.execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const rules = [
  ["PEM private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["Clerk secret", /sk_(?:test|live)_[A-Za-z0-9_-]{32,}/],
  ["Database URI with password", /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]{8,}@/],
  ["GitHub credential", /gh[psu]_[a-zA-Z0-9]{30,}/],
  ["AWS long-term key", /AKIA[0-9A-Z]{16}/],
];
for (const file of tracked) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || fs.statSync(absolute).size > 1_500_000) continue;
  const b = fs.readFileSync(absolute);
  if (b.includes(0)) continue;
  const contents = b.toString("utf8");
  for (const [kind, pattern] of rules) {
    if (pattern.test(contents)) errors.push("Possible committed " + kind + " in " + file + "; do not print secret");
  }
}
if (!fs.existsSync(path.join(root, "docs/security/THREAT_MODEL.md"))) errors.push("Threat model missing");
if (!fs.existsSync(path.join(root, "docs/security/PERMISSIONS.md"))) errors.push("Role matrix missing");
if (!fs.existsSync(path.join(root, "docs/security/CONTROLS.md"))) errors.push("Security controls missing");
const technicalDebt = [
  ["SEC-01 open legacy Socket.IO CORS", socketSource.includes('cors: { origin: "*" }'), "M03/M15"],
  ["SEC-02 privileged packaged local Next env", read("scripts/prepare-standalone.js").includes('copy(".env", ".env")'), "M02"],
  ["SEC-03 Electron sandbox disabled", read("electron/main.js").includes("sandbox: false"), "M04"],
  ["SEC-04 arbitrary URL probe", read("src/app/api/embeddable/route.ts").includes("fetch(url"), "M02/M04"],
];
for (const [label,present,milestone] of technicalDebt) if (present) console.warn("KNOWN UNFIXED RISK:", label, "tracked under", milestone);
if (errors.length) {
  for (const error of errors) console.error("SECURITY BASELINE FAIL:", error);
  process.exitCode = 1;
} else {
  console.log("Security baseline inventory and tracked-source secret scan passed. Legacy known risks remain until their milestones are implemented.");
}
