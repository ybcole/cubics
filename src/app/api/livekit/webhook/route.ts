import { NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { prisma } from "@/lib/prisma";
import { removeStaleMediaParticipant } from "@/lib/live/media-admin";
import { canPublishWidget } from "@/lib/security/livekit-grants.cjs";
import { memberMediaTag, parseMediaIdentity } from "@/lib/security/media-member.cjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Configure this HTTPS endpoint in LiveKit Settings -> Webhooks or the
 * self-hosted webhook.urls config. Authentication is the provider-signed JWT
 * over the EXACT raw request body, not a Clerk session or untrusted JSON.
 * Since webhooks arrive only after media transport joins, this is a
 * best-effort rejoin guard, not an instant client admission firewall.
 */
export async function POST(request: Request) {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const raw = await request.text();
  if (raw.length > 64_000) return NextResponse.json({ error: "Webhook too large" }, { status: 413 });
  let event;
  try {
    event = await new WebhookReceiver(key, secret).receive(
      raw, request.headers.get("authorization") || undefined
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
  }
  if (event.event !== "participant_joined") {
    return NextResponse.json({ ok: true });
  }
  const roomName = event.room?.name;
  const identity = event.participant?.identity;
  if (typeof roomName !== "string" || !roomName.startsWith("cubics:") ||
      typeof identity !== "string") {
    return NextResponse.json({ ok: true });
  }
  const roomId = roomName.slice("cubics:".length);
  if (!roomId || roomId.length > 128) {
    return NextResponse.json({ error: "Invalid Cubics room" }, { status: 400 });
  }
  try {
    const parsed = parseMediaIdentity(identity);
    // Never trust the webhook participant's self-described display name.
    // The signed server-issued identity contains a room-scoped HMAC tag.
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        ownerId: true,
        members: { select: { userId: true, role: true } },
      },
    });
    const authorized = new Map<string, { userId: string; role: "OWNER" | "ADMIN" | "MEMBER" }>();
    if (room) {
      authorized.set(memberMediaTag(secret, roomId, room.ownerId),
        { userId: room.ownerId, role: "OWNER" });
      for (const member of room.members) {
        if (member.userId !== room.ownerId) {
          authorized.set(memberMediaTag(secret, roomId, member.userId), {
            userId: member.userId, role: member.role === "ADMIN" ? "ADMIN" : "MEMBER",
          });
        }
      }
    }
    const owner = parsed ? authorized.get(parsed.tag) : null;
    let permitted = !!owner;
    if (parsed?.kind === "host" && owner) {
      const widget = await prisma.widget.findFirst({
        where: { id: parsed.widgetId!, roomId },
        select: { type: true, createdBy: true },
      });
      permitted = canPublishWidget(owner.role, owner.userId, widget);
    }
    if (!permitted) {
      await removeStaleMediaParticipant(roomId, identity);
      return NextResponse.json({ ok: true, revoked: true });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Non-2xx lets LiveKit retry transient DB/provider outages rather than
    // acknowledging an unchecked join. Never return raw provider errors.
    console.error("M05_LIVEKIT_WEBHOOK_RECHECK_FAILED", { roomId, event: event.id, reason: String(error) });
    return NextResponse.json({ error: "Media membership recheck unavailable" }, { status: 503 });
  }
}
