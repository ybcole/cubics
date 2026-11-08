"use strict";
const http=require("node:http");
const path=require("node:path");
const {app,BrowserWindow,webContents}=require("electron");
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
 const server=http.createServer((req,res)=>{
  const url="http://127.0.0.1:"+server.address().port;
  if(req.url==="/guest"){
   res.writeHead(200,{"Content-Type":"text/html",
    "Content-Security-Policy":"default-src 'none'; script-src 'none'",
    "X-Frame-Options":"DENY"});
   res.end("<!DOCTYPE html><body>Hostile guest<script>window.__forbiddenScriptRan=true;</script></body>");
   return;
  }
  res.writeHead(200,{"Content-Type":"text/html"});
  res.end('<!DOCTYPE html><html><body><webview id="good" src="'+url+'/guest" '+
   'partition="persist:cubics-tab-user_test-widget_test" style="display:inline-flex;width:200px;height:150px"></webview>'+
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
 const count=webContents.getAllWebContents().filter(w=>w.getType()==="webview").length;
 if(count!==1)throw Error("Malicious partition/preload attached: "+count);
 console.log("M04_NATIVE_E2E_PASS: sandbox, preload, CSP, guest partition, microphone, IPC input");
 server.close();
 app.exit(0);
}
run().catch(e=>{console.error("M04_NATIVE_E2E_FAIL:",e?.stack||String(e));app.exit(1)});
