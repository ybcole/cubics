"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { useParams, useRouter } from "next/navigation";

import { useUser } from "@clerk/nextjs";
import io from "socket.io-client";
import { Rnd } from "react-rnd";
import {
  ArrowLeft,
  RotateCw,
  Trash2,
  GripVertical,
  Send,
  MessageCircle,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  MonitorOff,
  Globe,
  Camera,
  Users,
  User,
  Copy,
  Check,
  Mic,
  MicOff,
  Edit2,
  MonitorSmartphone, X } from "lucide-react";
import type { Widget } from "@/types";
import { Modal } from "@/components/ui/Modal";
import TabShareWidget from "@/components/TabShareWidget";
import { injectLiveTabScript } from "@/components/LiveTabScript";

const CANVAS_W = 100000;
const CANVAS_H = 100000;
const DEFAULT_W = 800;
const DEFAULT_H = 600;

interface ChatMessage {
  id: string;
  content: string;
  userName: string;
  createdAt: string;
}

export default function RoomCanvasPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.id as string) || "";
  const { user: clerkUser, isLoaded } = useUser();
  const userName = clerkUser?.fullName || clerkUser?.firstName || clerkUser?.emailAddresses?.[0]?.emailAddress || "You";
  const clerkUserId = clerkUser?.id;
  const clerkUserImageUrl = clerkUser?.imageUrl ?? null;
  const userNameRef = useRef(userName);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"members" | "chat">("members");
  const [members, setMembers] = useState<any[]>([]);
  const [presenceMembers, setPresenceMembers] = useState<any[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, { x: number; y: number; userName: string; color: string }>>(new Map());
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const membersRef = useRef<HTMLDivElement>(null);
  const roomAvatarInputRef = useRef<HTMLInputElement>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [copied, setCopied] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomAvatar, setRoomAvatar] = useState<string | null>(null);
  const [roomOwnerId, setRoomOwnerId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [showTabPicker, setShowTabPicker] = useState(false);
  const [pendingUrl, setPendingUrl] = useState("");
  const [zOrder, setZOrder] = useState<string[]>([]);
  const widgetsRef = useRef<Widget[]>([]);
  const [isPanningActive, setIsPanningActive] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const scrollAtStart = useRef({ x: 0, y: 0 });
  const mainRef = useRef<HTMLDivElement>(null);
  const mainSocketRef = useRef<any>(null);
  const zoomRef = useRef(1);
  const [zoom, _setZoom] = useState(1);
  const [micOn, setMicOn] = useState(false);

  const viewRef = useRef({ scrollLeft: 0, scrollTop: 0, zoom: 1 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveView = useCallback(() => {
    if (typeof window === "undefined") return;
    viewRef.current.zoom = zoomRef.current;
    try {
      localStorage.setItem(`cubics:view:${roomId}`, JSON.stringify(viewRef.current));
    } catch {}
  }, [roomId]);

  const scheduleSaveView = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveView, 150);
  }, [saveView]);

  const handleScroll = useCallback(() => {
    const main = mainRef.current;
    if (!main) return;
    viewRef.current.scrollLeft = main.scrollLeft;
    viewRef.current.scrollTop = main.scrollTop;
    scheduleSaveView();
  }, [scheduleSaveView]);

  useEffect(() => {
    if (typeof window === "undefined" || !roomId) return;
    let raf1 = 0, raf2 = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;
    try {
      const raw = localStorage.getItem(`cubics:view:${roomId}`);
      if (!raw) return;
      const v = JSON.parse(raw);
      const restoredZoom = typeof v.zoom === "number" ? v.zoom : 1;
      viewRef.current = {
        scrollLeft: Number(v.scrollLeft) || 0,
        scrollTop: Number(v.scrollTop) || 0,
        zoom: restoredZoom,
      };
      zoomRef.current = restoredZoom;
      _setZoom(restoredZoom);
      const applyScroll = () => {
        const main = mainRef.current;
        if (!main) {
          retry = setTimeout(applyScroll, 50);
          return;
        }
        main.scrollLeft = viewRef.current.scrollLeft;
        main.scrollTop = viewRef.current.scrollTop;
      };
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(applyScroll);
      });
    } catch {}
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (retry) clearTimeout(retry);
    };
  }, [roomId]);

  useEffect(() => {
    const onHide = () => saveView();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveView();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [saveView]);

  const isOwner = !!clerkUser && roomOwnerId === clerkUser.id;

  const handleRoomAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isOwner) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setRoomAvatar(dataUrl);
      try {
        const res = await fetch(`/api/rooms/${roomId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar: dataUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          setRoomAvatar(data.avatar || dataUrl);
        }
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
    if (roomAvatarInputRef.current) roomAvatarInputRef.current.value = "";
  };

  const isMemberActive = useCallback((m: any) => {
    return presenceMembers.some((p: any) => (p.userId && p.userId === m.userId) || p.userName === m.name);
  }, [presenceMembers]);

  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/rooms/${roomId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setRoomName(data.name || "");
          setRoomAvatar(data.avatar || null);
          setRoomOwnerId(data.ownerId || null);
        }
      })
      .catch(console.error);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/rooms/${roomId}/members`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setRoomMembers(data);
      })
      .catch(console.error);
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !clerkUserId) return;
    let socket: any;
    let cancelled = false;
    const cursorTimeouts = new Map<string, any>();
    import("socket.io-client").then(({ default: io }) => {
      if (cancelled) return;
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://127.0.0.1:3001", { transports: ["websocket"] });
      mainSocketRef.current = socket;
      (window as any).__CUBICS_SOCKET__ = socket;

      const joinRoom = () => {
        socket.emit("room:join", {
          roomId,
          userName,
          imageUrl: clerkUserImageUrl,
          userId: clerkUserId,
          roomName: roomId,
        });
      };
      socket.on("connect", joinRoom);
      if (socket.connected) joinRoom();

      socket.on("presence:update", ({ roomId: rid, members }: { roomId: string; members: any[] }) => {
        if (rid !== roomId) return;
        setPresenceMembers(Array.isArray(members) ? members : []);
      });

      socket.on("cursor:move", ({ id, x, y, userName: cursorUserName, color, userId: cursorUserId }: { id: string; x: number; y: number; userName: string; color: string; userId?: string }) => {
        if (cursorUserId && clerkUserId && cursorUserId === clerkUserId) return;
        setRemoteCursors(prev => {
          const next = new Map(prev);
          next.set(id, { x, y, userName: cursorUserName, color });
          return next;
        });
        if (cursorTimeouts.has(id)) clearTimeout(cursorTimeouts.get(id));
        cursorTimeouts.set(id, setTimeout(() => {
          setRemoteCursors(prev => {
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
          cursorTimeouts.delete(id);
        }, 3000));
      });

      socket.on("cursor:leave", ({ id }: { id: string }) => {
        setRemoteCursors(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        if (cursorTimeouts.has(id)) {
          clearTimeout(cursorTimeouts.get(id));
          cursorTimeouts.delete(id);
        }
      });

      socket.on("widget:add", (widget: any) => {
        if (!widget || typeof widget.id !== "string") return;
        setWidgets(prev => (prev.some(w => w.id === widget.id) ? prev : [...prev, {
          ...widget,
          type: widget.url === "tab-share" ? ("tab-share" as const) : (widget.type || "iframe" as const),
          x: widget.x ?? 0,
          y: widget.y ?? 0,
          w: widget.w ?? DEFAULT_W,
          h: widget.h ?? DEFAULT_H,
        }]));
      });

      socket.on("widget:update", (patch: any) => {
        if (!patch || typeof patch.id !== "string") return;
        if (patch.id === (window as any).__CUBICS_DRAGGING_ID__) return;
        setWidgets(prev => prev.map(w => w.id === patch.id ? { ...w, ...patch } : w));
      });

      socket.on("widget:delete", (id: string) => {
        setWidgets(prev => prev.filter(w => w.id !== id));
        setZOrder(prev => prev.filter(z => z !== id));
      });
    });
    return () => {
      cancelled = true;
      mainSocketRef.current = null;
      (window as any).__CUBICS_SOCKET__ = null;
      socket?.disconnect();
    };
  }, [roomId, clerkUserId, clerkUserImageUrl, userName]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (membersRef.current && !membersRef.current.contains(e.target as Node)) {
        setShowMembers(false);
      }
    };
    if (showMembers) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMembers]);

  const setZoom = useCallback((updater: number | ((z: number) => number)) => {
    _setZoom(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      zoomRef.current = next;
      return next;
    });
  }, []);

  const zoomSaveReady = useRef(false);
  useEffect(() => {
    if (!zoomSaveReady.current) {
      zoomSaveReady.current = true;
      return;
    }
    scheduleSaveView();
  }, [zoom, scheduleSaveView]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveView();
    };
  }, [saveView]);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}/widgets`)
      .then((res) => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const parsed = data.map(w => ({
            ...w,
            type: w.url === "tab-share" ? ("tab-share" as const) : ("iframe" as const),
            x: w.x ?? 0,
            y: w.y ?? 0,
            w: w.w ?? DEFAULT_W,
            h: w.h ?? DEFAULT_H,
          }));
          setWidgets(parsed);
          setZOrder(parsed.map(w => w.id));
        }
      })
      .catch(console.error);
  }, [roomId]);

  useEffect(() => { widgetsRef.current = widgets; }, [widgets]);

  const handlePanStart = (e: React.PointerEvent) => {
    if ((e.target as Element).closest(".widget-card, .widget-drag-handle, .react-rnd")) return;
    isPanning.current = true;
    setIsPanningActive(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    const main = mainRef.current!;
    scrollAtStart.current = { x: main.scrollLeft, y: main.scrollTop };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const lastCursorEmit = useRef(0);
  const handlePanMove = (e: React.PointerEvent) => {
    if (isPanning.current) {
      const main = mainRef.current!;
      main.scrollLeft = scrollAtStart.current.x - (e.clientX - panStart.current.x);
      main.scrollTop = scrollAtStart.current.y - (e.clientY - panStart.current.y);
    }
    const now = Date.now();
    if (now - lastCursorEmit.current < 16) return;
    lastCursorEmit.current = now;
    const main = mainRef.current;
    if (!main) return;
    const rect = main.getBoundingClientRect();
    const zoomVal = zoomRef.current;
    const x = (main.scrollLeft + (e.clientX - rect.left)) / zoomVal;
    const y = (main.scrollTop + (e.clientY - rect.top)) / zoomVal;
    const color = "#3b82f6";
    mainSocketRef.current?.emit("cursor:move", { x, y, userName, color, userId: clerkUser?.id });
  };

  const handlePanEnd = (e: React.PointerEvent) => {
    if (!isPanning.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    isPanning.current = false;
    setIsPanningActive(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const main = mainRef.current!;
      const oldZoom = zoomRef.current;
      const delta = e.deltaY > 0 ? -1 : 1;
      const newZoom = Math.max(0.1, Math.min(5, oldZoom + delta * 0.05));
      const rect = main.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const canvasX = main.scrollLeft + mouseX;
      const canvasY = main.scrollTop + mouseY;
      zoomRef.current = newZoom;
      _setZoom(newZoom);
      requestAnimationFrame(() => {
        main.scrollLeft = canvasX * (newZoom / oldZoom) - mouseX;
        main.scrollTop = canvasY * (newZoom / oldZoom) - mouseY;
      });
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setChatMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      content: newMessage,
      userName: "You",
      createdAt: new Date().toISOString(),
    }]);
    setNewMessage("");
  };

  const getCenterCanvasPos = useCallback((widgetW: number, widgetH: number) => {
    const main = mainRef.current;
    if (!main) return { x: 0, y: 0 };
    const z = zoomRef.current;
    const centerX = (main.scrollLeft + main.clientWidth / 2) / z;
    const centerY = (main.scrollTop + main.clientHeight / 2) / z;
    const x = Math.max(0, Math.min(CANVAS_W - widgetW, centerX - widgetW / 2));
    const y = Math.max(0, Math.min(CANVAS_H - widgetH, centerY - widgetH / 2));
    return { x, y };
  }, []);

  const addWidgetFromUrl = async ({ title, url, w, h }: { title: string; url: string; w: number; h: number }) => {
    const { x, y } = getCenterCanvasPos(w, h);
    try {
      const res = await fetch(`/api/rooms/${roomId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url, x, y, w, h }),
      });
      if (res.ok) {
        const widget = await res.json();
        setWidgets(prev => [...prev, { ...widget, x: widget.x ?? x, y: widget.y ?? y, w: widget.w ?? w, h: widget.h ?? h }]);
        setZOrder(prev => [...prev.filter(id => id !== widget.id), widget.id]);
      }
    } catch (err) { console.error(err); }
  };

  const openInNewWidget = useCallback(async (url: string) => {
    const w = DEFAULT_W, h = DEFAULT_H;
    const { x, y } = getCenterCanvasPos(w, h);
    const title = (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return url.slice(0, 40); } })();
    try {
      const res = await fetch(`/api/rooms/${roomId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url, x, y, w, h }),
      });
      if (res.ok) {
        const widget = await res.json();
        setWidgets(prev => [...prev, { ...widget, x: widget.x ?? x, y: widget.y ?? y, w: widget.w ?? w, h: widget.h ?? h }]);
        setZOrder(prev => [...prev.filter(id => id !== widget.id), widget.id]);
      }
    } catch (err) { console.error(err); }
  }, [roomId, getCenterCanvasPos]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (data?.type === "URL_CHANGED" && typeof data.url === "string") {
        setWidgets(prev => prev.map(w => {
          const el = document.querySelector(`iframe[data-widget-id="${w.id}"]`) as HTMLIFrameElement | null;
          if (el && el.contentWindow === e.source) {
            fetch(`/api/rooms/${roomId}/widgets`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify([{ id: w.id, url: data.url }]),
            }).catch(console.error);
            return { ...w, url: data.url };
          }
          return w;
        }));
      }
      if (data?.type === "OPEN_URL" && typeof data.url === "string") {
        openInNewWidget(data.url);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [openInNewWidget, roomId]);

  const addLiveTab = async (url: string) => {
    const w = DEFAULT_W, h = DEFAULT_H;
    const { x, y } = getCenterCanvasPos(w, h);
    const title = (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return url.slice(0, 40); } })();
    const tempId = `temp-live-${Date.now()}`;
    const newWidget: Widget = { id: tempId, title, url, type: "live-tab", x, y, w, h, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), roomId };
    setWidgets(prev => [...prev, newWidget]);
    setZOrder(prev => [...prev, tempId]);
    try {
      const res = await fetch(`/api/rooms/${roomId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url, x, y, w, h, type: "live-tab" }),
      });
      if (res.ok) {
        const widget = await res.json();
        setWidgets(prev => prev.map(wgt => wgt.id === tempId ? { ...wgt, id: widget.id } : wgt));
        setZOrder(prev => prev.map(z => z === tempId ? widget.id : z));
      }
    } catch (err) { console.error(err); }
  };

  const addSharedBrowserWidget = () => {
    const id = `sb-${Date.now()}`;
    const newWidget: Widget = {
      id,
      type: "shared-browser" as any,
      title: "Shared browser",
      url: "",
      x: 100,
      y: 100,
      w: 900,
      h: 600,
      roomId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setWidgets((prev: Widget[]) => [...prev, newWidget]);
    setZOrder((prev: string[]) => [...prev.filter((z) => z !== id), id]);
          if ((window as any).__CUBICS_SOCKET__) {
            (window as any).__CUBICS_SOCKET__.emit("widget:add", { roomId, widget: newWidget });
          } else {
            import("socket.io-client").then(({ default: sio }) => {
              const s = sio(process.env.NEXT_PUBLIC_SOCKET_URL || "http://127.0.0.1:3001", { transports: ["websocket"] });
              s.emit("room:join", { roomId, userName: userNameRef.current, silent: true });
              s.emit("widget:add", { roomId, widget: newWidget });
              setTimeout(() => s.disconnect(), 500);
            });
          }
    try {
      fetch(`/api/rooms/${roomId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWidget),
      });
    } catch {}
  };

  const deleteWidget = useCallback(async (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
    setZOrder(prev => prev.filter(z => z !== id));
    if (!id.startsWith("temp-")) {
      fetch(`/api/rooms/${roomId}/widgets?widgetId=${id}`, { method: "DELETE" }).catch(console.error);
    }
  }, [roomId]);

  const bgMajor = 100;
  const bgMinor = 20;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => { saveView(); mainSocketRef.current?.disconnect(); router.push("/"); }} className="btn-icon" title="Back to rooms" aria-label="Back to rooms">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-h2 text-fg truncate max-w-[240px]">{roomName || roomId.slice(0, 8)}</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!urlInput.trim()) return;
              let url = urlInput.trim();
              if (!/^https?:\/\//i.test(url)) url = "https://" + url;
              setPendingUrl(url);
              setUrlInput("");
              setShowTabPicker(true);
            }}
            className="flex-1 max-w-xl"
          >
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste URL, press Enter"
              className="input-base input-sm w-full font-mono text-mono bg-surface"
            />
          </form>
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-2 px-2">
              <input
                type="range"
                min={10}
                max={500}
                step={1}
                value={Math.round(zoom * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  _setZoom(v);
                  zoomRef.current = v;
                }}
                aria-label="Zoom"
                className="w-20 h-1.5 accent-accent"
              />
              <span className="text-mono text-fg-muted w-10 text-center">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="w-px h-4 bg-line mx-1" />
            <button onClick={() => setMicOn(!micOn)} className="btn-icon" title={micOn ? "Mute mic" : "Unmute mic"} aria-label={micOn ? "Mute mic" : "Unmute mic"}>
              {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { setShowChat(!showChat); setSidebarTab("chat"); setSidebarOpen(true); setChatUnread(0); }}
              className="btn-icon relative"
              title="Chat"
              aria-label="Chat"
            >
              <MessageCircle className="w-4 h-4" />
              {chatUnread > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-accent ring-2 ring-canvas" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Canvas */}
      <main
        ref={mainRef}
        className="flex-1 overflow-auto no-scrollbar"
        onScroll={handleScroll}
        onPointerDown={handlePanStart}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanEnd}
        onPointerCancel={handlePanEnd}
        onWheel={handleWheel}
        style={{ cursor: isPanningActive || draggingId ? "grabbing" : "grab", touchAction: "none" }}
      >
        {/* Scroll area = canvas × zoom */}
        <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom, position: "relative" }}>
          {/* Scaled inner container — CSS transform, no layout change */}
          <div
            className={`canvas-grid ${(isPanningActive || draggingId) ? "canvas-interactive" : ""}`}
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              position: "absolute",
              top: 0,
              left: 0,
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
              backgroundSize: `${bgMajor}px ${bgMajor}px, ${bgMajor}px ${bgMajor}px, ${bgMinor}px ${bgMinor}px, ${bgMinor}px ${bgMinor}px`,
            }}
          >
            {widgets.map((widget) => (
              <WidgetRenderer
                key={widget.id}
                widget={widget}
                zoom={zoom}
                isDragging={draggingId === widget.id}
                zIndex={1000 + Math.max(0, zOrder.indexOf(widget.id))}
                roomId={roomId}
                onDelete={deleteWidget}
                setDraggingId={setDraggingId}
                setZOrder={setZOrder}
                setWidgets={setWidgets}
              />
            ))}
            <div className="absolute inset-0 pointer-events-none" style={{ width: CANVAS_W, height: CANVAS_H, zIndex: 99999 }}>
              {[...remoteCursors.entries()].map(([id, c]) => (
                <div key={id} className="absolute" style={{ left: 0, top: 0, transform: `translate3d(${c.x}px, ${c.y}px, 0)`, willChange: "transform" }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow">
                    <path d="M0 0 L0 14 L4 10 L7 17 L9 16 L6 9 L12 9 Z" fill={c.color || "#3b82f6"} stroke="#fff" strokeWidth="1" />
                  </svg>
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-surface text-caption text-fg shadow-sm whitespace-nowrap">
                    {c.userName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {showTabPicker && (
        <TabPicker
          url={pendingUrl}
          onClose={() => setShowTabPicker(false)}
          onPersonal={(u) => {
            setShowTabPicker(false);
            addWidgetFromUrl({
              title: (() => { try { return new URL(u).hostname.replace("www.", ""); } catch { return u.slice(0, 40); } })(),
              url: u,
              w: DEFAULT_W,
              h: DEFAULT_H,
            });
          }}
          onLive={() => {
            setShowTabPicker(false);
            addLiveTab(pendingUrl);
          }}
          onShared={() => {
            setShowTabPicker(false);
            addSharedBrowserWidget();
          }}
        />
      )}

      {showChat && (
        <div className="absolute bottom-4 right-4 z-30">
          <div className="menu flex flex-col" style={{ width: 320, height: 380 }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-surface">
              <span className="text-small font-medium text-fg">Chat</span>
              <button onClick={() => setShowChat(false)} className="btn-icon-sm" title="Close chat" aria-label="Close chat">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center text-small text-fg-muted mt-4">No messages yet</div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-caption text-fg">{msg.userName}</span>
                    <span className="text-caption text-fg-subtle">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                  </div>
                  <div className="text-small text-fg bg-hover rounded-md px-3 py-1.5 max-w-[85%] break-words">{msg.content}</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="p-2 border-t border-line flex gap-2 bg-canvas">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="input-base input-sm flex-1"
              />
              <button type="submit" className="btn btn-primary btn-sm" aria-label="Send">
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const TabPicker = ({ url, onClose, onPersonal, onLive, onShared }: { url: string; onClose: () => void; onPersonal: (u: string) => void; onLive: () => void; onShared: () => void }) => {
  const options = [
    { label: "Personal tab", hint: "Your own iframe", onClick: () => onPersonal(url) },
    { label: "Live tab", hint: "Share a browser tab", onClick: onLive },
    { label: "Shared tab", hint: "Shared browser + co-control", onClick: onShared },
  ];
  return (
    <Modal
      open
      onClose={onClose}
      title="Add as"
      size="sm"
      footer={<button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>}
    >
      <p className="text-small text-fg-muted mb-4 truncate">{url}</p>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.label}
            onClick={(e) => { e.stopPropagation(); o.onClick(); }}
            className="card card-interactive w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left"
          >
            <span className="text-body text-fg">{o.label}</span>
            <span className="text-caption text-fg-muted">{o.hint}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
};

interface WidgetRendererProps {
  widget: Widget;
  zoom: number;
  isDragging: boolean;
  zIndex: number;
  roomId: string;
  onDelete: (id: string) => void;
  setDraggingId: (id: string | null) => void;
  setZOrder: React.Dispatch<React.SetStateAction<string[]>>;
  setWidgets: React.Dispatch<React.SetStateAction<Widget[]>>;
}

const WidgetRenderer = memo(function WidgetRenderer({ widget, zoom, isDragging, zIndex, roomId, onDelete, setDraggingId, setZOrder, setWidgets }: WidgetRendererProps) {
  const w = widget.w || DEFAULT_W;
  const h = widget.h || DEFAULT_H;
  const lastEmitRef = useRef(0);

  const onDragStop = useCallback((_: any, d: { x: number; y: number }) => {
    const newX = Number(Math.max(0, Math.min(CANVAS_W - w, d.x)).toFixed(1));
    const newY = Number(Math.max(0, Math.min(CANVAS_H - h, d.y)).toFixed(1));
    setWidgets(prev => prev.map(wgt => wgt.id === widget.id ? { ...wgt, x: newX, y: newY } : wgt));
    fetch(`/api/rooms/${roomId}/widgets`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ id: widget.id, x: newX, y: newY, w, h }]) }).catch(console.error);
    (window as any).__CUBICS_SOCKET__?.emit("widget:update", { id: widget.id, x: newX, y: newY, w, h });
  }, [widget.id, w, h, roomId, setWidgets]);

  const onResizeStop = useCallback((_: any, __: any, ref: HTMLElement, ___: any, pos: { x: number; y: number }) => {
    const newW = Number(Math.max(100, ref.offsetWidth).toFixed(1));
    const newH = Number(Math.max(100, ref.offsetHeight).toFixed(1));
    const newX = Number(Math.max(0, Math.min(CANVAS_W - newW, pos.x)).toFixed(1));
    const newY = Number(Math.max(0, Math.min(CANVAS_H - newH, pos.y)).toFixed(1));
    setWidgets(prev => prev.map(wgt => wgt.id === widget.id ? { ...wgt, x: newX, y: newY, w: newW, h: newH } : wgt));
    fetch(`/api/rooms/${roomId}/widgets`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ id: widget.id, x: newX, y: newY, w: newW, h: newH }]) }).catch(console.error);
    (window as any).__CUBICS_SOCKET__?.emit("widget:update", { id: widget.id, x: newX, y: newY, w: newW, h: newH });
  }, [widget.id, roomId, setWidgets]);

  const handleDragStart = useCallback(() => {
    setZOrder(prev => [...prev.filter(id => id !== widget.id), widget.id]);
    setDraggingId(widget.id);
    (window as any).__CUBICS_DRAGGING_ID__ = widget.id;
  }, [widget.id, setZOrder, setDraggingId]);

  const handleDragEnd = useCallback((_e: any, d: any) => {
    setDraggingId(null);
    (window as any).__CUBICS_DRAGGING_ID__ = null;
    onDragStop(_e, d);
  }, [setDraggingId, onDragStop]);

  const handleResizeStart = useCallback(() => {
    setZOrder(prev => [...prev.filter(id => id !== widget.id), widget.id]);
    setDraggingId(widget.id);
    (window as any).__CUBICS_DRAGGING_ID__ = widget.id;
  }, [widget.id, setZOrder, setDraggingId]);

  const handleResizeEnd = useCallback((_e: any, _dir: any, ref: HTMLElement, _delta: any, pos: { x: number; y: number }) => {
    setDraggingId(null);
    (window as any).__CUBICS_DRAGGING_ID__ = null;
    onResizeStop(_e, _dir, ref, _delta, pos);
  }, [setDraggingId, onResizeStop]);

  const handleDelete = useCallback(() => onDelete(widget.id), [onDelete, widget.id]);

  return (
    <Rnd
      scale={zoom}
      className={`react-rnd ${isDragging ? "dragging" : ""}`}
      size={{ width: w, height: h }}
      position={{ x: widget.x, y: widget.y }}
      bounds="parent"
       onDragStart={handleDragStart}
       onDrag={(_e: any, d: any) => {
         const now = Date.now();
         // throttle
         if (now - lastEmitRef.current < 16) return;
         lastEmitRef.current = now;
         const newX = Number(Math.max(0, Math.min(CANVAS_W - w, d.x)).toFixed(1));
         const newY = Number(Math.max(0, Math.min(CANVAS_H - h, d.y)).toFixed(1));
         (window as any).__CUBICS_SOCKET__?.emit("widget:update", { id: widget.id, x: newX, y: newY, w, h });
       }}
       onDragStop={handleDragEnd}
       onResizeStart={handleResizeStart}
       onResize={(_e: any, _dir: any, ref: HTMLElement, _delta: any, pos: { x: number; y: number }) => {
         const now = Date.now();
         if (now - lastEmitRef.current < 16) return;
         lastEmitRef.current = now;
         const newW = Number(Math.max(100, ref.offsetWidth).toFixed(1));
         const newH = Number(Math.max(100, ref.offsetHeight).toFixed(1));
         const newX = Number(Math.max(0, Math.min(CANVAS_W - newW, pos.x)).toFixed(1));
         const newY = Number(Math.max(0, Math.min(CANVAS_H - newH, pos.y)).toFixed(1));
         (window as any).__CUBICS_SOCKET__?.emit("widget:update", { id: widget.id, x: newX, y: newY, w: newW, h: newH });
       }}
       onResizeStop={handleResizeEnd}
      minWidth={100}
      minHeight={100}
      enableResizing={true}
      dragHandleClassName="widget-drag-handle"
      style={{ zIndex, willChange: "transform" }}
    >
      {widget.type === "tab-share" ? (
        <TabShareCard widget={widget} onDelete={handleDelete} isDragging={isDragging} />
      ) : (widget.type as any) === "shared-browser" ? (
        <SharedBrowserCard widget={widget} onDelete={handleDelete} isDragging={isDragging} roomId={roomId} />
      ) : (
        <IframeCard widget={widget} onDelete={handleDelete} isDragging={isDragging} />
      )}
    </Rnd>
  );
});

const IframeCard = memo(function IframeCard({ widget, onDelete, isDragging = false }: { widget: Widget; onDelete: () => void; isDragging?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const socketRef = useRef<any>(null);
  const [token, setToken] = useState<{ holderId: string | null; holderName: string; version: number } | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, { x: number; y: number; userName: string; color: string }>>(new Map());
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const scriptInjectedRef = useRef(false);

  const isController = token ? token.holderId === mySocketId : false;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (widget.type !== "live-tab") return;
    let s: any;
    let cancelled = false;
    import("socket.io-client").then(({ default: io }) => {
      if (cancelled) return;
      s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://127.0.0.1:3001", { transports: ["websocket"] });
      socketRef.current = s;
      setMySocketId(s.id || null);
      s.on("connect", () => setMySocketId(s.id || null));
      s.emit("room:join", { roomId: widget.roomId, userName: "user", silent: true });

      s.on("token:state", ({ widgetId, holderId, holderName, version }: { widgetId: string; holderId: string | null; holderName: string; version: number }) => {
        if (widgetId !== widget.id) return;
        setToken({ holderId, holderName, version });
      });

      s.on("cursor:move", ({ id, x, y, userName, color }: { id: string; x: number; y: number; userName: string; color: string }) => {
        setRemoteCursors(prev => {
          const next = new Map(prev);
          next.set(id, { x, y, userName, color });
          return next;
        });
      });

      s.on("cursor:leave", ({ id }: { id: string }) => {
        setRemoteCursors(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      });

      const onInput = ({ widgetId, input }: { widgetId: string; input: any }) => {
        if (widgetId !== widget.id) return;
        const win = iframeRef.current?.contentWindow;
        if (win) win.postMessage({ type: "LIVE_INPUT", input }, "*");
      };
      s.on("widget:input", onInput);
    });
    return () => {
      cancelled = true;
      s?.disconnect();
    };
  }, [widget.id, widget.roomId]);

  const postToFrame = (msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  };

  const requestToken = useCallback(() => {
    if (widget.type !== "live-tab") return;
    if (isController) return;
    socketRef.current?.emit("token:request", { widgetId: widget.id, userName: "user" });
  }, [widget.id, widget.type, isController]);

  const releaseToken = useCallback(() => {
    if (widget.type !== "live-tab") return;
    if (!isController) return;
    socketRef.current?.emit("token:release", { widgetId: widget.id });
  }, [widget.id, widget.type, isController]);

  const broadcastInput = useCallback((input: any) => {
    if (widget.type !== "live-tab") return;
    if (!isController) {
      requestToken();
      return;
    }
    const op = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      widgetId: widget.id,
      userId: mySocketId || "user",
      userName: "user",
      seq: Date.now(),
      timestamp: Date.now(),
      ...input,
    };
    socketRef.current?.emit("widget:input", { widgetId: widget.id, input: op });
    // Apply locally immediately
    const win = iframeRef.current?.contentWindow;
    if (win) win.postMessage({ type: "LIVE_INPUT", input: op }, "*");
  }, [widget.id, widget.type, isController, mySocketId, requestToken]);

  const onContainerMouseDown = (e: React.MouseEvent) => {
    if (widget.type !== "live-tab") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    broadcastInput({ type: "mousedown", x: e.clientX - rect.left, y: e.clientY - rect.top, button: e.button });
  };
  const onContainerMouseUp = (e: React.MouseEvent) => {
    if (widget.type !== "live-tab") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    broadcastInput({ type: "mouseup", x: e.clientX - rect.left, y: e.clientY - rect.top, button: e.button });
  };
  const onContainerClick = (e: React.MouseEvent) => {
    if (widget.type !== "live-tab") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    broadcastInput({ type: "click", x: e.clientX - rect.left, y: e.clientY - rect.top, button: e.button });
  };
  const onContainerMouseMove = (e: React.MouseEvent) => {
    if (widget.type !== "live-tab") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    broadcastInput({ type: "mousemove", x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const onContainerKeyDown = (e: React.KeyboardEvent) => {
    if (widget.type !== "live-tab") return;
    e.preventDefault();
    broadcastInput({ type: "keydown", key: e.key, code: e.code });
  };
  const onContainerKeyUp = (e: React.KeyboardEvent) => {
    if (widget.type !== "live-tab") return;
    e.preventDefault();
    broadcastInput({ type: "keyup", key: e.key, code: e.code });
  };
  const onContainerWheel = (e: React.WheelEvent) => {
    if (widget.type !== "live-tab") return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    broadcastInput({ type: "wheel", x: e.clientX - rect.left, y: e.clientY - rect.top, deltaY: e.deltaY });
  };

  const onIframeLoad = () => {
    if (widget.type === "live-tab" && !scriptInjectedRef.current) {
      try {
        injectLiveTabScript(iframeRef.current!);
        scriptInjectedRef.current = true;
      } catch {}
    }
  };

  return (
    <div ref={containerRef} className="widget-card h-full flex flex-col" onMouseDown={onContainerMouseDown} onMouseUp={onContainerMouseUp} onClick={onContainerClick} onMouseMove={onContainerMouseMove} onKeyDown={onContainerKeyDown} onKeyUp={onContainerKeyUp} onWheel={onContainerWheel} tabIndex={0}>
      <div className="widget-card-header">
        <div className="widget-drag-handle flex items-center gap-1.5 flex-1 cursor-move min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-fg-subtle shrink-0" />
          <span className="text-small font-medium text-fg truncate">{widget.title}</span>
          {widget.type === "live-tab" && (
            <span className={`ml-2 text-caption ${isController ? "text-success" : "text-fg-subtle"}`}>
              {isController ? "● You control" : token ? `● ${token.holderName || "Someone"} controls` : "● Request control"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); postToFrame({ type: "GO_BACK" }); }}
            className="p-1 text-fg-subtle hover:text-fg rounded-sm transition-colors"
            title="Back"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); postToFrame({ type: "GO_FORWARD" }); }}
            className="p-1 text-fg-subtle hover:text-fg rounded-sm transition-colors"
            title="Forward"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); postToFrame({ type: "RELOAD" }); }}
            className="p-1 text-fg-subtle hover:text-fg rounded-sm transition-colors"
            title="Reload"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3 bg-line mx-0.5" />
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-fg-subtle hover:text-danger rounded-sm transition-colors" title="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="widget-card-body flex-1 min-h-0 relative">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-small text-fg-subtle">{widget.title}</span>
        </div>
        {isVisible ? (
          <iframe
            ref={iframeRef}
            data-widget-id={widget.id}
            src={widget.url}
            title={widget.title}
            allowFullScreen
            loading="lazy"
            className="w-full h-full border-0"
            onLoad={onIframeLoad}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-surface">
            <span className="text-small text-fg-subtle">{widget.title}</span>
          </div>
        )}
        {widget.type === "live-tab" && remoteCursors.size > 0 && (
          <div className="pointer-events-none inset-0 absolute z-10">
            {[...remoteCursors.entries()].map((([id, c]) => (
              <div key={id} className="absolute" style={{ left: c.x, top: c.y }}>
                <div className="relative">
                  <div className="w-2 h-2 rounded-full ring-2 ring-canvas" style={{ backgroundColor: c.color }} />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-caption text-fg-muted whitespace-nowrap">{c.userName}</div>
                </div>
              </div>
            )))}
          </div>
        )}
      </div>
    </div>
  );
});

const TabShareCard = memo(function TabShareCard({ widget, onDelete, isDragging = false }: { widget: Widget; onDelete: () => void; isDragging?: boolean }) {
  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-card-header">
        <div className="widget-drag-handle flex items-center gap-1.5 flex-1 cursor-move min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-fg-subtle shrink-0" />
          <span className="text-small font-medium text-fg truncate">{widget.title}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-fg-subtle hover:text-danger rounded-sm transition-colors" title="Remove">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="widget-card-body flex-1 min-h-0">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-small text-fg-subtle">{widget.title}</span>
        </div>
        <TabShareWidget widgetId={widget.id} onDelete={onDelete} />
      </div>
    </div>
  );
});


const SharedBrowserCard = memo(function SharedBrowserCard({ widget, onDelete, isDragging = false, roomId }: { widget: Widget; onDelete: () => void; isDragging?: boolean; roomId: string }) {
  const socketRefSB = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "hosting" | "viewing">("idle");
  const statusRef = useRef(status);
  const [urlInput, setUrlInput] = useState("");

  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    let s: any;
    let cancelled = false;
    import("socket.io-client").then(({ default: io }) => {
      if (cancelled) return;
      s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://127.0.0.1:3001", { transports: ["websocket"] });
      socketRefSB.current = s;
      s.emit("room:join", { roomId, userName: "user", silent: true });
      s.emit("sb:join", { widgetId: widget.id });
      
      s.on("sb:state", ({ hostId }: { hostId: string | null }) => {
        if (!hostId) {
          if (statusRef.current !== "hosting") {
            setStatus("idle");
            if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
            if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
            if (videoRef.current) videoRef.current.srcObject = null;
          }
          return;
        }
        if (hostId === s.id) {
          setStatus("hosting");
          return;
        }
        setStatus("viewing");
        if (!pcRef.current) s.emit("sb:viewer-request", { widgetId: widget.id });
      });

      s.on("sb:host-available", ({ widgetId: wid }: { widgetId: string }) => {
        if (wid !== widget.id) return;
        setStatus("viewing");
        if (!pcRef.current) s.emit("sb:viewer-request", { widgetId: widget.id });
      });

      s.on("sb:viewer", async ({ viewerId }: { viewerId: string }) => {
        if (statusRef.current !== "hosting" || !streamRef.current) return;
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        pcRef.current = pc;
        streamRef.current.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));
        const dc = pc.createDataChannel("input");
        dcRef.current = dc;
        pc.onicecandidate = (e) => { if (e.candidate) s.emit("sb:ice", { to: viewerId, candidate: e.candidate }); };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit("sb:offer-to", { to: viewerId, offer });
      });

      s.on("sb:offer-to", async ({ from, offer }: any) => {
        if (statusRef.current === "hosting") return;
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        pcRef.current = pc;
        pc.ontrack = (e) => { if (videoRef.current) videoRef.current.srcObject = e.streams[0]; };
        pc.onicecandidate = (e) => { if (e.candidate) s.emit("sb:ice", { to: from, candidate: e.candidate }); };
        pc.ondatachannel = (e) => { dcRef.current = e.channel; };
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        s.emit("sb:answer", { to: from, answer });
      });

      s.on("sb:answer", async ({ answer }: any) => {
        if (pcRef.current) await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      });

      s.on("sb:ice", async ({ candidate }: any) => {
        try { if (pcRef.current && candidate) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      });

      s.on("sb:nav", ({ url }: { url: string }) => { setUrlInput(url); });
    });
    return () => {
      cancelled = true;
      s?.disconnect();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    };
  }, [roomId, widget.id]);

  const hostBrowser = async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus("hosting");
      statusRef.current = "hosting";
      socketRefSB.current?.emit("sb:host", { widgetId: widget.id });
      stream.getVideoTracks()[0].onended = () => stopHost();
    } catch (e) {
      console.error(e);
    }
  };

  const stopHost = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
    statusRef.current = "idle";
    if (videoRef.current) videoRef.current.srcObject = null;
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
    socketRefSB.current?.emit("sb:unhost", { widgetId: widget.id });
  };

  const navigate = (url: string) => {
    let u = url.trim();
    if (!u) return;
    if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
    setUrlInput(u);
    socketRefSB.current?.emit("sb:nav", { widgetId: widget.id, url: u });
  };

  const handleMouse = (e: React.MouseEvent) => {
    if (status !== "viewing" || !dcRef.current || dcRef.current.readyState !== "open") return;
    const rect = (e.currentTarget as HTMLVideoElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    dcRef.current.send(JSON.stringify({ type: e.type, x, y, button: e.button }));
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (status !== "viewing" || !dcRef.current || dcRef.current.readyState !== "open") return;
    e.preventDefault();
    dcRef.current.send(JSON.stringify({ type: e.type, key: e.key, code: e.code }));
  };

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-card-header">
        <div className="widget-drag-handle flex items-center gap-1.5 flex-1 cursor-move min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-fg-subtle shrink-0" />
          <span className="text-small font-medium text-fg truncate">{widget.title}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-fg-subtle hover:text-danger rounded-sm transition-colors" title="Remove">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="widget-card-body flex-1 min-h-0 flex flex-col">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-small text-fg-subtle">Shared browser</span>
        </div>
        {status === "idle" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
            <Globe className="w-5 h-5 text-fg-subtle" />
            <p className="text-small text-fg-muted text-center">Host a shared browser session</p>
            <p className="text-caption text-fg-subtle text-center">Everyone in the room can view and control</p>
            <button onClick={hostBrowser} className="btn btn-primary btn-sm">Start hosting</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 px-2 py-1 bg-surface border-b border-line">
              <button onClick={(e) => { e.stopPropagation(); }} className="btn-icon-sm" title="Back"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); }} className="btn-icon-sm" title="Forward"><ChevronRight className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); }} className="btn-icon-sm" title="Reload"><RotateCw className="w-3.5 h-3.5" /></button>
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); navigate(urlInput); } }}
                onClick={(e) => e.stopPropagation()}
                placeholder={urlInput || "Enter URL..."}
                className="input-base input-sm flex-1 font-mono text-mono"
              />
              {status === "hosting" && (
                <button onClick={(e) => { e.stopPropagation(); stopHost(); }} className="btn-icon-danger" title="Stop hosting" aria-label="Stop hosting">
                  <MonitorOff className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex-1 relative bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={status === "hosting"}
                className="w-full h-full object-contain"
                onClick={handleMouse}
                onMouseMove={handleMouse}
                onKeyDown={handleKey}
                tabIndex={0}
                style={{ cursor: status === "viewing" ? "pointer" : "default" }}
              />
              {status === "viewing" && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/60 text-white text-caption rounded-sm">
                  Click and type to control
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});
