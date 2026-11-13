"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { io } = require("socket.io-client");

const root = path.resolve(__dirname, "../..");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const port = listener.address().port;
      listener.close(error => error ? reject(error) : resolve(port));
    });
  });
}
function connect(port, user, origin = "http://localhost:3000") {
  return new Promise((resolve, reject) => {
    const socket = io("http://127.0.0.1:" + port, {
      transports: ["websocket"], reconnection: false, timeout: 2500, forceNew: true,
      extraHeaders: { Origin: origin }, auth: { token: "test-" + user },
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", error => { socket.disconnect(); reject(error); });
  });
}
function waitFor(socket, event, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error("Timeout waiting for " + event));
    }, timeoutMs);
    const listener = payload => {
      clearTimeout(timer); socket.off(event, listener); resolve(payload);
    };
    socket.on(event, listener);
  });
}
async function join(socket, roomId, spoofUserId) {
  const joined = waitFor(socket, "room:joined");
  socket.emit("room:join", { roomId, userId: spoofUserId, userName: "Test User", roomName: roomId });
  assert.equal((await joined).roomId, roomId);
}
test("rejects anonymous, forged and foreign-origin Socket.IO connections and private-room access", { timeout: 15000 }, async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ["scripts/security/socket-fixture-server.cjs"], {
    cwd: root, env: { ...process.env, SOCKET_PORT: String(port) }, stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += String(chunk).slice(0, 1000); });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server start timed out " + stderr)), 5000);
    child.stdout.on("data", chunk => {
      if (String(chunk).includes("listening on port " + port)) {
        clearTimeout(timer); resolve();
      }
    });
    child.once("exit", code => {
      clearTimeout(timer); reject(new Error("Server exited " + code + ": " + stderr));
    });
  });
  const clients = [];
  try {
    await ready;
    await assert.rejects(connect(port, "unknown"), /Unauthorized/);
    await assert.rejects(connect(port, "alice", "https://untrusted.example"));
    const [a, b, c, outsider] = await Promise.all([
      connect(port, "alice"), connect(port, "bob"), connect(port, "charlie"), connect(port, "outsider"),
    ]);
    clients.push(a, b, c, outsider);
    const outsiderDenied = waitFor(outsider, "room:denied");
    outsider.emit("room:join", { roomId: "alpha", userId: "alice" });
    assert.equal((await outsiderDenied).roomId, "alpha");
    outsider.emit("widget:delete", "widget-owned-by-alice");
    outsider.emit("chat:send", { content: "not authorized", userId: "alice" });

    // An attempted userId spoof must not change the verified token identity.
    await join(a, "alpha", "bob");
    await join(b, "beta", "alice");
    await join(c, "alpha", "bob");

    const deny = waitFor(a, "room:denied");
    a.emit("room:join", { roomId: "beta", userId: "bob" });
    assert.equal((await deny).roomId, "beta");

    // A valid member may send a same-room peer signal.
    const legitimate = waitFor(c, "voice:signal");
    a.emit("voice:signal", { to: c.id, data: { kind: "valid" } });
    assert.equal((await legitimate).from, a.id);

    // A forged cursor identity or invalid geometry must not be broadcast.
    const cursor = waitFor(c, "cursor:move");
    a.emit("cursor:move", {
      id: "forged-socket", userId: "bob", userName: "Not Alice",
      roomId: "beta", x: 120, y: 180, color: "malicious-css",
    });
    const visibleCursor = await cursor;
    assert.equal(visibleCursor.id, a.id);
    assert.equal(visibleCursor.userId, "alice");
    assert.equal(visibleCursor.userName, "Test User");
    assert.equal(visibleCursor.roomId, "alpha");
    assert.equal(visibleCursor.color, "#64748b");
    const cursorLeak = [];
    c.on("cursor:move", data => cursorLeak.push(data));
    a.emit("cursor:move", { x: Number.POSITIVE_INFINITY, y: 2 });
    await sleep(60);
    assert.equal(cursorLeak.length, 0);

    // A forged chat userId must be ignored in favor of verified JWT identity.
    const message = waitFor(c, "chat:message");
    a.emit("chat:send", { content: "hello", userId: "bob", userName: "Other user" });
    const received = await message;
    assert.equal(received.userId, "alice");
    assert.equal(received.content, "hello");

    const leaked = [];
    for (const event of ["voice:signal", "sb:offer-to", "sb:ice", "tab:input", "rooms:changed"]) {
      b.on(event, () => leaked.push(event));
    }
    a.emit("voice:signal", { to: b.id, data: { kind: "forged" } });
    a.emit("sb:offer-to", { to: b.id, sdp: "not allowed" });
    a.emit("sb:ice", { to: b.id, candidate: "not allowed" });
    a.emit("room:update", { roomId: "beta", name: "forged" });

    const hosted = waitFor(b, "tab:host-state");
    b.emit("tab:host", { widgetId: "beta-widget", kind: "shared", hostName: "Bob", ownerId: "bob" });
    await hosted;
    a.emit("tab:input", { widgetId: "beta-widget", input: { type: "click" } });

    const snapshot = waitFor(a, "presence:snapshot");
    a.emit("presence:request");
    assert.deepEqual(Object.keys(await snapshot), ["alpha"]);

    // A MEMBER cannot forge an owner's rename or delete another user's widget.
    const forbiddenRelays = [];
    a.on("rooms:changed", value => { if (value?.name === "forged-rename") forbiddenRelays.push("rename"); });
    a.on("widget:delete", id => forbiddenRelays.push("delete:" + id));
    c.emit("room:update", { roomId: "alpha", name: "forged-rename" });
    c.emit("widget:delete", "alpha-widget");
    const authorizedUpdate = waitFor(c, "widget:update");
    a.emit("widget:update", { id: "alpha-widget", x: 77 });
    assert.equal((await authorizedUpdate).id, "alpha-widget");

    // M05: no personal URL/title/token may be sent to another room member.
    const added = waitFor(c, "widget:add");
    a.emit("widget:add", {
      id: "alpha-widget", title: "Private bank statement",
      url: "https://bank.example/account?token=secret-123",
      type: "iframe", createdBy: "alice",
    });
    assert.deepEqual(await added, { id: "alpha-widget" });
    const hiddenUpdate = waitFor(c, "widget:update");
    a.emit("widget:update", {
      id: "alpha-widget",
      url: "https://private.example/receipt?token=another-secret",
      title: "My confidential file",
      x: 8,
    });
    assert.deepEqual(await hiddenUpdate, {
      id: "alpha-widget", x: 8, metadataChanged: true,
    });
    await sleep(200);
    assert.deepEqual(forbiddenRelays, []);

    // A holder cannot replace the authenticated identity on token refresh.
    const refused = new Promise(resolve =>
      a.emit("auth:refresh", { token: "test-bob" }, resolve)
    );
    assert.deepEqual(await refused, { ok: false });

    await sleep(300);
    assert.deepEqual(leaked, [], "Cross-room messages leaked: " + leaked.join(", "));

    // Passive subscriptions must be withdrawn even when the revoked user
    // never sends another packet.
    const revoked = waitFor(c, "disconnect", 2800);
    child.stdin.write(JSON.stringify({ action: "revoke", userId: "charlie", roomId: "alpha" }) + "\\n");
    await revoked;
    assert.equal(c.connected, false);
  } finally {
    for (const client of clients) client.disconnect();
    child.kill("SIGTERM");
    await Promise.race([new Promise(resolve => child.once("exit", resolve)), sleep(800)]);
  }
});
