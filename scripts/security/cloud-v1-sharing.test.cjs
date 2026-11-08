"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("member-sharing API does not expose emails or arbitrary profile data",()=>{
  const source=read("src/app/v1/workspaces/[id]/members/route.ts");
  assert.match(source,/getRoomAccess/);
  assert.match(source,/!canView/);
  assert.match(source,/displayName/);
  assert.doesNotMatch(source,/email:\s*member/);
});
test("read-only legacy sync never claims durable revisions",()=>{
  const source=read("src/app/v1/workspaces/[id]/snapshot/route.ts");
  assert.match(source,/revision:\s*null/);
  assert.match(source,/legacy-unversioned/);
  assert.match(source,/operations:\s*\[\]/);
  assert.match(source,/getRoomAccess/);
});
