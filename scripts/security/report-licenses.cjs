"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const results = [];
for (const [location, meta] of Object.entries(lock.packages || {})) {
  if (!location || !location.includes("node_modules/")) continue;
  const manifest = path.join(root,location,"package.json");
  let license = "UNKNOWN";
  try {
    const pkg = JSON.parse(fs.readFileSync(manifest,"utf8"));
    license = typeof pkg.license === "string" ? pkg.license : pkg.license?.type || "UNKNOWN";
  } catch {}
  const name = location.slice(location.lastIndexOf("node_modules/")+"node_modules/".length);
  results.push({ name, version: meta.version || null, license, requiresReview: /(?:^|[^A-Z])(?:AGPL|GPL)(?:[^A-Z]|$)/i.test(license) || license === "UNKNOWN" });
}
results.sort((a,b) => a.name.localeCompare(b.name));
process.stdout.write(JSON.stringify({ schemaVersion:1, total:results.length, reviewNeeded:results.filter(p=>p.requiresReview).length, packages:results },null,2)+"\n");
