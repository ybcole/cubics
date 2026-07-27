import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
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
  const { title, url, x, y, w, h } = await request.json();

  try {
    const widget = await prisma.widget.create({
      data: {
        title,
        url,
        x: x || 0,
        y: y || 0,
        w: w || 4,
        h: h || 4,
        roomId: id,
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
  const updates: { id: string; x?: number; y?: number; w?: number; h?: number; url?: string }[] = await request.json();

  try {
    const results = await Promise.all(
      updates.map(({ id, ...rest }) =>
        prisma.widget.update({
          where: { id },
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
  const { searchParams } = new URL(request.url);
  const widgetId = searchParams.get("widgetId");

  if (!widgetId) {
    return NextResponse.json({ error: "widgetId query param required" }, { status: 400 });
  }

  try {
    await prisma.widget.delete({ where: { id: widgetId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete widget:", error);
    return NextResponse.json({ error: "Failed to delete widget" }, { status: 500 });
  }
}