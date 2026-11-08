"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {
  createSupabaseEphemeralTransport,safeCursor,validateConfig,
}=require("../../src/lib/realtime/supabase-ephemeral.cjs");

function fakeClient() {
 const callbacks={};const sent=[];let channelOptions,removeCalls=0,authTokens=[];
 const channel={
  on(type,filter,callback){callbacks[type+":"+filter.event]=callback;return this;},
  subscribe(callback){queueMicrotask(()=>callback("SUBSCRIBED"));return this;},
  async send(x){sent.push(x);return "ok";},
  async track(){return "ok";},
  presenceState(){return {"one":[{}],"two":[{},{}]};},
 };
 const instance={
  channel(topic,options){channelOptions={topic,options};return channel;},
  realtime:{async setAuth(token){authTokens.push(token);}},
  async removeChannel(){removeCalls++},
 };
 return {instance,callbacks,sent,summary:()=>({channelOptions,removeCalls,authTokens})};
}
test("Supabase config rejects HTTP/credentials/secret-role keys",()=>{
 for(const url of ["http://example.com","https://user:pass@example.com/","https://example.com/path"])
  assert.throws(()=>validateConfig(url,"sb_publishable_my_public_key"));
 assert.throws(()=>validateConfig("https://example.com","sb_secret_no"));
 assert.equal(validateConfig("https://example.supabase.co","sb_publishable_my_public_key"),"https://example.supabase.co");
});
test("Clerk identity selects private authorized room; broadcast never sends tokens or widget patches",async()=>{
 const fake=fakeClient();
 let cursor=null,counts=null;
 const tr=createSupabaseEphemeralTransport({
  createClient:()=>fake.instance,
  projectUrl:"https://example.supabase.co",
  publishableKey:"sb_publishable_my_public_key",
  getAccessToken:async()=>"clerk-test-jwt",
  onCursor:c=>cursor=c,
  onPresence:p=>counts=p,
  now:(()=>{let t=1000;return ()=>t+=40})(),
 });
 await tr.join("room_abc");
 assert.equal(fake.summary().channelOptions.topic,"cubics:room:room_abc");
 assert.equal(fake.summary().channelOptions.options.config.private,true);
 assert.deepEqual(fake.summary().authTokens,["clerk-test-jwt"]);
 fake.callbacks["broadcast:cursor:move"]({payload:{x:3,y:4,color:"#123abc",userId:"forged"}});
 assert.deepEqual(cursor,{x:3,y:4,color:"#123abc",label:"Member"});
 fake.callbacks["presence:sync"]({});
 assert.deepEqual(counts,{onlineCount:3});
 assert.equal(await tr.publishCursor({x:10,y:20,color:"#ff00cc",role:"OWNER",token:"secret"}),true);
 assert.deepEqual(fake.sent[0],{
  type:"broadcast",event:"cursor:move",payload:{x:10,y:20,color:"#ff00cc"}
 });
 assert.equal(JSON.stringify(fake.sent).includes("secret"),false);
 assert.throws(()=>tr.sendWorkspaceMutation({kind:"widget.delete"}),/not a workspace write API/);
 await tr.leave();
 assert.equal(fake.summary().removeCalls,1);
});
test("malicious cursor fields rejected, no token means fail closed",async()=>{
 assert.equal(safeCursor({x:Infinity,y:1}),null);
 assert.equal(safeCursor({x:0,y:"4"}),null);
 const tr=createSupabaseEphemeralTransport({
  createClient:()=>fakeClient().instance,
  projectUrl:"https://example.supabase.co",
  publishableKey:"sb_publishable_public",
  getAccessToken:async()=>null,
 });
 await assert.rejects(tr.join("room_abc"));
 await assert.rejects(tr.publishCursor({x:1,y:2}));
 await assert.rejects(tr.join("../../../bad"));
});
