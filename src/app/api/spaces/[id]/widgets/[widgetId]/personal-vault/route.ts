import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoomAccess } from "@/lib/spaceAccess";
import { createHash } from "node:crypto";

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

// Destructive per-tab cloud copy cleanup is never automatic. The trusted
// Electron flow requires a verified local encrypted destination, a portable
// recovery export, and explicit native confirmation before calling this API.
// Server enforces current owner/room identity and optimistic URL equality.
export async function POST(request: Request, { params }: Context) {
  const { id: roomId, widgetId } = await params;
  const { userId, role } = await getRoomAccess(roomId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!role || !/^[a-zA-Z0-9_-]{3,128}$/.test(widgetId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (body?.confirmation !== "REMOVE_LEGACY_PERSONAL_URL" ||
      typeof body.urlFingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(body.urlFingerprint)) {
    return NextResponse.json({ error: "Explicit recovery confirmation required" },
      { status: 400 });
  }
  const widget = await prisma.widget.findFirst({
    where: { id: widgetId, roomId, createdBy: userId, type: "iframe" },
    select: { id: true, url: true },
  });
  if (!widget) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (widget.url === "about:blank") {
    return NextResponse.json({ scrubbed: false, alreadyClean: true },
      { headers: { "Cache-Control": "private, no-store" } });
  }
  const fingerprint = createHash("sha256").update(widget.url).digest("hex");
  if (body.urlFingerprint !== fingerprint) {
    return NextResponse.json({ error: "Cloud destination changed; retry required" },
      { status: 409 });
  }
  const updated = await prisma.widget.updateMany({
    where: { id: widgetId, roomId, createdBy: userId, type: "iframe", url: widget.url },
    data: { url: "about:blank", title: "Private tab" },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "Cloud destination changed; retry required" },
      { status: 409 });
  }
  return NextResponse.json({ scrubbed: true }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
