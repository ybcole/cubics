import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { canRoomAction } from "@/lib/security/room-policy.cjs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-to-server only. The realtime service has already verified the Clerk
 * JWT; this endpoint makes PostgreSQL membership/role authoritative without
 * exposing DATABASE_URL or Prisma to a desktop client or socket worker.
 *
 * Isolate this route behind a private ingress/proxy in deployment, as well as
 * requiring a strong service token. Never use a NEXT_PUBLIC_* credential.
 */
export async function POST(request: Request) {
  const secret = process.env.CUBICS_REALTIME_SERVICE_TOKEN;
  if (!secret || Buffer.byteLength(secret) < 32) {
    return NextResponse.json({ error: "Service authorization unavailable" }, { status: 503 });
  }
  const supplied = request.headers.get("X-Cubics-Internal-Service-Token") || "";
  const providedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(secret);
  if (providedBytes.length !== expectedBytes.length ||
      !timingSafeEqual(providedBytes, expectedBytes)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (Number(request.headers.get("Content-Length") || "0") > 2048) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  const roomId = body?.roomId;
  if (typeof userId !== "string" || typeof roomId !== "string" ||
      !userId || !roomId || userId.length > 128 || roomId.length > 128) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        ownerId: true,
        members: { where: { userId }, take: 1, select: { role: true } },
      },
    });
    const role = !room ? null : room.ownerId === userId ? "OWNER" :
      room.members[0]?.role === "ADMIN" ? "ADMIN" :
      room.members[0] ? "MEMBER" : null;
    let allowed = role !== null;
    if (body.action !== undefined) {
      const action = body.action;
      const widgetId = body.widgetId;
      if (typeof action !== "string" || action.length > 64) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }
      let ownsWidget = false;
      let legacyUnowned = false;
      let isSharedWidget = false;
      let isLiveWidget = false;
      if (action === "widget.create" || action === "widget.modify" ||
          action === "widget.delete" || action === "media.host" ||
          action === "media.host.live" || action === "media.host.shared" ||
          action === "media.view" || action === "control.send") {
        if (typeof widgetId !== "string" || !widgetId || widgetId.length > 128) {
          return NextResponse.json({ error: "Widget ID required" }, { status: 400 });
        }
        const widget = await prisma.widget.findFirst({
          where: { id: widgetId, roomId },
          select: { createdBy: true, type: true },
        });
        if (!widget) allowed = false;
        else {
          ownsWidget = widget.createdBy === userId;
          legacyUnowned = widget.createdBy === null;
          isSharedWidget = widget.type === "shared-browser";
          isLiveWidget = widget.type === "live-tab";
          // Personal widgets must never acquire an SFU viewing/host grant.
          if (["media.view", "media.host.live", "media.host.shared",
               "control.send"].includes(action) && !isLiveWidget && !isSharedWidget) {
            allowed = false;
          }
          if (action === "media.host.live" && !isLiveWidget) allowed = false;
          if (["media.host.shared", "control.send"].includes(action) && !isSharedWidget) {
            allowed = false;
          }
        }
      }
      allowed = allowed && canRoomAction(role, action, {
        ownsWidget, legacyUnowned, isSharedWidget,
      });
      // An incoming widget:add is an announcement of an HTTP-created widget,
      // not permission to impersonate a creator and inject phantom widgets.
      if (action === "widget.create" && !ownsWidget && !["OWNER", "ADMIN"].includes(role || "")) {
        allowed = false;
      }
    }
    return NextResponse.json({ allowed, role }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Membership authority unavailable" }, { status: 503 });
  }
}
