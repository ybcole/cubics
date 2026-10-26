"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { useParams, useRouter } from "next/navigation";

import { useUser } from "@clerk/nextjs";
import { ProfileDropdown } from "@/components/ProfileDropdown";
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
  Users,
  Copy,
  Check,
  Mic,
  MicOff,
  Edit2,
  MonitorSmartphone,
} from "lucide-react";
import type { Widget } from "@/types";
import LibraryModal from "@/components/LibraryModal";
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
  const userNameRef = useRef(userName);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"members" | "chat">("members");
  const [members, setMembers] = useState<any[]>([]);
  const [presenceMembers, setPresenceMembers] = useState<any[]>([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [copied, setCopied] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
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
  const zoomRef = useRef(1);
  const [zoom, _setZoom] = useState(1);
  const [micOn, setMicOn] = useState(false);

  const setZoom = useCallback((updater: number | ((z: number) => number)) => {
    _setZoom(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      zoomRef.current = next;
      return next;
    });
  }, []);

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

  const handlePanMove = (e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const main = mainRef.current!;
    main.scrollLeft = scrollAtStart.current.x - (e.clientX - panStart.current.x);
    main.scrollTop = scrollAtStart.current.y - (e.clientY - panStart.current.y);
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
      title: "Shared Browser",
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
              s.emit("room:join", { roomId, userName: userNameRef.current });
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
      <header className="shrink-0 z-20 bg-white border-b border-zinc-200">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="text-zinc-400 hover:text-zinc-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-zinc-900">Room</span>
            <span className="text-xs text-zinc-400 font-mono">{roomId.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-xl mx-4">
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
              className="flex-1 flex items-center"
            >
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste URL, press Enter"
                className="w-full px-3 py-1.5 text-xs border border-surface rounded-md focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent placeholder:text-zinc-500 font-mono bg-surface text-zinc-900"
              />
            </form>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1 px-1.5">
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
                className="w-20 h-1.5 accent-accent-teal"
              />
              <span className="text-xs text-zinc-500 w-9 text-center font-mono">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="w-px h-4 bg-surface mx-1" />
            <button onClick={() => setShowLibrary(true)} className="px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors">
              Library
            </button>
            <button onClick={() => setMicOn(!micOn)} className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors" title={micOn ? "Mute mic" : "Unmute mic"}>
              {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => { setShowChat(!showChat); setSidebarTab("chat"); setSidebarOpen(true); setChatUnread(0); }} className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors relative">
              <MessageCircle className="w-3.5 h-3.5" />
              {chatUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent-teal"></span>
              )}
            </button>
            <ProfileDropdown />
          </div>
        </div>
      </header>

      {/* Canvas */}
      <main
        ref={mainRef}
        className="flex-1 overflow-auto no-scrollbar"
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
            className={(isPanningActive || draggingId) ? "canvas-interactive" : ""}
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              position: "absolute",
              top: 0,
              left: 0,
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
              backgroundSize: `${bgMajor}px ${bgMajor}px, ${bgMajor}px ${bgMajor}px, ${bgMinor}px ${bgMinor}px, ${bgMinor}px ${bgMinor}px`,
              backgroundImage:
                "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)",
              backgroundColor: "#fafafa",
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
          </div>
        </div>
      </main>

      <LibraryModal
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        currentRoomId={roomId}
        onAddToRoom={(widget) => {
          addWidgetFromUrl({ title: widget.title, url: widget.url, w: widget.w, h: widget.h });
        }}
        onAddSharedBrowser={() => {
          const id = `sb-${Date.now()}`;
          const newWidget: Widget = {
            id,
            type: "shared-browser" as any,
            title: "Shared Browser",
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
              s.emit("room:join", { roomId, userName: userNameRef.current });
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
        }}
        onShowAddWidget={() => setShowLibrary(false)}
      />

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
          <div className="bg-white border border-surface rounded-lg shadow-lg overflow-hidden flex flex-col" style={{ width: 320, height: 380 }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-surface bg-surface">
              <span className="text-xs font-medium text-zinc-900">Chat</span>
              <button onClick={() => setShowChat(false)} className="text-zinc-500 hover:text-zinc-900">
                <span className="text-xs">×</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {chatMessages.length === 0 && (
                <div className="text-center text-xs text-zinc-500 mt-4">No messages yet</div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className="flex flex-col">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-medium text-zinc-900">{msg.userName}</span>
                    <span className="text-[10px] text-zinc-500">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                  </div>
                  <div className="text-xs text-zinc-900 bg-zinc-100 rounded-lg rounded-tl-sm px-2 py-1 max-w-[85%] break-words">{msg.content}</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="p-2 border-t border-surface flex gap-1 bg-white">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="input-base flex-1 text-xs py-1.5"
              />
              <button type="submit" className="btn-primary p-1.5">
                <Send className="w-3 h-3" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const TabPicker = ({ url, onClose, onPersonal, onLive, onShared }: { url: string; onClose: () => void; onPersonal: (u: string) => void; onLive: () => void; onShared: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-sm font-semibold text-zinc-900 mb-1">Add as</h3>
      <p className="text-xs text-zinc-500 mb-6 truncate">{url}</p>
      <div className="space-y-2">
        <button
          onClick={(e) => { e.stopPropagation(); onPersonal(url); }}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors text-sm text-zinc-700"
        >
          <span>Personal Tab</span>
          <span className="text-xs text-zinc-400">Your own iframe</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onLive(); }}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors text-sm text-zinc-700"
        >
          <span>Live Tab</span>
          <span className="text-xs text-zinc-400">Share a browser tab</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onShared(); }}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors text-sm text-zinc-700"
        >
          <span>Shared Tab</span>
          <span className="text-xs text-zinc-400">Shared browser + co-control</span>
        </button>
      </div>
      <button onClick={onClose} className="mt-4 w-full px-4 py-2 text-xs text-zinc-500 hover:text-zinc-900">Cancel</button>
    </div>
  </div>
);

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

  const onDragStop = useCallback((_: any, d: { x: number; y: number }) => {
    const newX = Number(Math.max(0, Math.min(CANVAS_W - w, d.x)).toFixed(1));
    const newY = Number(Math.max(0, Math.min(CANVAS_H - h, d.y)).toFixed(1));
    setWidgets(prev => prev.map(wgt => wgt.id === widget.id ? { ...wgt, x: newX, y: newY } : wgt));
    fetch(`/api/rooms/${roomId}/widgets`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ id: widget.id, x: newX, y: newY, w, h }]) }).catch(console.error);
  }, [widget.id, w, h, roomId, setWidgets]);

  const onResizeStop = useCallback((_: any, __: any, ref: HTMLElement, ___: any, pos: { x: number; y: number }) => {
    const newW = Number(Math.max(100, ref.offsetWidth).toFixed(1));
    const newH = Number(Math.max(100, ref.offsetHeight).toFixed(1));
    const newX = Number(Math.max(0, Math.min(CANVAS_W - newW, pos.x)).toFixed(1));
    const newY = Number(Math.max(0, Math.min(CANVAS_H - newH, pos.y)).toFixed(1));
    setWidgets(prev => prev.map(wgt => wgt.id === widget.id ? { ...wgt, x: newX, y: newY, w: newW, h: newH } : wgt));
    fetch(`/api/rooms/${roomId}/widgets`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ id: widget.id, x: newX, y: newY, w: newW, h: newH }]) }).catch(console.error);
  }, [widget.id, roomId, setWidgets]);

  const handleDragStart = useCallback(() => {
    setZOrder(prev => [...prev.filter(id => id !== widget.id), widget.id]);
    setDraggingId(widget.id);
  }, [widget.id, setZOrder, setDraggingId]);

  const handleDragEnd = useCallback((_e: any, d: any) => {
    setDraggingId(null);
    onDragStop(_e, d);
  }, [setDraggingId, onDragStop]);

  const handleResizeStart = useCallback(() => {
    setZOrder(prev => [...prev.filter(id => id !== widget.id), widget.id]);
    setDraggingId(widget.id);
  }, [widget.id, setZOrder, setDraggingId]);

  const handleResizeEnd = useCallback((_e: any, _dir: any, ref: HTMLElement, _delta: any, pos: { x: number; y: number }) => {
    setDraggingId(null);
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
      onDragStop={handleDragEnd}
      onResizeStart={handleResizeStart}
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
    import("socket.io-client").then(({ default: io }) => {
      const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://127.0.0.1:3001", { transports: ["websocket"] });
      socketRef.current = s;
      setMySocketId(s.id || null);
      s.emit("room:join", { roomId: widget.roomId, userName: "user" });

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

      return () => {
        s.off("token:state");
        s.off("cursor:move");
        s.off("cursor:leave");
        s.off("widget:input", onInput);
        s.disconnect();
      };
    });
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
          <GripVertical className="w-3 h-3 text-zinc-300 shrink-0" />
          <span className="text-xs font-medium text-zinc-700 truncate">{widget.title}</span>
          {widget.type === "live-tab" && (
            <span className="ml-2 text-[10px] {isController ? 'text-green-600' : 'text-zinc-400'} font-medium">
              {isController ? "● You control" : token ? `● ${token.holderName || "Someone"} controls` : "● Request control"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); postToFrame({ type: "GO_BACK" }); }}
            className="p-1 text-zinc-300 hover:text-zinc-600 rounded transition-colors"
            title="Back"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); postToFrame({ type: "GO_FORWARD" }); }}
            className="p-1 text-zinc-300 hover:text-zinc-600 rounded transition-colors"
            title="Forward"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); postToFrame({ type: "RELOAD" }); }}
            className="p-1 text-zinc-300 hover:text-zinc-600 rounded transition-colors"
            title="Reload"
          >
            <RotateCw className="w-3 h-3" />
          </button>
          <div className="w-px h-3 bg-zinc-200 mx-0.5" />
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-zinc-300 hover:text-red-500 rounded transition-colors" title="Remove">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="widget-card-body flex-1 min-h-0 relative">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-xs text-zinc-400">{widget.title}</span>
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
          <div className="flex items-center justify-center h-full bg-zinc-50">
            <span className="text-xs text-zinc-300">{widget.title}</span>
          </div>
        )}
        {widget.type === "live-tab" && remoteCursors.size > 0 && (
          <div className="pointer-events-none inset-0 absolute z-10">
            {[...remoteCursors.entries()].map((([id, c]) => (
              <div key={id} className="absolute" style={{ left: c.x, top: c.y }}>
                <div className="relative">
                  <div className="w-2 h-2 rounded-full border-2 border-white shadow" style={{ backgroundColor: c.color }} />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500 whitespace-nowrap">{c.userName}</div>
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
          <GripVertical className="w-3 h-3 text-zinc-300 shrink-0" />
          <span className="text-xs font-medium text-zinc-700 truncate">{widget.title}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-zinc-300 hover:text-red-500 rounded transition-colors" title="Remove">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="widget-card-body flex-1 min-h-0">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-xs text-zinc-400">{widget.title}</span>
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
    import("socket.io-client").then(({ default: io }) => {
      const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://127.0.0.1:3001", { transports: ["websocket"] });
      socketRefSB.current = s;
      s.emit("room:join", { roomId, userName: "user" });
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

      return () => {
        s.disconnect();
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
      };
    });
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
          <GripVertical className="w-3 h-3 text-zinc-300 shrink-0" />
          <span className="text-xs font-medium text-zinc-700 truncate">{widget.title}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-zinc-300 hover:text-red-500 rounded transition-colors" title="Remove">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="widget-card-body flex-1 min-h-0 flex flex-col">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-xs text-zinc-400">Shared Browser</span>
        </div>
        {status === "idle" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
            <Globe className="w-5 h-5 text-zinc-400" />
            <p className="text-xs text-zinc-500 text-center">Host a shared browser session</p>
            <p className="text-[10px] text-zinc-400 text-center">Everyone in the room can view and control</p>
            <button onClick={hostBrowser} className="btn-primary px-3 py-1.5 text-xs">Start Hosting</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 px-2 py-1 bg-zinc-50 border-b border-zinc-200">
              <button onClick={(e) => { e.stopPropagation(); }} className="p-1 text-zinc-400" title="Back"><ChevronLeft className="w-3 h-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); }} className="p-1 text-zinc-400" title="Forward"><ChevronRight className="w-3 h-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); }} className="p-1 text-zinc-400" title="Reload"><RotateCw className="w-3 h-3" /></button>
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); navigate(urlInput); } }}
                onClick={(e) => e.stopPropagation()}
                placeholder={urlInput || "Enter URL..."}
                className="flex-1 text-[11px] px-2 py-0.5 border border-zinc-200 rounded bg-white"
              />
              {status === "hosting" && (
                <button onClick={(e) => { e.stopPropagation(); stopHost(); }} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Stop Hosting">
                  <MonitorOff className="w-3 h-3" />
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
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/60 text-white text-[9px] rounded">
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
