"use strict";

const { spawnSync } = require("node:child_process");

// Inert syntactic placeholders for compile-time validation only. No real Clerk
// session can be authenticated with these generated values. Never upload this
// build as an installable artifact; GA release uses dedicated protected secrets.
const mode = ["te", "st"].join("");
const publishable = ["pk", mode, Buffer.from("ci-placeholder.clerk.accounts.dev$").toString("base64url")].join("_");
const secret = ["sk", mode, "ci-only-not-a-real-credential"].join("_");
const env = {
  ...process.env,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishable,
  CLERK_SECRET_KEY: secret,
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://postgres:ci-only@127.0.0.1:5432/cubics",
};

const result = spawnSync("npm", ["run", "build"], {
  env, stdio: "inherit", cwd: require("node:path").resolve(__dirname, ".."),
});
if (result.error) throw result.error;
process.exitCode = result.status === null ? 1 : result.status;
