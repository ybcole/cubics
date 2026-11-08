import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { v1Error, v1Json } from "@/lib/cloud/server-response";

export const dynamic = "force-dynamic";

/** Read-only v1 compatibility endpoint. This currently lives in the legacy
 * Next process; M02 moves it to the hosted API before production flag flip. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return v1Error("UNAUTHORIZED", "Sign in to continue", 401);
  try {
    const rooms = await prisma.room.findMany({
      where: { OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ] },
      select: {
        id: true, name: true, ownerId: true, updatedAt: true,
        members: { where: { userId }, select: { role: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return v1Json({
      items: rooms.map(room => ({
        id: room.id,
        name: room.name,
        ownerId: room.ownerId,
        role: room.ownerId === userId ? "OWNER" :
          room.members[0]?.role === "ADMIN" ? "ADMIN" : "MEMBER",
        // Room/Widget schema has no monotonic revision yet. Do not fabricate one.
        revision: null,
      })),
      cursor: null,
    });
  } catch {
    return v1Error("UNAVAILABLE", "Could not load workspaces", 503);
  }
}
