import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rooms are account-bound: rooms the user owns or is a member of.
    // Every room is private and can only be entered with its code.
    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        _count: {
          select: { members: true, widgets: true },
        },
        // The current user's membership, used to order by "recently joined".
        members: {
          where: { userId },
          select: { joinedAt: true },
        },
      },
    });

    // Most recently joined room first (owners fall back to room creation time).
    rooms.sort((a, b) => {
      const aTime = (a.members[0]?.joinedAt ?? a.createdAt).getTime();
      const bTime = (b.members[0]?.joinedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

    return NextResponse.json(
      rooms.map((room) => ({
        id: room.id,
        name: room.name,
        avatar: room.avatar || null,
        description: room.description,
        isPublic: room.isPublic,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        ownerId: room.ownerId,
        memberCount: room._count.members,
        widgetCount: room._count.widgets,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch rooms:", error);
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, avatar } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Space name is required" }, { status: 400 });
    }

    // Ensure a local User record exists for the Clerk user (FK constraint on ownerId)
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress || `${userId}@clerk.local`;
      const displayName = clerkUser.fullName || clerkUser.username || email.split("@")[0];

      await prisma.user.upsert({
        where: { id: userId },
        update: { email, name: displayName, avatar: clerkUser.imageUrl },
        create: { id: userId, email, name: displayName, avatar: clerkUser.imageUrl },
      });
    } catch (userError) {
      console.error("Failed to sync Clerk user:", userError);
      return NextResponse.json({ error: "Failed to authenticate user: " + (userError as Error).message }, { status: 500 });
    }

    try {
      const room = await prisma.room.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          avatar: avatar || null,
          isPublic: false,
          ownerId: userId,
          members: {
            create: {
              userId,
              role: "OWNER",
            },
          },
        },
      });

      return NextResponse.json(room);
    } catch (roomError) {
      console.error("Failed to create room:", roomError);
      return NextResponse.json({ error: "Failed to create room: " + (roomError as Error).message }, { status: 500 });
    }
  } catch (error) {
    console.error("Failed to create room:", error);
    return NextResponse.json({ error: "Failed to create room: " + (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }
    if (room.ownerId !== userId) {
      return NextResponse.json({ error: "Only the room owner can delete this room" }, { status: 403 });
    }

    // Remove children first to avoid foreign key constraint errors.
    await prisma.$transaction([
      prisma.widget.deleteMany({ where: { roomId } }),
      prisma.roomMember.deleteMany({ where: { roomId } }),
      prisma.room.delete({ where: { id: roomId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete room:", error);
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 });
  }
}