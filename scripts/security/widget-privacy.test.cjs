"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { redactWidgetForViewer } = require("../../src/lib/security/widget-privacy.cjs");

test("M05 Personal URL/title redacted to unrelated room members, including admins", () => {
  const owner = { id: "w1", roomId: "alpha", type: "iframe", createdBy: "alice",
    url: "https://bank.example/account?secret=abc#session", title: "Account • balance",
    x: 1, y: 2, w: 10, h: 12 };
  assert.deepEqual(redactWidgetForViewer(owner, "alice"), owner);
  const spectator = redactWidgetForViewer(owner, "bob");
  assert.equal(spectator.url, "about:blank");
  assert.equal(spectator.title, "Private tab");
  assert.equal(spectator.id, owner.id);
  assert.deepEqual([spectator.x,spectator.y,spectator.w,spectator.h], [1,2,10,12]);
  assert.equal(owner.url.includes("secret"), true, "no source record mutation");
});
test("M05 legacy ownerless widgets fail closed; Live/Shared remain explicitly distinct", () => {
  const legacy={id:"orphan",title:"old token",url:"https://private.example/t?k=1",type:null,createdBy:null};
  assert.equal(redactWidgetForViewer(legacy,"bob").url,"about:blank");
  assert.equal(redactWidgetForViewer(legacy,"").title,"Private tab");
  for(const type of ["live-tab","shared-browser"]) {
    const shared={ ...legacy,type,createdBy:"alice" };
    assert.equal(redactWidgetForViewer(shared,"bob").url,legacy.url);
  }
});
test("M05 legacy GET requires authenticated per-viewer redaction and disables caching",()=>{
  const source=fs.readFileSync(path.resolve(__dirname,"../../src/app/api/spaces/[id]/widgets/route.ts"),"utf8");
  assert.match(source,/widgets\.map\(widget => redactWidgetForViewer\(widget, userId\)\)/);
  assert.match(source,/Cache-Control": "private, no-store"/);
});

test("M05 ownerless Personal title redacted in legacy v1 snapshot", () => {
  const snapshot=fs.readFileSync(path.resolve(__dirname,"../../src/app/v1/workspaces/[id]/snapshot/route.ts"),"utf8");
  assert.match(snapshot,/widget\.createdBy !== userId/);
  assert.doesNotMatch(snapshot,/widget\.createdBy && widget\.createdBy !== userId/);
});
