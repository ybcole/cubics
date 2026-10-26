const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.error("Run `next build` first (output: standalone)");
  process.exit(1);
}

function copy(from, to) {
  const src = path.join(root, from);
  const dest = path.join(standalone, to);
  if (!fs.existsSync(src)) return;
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`copied ${from} -> ${to}`);
}

copy("public", "public");
copy(".next/static", path.join(".next", "static"));
copy(".env", ".env");

console.log("Standalone server ready at .next/standalone");
