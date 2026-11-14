"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const p=require("../../electron/security-policy.cjs");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../..");
const origin="https://cubics.example.com";
const wc={getURL:()=>origin+"/spaces/abc",isDestroyed:()=>false};
const win={webContents:wc};wc.mainFrame={url:origin+"/spaces/abc"};
const caller={sender:wc,senderFrame:wc.mainFrame};

test("M04 hostile shell URLs and protocols deny by default",()=>{
  for(const url of ["javascript:alert(1)","file:///etc/passwd","smb://evil","data:text/html,evil",
    "http://evil.example/","https://user:pass@example.com/","https://example.com/".repeat(200)])
    assert.equal(p.safeExternalUrl(url),null,url);
  assert.equal(p.safeExternalUrl("https://www.example.com/a"),"https://www.example.com/a");
});
test("M04 nested/untrusted IPC frames and forged webContents IDs cannot access native bridge",()=>{
  assert.equal(p.isTrustedRenderer(caller,win,origin),true);
  assert.equal(p.isTrustedRenderer({...caller,senderFrame:{url:"https://evil.example"}},win,origin),false);
  assert.equal(p.isTrustedRenderer({...caller,sender:{}},win,origin),false);
  assert.equal(p.isTrustedRenderer(caller,win,"https://evil.example"),false);
  assert.equal(p.nativePermissionAllowedRequest({sender:wc,requestingUrl:origin,window:win,origin,permission:"media"}),true);
  assert.equal(p.nativePermissionAllowedRequest({sender:wc,requestingUrl:"https://evil.example",window:win,origin,permission:"media"}),false);
  assert.equal(p.nativePermissionAllowedRequest({sender:{},requestingUrl:origin,window:win,origin,permission:"media"}),false);
  assert.equal(p.nativePermissionAllowedRequest({sender:wc,requestingUrl:origin,window:win,origin,permission:"geolocation"}),false);
});
test("M04 webview partition checks reject cross-origin untrusted guest options",()=>{
  assert.equal(p.isAllowedGuestPartition("persist:cubics-personal-user_alice"),true);
  assert.equal(p.isAllowedGuestPartition("persist:cubics-tab-user_alice-widgetA"),true);
  for(const partition of ["persist:default","persist:cubics-tab-../../e","persist:cubics-tab-💥","", "cubics-personal-alice"])
    assert.equal(p.isAllowedGuestPartition(partition),false,partition);
  assert.equal(p.checkGuestAttach({partition:"persist:cubics-personal-user_alice",src:"https://example.com/",allowpopups:false}),true);
  assert.equal(p.checkGuestAttach({partition:"persist:cubics-personal-user_alice",src:"http://metadata.google.internal/" }),false);
  assert.equal(p.checkGuestAttach({partition:"persist:cubics-personal-user_alice",src:"https://example.com",preload:"file:///evil.js"}),false);
  assert.equal(p.checkGuestAttach({partition:"persist:cubics-personal-user_alice",src:"https://example.com",allowpopups:true}),false);
});
test("M04 popup/navigation decisions require full origin rather than suffix trust",()=>{
  assert.equal(p.safeWindowTarget(origin+"/spaces/a",origin),"app");
  assert.equal(p.safeWindowTarget("https://accounts.google.com/",origin),"auth");
  assert.equal(p.safeWindowTarget("https://example.com/",origin),"external");
  assert.equal(p.safeWindowTarget("https://accounts.google.com.evil.com/",origin),"external");
  assert.equal(p.safeWindowTarget("javascript:alert(1)",origin),"deny");
});

test("M04 native host permission requests reject iframes even when URL is same origin",()=>{
  const main=fs.readFileSync(path.join(root,"electron/main.js"),"utf8");
  assert.match(main,/details\.isMainFrame === false/);
  assert.match(main,/setPermissionRequestHandler/);
  assert.match(main,/setPermissionCheckHandler/);
});


test("M04 account-owned partition issuance and explicit allowlist deny cross-account reuse",()=>{
  const alice=p.partitionForVerifiedAccount("user_alice","personal",null);
  const bob=p.partitionForVerifiedAccount("user_bob","personal",null);
  const tab=p.partitionForVerifiedAccount("user_alice","tab","widget_abc");
  assert.equal(alice,"persist:cubics-personal-user_alice");
  assert.equal(tab,"persist:cubics-tab-user_alice-widget_abc");
  assert.notEqual(alice,bob);
  assert.throws(()=>p.partitionForVerifiedAccount("../../other","personal"));
  assert.throws(()=>p.partitionForVerifiedAccount("user_alice","tab","../evil"));
  const params={partition:alice,src:"https://example.com/"};
  assert.equal(p.checkGuestAttach(params,false,new Set([alice])),true);
  assert.equal(p.checkGuestAttach({...params,partition:bob},false,new Set([alice])),false);
  assert.equal(p.checkGuestAttach({...params,partition:tab},false,new Set([alice])),false);
});


test("M05 temporary Shared profiles cannot inherit Personal or Live cookies",()=>{
  const account="user_alice", widget="widget_abc";
  const personal=p.partitionForVerifiedAccount(account,"personal");
  const live=p.partitionForVerifiedAccount(account,"tab",widget);
  const shared=p.partitionForVerifiedAccount(account,"shared",widget);
  const other=p.partitionForVerifiedAccount("user_bob","shared",widget);
  assert.equal(shared,"cubics-shared-user_alice-widget_abc");
  assert.ok(!shared.startsWith("persist:"),"Shared sessions must be ephemeral");
  assert.notEqual(shared,personal);
  assert.notEqual(shared,live);
  assert.notEqual(shared,other);
  assert.equal(p.isAllowedGuestPartition(shared),true);
  assert.equal(p.checkGuestAttach({partition:shared,src:"https://example.com"},false,new Set([shared])),true);
  assert.equal(p.checkGuestAttach({partition:other,src:"https://example.com"},false,new Set([shared])),false);
  assert.throws(()=>p.partitionForVerifiedAccount(account,"shared","../escape"));
});
test("M05 only main-process verified partitions may be cleared",()=>{
  const main=fs.readFileSync(path.join(root,"electron/main.js"),"utf8");
  assert.match(main,/ipcMain\.handle\("cubics:clear-browser-data"/);
  assert.match(main,/partitionForVerifiedAccount\(userId, kind, widgetId\)/);
  assert.match(main,/issuedGuestPartitions\.has\(partition\)/);
  assert.match(main,/await verifyBrowserAccount\(expectedUserId\)/);
  assert.match(main,/await target\.clearData\(\)/);
  assert.match(main,/confirmNative\("Clear local browsing data\?"/);
  assert.doesNotMatch(main,/session\.defaultSession\.clearData\(/);
});


test("M05 browser device marker and profile identity are stable and local-only",()=>{
  const os=require("node:os"), fs=require("node:fs"), path=require("node:path");
  const {getOrCreateBrowserDeviceId,browserProfileDescriptor}=require("../../electron/browser-profile.cjs");
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"cubics-profile-test-"));
  try {
    const deviceA=getOrCreateBrowserDeviceId(path.join(root,"deviceA"));
    assert.equal(getOrCreateBrowserDeviceId(path.join(root,"deviceA")),deviceA);
    const deviceB=getOrCreateBrowserDeviceId(path.join(root,"deviceB"));
    assert.notEqual(deviceA,deviceB);
    const p1=browserProfileDescriptor(deviceA,"user_alice","personal");
    const p2=browserProfileDescriptor(deviceA,"user_alice","personal");
    const p3=browserProfileDescriptor(deviceA,"user_bob","personal");
    const p4=browserProfileDescriptor(deviceB,"user_alice","personal");
    const live=browserProfileDescriptor(deviceA,"user_alice","tab","widget_abc");
    const shared=browserProfileDescriptor(deviceA,"user_alice","shared","widget_abc");
    assert.deepEqual(p1,p2);
    assert.equal(p1.schemaVersion,1);
    assert.match(p1.profileId,/^bp1_[a-f0-9]{40}$/);
    assert.equal(p1.deviceLocal,true);
    assert.equal(p1.containsBrowsingData,false);
    assert.equal(p1.persistence,"persistent");
    assert.equal(shared.persistence,"temporary");
    assert.ok(new Set([p1.profileId,p3.profileId,p4.profileId,live.profileId,shared.profileId]).size===5);
    assert.ok(!JSON.stringify(p1).includes("user_alice"),"Opaque profile identity must not leak source user ID");
    assert.throws(()=>browserProfileDescriptor(deviceA,"../unsafe","personal"));
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test("M05 profile metadata export requires verified account, main-issued scope and no cookies",()=>{
  const fs=require("node:fs"),path=require("node:path");
  const m=fs.readFileSync(path.join(__dirname,"../../electron/main.js"),"utf8");
  assert.match(m,/ipcMain\.handle\("cubics:export-browser-profile-info"/);
  assert.match(m,/await verifyBrowserAccount\(expectedUserId\)/);
  assert.match(m,/issuedGuestPartitions\.has\(partition\)/);
  assert.match(m,/dialog\.showSaveDialog/);
  assert.match(m,/flag: "wx", mode: 0o600/);
  const helper=fs.readFileSync(path.join(__dirname,"../../electron/browser-profile.cjs"),"utf8");
  assert.doesNotMatch(helper,/cookies\.get\(|localStorage\.getItem\(/);
});
