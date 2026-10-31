import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoomAccess } from "@/lib/spaceAccess";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

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
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json(
      members.map((m) => ({
        userId: m.userId,
        name: m.user?.name || m.user?.email?.split("@")[0] || "Member",
        email: m.user?.email || null,
        avatar: m.user?.avatar || null,
        role: m.role,
        joinedAt: m.joinedAt,
        isOwner: room.ownerId === m.userId,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}
