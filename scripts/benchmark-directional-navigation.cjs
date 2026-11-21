"use strict";
// Geometry lookup microbenchmark; not an Electron frame-rate certification.
const ts = require('typescript'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const context = { exports: {}, Math, Number };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib/canvas/directional-navigation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const results = [];
for (const count of [100, 1000, 10000]) {
  const tabs = Array.from({ length: count }, (_, i) => ({ id: String(i), x: (i % 100)*900, y: Math.floor(i/100)*700, w: 800, h: 600 }));
  const origin = { x: 45000, y: 35000 };
  for (let i = 0; i < 100; i++) context.exports.findDirectionalTab(tabs, origin, 'up');
  const times = [];
  for (let i = 0; i < 300; i++) {
    const start = performance.now();
    context.exports.findDirectionalTab(tabs, origin, 'up');
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a-b);
  results.push({ tabs: count, medianMs: +times[150].toFixed(3), p95Ms: +times[285].toFixed(3) });
}
console.log(JSON.stringify({ runtime: process.version, results }, null, 2));
