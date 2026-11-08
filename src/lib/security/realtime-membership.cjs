"use strict";

/* Temporary M01/M03 implementation in the realtime process.
 * M02 will move privileged DB authority behind the hosted API.
 * Fail closed on missing DATABASE_URL, query errors or missing membership. */
let prisma;

async function checkRoomMembership(userId, roomId) {
  if (typeof userId !== "string" || !userId || typeof roomId !== "string" || !roomId) return false;
  if (!prisma) {
    const { PrismaClient } = require("@prisma/client");
    prisma = new PrismaClient();
  }
  const room = await prisma.room.findFirst({
    where: { id: roomId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  return !!room;
}

module.exports = { checkRoomMembership };
