"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const { io } = require("socket.io-client");
const { createRealtimeServer } = require("../../socket-server.cjs");
const { realtimeServiceToken } = require("../../src/lib/security/realtime-service-config.cjs");
const { getRoomRole } = require("../../src/lib/security/realtime-membership.cjs");
const { createRoomJoinRecovery } = require("../../src/lib/cloud/room-join-recovery.cjs");

test("M03/M15 local service auth and real socket join recover after outage, while forbidden rooms stay denied", { timeout: 10000 }, async () => {
  const env = { NODE_ENV: "development" };
  const token = realtimeServiceToken(env);
  let available = false;
  const api = http.createServer(async (req, res) => {
    if (req.headers["x-cubics-internal-service-token"] !== token) { res.writeHead(403).end(); return; }
    if (!available) { res.writeHead(503).end(); return; }
    let data = ""; for await (const chunk of req) data += chunk;
    const { userId, roomId } = JSON.parse(data);
    const allowed = userId === "userA" && roomId === "roomA";
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ allowed, role: allowed ? "MEMBER" : null }));
  });
  await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
  env.CUBICS_INTERNAL_API_ORIGIN = "http://127.0.0.1:" + api.address().port;
  const realtime = createRealtimeServer({
    verifyIdentity: async () => ({ userId: "userA", sessionId: "test-session", expiresAt: Date.now() / 1000 + 600 }),
    authorizeRoom: async (userId, roomId) => !!(await getRoomRole(userId, roomId, { env })),
    allowedOrigins: ["http://localhost:3000"],
  });
  await new Promise(resolve => realtime.httpServer.listen(0, "127.0.0.1", resolve));
  const socket = io("http://127.0.0.1:" + realtime.httpServer.address().port, {
    autoConnect: false, transports: ["websocket"], reconnection: false,
    extraHeaders: { Origin: "http://localhost:3000" },
  });
  const denials = [];
  const recovery = createRoomJoinRecovery({ roomId: "roomA",
    join: () => socket.emit("room:join", { roomId: "roomA" }), isConnected: () => socket.connected,
    onDenied: reason => denials.push(reason), onUnavailable: () => { available = true; },
    setTimer: fn => setTimeout(fn, 10), clearTimer: clearTimeout,
  });
  socket.on("connect", recovery.connect);
  socket.on("room:denied", recovery.denied);
  socket.on("room:joined", recovery.joined);
  try {
    const firstDenied = once(socket, "room:denied");
    const joined = once(socket, "room:joined");
    socket.connect();
    const [failure] = await firstDenied;
    assert.equal(failure.retryable, true);
    assert.equal(failure.code, "MEMBERSHIP_UNAVAILABLE");
    const [success] = await joined;
    assert.equal(success.roomId, "roomA"); assert.deepEqual(denials, []);
    const forbidden = once(socket, "room:denied");
    socket.emit("room:join", { roomId: "private-room" });
    const [denial] = await forbidden;
    assert.equal(denial.reason, "Private room or missing membership");
    assert.notEqual(denial.retryable, true);
  } finally {
    recovery.dispose(); socket.disconnect();
    await new Promise(resolve => realtime.io.close(resolve));
    await new Promise(resolve => api.close(resolve));
  }
});
