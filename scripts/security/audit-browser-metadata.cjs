#!/usr/bin/env node
"use strict";

// Explicitly refuses writes and never prints confidential values.
const { loadEnvConfig } = require("@next/env");
const { PrismaClient } = require("@prisma/client");
const { createAggregate, countWidget } = require("../../src/lib/security/metadata-audit.cjs");

if (process.argv.slice(2).some(arg => arg !== "--json")) {
  console.error("Read-only metadata audit. Only --json is supported; no --apply option.");
  process.exit(2);
}
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL required; no database accessed.");
  process.exit(2);
}
const db = new PrismaClient();
async function run() {
  const counts = createAggregate();
  let lastId = null;
  for (;;) {
    const widgets = await db.widget.findMany({
      take: 500, orderBy: { id: "asc" },
      ...(lastId ? { cursor: { id: lastId }, skip: 1 } : {}),
      select: { id: true, type: true, title: true, url: true },
    });
    if (!widgets.length) break;
    for (const widget of widgets) countWidget(counts, widget);
    lastId = widgets[widgets.length - 1].id;
    if (widgets.length < 500) break;
  }
  const report = {
    report: "cubics-m05-browser-metadata-readonly",
    schemaVersion: 1,
    ...counts,
    changedRecords: 0,
    reminder: "No metadata was altered. Migrate URLs to an OS-protected per-device vault before scrubbing legacy cloud records.",
  };
  console.log(JSON.stringify(report, null, process.argv.includes("--json") ? 0 : 2));
}
run().catch(() => {
  // Do not expose driver error text, DB hostname, query data or connection URL.
  console.error("Metadata audit failed; check database connectivity and credentials privately.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
