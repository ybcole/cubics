#!/usr/bin/env node
/**
 * Brand lint: fails if UI code uses values that are not in docs/BRAND.md.
 * Run: npm run brand:check
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");
const RULES = [
  [/\b(?:bg|text|border(?:-[trblxy])?|ring|divide|fill|stroke|from|to|via|accent|placeholder:text|hover:bg|hover:text|hover:border|focus:ring|group-hover:text)-(?:zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/, "palette color: use a token (fg, fg-muted, line, accent, danger...)"],
  [/\b(?:accent-teal|accent-purple|accent-lime)\b/, "retired accent: use accent / success"],
  [/\btext-\[\d+(?:\.\d+)?(?:px|rem)\]/, "arbitrary font size: use text-display|h1|h2|body|small|caption|mono"],
  [/\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)\b/, "Tailwind size scale: use text-display|h1|h2|body|small|caption|mono"],
  [/\brounded-(?:xl|2xl|3xl)\b/, "radius > 12px"],
  [/\bshadow-(?:lg|xl|2xl)\b/, "shadow too heavy: use shadow-sm or shadow-md"],
  [/\bbg-gradient-|\bbackground:\s*(?:linear|radial)-gradient/, "gradients are not allowed"],
  [/\bfont-(?:extrabold|black)\b/, "max font weight is 700"],
  [/\bborder-(?:2|4|8)\b/, "borders are always 1px (spinner excepted)"],
  [/\b(?:duration|delay)-(?:2\d\d|[3-9]\d\d|\d{4})\b/, "transitions must be <= 200ms"],
  [/#[0-9a-fA-F]{3,8}\b(?=[^"'`]*["'`]\s*(?:\/>|>|\}))/, "hard-coded hex in className"],
];
const SKIP = [/node_modules/, /\.d\.ts$/];
let failures = 0;

(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|jsx)$/.test(f) && !SKIP.some((s) => s.test(p))) check(p);
  }
})(ROOT);

function check(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!/className|class=/.test(line) && !/"[^"]*\b(?:bg|text|border)-/.test(line)) return;
    for (const [re, msg] of RULES) {
      if (re.test(line)) {
        failures++;
        console.error(`${path.relative(process.cwd(), file)}:${i + 1}  ${msg}\n    ${line.trim().slice(0, 140)}`);
      }
    }
  });
}

if (failures) {
  console.error(`\n${failures} brand violation(s). See docs/BRAND.md`);
  process.exit(1);
}
console.log("brand:check passed");
