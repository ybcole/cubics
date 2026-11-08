"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("desktop builder ships isolated Electron shell not Next server",()=>{
  const builder=read("electron-builder.yml");
  assert.match(builder,/app: .desktop-staging/);
  assert.doesNotMatch(builder,/extraResources:/);
  const main=read("electron/main.js");
  assert.doesNotMatch(main,/startNextServer|getFreePort|serverProcess|ELECTRON_RUN_AS_NODE/);
  assert.match(main,/release-config.json/);
});
test("staging secrets are operator-provided, not embedded in images",()=>{
  const compose=read("deploy/compose.staging.yml");
  assert.match(compose,/DATABASE_URL: \$\{DATABASE_URL:\?\}/);
  assert.match(compose,/CUBICS_REALTIME_SERVICE_TOKEN: \$\{CUBICS_REALTIME_SERVICE_TOKEN:\?\}/);
  assert.match(read("deploy/Dockerfile.realtime"),/USER node/);
  assert.match(read("deploy/Dockerfile.web"),/USER node/);
});
