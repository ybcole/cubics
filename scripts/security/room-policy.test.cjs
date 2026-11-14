"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { canRoomAction, normalizeRoomRole } =
  require("../../src/lib/security/room-policy.cjs");

test("untrusted client role and unknown operations deny by default",()=>{
  for(const role of [null,undefined,"GUEST","SUPERADMIN","owner",true,{}])
    assert.equal(canRoomAction(role,"room.delete"),false);
  assert.equal(canRoomAction("OWNER","an:unknown:action"),false);
  assert.equal(normalizeRoomRole("MEMBER"),"MEMBER");
});
test("owner/admin/member workspace mutation matrix",()=>{
  assert.equal(canRoomAction("OWNER","room.delete"),true);
  assert.equal(canRoomAction("ADMIN","room.delete"),false);
  assert.equal(canRoomAction("MEMBER","room.delete"),false);
  assert.equal(canRoomAction("ADMIN","room.rename"),true);
  assert.equal(canRoomAction("MEMBER","room.rename"),false);
  assert.equal(canRoomAction("ADMIN","members.remove"),true);
  assert.equal(canRoomAction("MEMBER","members.remove"),false);
  assert.equal(canRoomAction("ADMIN","members.role"),false);
  assert.equal(canRoomAction("OWNER","members.role"),true);
});
test("members cannot mutate each other's widgets, except explicit legacy ownership-less migration",()=>{
  assert.equal(canRoomAction("MEMBER","widget.modify",{ownsWidget:false}),false);
  assert.equal(canRoomAction("MEMBER","widget.delete",{ownsWidget:false}),false);
  assert.equal(canRoomAction("MEMBER","widget.modify",{ownsWidget:true}),true);
  assert.equal(canRoomAction("MEMBER","widget.delete",{legacyUnowned:true}),true);
  assert.equal(canRoomAction("ADMIN","widget.delete",{ownsWidget:false}),true);
  assert.equal(canRoomAction("OWNER","widget.create"),true);
  assert.equal(canRoomAction("MEMBER","widget.create"),true);
});
test("media grants require widget host ownership or elevated room role",()=>{
  assert.equal(canRoomAction("MEMBER","media.host"),false);
  assert.equal(canRoomAction("MEMBER","media.host",{ownsWidget:true}),true);
  assert.equal(canRoomAction("ADMIN","media.host"),true);
});

test("M05 Live is creator-only and Shared control requires a verified Shared widget",()=>{
  const {canRoomAction}=require("../../src/lib/security/room-policy.cjs");
  assert.equal(canRoomAction("MEMBER","media.host.live",{ownsWidget:true}),true);
  assert.equal(canRoomAction("OWNER","media.host.live",{ownsWidget:false}),false);
  assert.equal(canRoomAction("MEMBER","media.host.shared",{isSharedWidget:true}),true);
  assert.equal(canRoomAction("MEMBER","media.host.shared",{isSharedWidget:false}),false);
  assert.equal(canRoomAction("MEMBER","control.send",{isSharedWidget:true}),true);
  assert.equal(canRoomAction("MEMBER","control.send",{isSharedWidget:false}),false);
});
