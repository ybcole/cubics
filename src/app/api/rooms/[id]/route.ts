import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { userId } = auth();

  try {
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true, widgets: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // All rooms are private: only the owner and members may view them.
    let canView = !!userId && room.ownerId === userId;
    if (!canView && userId) {
      const member = await prisma.roomMember.findUnique({
        where: { userId_roomId: { userId, roomId: id } },
      });
      canView = !!member;
    }
    if (!canView) {
      return NextResponse.json({ error: "This room is private" }, { status: 403 });
    }

    return NextResponse.json({
      id: room.id,
      name: room.name,
      description: room.description,
      isPublic: room.isPublic,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      ownerId: room.ownerId,
      memberCount: room._count.members,
      widgetCount: room._count.widgets,
    });
  } catch (error) {
    console.error("Failed to fetch room:", error);
    return NextResponse.json({ error: "Failed to fetch room" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Room name is required" }, { status: 400 });
  }

  try {
    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Only owner can rename
    if (room.ownerId !== userId) {
      return NextResponse.json({ error: "Only the room owner can rename" }, { status: 403 });
    }

    const updated = await prisma.room.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json({ id: updated.id, name: updated.name });
  } catch (error) {
    console.error("Failed to rename room:", error);
    return NextResponse.json({ error: "Failed to rename room" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (room.ownerId !== userId) {
      return NextResponse.json({ error: "Only the room owner can delete this room" }, { status: 403 });
    }

    await prisma.widget.deleteMany({ where: { roomId: id } });
    await prisma.room.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete room:", error);
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let room = await prisma.room.findUnique({
      where: { id },
    });

    // Accept short room codes (prefix of the id, e.g. first 8 chars)
    if (!room && id.length >= 4) {
      const matches = await prisma.room.findMany({
        where: { id: { startsWith: id } },
        take: 2,
      });
      if (matches.length === 1) room = matches[0];
    }

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Ensure local User record exists
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
      return NextResponse.json({ error: "Failed to authenticate user" }, { status: 500 });
    }

    // Add as member (idempotent)
    await prisma.roomMember.upsert({
      where: {
        userId_roomId: { userId, roomId: room.id },
      },
      create: { userId, roomId: room.id, role: "MEMBER" },
      update: {},
    });

    return NextResponse.json({ success: true, roomId: room.id });
  } catch (error) {
    console.error("Failed to join room:", error);
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }
}
