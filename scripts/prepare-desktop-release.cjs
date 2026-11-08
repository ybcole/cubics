"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { normalizedAppOrigin } = require("../electron/app-origin.cjs");

function prepareDesktop({ root = path.resolve(__dirname, ".."), publicAppOrigin = process.env.CUBICS_DESKTOP_APP_URL } = {}) {
  const origin = normalizedAppOrigin(publicAppOrigin, { packaged: true });
  const source = path.join(root, "electron");
  const stage = path.join(root, ".desktop-staging");
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (!fs.existsSync(path.join(source, "main.js")) || !fs.existsSync(path.join(source, "preload.js"))) {
    throw new Error("Electron entrypoint/preload missing");
  }

  // Copy an allowlisted set of shell files, never the Node/Next/Prisma tree.
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, "electron"), { recursive: true });
  for (const file of ["main.js", "preload.js", "app-origin.cjs", "security-policy.cjs"]) {
    fs.copyFileSync(path.join(source, file), path.join(stage, "electron", file));
  }
  fs.writeFileSync(path.join(stage, "electron", "release-config.json"),
    JSON.stringify({ schemaVersion: 1, appOrigin: origin }, null, 2) + "\n", { mode: 0o644 });
  fs.writeFileSync(path.join(stage, "package.json"), JSON.stringify({
    name: "cubics-desktop-shell", version: packageJson.version, private: true,
    main: "electron/main.js", dependencies: {},
  }, null, 2) + "\n", { mode: 0o644 });
  return { stage, origin };
}

if (require.main === module) {
  const result = prepareDesktop();
  console.log("Staged public desktop shell for", result.origin);
}
module.exports = { prepareDesktop };
