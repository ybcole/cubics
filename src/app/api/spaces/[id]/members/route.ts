import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoomAccess } from "@/lib/spaceAccess";
import { canRoomAction } from "@/lib/security/room-policy.cjs";
import { evictMediaMember } from "@/lib/live/media-admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const { room, canView } = await getRoomAccess(id);
    if (!room) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }
    if (!canView) {
      return NextResponse.json({ error: "This room is private" }, { status: 403 });
    }

    const members = await prisma.roomMember.findMany({
      where: { roomId: id },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json(
      members.map((m) => ({
        userId: m.userId,
        name: m.user?.name || "Member",
        avatar: m.user?.avatar || null,
        role: m.role,
        joinedAt: m.joinedAt,
        isOwner: room.ownerId === m.userId,
      })),
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

/** M03: owner-controlled role changes. OWNER cannot be granted via client
 * data; an ownership transfer requires a separate audited transaction. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, room, role } = await getRoomAccess(id);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!room || !canRoomAction(role, "members.role")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const target = body?.userId;
  const newRole = body?.role;
  if (typeof target !== "string" || !target || target.length > 128 ||
      !["ADMIN", "MEMBER"].includes(newRole) || target === room.ownerId) {
    return NextResponse.json({ error: "Invalid membership update" }, { status: 400 });
  }
  const update = await prisma.roomMember.updateMany({
    where: { roomId: id, userId: target }, data: { role: newRole },
  });
  if (!update.count) return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  return NextResponse.json({ ok: true, userId: target, role: newRole });
}

/** M03: a member may leave voluntarily; an owner/admin may revoke another
 * member. Ownership cannot be deleted without an explicit transfer. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, room, role } = await getRoomAccess(id);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!room || !role) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const target = body?.userId ?? userId;
  if (typeof target !== "string" || !target || target.length > 128) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }
  if (target === room.ownerId) {
    return NextResponse.json({ error: "Owner must transfer ownership before leaving" }, { status: 409 });
  }
  if (target !== userId && !canRoomAction(role, "members.remove")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // A delegated admin cannot revoke another admin; only owner may do that.
  if (role === "ADMIN" && target !== userId) {
    const member = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: target, roomId: id } }, select: { role: true },
    });
    if (member?.role === "ADMIN") {
      return NextResponse.json({ error: "Only owner can revoke an admin" }, { status: 403 });
    }
  }
  // Evict first: if the media admin API is down, keep membership unchanged
  // rather than pretending media access was withdrawn. A second eviction
  // after the DB mutation narrows the rejoin race against an old token.
  const existing = await prisma.roomMember.findUnique({
    where: { userId_roomId: { userId: target, roomId: id } },
    select: { userId: true },
  });
  if (!existing) return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  try {
    await evictMediaMember(id, target);
  } catch {
    return NextResponse.json({ error: "Could not revoke active media session; membership unchanged" },
      { status: 503 });
  }
  const removed = await prisma.roomMember.deleteMany({
    where: { userId: target, roomId: id },
  });
  if (removed.count) {
    try {
      await evictMediaMember(id, target);
    } catch (error) {
      console.error("M05_MEDIA_REVOCATION_RETRY_REQUIRED", { roomId: id, error: String(error) });
      return NextResponse.json({ error: "Membership removed, but media revocation needs retry",
        removed: true, mediaRevocationPending: true }, { status: 503 });
    }
  }
  return NextResponse.json({ ok: true, removed: removed.count > 0 });
}
