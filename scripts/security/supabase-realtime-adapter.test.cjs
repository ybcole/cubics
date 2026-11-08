"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {createSupabaseRealtimeTransport, topicFor, checkedEphemeral} =
  require("../../src/lib/cloud/supabase-realtime.cjs");

const id = "clabcdefghijklmn";
function fixture() {
  const callbacks = new Map(), messages = [], channels = [];
  let privateOnly = false, authToken = null;
  const client = {
    realtime: { setAuth: async token => {authToken = token;} },
    channel: (name, options) => {
      privateOnly = options.config.private === true;
      const channel = {
        on(type, filter, callback) {callbacks.set(filter.event, callback); return this;},
        subscribe(fn) {fn("SUBSCRIBED"); return this;},
        async send(message) {messages.push(message); return "ok";},
      };
      channels.push({name,options,channel});
      return channel;
    },
    async removeChannel() {},
  };
  return {client,callbacks,messages,channels,get privateOnly(){return privateOnly;},
    get authToken(){return authToken;}};
}
test("room identifier must be safe and never encode a user-chosen channel",()=>{
  assert.equal(topicFor(id),"cubics:room:"+id);
  for(const bad of ["", "../admin", "c", "room_one", "__proto__", "room:foo"]) {
    assert.throws(()=>topicFor(bad));
  }
});
test("private subscription receives Clerk JWT without exposing authority",async()=>{
  const fx=fixture(), transport=createSupabaseRealtimeTransport(fx.client);
  assert.equal(transport.provider,"supabase");
  await transport.connect({workspaceId:id,token:"test_clerk_token_123"});
  assert.ok(fx.privateOnly);
  assert.equal(fx.authToken,"test_clerk_token_123");
  assert.equal(fx.channels[0].name,"cubics:room:"+id);
  await transport.disconnect();
});
test("client cannot publish widget mutation, host grant, or arbitrary payload",async()=>{
  const fx=fixture(), transport=createSupabaseRealtimeTransport(fx.client);
  await transport.connect({workspaceId:id,token:"test_clerk_token_123"});
  for (const payload of [
    {kind:"widget.update",id:"w",x:20}, {kind:"workspace.commit",revision:42},
    {kind:"cursor",x:Infinity,y:3}, {kind:"cursor",x:2e8,y:3},
    {kind:"presence",state:"admin"},
  ]) await assert.rejects(transport.publishEphemeral(payload));
  await transport.publishEphemeral({kind:"cursor",x:1,y:2,color:"#aabbcc"});
  assert.deepEqual(fx.messages,[{type:"broadcast",event:"ephemeral",
    payload:{kind:"cursor",x:1,y:2,color:"#aabbcc"}}]);
});
test("commit notifications are hints, never accepted as canonical writes",async()=>{
  const fx=fixture(), transport=createSupabaseRealtimeTransport(fx.client);
  const commits=[]; transport.onCommitted(c=>commits.push(c));
  await transport.connect({workspaceId:id,token:"test_clerk_token_123"});
  fx.callbacks.get("commit_hint")({payload:{workspaceId:"other",operationId:"x",revision:1}});
  fx.callbacks.get("commit_hint")({payload:{workspaceId:id,operationId:"x",revision:-1}});
  assert.deepEqual(commits,[]);
  fx.callbacks.get("commit_hint")({payload:{workspaceId:id,operationId:"x",revision:1}});
  assert.deepEqual(commits,[{kind:"workspace.commit",workspaceId:id,operationId:"x",revision:1}]);
});
test("malicious broadcasts do not reach ephemeral listeners",async()=>{
  const fx=fixture(), transport=createSupabaseRealtimeTransport(fx.client);
  const events=[];transport.onEphemeral(ev=>events.push(ev));
  await transport.connect({workspaceId:id,token:"test_clerk_token_123"});
  fx.callbacks.get("ephemeral")({payload:{kind:"widget.update",id:"w"}});
  fx.callbacks.get("ephemeral")({payload:{kind:"cursor",x:3,y:4}});
  assert.deepEqual(events,[{kind:"cursor",x:3,y:4}]);
});
