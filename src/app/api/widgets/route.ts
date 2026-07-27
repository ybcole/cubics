import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const widgets = await prisma.widget.findMany({
      include: { room: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      widgets.map((w) => ({
        id: w.id,
        title: w.title,
        url: w.url,
        w: w.w,
        h: w.h,
        roomId: w.roomId,
        roomName: w.room.name,
        createdAt: w.createdAt,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch all widgets:", error);
    return NextResponse.json({ error: "Failed to fetch widgets" }, { status: 500 });
  }
}
