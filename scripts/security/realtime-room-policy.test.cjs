"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { joinedRoom, isInJoinedRoom, sameJoinedRoom } = require("../../src/lib/security/realtime-room-policy.cjs");
const alice = { data: { roomId: "alpha" } };
const bob = { data: { roomId: "alpha" } };
const outsider = { data: { roomId: "beta" } };
test("room guard denies different rooms and missing room identity", () => {
  assert.equal(joinedRoom(alice), "alpha");
  assert.equal(sameJoinedRoom(alice, bob), true);
  assert.equal(sameJoinedRoom(alice, outsider), false);
  assert.equal(sameJoinedRoom(alice, null), false);
  assert.equal(sameJoinedRoom({}, bob), false);
  assert.equal(sameJoinedRoom({ data: { roomId: "" } }, bob), false);
});
test("event room ID must match socket joined room", () => {
  assert.equal(isInJoinedRoom(alice, "alpha"), true);
  assert.equal(isInJoinedRoom(alice, "beta"), false);
  assert.equal(isInJoinedRoom(alice, ""), false);
  assert.equal(isInJoinedRoom({}, "alpha"), false);
});
