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
  return { service: new RoomServiceClient(url, key, secret), secret };
}
export async function evictMediaMember(roomId: string, userId: string) {
  const admin = mediaRoomService();
  if (!admin) return { configured: false, evicted: 0, legacyRoomReset: false };
  const tag = memberMediaTag(admin.secret, roomId, userId);
  const result = await evictMemberFromService(admin.service, roomId, tag);
  return { configured: true, ...result };
}
export async function closeMediaRoom(roomId: string) {
  const admin = mediaRoomService();
  if (!admin) return { configured: false };
  await admin.service.deleteRoom("cubics:" + roomId);
  return { configured: true };
}
