"use strict";

const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const files = [
  "src/app/api/spaces/[id]/route.ts",
  "src/app/api/spaces/route.ts",
  "src/app/api/users/avatar/route.ts",
  "src/app/api/users/profile/route.ts",
  "src/app/api/users/username/route.ts",
  "src/lib/spaceAccess.ts",
];
const apply = process.argv.includes("--apply");
let changed = 0;
for (const file of files) {
  const absolute = path.join(root, file);
  const before = fs.readFileSync(absolute, "utf8");
  const after = before
    .replace(/= auth\(\);/g, "= await auth();")
    .replace(/\bclerkClient\.users\./g, "(await clerkClient()).users.");
  if (before !== after) {
    changed++;
    if (apply) fs.writeFileSync(absolute, after);
    else {
      console.error("Clerk 6 migration pending: " + file);
      process.exitCode = 1;
    }
  }
}
console.log("Clerk 6 server helper migration checked: " + changed + " files " + (apply ? "updated" : "needing updates"));
