import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { getRoomAccess } from "@/lib/roomAccess";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) {
    return NextResponse.json({ error: "Live streaming server is not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  const { userId, canView } = await getRoomAccess(roomId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView) return NextResponse.json({ error: "This room is private" }, { status: 403 });

  const token = new AccessToken(key, secret, {
    // unique per window so two windows of one user don't kick each other off
    identity: `${userId}:${randomUUID().slice(0, 8)}`,
    name: typeof body?.name === "string" ? body.name.slice(0, 64) : undefined,
    ttl: "2h",
  });
  token.addGrant({
    room: `cubics:${roomId}`,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });

  return NextResponse.json({ token: await token.toJwt(), url });
}
