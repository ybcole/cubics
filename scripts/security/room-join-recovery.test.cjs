"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRoomJoinRecovery } = require("../../src/lib/cloud/room-join-recovery.cjs");

function fixture() {
  const timers = new Map(), delays = [], denied = [];
  let joined = 0, notices = 0, connected = true, id = 0;
  const recovery = createRoomJoinRecovery({ roomId: "roomA", join: () => joined++,
    isConnected: () => connected, onDenied: reason => denied.push(reason),
    onUnavailable: () => notices++, maxRetries: 3,
    setTimer: (fn, ms) => { delays.push(ms); timers.set(++id, fn); return id; },
    clearTimer: id => timers.delete(id) });
  const failure = { roomId: "roomA", reason: "Unable to verify membership",
    code: "MEMBERSHIP_UNAVAILABLE", retryable: true };
  return { recovery, failure, timers, delays, denied,
    get joins() { return joined; }, get notices() { return notices; },
    tick() { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); },
    disconnect() { connected = false; recovery.disconnect(); } };
}

test("M15 retries explicit transient join failures with bounded backoff and no fake success", () => {
  const f = fixture(); f.recovery.connect();
  for (let i = 0; i < 3; i++) {
    f.recovery.denied(f.failure); f.recovery.denied(f.failure);
    assert.equal(f.timers.size, 1); f.tick();
  }
  assert.deepEqual(f.delays, [1000, 2000, 4000]);
  assert.equal(f.joins, 4); assert.equal(f.notices, 1);
  f.recovery.denied(f.failure);
  assert.equal(f.timers.size, 0); assert.equal(f.denied.length, 1);
});
test("M15 denial/config errors do not retry; unrelated rooms cannot change recovery", () => {
  const f = fixture();
  f.recovery.denied({ ...f.failure, roomId: "other" });
  assert.equal(f.timers.size, 0); assert.equal(f.denied.length, 0);
  f.recovery.denied({ ...f.failure, retryable: false });
  f.recovery.denied({ roomId: "roomA", reason: "Private room or missing membership" });
  assert.equal(f.timers.size, 0); assert.equal(f.denied.length, 2);
});
test("M15 success, disconnect and unmount cancel pending retries", () => {
  const f = fixture();
  f.recovery.denied(f.failure); f.recovery.joined({ roomId: "roomA" });
  assert.equal(f.timers.size, 0);
  f.recovery.denied(f.failure); assert.equal(f.timers.size, 1);
  f.disconnect(); assert.equal(f.timers.size, 0);
  f.recovery.dispose(); f.recovery.connect(); f.recovery.denied(f.failure);
  assert.equal(f.timers.size, 0); assert.equal(f.joins, 0);
});
