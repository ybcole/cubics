"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const { assessWidgetMetadata, createAggregate, countWidget } =
 require("../../src/lib/security/metadata-audit.cjs");

test("M05 metadata audit reports only counts and never raw URL/title/IDs",()=>{
  const sensitive={type:"iframe",url:"https://bank.example/account?auth=secret#private",
    title:"Sensitive account secret",id:"widget_123",createdBy:"user_alice"};
  const report=createAggregate();
  countWidget(report,sensitive);
  countWidget(report,{type:"live-tab",url:"about:blank",title:"Live tab"});
  countWidget(report,{type:"shared-browser",url:"https://example.com/checkout?secret=1",
    title:"Shared tab"});
  assert.equal(report.rowsInspected,3);
  assert.equal(report.personalUrlStored,1);
  assert.equal(report.personalTitleStored,1);
  assert.equal(report.liveUrlStored,0);
  assert.equal(report.sharedFullUrlStored,1);
  assert.equal(report.sharedTitleStored,0);
  const output=JSON.stringify(report);
  for(const needle of ["bank.example","secret","widget_123","user_alice"]) {
    assert.equal(output.includes(needle),false);
  }
  assert.equal(assessWidgetMetadata({type:"shared-browser",
    url:"https://example.com/", title:"Shared tab"}).sharedFullUrlStored,false);
});
test("M05 audit CLI is read-only: no mutation functions or apply option",()=>{
  const source=fs.readFileSync(path.join(__dirname,"audit-browser-metadata.cjs"),"utf8");
  assert.match(source,/db\.widget\.findMany/);
  assert.doesNotMatch(source,/db\.widget\.(update|delete|create|upsert|updateMany|deleteMany)/);
  assert.match(source,/Only --json is supported/);
});
