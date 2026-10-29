const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

/** @typedef { { x: number, y: number, userId: string, userName: string, color: string, roomId: string } } CursorData */

/** @type {Map<string, CursorData>} */
const cursors = new Map();

/** @type {Map<string, Map<string, { id: string, userId: string | null, userName: string, imageUrl: string | null }>>} */
const roomPresence = new Map();

/** In-memory chat history per room (last CHAT_LIMIT messages). */
/** @type {Map<string, Array<object>>} */
const roomChat = new Map();
const CHAT_LIMIT = 200;

function pushChat(roomId, message) {
  if (!roomChat.has(roomId)) roomChat.set(roomId, []);
  const history = roomChat.get(roomId);
  history.push(message);
  if (history.length > CHAT_LIMIT) history.splice(0, history.length - CHAT_LIMIT);
  return message;
}

function systemMessage(content) {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "system",
    content,
    createdAt: new Date().toISOString(),
  };
}

function presenceList(roomId) {
  const members = roomPresence.get(roomId);
  if (!members) return [];
  const byUser = new Map();
  for (const member of members.values()) {
    byUser.set(member.userId || `socket:${member.id}`, member);
  }
  return Array.from(byUser.values());
}

function allPresence() {
  const rooms = {};
  for (const roomId of roomPresence.keys()) {
    const members = presenceList(roomId);
    if (members.length > 0) rooms[roomId] = members;
  }
  return rooms;
}

function broadcastPresence(roomId) {
  const members = presenceList(roomId);
  io.emit("presence:update", { roomId, members });
}

/** Live/shared browser tabs: widgetId -> { hostId, hostName, kind, roomId, ownerId } */
/** @type {Map<string, { hostId: string, hostName: string, kind: "live" | "shared", roomId: string, ownerId: string | null }>} */
const tabHosts = new Map();

function tabHostState(widgetId, host) {
  return {
    widgetId,
    hostId: host ? host.hostId : null,
    hostName: host ? host.hostName : "",
    kind: host ? host.kind : null,
  };
}

/** widgetId -> Set<socketId> of sockets currently watching that tab. */
/** @type {Map<string, Set<string>>} */
const tabViewers = new Map();

function tabViewerCount(widgetId) {
  const viewers = tabViewers.get(widgetId);
  if (!viewers) return 0;
  const hostId = tabHosts.get(widgetId)?.hostId;
  let count = 0;
  for (const id of viewers) {
    if (id !== hostId) count += 1;
  }
  return count;
}

function notifyTabViewers(widgetId) {
  const host = tabHosts.get(widgetId);
  if (!host) return;
  const hostSocket = io.sockets.sockets.get(host.hostId);
  if (hostSocket) {
    hostSocket.emit("tab:viewers", { widgetId, count: tabViewerCount(widgetId) });
  }
}

function removeTabViewer(socketId) {
  for (const [widgetId, viewers] of tabViewers.entries()) {
    if (!viewers.delete(socketId)) continue;
    if (viewers.size === 0) tabViewers.delete(widgetId);
    notifyTabViewers(widgetId);
  }
}

function releaseTabHosts(socketId) {
  for (const [widgetId, host] of tabHosts.entries()) {
    if (host.hostId !== socketId) continue;
    tabHosts.delete(widgetId);
    io.to(host.roomId).emit("tab:host-state", tabHostState(widgetId, null));
  }
}

io.on("connection", (socket) => {
  console.log("Cursor server: user connected", socket.id);

  socket.on("presence:request", () => {
    socket.emit("presence:snapshot", allPresence());
  });

  socket.on("room:join", ({ roomId, userName, imageUrl, userId, roomName, silent }) => {
    if (typeof roomId !== "string" || !roomId) return;
    const rejoining = socket.data.roomId === roomId;
    if (socket.data.roomId && !rejoining) {
      removeTabViewer(socket.id);
      releaseTabHosts(socket.id);
      leaveRoom(socket);
    }
    socket.data.roomId = roomId;
    socket.data.userName = userName || "Guest";
    socket.data.imageUrl = imageUrl || null;
    socket.data.userId = userId || null;
    socket.data.roomName = roomName || null;
    socket.data.silent = !!silent;
    socket.join(roomId);

    if (socket.data.silent) return;

    if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Map());
    roomPresence.get(roomId).set(socket.id, {
      id: socket.id,
      userId: socket.data.userId,
      userName: socket.data.userName,
      imageUrl: socket.data.imageUrl,
    });
    broadcastPresence(roomId);

    const roomCursors = Array.from(cursors.entries())
      .filter(([, c]) => c.roomId === roomId && c.userId !== socket.id)
      .map(([id, c]) => ({ id, ...c }));
    socket.emit("cursors:init", roomCursors);

    // Send existing chat history, then announce the join to everyone.
    socket.emit("chat:history", roomChat.get(roomId) || []);
    if (!rejoining) {
      const where = socket.data.roomName ? ` ${socket.data.roomName}` : " the room";
      const msg = systemMessage(`${socket.data.userName} joined${where}`);
      pushChat(roomId, msg);
      io.to(roomId).emit("chat:message", msg);
    }
  });

  function leaveRoom(sock) {
    const roomId = sock.data.roomId;
    if (!roomId) return;
    sock.leave(roomId);
    if (sock.data.silent) return;
    const members = roomPresence.get(roomId);
    if (members) {
      members.delete(sock.id);
      if (members.size === 0) roomPresence.delete(roomId);
      broadcastPresence(roomId);
    }
    if (sock.data.voice) sock.to(roomId).emit("voice:left", sock.id);
    if (sock.data.userName) {
      const where = sock.data.roomName ? ` ${sock.data.roomName}` : " the room";
      const msg = systemMessage(`${sock.data.userName} left${where}`);
      pushChat(roomId, msg);
      sock.to(roomId).emit("chat:message", msg);
    }
  }

  socket.on("cursor:move", (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    cursors.set(socket.id, { ...data, roomId, userId: socket.id });
    socket.to(roomId).emit("cursor:move", { id: socket.id, ...data });
  });

/** Shared browser sessions: widgetId -> { hostId, hostName } */
const sharedBrowsers = new Map();

  // === Widget sync (add / move / resize / url change / delete) ===
  socket.on("widget:add", (widget) => {
    const roomId = socket.data.roomId;
    if (!roomId || !widget || typeof widget.id !== "string") return;
    socket.to(roomId).emit("widget:add", widget);
  });

  socket.on("widget:update", (patch) => {
    const roomId = socket.data.roomId;
    if (!roomId || !patch || typeof patch.id !== "string") return;
    socket.to(roomId).emit("widget:update", patch);
  });

  socket.on("widget:delete", (id) => {
    console.log("DELETE RECEIVED", id, socket.data.roomId);
    const roomId = socket.data.roomId;
    if (!roomId || typeof id !== "string") return;
    io.to(roomId).emit("widget:delete", id);
    sharedBrowsers.delete(id);
    tabViewers.delete(id);
    if (tabHosts.has(id)) {
      const host = tabHosts.get(id);
      tabHosts.delete(id);
      if (host) io.to(host.roomId).emit("tab:host-state", tabHostState(id, null));
    }
  });
  socket.on("room:update", ({ roomId, avatar, name }) => {
    io.emit("rooms:changed", { roomId, avatar, name });
  });

  // === Widget input forwarding (live-tab co-control) ===
  socket.on("widget:input", ({ widgetId, input }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !widgetId || !input) return;
    socket.to(roomId).emit("widget:input", { widgetId, input, from: socket.id });
  });

  // === Live-tab control token arbitration ===
  /** @type {Map<string, { holderId: string | null, holderName: string, version: number, queue: string[] }>} */
  const liveTokens = new Map();

  function getTokenState(widgetId) {
    if (!liveTokens.has(widgetId)) {
      liveTokens.set(widgetId, { holderId: null, holderName: "", version: 0, queue: [] });
    }
    return liveTokens.get(widgetId);
  }

  function broadcastToken(widgetId) {
    const state = getTokenState(widgetId);
    io.emit("token:state", { widgetId, holderId: state.holderId, holderName: state.holderName, version: state.version });
  }

  socket.on("token:request", ({ widgetId, userName }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !widgetId) return;
    const state = getTokenState(widgetId);
    if (!state.queue.includes(socket.id)) state.queue.push(socket.id);
    if (!state.holderId) {
      const next = state.queue.shift();
      state.holderId = next;
      state.holderName = userName || "user";
      state.version += 1;
      broadcastToken(widgetId);
    }
  });

  socket.on("token:release", ({ widgetId }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !widgetId) return;
    const state = getTokenState(widgetId);
    if (state.holderId === socket.id) {
      state.holderId = null;
      state.holderName = "";
      state.version += 1;
      const next = state.queue.shift();
      if (next) {
        state.holderId = next;
        state.holderName = "";
        state.version += 1;
      }
      broadcastToken(widgetId);
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    cursors.delete(socket.id);
    removeTabViewer(socket.id);
    releaseTabHosts(socket.id);
    leaveRoom(socket);
    // Release any held tokens and remove from queues
    for (const [widgetId, state] of liveTokens.entries()) {
      if (state.holderId === socket.id) {
        state.holderId = null;
        state.holderName = "";
        state.version += 1;
        const next = state.queue.shift();
        if (next) {
          state.holderId = next;
          state.holderName = "";
          state.version += 1;
        }
        broadcastToken(widgetId);
      } else {
        const idx = state.queue.indexOf(socket.id);
        if (idx !== -1) state.queue.splice(idx, 1);
      }
    }
  });

  // === Shared Browser (WebRTC screen share + remote control) ===
  socket.on("sb:join", ({ widgetId, userName }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !widgetId) return;
    socket.data.sbWidget = widgetId;
    const state = sharedBrowsers.get(widgetId);
    if (state) {
      socket.emit("sb:state", { hostId: state.hostId });
      // Ask host to resend offer to the new viewer
      const hostSock = io.sockets.sockets.get(state.hostId);
      if (hostSock && socket.id !== state.hostId) {
        hostSock.emit("sb:viewer", { viewerId: socket.id, userName });
      }
    } else {
      socket.emit("sb:state", { hostId: null });
    }
  });

  socket.on("sb:host", ({ widgetId, sdp }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !widgetId) return;
    // If someone else is hosting, replace them
    const existing = sharedBrowsers.get(widgetId);
    if (existing && existing.hostId !== socket.id && roomId) {
      socket.to(roomId).emit("sb:state", { hostId: null });
    }
    sharedBrowsers.set(widgetId, { hostId: socket.id, hostName: socket.data.userName });
    console.log("[SB-SRV] host set", widgetId, socket.id, "room", roomId);
    io.to(roomId).emit("sb:state", { hostId: socket.id });
    // Notify all other viewers in room to request connection
    socket.to(roomId).emit("sb:host-available", { widgetId, hostId: socket.id });
  });

  socket.on("sb:unhost", ({ widgetId }) => {
    const roomId = socket.data.roomId;
    const state = sharedBrowsers.get(widgetId);
    if (state && state.hostId === socket.id) {
      sharedBrowsers.delete(widgetId);
      if (roomId) socket.to(roomId).emit("sb:state", { hostId: null });
    }
  });

  socket.on("sb:viewer", ({ viewerId, userName }) => {
    const roomId = socket.data.roomId;
    // host will handle creating offer
  });

  socket.on("sb:viewer-request", ({ widgetId }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !widgetId) return;
    const state = sharedBrowsers.get(widgetId);
    console.log("[SB-SRV] viewer-request from", socket.id, "host:", state?.hostId);
    if (state && state.hostId && state.hostId !== socket.id) {
      const hostSock = io.sockets.sockets.get(state.hostId);
      if (hostSock) {
        console.log("[SB-SRV] forwarding to host", state.hostId);
        hostSock.emit("sb:viewer", { viewerId: socket.id });
      }
    }
  });

  socket.on("sb:offer-to", ({ to, sdp }) => {
    if (!to) return;
    const target = io.sockets.sockets.get(to);
    if (target) target.emit("sb:offer-to", { from: socket.id, sdp });
  });

  socket.on("sb:ice", ({ to, candidate }) => {
    if (!candidate) return;
    if (to && to !== "*") {
      const target = io.sockets.sockets.get(to);
      if (target) target.emit("sb:ice", { candidate });
    } else {
      const roomId = socket.data.roomId;
      if (roomId) socket.to(roomId).emit("sb:ice", { candidate, from: socket.id });
    }
  });

  socket.on("sb:nav", ({ widgetId, url }) => {
    const roomId = socket.data.roomId;
    if (roomId && url) socket.to(roomId).emit("sb:nav", { url });
  });

  // === Live / shared browser tab streaming ===
  socket.on("tab:join", ({ widgetId }) => {
    if (!widgetId || typeof widgetId !== "string") return;
    let viewers = tabViewers.get(widgetId);
    if (!viewers) {
      viewers = new Set();
      tabViewers.set(widgetId, viewers);
    }
    viewers.add(socket.id);
    notifyTabViewers(widgetId);
    const host = tabHosts.get(widgetId) || null;
    socket.emit("tab:host-state", tabHostState(widgetId, host));
  });

  socket.on("tab:leave", ({ widgetId }) => {
    if (!widgetId || typeof widgetId !== "string") return;
    const viewers = tabViewers.get(widgetId);
    if (!viewers) return;
    viewers.delete(socket.id);
    if (viewers.size === 0) tabViewers.delete(widgetId);
    notifyTabViewers(widgetId);
  });

  socket.on("tab:host", ({ widgetId, kind, ownerId, hostName }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !widgetId || typeof widgetId !== "string") return;
    const tabKind = kind === "shared" ? "shared" : "live";
    if (tabKind === "live" && ownerId && socket.data.userId !== ownerId) {
      socket.emit("tab:host-state", tabHostState(widgetId, tabHosts.get(widgetId) || null));
      return;
    }

    const existing = tabHosts.get(widgetId);
    if (existing && existing.hostId !== socket.id) {
      socket.emit("tab:host-state", tabHostState(widgetId, existing));
      return;
    }

    const previousHost = tabHosts.get(widgetId);
    if (previousHost && previousHost.hostId !== socket.id) {
      const oldViewers = tabViewers.get(widgetId);
      oldViewers?.delete(previousHost.hostId);
      if (oldViewers && oldViewers.size === 0) tabViewers.delete(widgetId);
    }

    const host = {
      hostId: socket.id,
      hostName: hostName || socket.data.userName || "Guest",
      kind: tabKind,
      roomId,
      ownerId: ownerId || socket.data.userId || null,
    };
    tabHosts.set(widgetId, host);
    io.to(roomId).emit("tab:host-state", tabHostState(widgetId, host));
    notifyTabViewers(widgetId);
  });

  socket.on("tab:unhost", ({ widgetId }) => {
    if (!widgetId || typeof widgetId !== "string") return;
    const host = tabHosts.get(widgetId);
    if (!host || host.hostId !== socket.id) return;
    tabHosts.delete(widgetId);
    const viewers = tabViewers.get(widgetId);
    if (viewers) {
      viewers.delete(socket.id);
      if (viewers.size === 0) tabViewers.delete(widgetId);
    }
    io.to(host.roomId).emit("tab:host-state", tabHostState(widgetId, null));
  });

  socket.on("tab:frame", ({ widgetId, frame }) => {
    if (!widgetId || !frame || !frame.data) return;
    const host = tabHosts.get(widgetId);
    if (!host || host.hostId !== socket.id) return;
    socket.to(host.roomId).emit("tab:frame", { widgetId, frame });
  });

  socket.on("tab:input", ({ widgetId, input }) => {
    if (!widgetId || !input || typeof input.type !== "string") return;
    const host = tabHosts.get(widgetId);
    if (!host || host.kind !== "shared") return;
    const target = io.sockets.sockets.get(host.hostId);
    if (target) target.emit("tab:input", { widgetId, input, from: socket.id });
  });

  // === Chat ===
  socket.on("chat:send", (payload) => {
    const roomId = socket.data.roomId;
    if (!roomId || !payload || typeof payload.content !== "string") return;
    const content = payload.content.trim().slice(0, 2000);
    if (!content) return;
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "user",
      userId: payload.userId || socket.data.userId || socket.id,
      userName: payload.userName || socket.data.userName || "Guest",
      content,
      createdAt: new Date().toISOString(),
    };
    pushChat(roomId, msg);
    io.to(roomId).emit("chat:message", msg);
  });

  // === Voice chat signaling ===
  socket.on("voice:join", (payload) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.data.voice = true;
    socket.data.voiceName =
      (payload && typeof payload.userName === "string" && payload.userName.trim()) || "Guest";

    const peers = [];
    for (const [, s] of io.sockets.sockets) {
      if (s.id !== socket.id && s.data.roomId === roomId && s.data.voice) {
        peers.push({ id: s.id, userName: s.data.voiceName });
      }
    }
    socket.emit("voice:peers", peers);
    socket.to(roomId).emit("voice:joined", { id: socket.id, userName: socket.data.voiceName });
  });

  socket.on("voice:leave", () => {
    const roomId = socket.data.roomId;
    socket.data.voice = false;
    if (roomId) socket.to(roomId).emit("voice:left", socket.id);
  });

  socket.on("voice:signal", (msg) => {
    if (!msg || typeof msg.to !== "string" || !msg.data) return;
    const target = io.sockets.sockets.get(msg.to);
    if (target) target.emit("voice:signal", { from: socket.id, data: msg.data });
  });
});

const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);
httpServer.listen(PORT, () => {
  console.log(`Cursor socket server listening on port ${PORT}`);
});
