"use strict";
const test=require("node:test"), assert=require("node:assert/strict");
const {memberMediaTag,memberIdentity,belongsToMember,isLegacyMediaIdentity,
  evictMemberFromService}=require("../../src/lib/security/media-member.cjs");
const secret="server-only-test-secret-not-real";
const tag=memberMediaTag(secret,"alpha","user_alice"), another=memberMediaTag(secret,"alpha","user_bob");
test("M05 LiveKit member identity hides Clerk ID and resists cross-member collision",()=>{
  assert.notEqual(tag,another);
  assert.notEqual(tag,memberMediaTag(secret,"beta","user_alice"));
  const w=memberIdentity("watch",tag,"00000000-0000-4000-8000-000000000001");
  const h=memberIdentity("host",tag,"00000000-0000-4000-8000-000000000002","alpha_widget");
  assert.equal(w.includes("user_alice"),false);
  assert.equal(h.includes("user_alice"),false);
  assert.equal(belongsToMember(w,tag),true);
  assert.equal(belongsToMember(h,tag),true);
  assert.equal(belongsToMember(w,another),false);
  assert.equal(belongsToMember(h,another),false);
  assert.equal(belongsToMember("watch:"+tag+"evil:uuid",tag),false);
  assert.equal(isLegacyMediaIdentity("watch:00000000-0000-4000-8000-000000000001"),true);
  assert.equal(isLegacyMediaIdentity(w),false);
  assert.throws(()=>memberMediaTag("short","a","bob"));
});
test("M05 revocation removes only revoked member and preserves other connected users",async()=>{
  const own=memberIdentity("watch",tag,"00000000-0000-4000-8000-000000000003");
  const pub=memberIdentity("host",tag,"00000000-0000-4000-8000-000000000004","alpha_widget");
  const other=memberIdentity("watch",another,"00000000-0000-4000-8000-000000000005");
  const removed=[];
  const service={
    async listRooms(){return [{name:"cubics:alpha"}]},
    async listParticipants(room){assert.equal(room,"cubics:alpha");return [{identity:other},{identity:own},{identity:pub}]},
    async removeParticipant(room,identity){assert.equal(room,"cubics:alpha");removed.push(identity)},
    async deleteRoom(){throw Error("Unexpected room reset")},
  };
  assert.deepEqual(await evictMemberFromService(service,"alpha",tag),{evicted:2,legacyRoomReset:false});
  assert.deepEqual(removed,[own,pub]);
});
test("M05 legacy unmapped identities trigger full room reset",async()=>{
  const removed=[];let reset=0;
  const service={
    async listRooms(){return [{name:"cubics:alpha"}]},
    async listParticipants(){return [{identity:"watch:00000000-0000-4000-8000-000000000001"}]},
    async removeParticipant(_room,id){removed.push(id)},
    async deleteRoom(room){assert.equal(room,"cubics:alpha");reset++},
  };
  assert.deepEqual(await evictMemberFromService(service,"alpha",tag),{evicted:1,legacyRoomReset:true});
  assert.equal(reset,1);assert.deepEqual(removed,[]);
});
test("M05 provider removal failure propagates and must not be reported as success",async()=>{
  const service={
    async listRooms(){return [{name:"cubics:alpha"}]},
    async listParticipants(){return [{identity:memberIdentity("watch",tag,"00000000-0000-4000-8000-000000000001")}]},
    async removeParticipant(){throw Error("LiveKit unreachable")},
  };
  await assert.rejects(evictMemberFromService(service,"alpha",tag),/LiveKit unreachable/);
});

test("M05 nonexistent provider room is safely treated as already disconnected",async()=>{
  const service={
    async listRooms(names){assert.deepEqual(names,["cubics:alpha"]);return []},
    async listParticipants(){throw Error("Must not inspect a missing media room")},
    async deleteRoom(){throw Error("Must not delete missing media room")},
  };
  assert.deepEqual(await evictMemberFromService(service,"alpha",tag),
    {evicted:0,legacyRoomReset:false});
});

test("M05 webhook identity parser recognizes signed-role tags but not arbitrary names",()=>{
  const {parseMediaIdentity}=require("../../src/lib/security/media-member.cjs");
  const watch=memberIdentity("watch",tag,"00000000-0000-4000-8000-000000000001");
  const host=memberIdentity("host",tag,"00000000-0000-4000-8000-000000000002","alpha_widget");
  assert.deepEqual(parseMediaIdentity(watch),{kind:"watch",tag,widgetId:null});
  assert.deepEqual(parseMediaIdentity(host),{kind:"host",tag,widgetId:"alpha_widget"});
  assert.equal(parseMediaIdentity("watch:random"),null);
  assert.equal(parseMediaIdentity("host:alpha_widget:forged-identity"),null);
  assert.equal(parseMediaIdentity(""),null);
});
