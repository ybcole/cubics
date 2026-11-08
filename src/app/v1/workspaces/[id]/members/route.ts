import { getRoomAccess } from "@/lib/spaceAccess";
import { prisma } from "@/lib/prisma";
import { v1Error, v1Json } from "@/lib/cloud/server-response";
export const dynamic = "force-dynamic";

/** Versioned sharing read. Private workspace membership is verified on every
 * request; never reveal member emails, cookies or personal browser metadata. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 128) return v1Error("INVALID_REQUEST", "Invalid workspace", 400);
  const { userId, room, canView } = await getRoomAccess(id);
  if (!userId) return v1Error("UNAUTHORIZED", "Sign in to continue", 401);
  if (!room || !canView) return v1Error("NOT_FOUND", "Workspace not found", 404);
  try {
    const members = await prisma.roomMember.findMany({
      where: { roomId: id },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { joinedAt: "asc" },
      take: 500,
    });
    return v1Json({
      items: members.map(member => ({
        userId: member.userId,
        displayName: member.user?.name || "Member",
        avatar: member.user?.avatar || null,
        role: member.userId === room.ownerId ? "OWNER" :
          member.role === "ADMIN" ? "ADMIN" : "MEMBER",
        joinedAt: member.joinedAt.toISOString(),
      })),
      cursor: null,
    });
  } catch {
    return v1Error("UNAVAILABLE", "Members unavailable", 503);
  }
}
