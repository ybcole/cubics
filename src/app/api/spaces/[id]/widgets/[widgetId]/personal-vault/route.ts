import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoomAccess } from "@/lib/spaceAccess";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; widgetId: string }> };

/** Owner-only legacy import endpoint for the Electron main process.
 * No profile or browser navigation is authorized by room membership alone.
 * Does NOT change PostgreSQL until the device-local vault is proven durable.
 */
export async function GET(_request: Request, { params }: Context) {
  const { id: roomId, widgetId } = await params;
  const { userId, role } = await getRoomAccess(roomId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!role || !/^[a-zA-Z0-9_-]{3,128}$/.test(widgetId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const widget = await prisma.widget.findFirst({
    where: { id: widgetId, roomId, createdBy: userId, type: "iframe" },
    select: { id: true, url: true },
  });
  if (!widget) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Expose legacy URL only to its authenticated owner. An untrusted
  // renderer can never use this response to read someone else's tab.
  return NextResponse.json({ legacyUrl: widget.url }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
