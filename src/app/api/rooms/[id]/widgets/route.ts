import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoomAccess } from "@/lib/roomAccess";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const { room, canView } = await getRoomAccess(id);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (!canView) {
      return NextResponse.json({ error: "This room is private" }, { status: 403 });
    }

    const widgets = await prisma.widget.findMany({
      where: { roomId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(widgets);
  } catch (error) {
    console.error("Failed to fetch widgets:", error);
    return NextResponse.json({ error: "Failed to fetch widgets" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { userId, room, canView } = await getRoomAccess(id);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canView) {
    return NextResponse.json({ error: "This room is private" }, { status: 403 });
  }

  const { title, url, x, y, w, h, type } = await request.json();
  const widgetType = ["iframe", "tab-share", "shared-browser", "live-tab"].includes(type)
    ? type
    : "iframe";

  try {
    const widget = await prisma.widget.create({
      data: {
        title,
        url,
        type: widgetType,
        x: x || 0,
        y: y || 0,
        w: w || 4,
        h: h || 4,
        roomId: id,
        createdBy: userId,
      },
    });

    return NextResponse.json(widget);
  } catch (error) {
    console.error("Failed to create widget:", error);
    return NextResponse.json({ error: "Failed to create widget" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { id: roomId } = params;
  const { userId, room, canView } = await getRoomAccess(roomId);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canView) {
    return NextResponse.json({ error: "This room is private" }, { status: 403 });
  }

  const updates: { id: string; x?: number; y?: number; w?: number; h?: number; url?: string }[] = await request.json();

  try {
    // Scope updates to widgets that belong to this room.
    const results = await Promise.all(
      updates.map(({ id, ...rest }) =>
        prisma.widget.updateMany({
          where: { id, roomId },
          data: rest,
        })
      )
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to update widgets:", error);
    return NextResponse.json({ error: "Failed to update widgets" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { id: roomId } = params;
  const { userId, room, canView } = await getRoomAccess(roomId);
  const { searchParams } = new URL(request.url);
  const widgetId = searchParams.get("widgetId");

  if (!widgetId) {
    return NextResponse.json({ error: "widgetId query param required" }, { status: 400 });
  }
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canView) {
    return NextResponse.json({ error: "This room is private" }, { status: 403 });
  }

  try {
    const widget = await prisma.widget.findUnique({ where: { id: widgetId } });
    if (!widget || widget.roomId !== roomId) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }
    await prisma.widget.delete({ where: { id: widgetId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete widget:", error);
    return NextResponse.json({ error: "Failed to delete widget" }, { status: 500 });
  }
}
