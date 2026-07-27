import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        _count: {
          select: { members: true, widgets: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      rooms.map((room) => ({
        id: room.id,
        name: room.name,
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
    const { name, description, isPublic } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 });
    }

    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isPublic: !!isPublic,
      },
    });

    return NextResponse.json(room);
  } catch (error) {
    console.error("Failed to create room:", error);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    // remove widgets first to avoid foreign key constraint errors
    await prisma.widget.deleteMany({ where: { roomId } });

    await prisma.room.delete({ where: { id: roomId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete room:", error);
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 });
  }
}