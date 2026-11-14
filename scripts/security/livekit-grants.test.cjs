"use strict";
const test=require("node:test"), assert=require("node:assert/strict");
const {canPublishWidget,publishedIdentityMatches}=require("../../src/lib/security/livekit-grants.cjs");
test("M05 only Live creators and Shared room members receive a publish grant",()=>{
  assert.equal(canPublishWidget("MEMBER","user_alice",{type:"live-tab",createdBy:"user_alice"}),true);
  assert.equal(canPublishWidget("OWNER","user_bob",{type:"live-tab",createdBy:"user_alice"}),false);
  assert.equal(canPublishWidget("MEMBER","user_alice",{type:"shared-browser",createdBy:"user_bob"}),true);
  assert.equal(canPublishWidget("MEMBER","user_alice",{type:"iframe",createdBy:"user_alice"}),false);
  assert.equal(canPublishWidget(null,"user_alice",{type:"shared-browser"}),false);
  assert.equal(canPublishWidget("MEMBER","user_alice",null),false);
});
test("M05 viewer binds track to server-minted widget publisher identity",()=>{
  assert.equal(publishedIdentityMatches("host:widget_alpha:abc","widget_alpha"),true);
  assert.equal(publishedIdentityMatches("host:widget_beta:abc","widget_alpha"),false);
  assert.equal(publishedIdentityMatches("watch:abc","widget_alpha"),false);
  assert.equal(publishedIdentityMatches("host:widget_alpha_fake:abc","widget_alpha"),false);
});
