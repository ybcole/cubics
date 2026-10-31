import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export interface RoomAccess {
  userId: string | null;
  room: Awaited<ReturnType<typeof prisma.room.findUnique>>;
  isOwner: boolean;
  isMember: boolean;
  canView: boolean;
}

export async function getRoomAccess(roomId: string): Promise<RoomAccess> {
  const { userId } = auth();
  const room = await prisma.room.findUnique({ where: { id: roomId } });

  if (!room) {
    return { userId, room: null, isOwner: false, isMember: false, canView: false };
  }

  const isOwner = !!userId && room.ownerId === userId;
  let isMember = isOwner;
  if (userId && !isMember) {
    const member = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    isMember = !!member;
  }

  // All rooms are private: only the owner and members can view them.
  const canView = isMember;

  return { userId, room, isOwner, isMember, canView };
}
