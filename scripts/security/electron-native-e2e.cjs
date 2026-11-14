"use strict";
const http=require("node:http");
const path=require("node:path");
const {app,BrowserWindow,webContents,session}=require("electron");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=20000){
  const started=Date.now();
  while(Date.now()-started<ms){
    try{const v=fn();if(v)return v}catch{}
    await sleep(80);
  }
  throw Error("M04 native test timeout");
}
async function run(){
 let currentAccount="user_test";
 const server=http.createServer((req,res)=>{
  const url="http://127.0.0.1:"+server.address().port;
  if(req.url==="/v1/identity"){
   res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});
   res.end(JSON.stringify({userId:currentAccount,protocolVersion:1}));
   return;
  }
  if(req.url==="/guest"){
   res.writeHead(200,{"Content-Type":"text/html",
    "Content-Security-Policy":"default-src 'none'; script-src 'none'",
    "X-Frame-Options":"DENY"});
   res.end("<!DOCTYPE html><body>Hostile guest<script>window.__forbiddenScriptRan=true;</script></body>");
   return;
  }
  res.writeHead(200,{"Content-Type":"text/html"});
  res.end('<!DOCTYPE html><html><body>'+
   '<webview id="bad" src="'+url+'/guest" partition="persist:default" preload="file:///tmp/evil.js"></webview>'+
   '<div>Security fixture</div></body></html>');
 });
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
 const origin="http://127.0.0.1:"+server.address().port;
 process.env.CUBICS_SERVER_URL=origin;
 process.env.CUBICS_PROFILE="native-security-"+process.pid;
 require(path.resolve(__dirname,"../../electron/main.js"));
 await app.whenReady();
 const win=await until(()=>BrowserWindow.getAllWindows().find(x=>x.getTitle()==="Cubics"));
 await until(()=>win.webContents.getURL().startsWith(origin) && !win.webContents.isLoadingMainFrame());
 const main=await win.webContents.executeJavaScript(
  "({version:window.cubics?.bridgeVersion,node:typeof require,hasIpc:!!window.cubics?.invoke})");
 if(main.version!==1||main.node!=="undefined"||main.hasIpc)
  throw Error("App renderer sandbox/preload invalid: "+JSON.stringify(main));
 const crossAccountClaim=await win.webContents.executeJavaScript(
  'window.cubics.getBrowserPartition("personal",null,"user_intruder").then(()=>false,()=>true)');
 if(!crossAccountClaim)throw Error("Renderer forged account identity");
 const partition=await win.webContents.executeJavaScript(
  'window.cubics.getBrowserPartition("tab","widget_test","user_test")');
 if(partition!=="persist:cubics-tab-user_test-widget_test")
  throw Error("Unexpected issued browser partition");
 const shared=await win.webContents.executeJavaScript(
  'window.cubics.getBrowserPartition("shared","widget_test","user_test")');
 if(shared!=="cubics-shared-user_test-widget_test" || shared===partition)
  throw Error("Shared session was not isolated from Live session");
 const personal=await win.webContents.executeJavaScript(
  'window.cubics.getBrowserPartition("personal",null,"user_test")');
 const personalSession=session.fromPartition(personal);
 const liveSession=session.fromPartition(partition);
 const sharedSession=session.fromPartition(shared);
 if(!personalSession.isPersistent() || !liveSession.isPersistent() ||
     sharedSession.isPersistent()) throw Error("Profile persistence flags were incorrect");
 await personalSession.cookies.set({url:origin,name:"m05_personal",value:"owner-only"});
 await liveSession.cookies.set({url:origin,name:"m05_live",value:"live-only"});
 await sharedSession.cookies.set({url:origin,name:"m05_shared",value:"shared-only"});
 const getCookie=async(ses,name)=>(await ses.cookies.get({url:origin,name})).map(c=>c.value);
 if((await getCookie(personalSession,"m05_personal")).join()!=="owner-only" ||
    (await getCookie(liveSession,"m05_personal")).length!==0 ||
    (await getCookie(sharedSession,"m05_personal")).length!==0 ||
    (await getCookie(personalSession,"m05_shared")).length!==0 ||
    (await getCookie(liveSession,"m05_shared")).length!==0 ||
    (await getCookie(sharedSession,"m05_live")).length!==0) {
   throw Error("M05 cross-mode browser cookie leak");
 }
 // Clear one temporary Shared jar without erasing Personal/Live sessions.
 await sharedSession.clearData({dataTypes:["cookies"]});
 if((await getCookie(sharedSession,"m05_shared")).length!==0 ||
    (await getCookie(personalSession,"m05_personal")).join()!=="owner-only" ||
    (await getCookie(liveSession,"m05_live")).join()!=="live-only")
   throw Error("M05 scoped profile clear erased unrelated browser data");
 await win.webContents.executeJavaScript(`(async()=>{
  const good=document.createElement("webview");
  good.id="good";good.src="${origin}/guest";good.setAttribute("partition","${partition}");
  good.style.cssText="display:inline-flex;width:200px;height:150px";
  document.body.appendChild(good);
 })()`);
 const guest=await until(()=>webContents.getAllWebContents().find(w=>
  w.getType()==="webview"&&w.getURL().startsWith(origin+"/guest")));
 const pref=guest.getLastWebPreferences();
 if(!pref.sandbox||pref.nodeIntegration||!pref.contextIsolation)
  throw Error("Guest sandbox disabled: "+JSON.stringify(pref));
 const result=await guest.executeJavaScript(
  "({hasRequire:typeof require!=='undefined',hasBridge:!!window.cubics,scriptRan:!!window.__forbiddenScriptRan})");
 if(result.hasRequire||result.hasBridge||result.scriptRan)
  throw Error("Hostile guest escaped: "+JSON.stringify(result));
 const denied=await guest.executeJavaScript(
  "navigator.mediaDevices.getUserMedia({audio:true}).then(()=>false,()=>true)");
 if(!denied)throw Error("Guest microphone unexpectedly allowed");
 const rejected=await win.webContents.executeJavaScript(
  "window.cubics.getTabMediaSourceId(-1).then(()=>false,()=>true)");
 if(!rejected)throw Error("Invalid native IPC ID accepted");
 await sleep(300);
 let count=webContents.getAllWebContents().filter(w=>w.getType()==="webview").length;
 if(count!==1)throw Error("Malicious partition/preload attached: "+count);
 // Account switch invalidates the old guest and its capture permission; it
 // MUST NOT erase its cookies or allow reuse of the previous partition.
 currentAccount="user_other";
 const nextPartition=await win.webContents.executeJavaScript(
  'window.cubics.getBrowserPartition("tab","widget_test","user_other")');
 if(nextPartition===partition)throw Error("Cross-account partition collision");
 const otherPersonal=await win.webContents.executeJavaScript(
  'window.cubics.getBrowserPartition("personal",null,"user_other")');
 const otherPersonalSession=session.fromPartition(otherPersonal);
 if((await getCookie(otherPersonalSession,"m05_personal")).length!==0 ||
    (await getCookie(personalSession,"m05_personal")).join()!=="owner-only")
   throw Error("M05 account-switch cookie isolation/persistence failed");
 await until(()=>guest.isDestroyed());
 await win.webContents.executeJavaScript(`(()=>{
  const stale=document.createElement("webview");
  stale.src="${origin}/guest";stale.setAttribute("partition","${partition}");
  document.body.appendChild(stale);
 })()`);
 await sleep(400);
 count=webContents.getAllWebContents().filter(w=>w.getType()==="webview").length;
 if(count!==0)throw Error("Previous account's partition reattached after switch: "+count);
 console.log("M04_NATIVE_E2E_PASS: sandbox, CSP, permission denial, IPC, account switch, M05 cookies and scoped clear");
 // Test-only main process. Electron app.exit can leave open platform handles
 // after a renderer was destroyed (observed on all 3 GH Actions runners).
 // We have completed all assertions, so make the CLI exit code deterministic.
 server.close();
 process.exit(0);
}
run().catch(e=>{
 console.error("M04_NATIVE_E2E_FAIL:",e?.stack||String(e));
 process.exit(1);
});
