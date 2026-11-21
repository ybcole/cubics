"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRoomJoinRecovery, roomDenialMessage } = require("../../src/lib/cloud/room-join-recovery.cjs");

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

test("M15 legacy workers receive explicit restart guidance without retrying a stale service", () => {
  const f = fixture();
  f.recovery.denied({ roomId: "roomA", reason: "Unable to verify membership" });
  assert.equal(f.timers.size, 0);
  assert.match(f.denied[0], /Fully stop and restart npm run app:dev/);
});

test("M15 safe diagnostics distinguish configuration, credential and API failures", () => {
  const base = { reason: "Unable to verify membership", code: "MEMBERSHIP_UNAVAILABLE" };
  assert.match(roomDenialMessage({ ...base, failureCode: "MEMBERSHIP_CONFIG" }), /configuration is invalid/);
  assert.match(roomDenialMessage({ ...base, failureCode: "SERVICE_AUTH_FAILED", httpStatus: 403 }), /credential.*HTTP 403/);
  assert.match(roomDenialMessage({ ...base, failureCode: "AUTHORITY_HTTP_ERROR", httpStatus: 404 }), /API.*HTTP 404/);
  assert.match(roomDenialMessage({ ...base, failureCode: "AUTHORITY_UNAVAILABLE" }), /cannot reach/);
});

test("M15 unknown error details and malformed status are never exposed by diagnostic formatting", () => {
  const base = { reason: "Unable to verify membership", code: "MEMBERSHIP_UNAVAILABLE" };
  assert.equal(roomDenialMessage({ ...base, failureCode: "private-credential-value", httpStatus: "secret-value" }), base.reason);
  const text = roomDenialMessage({ ...base, failureCode: "SERVICE_AUTH_FAILED", httpStatus: "secret-value" });
  assert.ok(!text.includes("secret-value"));
  assert.equal(roomDenialMessage({ reason: "Private room or missing membership" }), "Private room or missing membership");
});
