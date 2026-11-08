import { prisma } from "@/lib/prisma";
import { getRoomAccess } from "@/lib/spaceAccess";
import { v1Error, v1Json } from "@/lib/cloud/server-response";
export const dynamic = "force-dynamic";

/** M02 read-only compatibility snapshot. M13 adds real ordered operations
 * and a monotonic revision. Do not claim safe write replay before then. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 128) return v1Error("INVALID_REQUEST", "Invalid workspace", 400);
  const { userId, room, role } = await getRoomAccess(id);
  if (!userId) return v1Error("UNAUTHORIZED", "Sign in to continue", 401);
  if (!room || !role) return v1Error("NOT_FOUND", "Workspace not found", 404);
  try {
    const widgets = await prisma.widget.findMany({
      where: { roomId: id },
      select: { id:true, title:true, type:true, x:true, y:true, w:true, h:true,
        createdBy:true },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    return v1Json({
      workspaceId: id,
      revision: null,
      synchronization: "legacy-unversioned",
      operations: [],
      widgets: widgets.map(widget => ({
        id: widget.id,
        workspaceId: id,
        kind: widget.type === "live-tab" ? "live" :
          widget.type === "shared-browser" ? "shared" : "personal",
        title: widget.createdBy && widget.createdBy !== userId &&
          widget.type !== "live-tab" && widget.type !== "shared-browser"
          ? "Private tab" : widget.title,
        geometry: { x:widget.x, y:widget.y, width:widget.w, height:widget.h, zIndex:0 },
        version: null,
      })),
    });
  } catch {
    return v1Error("UNAVAILABLE", "Snapshot unavailable", 503);
  }
}
