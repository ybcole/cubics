"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const plan = read("master_plan.md");
const checklist = read("master_checklist.md");
const errors = [];
const check = (condition, why) => { if (!condition) errors.push(why); };

const expected = Array.from({ length: 25 }, (_, i) => String(i).padStart(2, "0"));
const headings = [...plan.matchAll(/^### Milestone (\d{2}) — (.+)$/gm)];
const sections = [...checklist.matchAll(/^### M(\d{2}) — (.+)$/gm)];
check(headings.length === 25, "The plan must contain exactly M00–M24");
check(sections.length === 25, "The checklist must contain exactly M00–M24");
check(headings.map(m => m[1]).join() === expected.join(), "Plan milestone numbers are out of order");
check(sections.map(m => m[1]).join() === expected.join(), "Checklist milestone numbers are out of order");

const planTasks = [...plan.matchAll(/^- \*\*(M\d{2}\.\d{2})\*\* /gm)].map(m => m[1]);
const checkTasks = [...checklist.matchAll(/^- \[([ x])\] \*\*(M\d{2}\.\d{2})\*\* /gm)].map(m => m[2]);
check(planTasks.length >= 203, "Plan lost original 203 tracked tasks");
check(planTasks.length === checkTasks.length && planTasks.every((s, i) => checkTasks[i] === s),
  "Plan and checklist task IDs must match exactly and in order");
check(new Set(planTasks).size === planTasks.length, "Duplicate task IDs in plan");

for (const id of expected) {
  const planHead = headings.find(m => m[1] === id);
  const checkHead = sections.find(m => m[1] === id);
  check(Boolean(planHead && checkHead), `Missing milestone M${id}`);
  if (planHead && checkHead) {
    const normalized = planHead[2].replace(/ \[COMPLETED\]$/, "");
    check(normalized === checkHead[2], `M${id} title mismatch`);
    const selected = checklist.slice(checkHead.index, sections.find(m => Number(m[1]) === Number(id) + 1)?.index);
    for (const suffix of ["E1", "E2", "SIGNOFF"]) {
      check(selected.includes(`**M${id}.${suffix}**`), `M${id} missing ${suffix}`);
    }
    check(checklist.includes(`<a id="m${id}"></a>`), `Missing link anchor M${id}`);
    if (planHead[2].endsWith(" [COMPLETED]")) {
      const entries = [...selected.matchAll(/^- \[([ x])\] \*\*(M\d{2}(?:\.\d{2}|\.E[12]|\.SIGNOFF))\*\*/gm)];
      check(entries.length > 0 && entries.every(m => m[1] === "x"),
        `M${id} marked [COMPLETED] but some checklist work/exit/signoff boxes remain open`);
      const evidence = read(`docs/milestones/M${id}.md`);
      check(/^- Milestone owner sign-off: APPROVED by [A-Za-z][^\n]* on 20\d{2}-\d{2}-\d{2}$/m.test(evidence),
        `M${id} marked completed without a named and dated owner approval`);
    }
  }
}
for (let g=1;g<=10;g++) check(checklist.includes(`**G${g}**`), `Missing global release gate G${g}`);

const required = [
  "docs/final-product/README.md",
  "docs/final-product/product-scope.md",
  "docs/final-product/browser-modes.md",
  "docs/final-product/system-contracts.md",
  "docs/final-product/support-matrix.md",
  "docs/final-product/accessibility.md",
  "docs/final-product/current-deviations.md",
  "docs/final-product/migration-map.md",
  "docs/final-product/governance.md",
  "docs/milestones/M00.md",
  "docs/adr/README.md",
  ...["0001-desktop-cloud-trust-boundary","0002-browser-session-manager",
  "0003-server-authoritative-realtime","0004-browsing-privacy-media",
  "0005-stable-final-architecture"].map(name => `docs/adr/${name}.md`),
];
for (const filename of required) {
  check(fs.existsSync(path.join(root, filename)), `Missing M00 document: ${filename}`);
}
check(checklist.includes("M00.01"), "Missing M00 owner scope acceptance");
check(plan.includes("INV-01") || read("docs/final-product/product-scope.md").includes("INV-01"),
  "Missing product invariant contract");
check(!plan.includes("### Milestone 00 — Final product contract, technical governance, and architecture freeze policy [COMPLETED]") ||
  checklist.includes("- [x] **M00.SIGNOFF**"),
  "M00 has premature completion marker");

if (errors.length) {
  console.error("Master plan validation FAILED:");
  errors.forEach((err,i) => console.error(`  ${i+1}. ${err}`));
  process.exitCode = 1;
} else {
  console.log(`Master plan validated: ${headings.length} milestones, ${planTasks.length} matching tasks, G1–G10, M00 docs present.`);
}
