"use strict";

const { createRealtimeServer } = require("../../socket-server.cjs");

const memberRooms = Object.freeze({
  alice: ["alpha"],
  bob: ["beta"],
  charlie: ["alpha"],
  outsider: [],
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
  allowedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
});
const port = parseInt(process.env.SOCKET_PORT || "3001", 10);
httpServer.listen(port, () => console.log("Cursor socket server listening on port " + port));
