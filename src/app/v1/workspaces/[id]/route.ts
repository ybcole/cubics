import { prisma } from "@/lib/prisma";
import { getRoomAccess } from "@/lib/spaceAccess";
import { v1Error, v1Json } from "@/lib/cloud/server-response";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!params.id || params.id.length > 128) {
    return v1Error("INVALID_REQUEST", "Invalid workspace ID", 400);
  }
  const { room, userId, canView } = await getRoomAccess(params.id);
  if (!userId) return v1Error("UNAUTHORIZED", "Sign in to continue", 401);
  // Do not reveal whether a private room exists to a non-member.
  if (!room || !canView) return v1Error("NOT_FOUND", "Workspace not found", 404);
  try {
    const member = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId: room.id } },
      select: { role: true },
    });
    return v1Json({
      id: room.id, name: room.name, ownerId: room.ownerId,
      role: room.ownerId === userId ? "OWNER" :
        member?.role === "ADMIN" ? "ADMIN" : "MEMBER",
      revision: null,
    });
  } catch {
    return v1Error("UNAVAILABLE", "Could not load workspace", 503);
  }
}
