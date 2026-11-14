import "server-only";
import { RoomServiceClient } from "livekit-server-sdk";
import { evictMemberFromService, memberMediaTag } from "@/lib/security/media-member.cjs";

/** Server-only provider credentials; user removal must fail visibly on
 * administrative errors, never return an imaginary successful revocation.
 * A missing provider is a no-op only when ALL LiveKit settings are absent.
 */
function mediaRoomService() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url && !key && !secret) return null;
  if (!url || !key || !secret) {
    throw new Error("Media revocation cannot run: incomplete LiveKit configuration");
  }
  // The client-facing LIVEKIT_URL is normally wss://; RoomServiceClient
  // expects an HTTP(S) API origin, not a WebSocket address.
  const adminUrl = new URL(url);
  if (adminUrl.protocol === "wss:") adminUrl.protocol = "https:";
  else if (adminUrl.protocol === "ws:") adminUrl.protocol = "http:";
  else if (adminUrl.protocol !== "https:" && adminUrl.protocol !== "http:") {
    throw new Error("Unsupported LiveKit administration URL");
  }
  return { service: new RoomServiceClient(adminUrl.origin, key, secret), secret };
}
export async function evictMediaMember(roomId: string, userId: string) {
  const admin = mediaRoomService();
  if (!admin) return { configured: false, evicted: 0, legacyRoomReset: false };
  const tag = memberMediaTag(admin.secret, roomId, userId);
  const result = await evictMemberFromService(admin.service, roomId, tag);
  return { configured: true, ...result };
}
export async function removeStaleMediaParticipant(roomId: string, identity: string) {
  const admin = mediaRoomService();
  if (!admin) throw new Error("LiveKit provider is not configured for webhook revocation");
  const name = "cubics:" + roomId;
  const found = (await admin.service.listRooms([name]))
    .some(room => room.name === name);
  if (!found) return { removed: false };
  // Webhook delivery can be delayed or duplicated. Only remove if the same
  // connection still exists; avoid treating a past leave as an outage.
  const participant = (await admin.service.listParticipants(name))
    .find(p => p.identity === identity);
  if (!participant) return { removed: false };
  await admin.service.removeParticipant(name, identity);
  return { removed: true };
}
export async function closeMediaRoom(roomId: string) {
  const admin = mediaRoomService();
  if (!admin) return { configured: false };
  const name = "cubics:" + roomId;
  const exists = (await admin.service.listRooms([name]))
    .some(room => room.name === name);
  if (exists) await admin.service.deleteRoom(name);
  return { configured: true };
}
