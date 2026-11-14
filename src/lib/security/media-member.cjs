"use strict";

const { createHmac } = require("node:crypto");

// Opaque user-scoped LiveKit identity tag; no raw Clerk ID in client-visible
// participant identity. Tags differ across workspaces and require the
// server-only LIVEKIT_API_SECRET to derive.
function memberMediaTag(secret, roomId, userId) {
  if (typeof secret !== "string" || secret.length < 12 ||
      typeof roomId !== "string" || !roomId || roomId.length > 128 ||
      typeof userId !== "string" || !userId || userId.length > 128) {
    throw new TypeError("Valid server media secret, room and user required");
  }
  return "m_" + createHmac("sha256", secret)
    .update(JSON.stringify(["cubics-media-member-v1", roomId, userId]))
    .digest("hex").slice(0, 32);
}
function memberIdentity(role, tag, nonce, widgetId = null) {
  if (!/^m_[a-f0-9]{32}$/.test(tag) || !/^[a-f0-9-]{36}$/.test(nonce)) {
    throw new TypeError("Invalid media identity");
  }
  if (role === "watch") return "watch:" + tag + ":" + nonce;
  if (role === "host" && typeof widgetId === "string" &&
      /^[a-zA-Z0-9_-]{3,128}$/.test(widgetId)) {
    return "host:" + widgetId + ":" + tag + ":" + nonce;
  }
  throw new TypeError("Invalid media participant type");
}
function belongsToMember(identity, tag) {
  if (typeof identity !== "string" || !/^m_[a-f0-9]{32}$/.test(tag)) return false;
  // Exact segment match; no prefix or substring collisions across users.
  return identity.startsWith("watch:" + tag + ":") ||
    /^host:[a-zA-Z0-9_-]{3,128}:m_[a-f0-9]{32}:[a-f0-9-]{36}$/.test(identity) &&
    identity.split(":")[2] === tag;
}
function isLegacyMediaIdentity(identity) {
  return typeof identity === "string" && (
    /^watch:[a-f0-9-]{36}$/.test(identity) ||
    /^host:[a-zA-Z0-9_-]{3,128}:[a-f0-9-]{36}$/.test(identity)
  );
}
async function evictMemberFromService(service, roomId, tag) {
  const roomName = "cubics:" + roomId;
  // A room with no connected participants is often absent entirely.
  // Treat that as an idempotent completed eviction rather than a 404 error.
  const rooms = await service.listRooms([roomName]);
  if (!rooms.some(room => room.name === roomName)) {
    return { evicted: 0, legacyRoomReset: false };
  }
  const participants = await service.listParticipants(roomName);
  if (participants.some(p => isLegacyMediaIdentity(p.identity))) {
    // Existing untagged participants cannot be attributed safely to a
    // removed member. One legacy-session room reset is safer than leaving
    // someone connected to a stream they no longer have permission to see.
    await service.deleteRoom(roomName);
    return { evicted: participants.length, legacyRoomReset: true };
  }
  const targets = participants.filter(p => belongsToMember(p.identity, tag));
  // Sequential removal avoids unbounded administrative RPC fan-out.
  for (const participant of targets) {
    await service.removeParticipant(roomName, participant.identity);
  }
  return { evicted: targets.length, legacyRoomReset: false };
}
module.exports = {
  memberMediaTag, memberIdentity, belongsToMember, isLegacyMediaIdentity,
  evictMemberFromService,
};
