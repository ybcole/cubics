import { prisma } from "@/lib/prisma";
import { getRoomAccess } from "@/lib/spaceAccess";
import { v1Error, v1Json } from "@/lib/cloud/server-response";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 128) {
    return v1Error("INVALID_REQUEST", "Invalid workspace ID", 400);
  }
  const { userId, room, canView } = await getRoomAccess(id);
  if (!userId) return v1Error("UNAUTHORIZED", "Sign in to continue", 401);
  if (!room || !canView) return v1Error("NOT_FOUND", "Workspace not found", 404);
  try {
    const widgets = await prisma.widget.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: {
        id:true, roomId:true, type:true, title:true, url:true,
        createdBy:true, x:true, y:true, w:true, h:true,
      },
    });
    return v1Json({
      items: widgets.map(widget => {
        const personal = widget.type !== "live-tab" && widget.type !== "shared-browser";
        const canReadPersonalMetadata = widget.createdBy === userId;
        let safeUrl: string | undefined;
        if (!personal || canReadPersonalMetadata) {
          try {
            const url = new URL(widget.url);
            if (url.protocol === "https:" || url.protocol === "http:") {
              safeUrl = url.origin + url.pathname;
            }
          } catch { /* No URL metadata for special widgets. */ }
        }
        return {
          id: widget.id, workspaceId:widget.roomId,
          kind:widget.type === "live-tab" ? "live" :
            widget.type === "shared-browser" ? "shared" : "personal",
          title:personal && !canReadPersonalMetadata ? "Private tab" : widget.title,
          geometry:{ x:widget.x, y:widget.y, width:widget.w, height:widget.h, zIndex:0 },
          version:0, // Explicit unversioned legacy compatibility data.
          ...(safeUrl ? { safeUrl } : {}),
        };
      }),
      cursor:null,
    });
  } catch {
    return v1Error("UNAVAILABLE", "Could not load widgets", 503);
  }
}
