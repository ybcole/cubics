"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root,file),"utf8");

test("M04 app sandbox, webview hardening and native sender validation",()=>{
  const main=read("electron/main.js");
  assert.match(main,/app\.enableSandbox\(\)/);
  assert.match(main,/sandbox:\s*true/);
  assert.match(main,/contextIsolation:\s*true/);
  assert.match(main,/nodeIntegration:\s*false/);
  assert.match(main,/will-attach-webview/);
  assert.match(main,/isTrustedRenderer\(event, mainWindow, appOrigin\)/);
  assert.doesNotMatch(main,/sandbox:\s*false|onHeadersReceived/);
  assert.doesNotMatch(read("src/components/PersonalTabView.tsx"),/\ballowpopups\b/);
  assert.doesNotMatch(read("src/components/StreamedTabView.tsx"),/\ballowpopups\b/);
});
test("M04 preload has narrow versioned methods not arbitrary IPC",()=>{
  const preload=read("electron/preload.js");
  assert.match(preload,/bridgeVersion:\s*1/);
  assert.match(preload,/contextBridge\.exposeInMainWorld/);
  assert.doesNotMatch(preload,/ipcRenderer:\s*ipcRenderer/);
  assert.doesNotMatch(preload,/on:\s*ipcRenderer\.on/);
  assert.match(preload,/Number\.isSafeInteger/);
});
test("M04 app headers enforce restrictive CSP and preserve remote website policies",()=>{
  const next=read("next.config.js");
  assert.match(next,/Content-Security-Policy/);
  assert.match(next,/object-src 'none'/);
  assert.match(next,/frame-ancestors 'none'/);
  assert.match(next,/base-uri 'self'/);
  assert.match(read("electron/main.js"),/Never modify remote frame-blocking headers/);
});
test("M04 fuses disable debug/node injection, lock ASAR and deny file privileges",()=>{
  const y=read("electron-builder.yml");
  assert.match(y,/runAsNode:\s*false/);
  assert.match(y,/enableNodeCliInspectArguments:\s*false/);
  assert.match(y,/enableNodeOptionsEnvironmentVariable:\s*false/);
  assert.match(y,/onlyLoadAppFromAsar:\s*true/);
  assert.match(y,/grantFileProtocolExtraPrivileges:\s*false/);
});
