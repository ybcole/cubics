"use strict";

const { createRealtimeServer } = require("../../socket-server.cjs");
const { canRoomAction } = require("../../src/lib/security/room-policy.cjs");

const memberRooms = {
  alice: ["alpha"],
  bob: ["beta"],
  charlie: ["alpha"],
  outsider: [],
};
const owners = { alpha: "alice", beta: "bob" };
const widgetOwners = { "alpha-widget": "alice", "charlie-widget": "charlie", "beta-widget": "bob" };
const widgetModes = { "alpha-widget": "live", "charlie-widget": "shared", "beta-widget": "shared" };

// Commands are scoped to this test-only child process, not exposed over HTTP.
process.stdin.setEncoding("utf8");
process.stdin.on("data", text => {
  for (const line of text.split("\\n")) {
    if (!line.trim()) continue;
    try {
      const command = JSON.parse(line);
      if (command.action === "revoke" && memberRooms[command.userId]) {
        memberRooms[command.userId] = memberRooms[command.userId].filter(id => id !== command.roomId);
      }
    } catch {}
  }
});

const { httpServer } = createRealtimeServer({
  verifyIdentity: async token => {
    if (typeof token !== "string" || !/^test-(alice|bob|charlie|outsider)$/.test(token)) {
      throw new Error("Unauthorized");
    }
    return {
      userId: token.slice(5),
      sessionId: "test-session-" + token,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    };
  },
  authorizeRoom: async (userId, roomId) => memberRooms[userId]?.includes(roomId) || false,
  authorizeOperation: async (userId, roomId, action, widgetId) => {
    if (!memberRooms[userId]?.includes(roomId)) return false;
    const role = owners[roomId] === userId ? "OWNER" : "MEMBER";
    if (widgetId && !widgetOwners[widgetId]) return false;
    const mode = widgetModes[widgetId];
    if (["media.view", "media.host.live", "media.host.shared", "control.send"].includes(action)) {
      if (!mode) return false;
      if (action === "media.host.live" && mode !== "live") return false;
      if (["media.host.shared", "control.send"].includes(action) && mode !== "shared") return false;
    }
    return canRoomAction(role, action, {
      ownsWidget: widgetOwners[widgetId] === userId,
      isSharedWidget: mode === "shared",
    });
  },
  membershipRecheckMs: 250,
  allowedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
});
const port = parseInt(process.env.SOCKET_PORT || "3001", 10);
httpServer.listen(port, () => console.log("Cursor socket server listening on port " + port));
