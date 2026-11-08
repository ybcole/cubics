"use strict";

/** Pre-distribution guard: fail closed while a privileged local Next server
 * and server-only secret sources are still part of the desktop artifact.
 * This is deliberately stricter than an absence-of-.env test.
 */
const fs = require("node:fs");
const path = require("node:path");

const LEGACY_ROUTES = ["spaces", "users", "livekit", "v1"];
const DOTENVS = [
  ".env", ".env.local", ".env.production", ".env.production.local",
  ".env.development", ".env.development.local", ".env.test",
];

function inspectDesktopServer(standalone) {
  const findings = [];
  if (!fs.existsSync(standalone)) {
    findings.push("Missing standalone server: run build before distribution");
    return findings;
  }
  for (const filename of DOTENVS) {
    if (fs.existsSync(path.join(standalone, filename))) {
      findings.push("Server-side environment file would be packaged: " + filename);
    }
  }
  const appApi = path.join(standalone, ".next", "server", "app", "api");
  for (const folder of LEGACY_ROUTES) {
    if (fs.existsSync(path.join(appApi, folder))) {
      findings.push("Privileged Next API present in local desktop server: /api/" + folder);
    }
  }
  const rootServer = path.join(standalone, "server.js");
  if (fs.existsSync(rootServer) && !fs.existsSync(path.join(standalone, "cubics-public-client-only.json"))) {
    // An explicit marker will be produced by M02's future safe build pipeline,
    // only after it proves there is no local database/secret authority.
    findings.push("Legacy local Next server is not certified public-client-only");
  }
  return findings;
}

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const findings = inspectDesktopServer(path.join(root, ".next", "standalone"));
  if (findings.length) {
    console.error("Cubics desktop release blocked until M02 hosted authority migration:");
    for (const issue of findings) console.error(" - " + issue);
    process.exitCode = 1;
  } else {
    console.log("Desktop distribution trust-boundary checks passed");
  }
}
module.exports = { inspectDesktopServer };
