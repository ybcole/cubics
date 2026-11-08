import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export type RoomRole = "OWNER" | "ADMIN" | "MEMBER" | null;

export interface RoomAccess {
  userId: string | null;
  room: Awaited<ReturnType<typeof prisma.room.findUnique>>;
  role: RoomRole;
  isOwner: boolean;
  isMember: boolean;
  canView: boolean;
}

/** All role information originates from the authoritative server database.
 * A client-supplied room role, creatorId or invite claim is never trusted. */
export async function getRoomAccess(roomId: string): Promise<RoomAccess> {
  const { userId } = await auth();
  if (!userId || !roomId) {
    return { userId, room: null, role: null, isOwner: false, isMember: false, canView: false };
  }
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    return { userId, room: null, role: null, isOwner: false, isMember: false, canView: false };
  }
  const isOwner = room.ownerId === userId;
  const membership = isOwner ? null : await prisma.roomMember.findUnique({
    where: { userId_roomId: { userId, roomId } },
    select: { role: true },
  });
  const role: RoomRole = isOwner ? "OWNER" : !membership ? null :
    membership.role === "ADMIN" ? "ADMIN" : "MEMBER";
  const isMember = role !== null;
  return { userId, room, role, isOwner, isMember, canView: isMember };
}
