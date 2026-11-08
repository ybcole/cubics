"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const p=require("../../electron/security-policy.cjs");
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
