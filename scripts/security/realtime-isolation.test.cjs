"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { io } = require("socket.io-client");

const root = path.resolve(__dirname,"../..");
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
async function freePort() {
  return new Promise((resolve,reject)=>{
    const server = net.createServer();
    server.once("error",reject);
    server.listen(0,"127.0.0.1",()=>{
      const port = server.address().port;
      server.close(error => error ? reject(error):resolve(port));
    });
  });
}
function connect(port) {
  return new Promise((resolve,reject)=>{
    const socket = io("http://127.0.0.1:"+port,{
      transports:["websocket"],reconnection:false,timeout:2500,forceNew:true
    });
    socket.once("connect",()=>resolve(socket));
    socket.once("connect_error",error=>{ socket.disconnect(); reject(error); });
  });
}
function one(socket,name,ms=1500) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.off(name,handler);reject(new Error("timeout waiting for "+name));},ms);
    const handler=(value)=>{clearTimeout(timer);socket.off(name,handler);resolve(value)};
    socket.on(name,handler);
  });
}
async function join(socket, roomId, userId){
  const ready=one(socket,"tab:host-states");
  socket.emit("room:join",{roomId,userId,userName:userId,roomName:roomId});
  await ready;
}
test("live Socket.IO server isolates direct peer signals and presence by joined room", {timeout:12000}, async () => {
  const port=await freePort();
  const child=spawn(process.execPath,["socket-server.cjs"],{cwd:root,env:{...process.env,SOCKET_PORT:String(port)},stdio:["ignore","pipe","pipe"]});
  let stderr="";
  child.stderr.on("data",chunk=>{stderr+=String(chunk).slice(0,1000)});
  const ready=new Promise((resolve,reject)=>{
    let chunks="";
    const timer=setTimeout(()=>reject(new Error("server startup timed out "+stderr)),4000);
    child.stdout.on("data",chunk=>{
      chunks+=String(chunk);
      if(chunks.includes("listening on port "+port)){clearTimeout(timer);resolve();}
    });
    child.once("exit",code=>{clearTimeout(timer);reject(new Error("server exited "+code+" "+stderr))});
  });
  const clients=[];
  try {
    await ready;
    const [a,b,c]=await Promise.all([connect(port),connect(port),connect(port)]);
    clients.push(a,b,c);
    await join(a,"alpha","alice");
    await join(b,"beta","bob");
    await join(c,"alpha","charlie");
    const leak=[];
    for(const event of ["voice:signal","sb:offer-to","sb:ice","tab:input","rooms:changed"])
      b.on(event,()=>leak.push(event));
    // Same-room delivery remains functional (not a blanket shutdown).
    const valid=one(c,"voice:signal");
    a.emit("voice:signal",{to:c.id,data:{kind:"test"}});
    assert.equal((await valid).from,a.id);
    a.emit("voice:signal",{to:b.id,data:{kind:"not-allowed"}});
    a.emit("sb:offer-to",{to:b.id,sdp:"blocked"});
    a.emit("sb:ice",{to:b.id,candidate:"blocked"});
    a.emit("room:update",{roomId:"beta",name:"forged"});
    const hostReady=one(b,"tab:host-state");
    b.emit("tab:host",{widgetId:"beta-widget",kind:"shared",hostName:"Bob",ownerId:"bob"});
    await hostReady;
    a.emit("tab:input",{widgetId:"beta-widget",input:{type:"click"}});
    const snapshotPromise=one(a,"presence:snapshot");
    a.emit("presence:request");
    const snapshot=await snapshotPromise;
    assert.deepEqual(Object.keys(snapshot),["alpha"]);
    await sleep(260);
    assert.deepEqual(leak,[],"cross-room peer signals leaked: "+leak.join(","));
  } finally {
    for(const socket of clients) socket.disconnect();
    child.kill("SIGTERM");
    await Promise.race([new Promise(resolve=>child.once("exit",resolve)),sleep(600)]);
  }
});
