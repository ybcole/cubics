import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { getRoomAccess } from "@/lib/spaceAccess";
import { prisma } from "@/lib/prisma";
import { canPublishWidget } from "@/lib/security/livekit-grants.cjs";

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
  if (!roomId || roomId.length > 128)
    return NextResponse.json({ error: "Valid roomId required" }, { status: 400 });
  // A viewing connection never gets publisher rights. The optional
  // publishWidgetId is checked against current database authority.
  const requestedPublisher = body?.publishWidgetId !== undefined;
  const publishWidgetId = requestedPublisher ? body.publishWidgetId : null;
  if (requestedPublisher &&
      (typeof publishWidgetId !== "string" ||
       !/^[a-zA-Z0-9_-]{3,128}$/.test(publishWidgetId))) {
    return NextResponse.json({ error: "Invalid publishing widget" }, { status: 400 });
  }

  const { userId, canView, role } = await getRoomAccess(roomId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView || !role)
    return NextResponse.json({ error: "This space is private" }, { status: 403 });
  if (requestedPublisher) {
    let widget;
    try {
      widget = await prisma.widget.findFirst({
        where: { id: publishWidgetId, roomId },
        select: { type: true, createdBy: true },
      });
    } catch {
      return NextResponse.json({ error: "Publisher authority unavailable" }, { status: 503 });
    }
    if (!canPublishWidget(role, userId, widget)) {
      return NextResponse.json({ error: "Not authorized to host this tab" }, { status: 403 });
    }
  }

  const token = new AccessToken(key, secret, {
    // Opaque identity: LiveKit logs must not contain a raw Clerk user ID.
    // Tracks are accepted only from an identity minted for that widget.
    identity: requestedPublisher ? `host:${publishWidgetId}:${randomUUID()}`
      : `watch:${randomUUID()}`,
    name: typeof body?.name === "string" ? body.name.slice(0, 64) : undefined,
    ttl: "5m",
  });
  token.addGrant({
    room: `cubics:${roomId}`,
    roomJoin: true,
    canPublish: requestedPublisher,
    canSubscribe: !requestedPublisher,
    canPublishData: false,
  });

  return NextResponse.json({ token: await token.toJwt(), url }, {
    headers: { "Cache-Control": "no-store" },
  });
}
