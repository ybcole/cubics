"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { inspectDesktopStage } = require("../verify-desktop-distribution.cjs");

function validateAsar(asarPath, extractAll) {
  if (!fs.existsSync(asarPath)) throw new Error("Missing extracted Linux Electron app.asar");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cubics-asar-"));
  try {
    extractAll(asarPath, temp);
    const failures = inspectDesktopStage(temp);
    if (failures.length) throw new Error(failures.join("; "));
    const entries = fs.readdirSync(temp).sort();
    if (entries.some(x => ["node_modules", "server.js", ".next", "prisma"].includes(x))) {
      throw new Error("Unexpected backend files in packed app");
    }
    console.log("Extracted Electron app.asar passed public-client verification");
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
if (require.main === module) {
  const archive = process.argv[2];
  if (!archive) throw new Error("Usage: verify-packaged-shell.cjs <path-to-app.asar>");
  const { extractAll } = require("@electron/asar");
  validateAsar(path.resolve(archive), extractAll);
}
module.exports = { validateAsar };
