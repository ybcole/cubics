import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoomAccess } from "@/lib/spaceAccess";
import { canRoomAction } from "@/lib/security/room-policy.cjs";
import { redactWidgetForViewer } from "@/lib/security/widget-privacy.cjs";

type Params = { params: Promise<{ id: string }> };
type WidgetPatch = {
  id: string;
  x?: number; y?: number; w?: number; h?: number; url?: string;
};
const writableFields = ["x", "y", "w", "h", "url"] as const;
const kinds = new Set(["iframe", "tab-share", "shared-browser", "live-tab"]);

function validNumber(value: unknown, dimension = false): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    Math.abs(value) <= 10_000_000 &&
    (!dimension || (value > 0 && value <= 10_000));
}
function validTabUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  if (value === "tab-share" || value === "about:blank") return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password;
  } catch { return false; }
}
function forbidden() {
  return NextResponse.json({ error: "Insufficient workspace permissions" }, { status: 403 });
}
function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { userId, room, canView } = await getRoomAccess(id);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!room || !canView) return NextResponse.json({ error: "Space not found" }, { status: 404 });
  try {
    const widgets = await prisma.widget.findMany({
      where: { roomId: id }, orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(widgets.map(widget => redactWidgetForViewer(widget, userId)), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch widgets" }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { userId, room, role } = await getRoomAccess(id);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!room || !role) return forbidden();
  if (!canRoomAction(role, "widget.create")) return forbidden();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.title !== "string" ||
      !body.title.trim() || body.title.length > 200 ||
      !validTabUrl(body.url) ||
      (body.type !== undefined && !kinds.has(body.type))) {
    return invalid("Invalid widget title, URL or type");
  }
  const x = body.x ?? 0, y = body.y ?? 0, w = body.w ?? 4, h = body.h ?? 4;
  if (!validNumber(x) || !validNumber(y) || !validNumber(w, true) || !validNumber(h, true)) {
    return invalid("Invalid widget geometry");
  }
  try {
    const widget = await prisma.widget.create({
      data: {
        title: body.title.trim(), url: body.url, type: body.type ?? "iframe",
        x, y, w, h, roomId: id, createdBy: userId,
      },
    });
    return NextResponse.json(widget);
  } catch {
    return NextResponse.json({ error: "Failed to create widget" }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: roomId } = await params;
  const { userId, room, role } = await getRoomAccess(roomId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!room || !role) return forbidden();
  const updates: unknown = await request.json().catch(() => null);
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 100) {
    return invalid("Expected 1 to 100 widget updates");
  }
  const changes: WidgetPatch[] = [];
  for (const payload of updates) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return invalid("Invalid widget patch");
    const item = payload as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id || item.id.length > 128 ||
        Object.keys(item).some(key => key !== "id" && !writableFields.includes(key as typeof writableFields[number]))) {
      return invalid("Unexpected widget field");
    }
    const data: WidgetPatch = { id: item.id };
    for (const field of ["x", "y", "w", "h"] as const) {
      if (item[field] !== undefined) {
        if (!validNumber(item[field], field === "w" || field === "h")) return invalid("Invalid widget geometry");
        data[field] = item[field];
      }
    }
    if (item.url !== undefined) {
      if (!validTabUrl(item.url)) return invalid("Invalid widget URL");
      data.url = item.url;
    }
    if (Object.keys(data).length === 1) return invalid("Nothing to update");
    changes.push(data);
  }
  if (new Set(changes.map(item => item.id)).size !== changes.length) return invalid("Duplicate widget ID");
  try {
    const owned = await prisma.widget.findMany({
      where: { roomId, id: { in: changes.map(item => item.id) } },
      select: { id: true, createdBy: true },
    });
    if (owned.length !== changes.length) return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    for (const widget of owned) {
      if (!canRoomAction(role, "widget.modify", {
        ownsWidget: widget.createdBy === userId,
        legacyUnowned: widget.createdBy === null,
      })) return forbidden();
    }
    const results = await prisma.$transaction(
      changes.map(({ id, ...data }) => prisma.widget.updateMany({
        where: { id, roomId }, data,
      }))
    );
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Failed to update widgets" }, { status: 503 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: roomId } = await params;
  const { userId, room, role } = await getRoomAccess(roomId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!room || !role) return forbidden();
  const widgetId = new URL(request.url).searchParams.get("widgetId");
  if (!widgetId || widgetId.length > 128) return invalid("widgetId required");
  try {
    const widget = await prisma.widget.findFirst({
      where: { id: widgetId, roomId }, select: { id: true, createdBy: true },
    });
    if (!widget) return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    if (!canRoomAction(role, "widget.delete", {
      ownsWidget: widget.createdBy === userId,
      legacyUnowned: widget.createdBy === null,
    })) return forbidden();
    await prisma.widget.deleteMany({ where: { id: widgetId, roomId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete widget" }, { status: 503 });
  }
}
