"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { normalizedAppOrigin } = require("../electron/app-origin.cjs");
const FORBIDDEN_BASENAMES = new Set([
  ".env", ".env.local", ".env.production", ".env.production.local",
  ".env.development", ".env.development.local", ".env.test",
  "server.js", "schema.prisma", "migration.sql",
]);
const SENSITIVE = [
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["Clerk secret", /sk_(?:test|live)_[a-zA-Z0-9_-]{20,}/],
  ["LiveKit signing token", /LIVEKIT_API_SECRET\s*[:=]/],
  ["Postgres connection", /postgres(?:ql)?:\/\/[^\s"']+/],
  ["Server-only credential", /(?:CLERK_SECRET_KEY|DATABASE_URL|CUBICS_REALTIME_SERVICE_TOKEN)\s*[:=]/],
];
function inspectDesktopStage(stage) {
  const problems = [];
  if (!fs.existsSync(stage)) return ["Staged desktop app does not exist"];
  let config, manifest;
  try {
    config = JSON.parse(fs.readFileSync(path.join(stage, "electron/release-config.json"), "utf8"));
    normalizedAppOrigin(config.appOrigin, { packaged: true });
    if (config.schemaVersion !== 1) throw Error("Wrong schema version");
  } catch { problems.push("Missing or invalid pinned HTTPS release origin"); }
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(stage, "package.json"), "utf8"));
    if (manifest.main !== "electron/main.js" || Object.keys(manifest.dependencies || {}).length > 0) {
      problems.push("Desktop package has server dependencies or unexpected entrypoint");
    }
  } catch { problems.push("Invalid desktop-only manifest"); }
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      const relative = path.relative(stage, full).replaceAll(path.sep, "/");
      if (entry.isSymbolicLink()) {
        problems.push("Symlink may escape staged package: " + relative);
        continue;
      }
      if (entry.isDirectory()) {
        if (["node_modules", ".next", "prisma", "server", ".git"].includes(entry.name)) {
          problems.push("Privileged directory in desktop package: " + relative);
        } else visit(full);
      } else if (entry.isFile()) {
        if (FORBIDDEN_BASENAMES.has(entry.name) || /^\.env(?:\.|$)/.test(entry.name)) {
          problems.push("Secret/server file in package: " + relative);
        }
        const bytes = fs.readFileSync(full);
        if (bytes.includes(0)) {
          problems.push("Unexpected binary in minimal shell: " + relative);
          continue;
        }
        const text = bytes.toString("utf8");
        for (const [reason, regex] of SENSITIVE) {
          if (regex.test(text)) problems.push(reason + " found in " + relative);
        }
      }
    }
  };
  visit(stage);
  return problems;
}

if (require.main === module) {
  const stage = path.resolve(__dirname, "../.desktop-staging");
  const findings = inspectDesktopStage(stage);
  if (findings.length) {
    for (const issue of findings) console.error("Desktop release refused:", issue);
    process.exitCode = 1;
  } else console.log("Desktop staging verified: shell-only, pinned HTTPS origin, no backend secrets");
}
module.exports = { inspectDesktopStage };
