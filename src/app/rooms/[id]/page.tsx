"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Puzzle,
} from "lucide-react";
import type { Widget } from "@/types";
import LibraryModal from "@/components/LibraryModal";
import TabShareWidget from "@/components/TabShareWidget";

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
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [zOrder, setZOrder] = useState<string[]>([]);
  const widgetsRef = useRef<Widget[]>([]);
  const [isPanningActive, setIsPanningActive] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const scrollAtStart = useRef({ x: 0, y: 0 });
  const mainRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [zoom, _setZoom] = useState(1);

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

  const addTabShare = () => {
    const w = 1280, h = 720;
    const { x, y } = getCenterCanvasPos(w, h);
    const tempId = `temp-tabshare-${Date.now()}`;
    const newWidget: Widget = { id: tempId, title: "Tab Share", url: "", type: "tab-share", x, y, w, h, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), roomId };
    setWidgets(prev => [...prev, newWidget]);
    setZOrder(prev => [...prev, tempId]);
    fetch(`/api/rooms/${roomId}/widgets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Tab Share", url: "tab-share", type: "tab-share", x, y, w, h }),
    }).then(r => r.ok ? r.json() : null).then(saved => {
      if (saved) {
        setWidgets(prev => prev.map(w => w.id === tempId ? { ...w, id: saved.id } : w));
        setZOrder(prev => prev.map(z => z === tempId ? saved.id : z));
      }
    }).catch(console.error);
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
                addWidgetFromUrl({ title: (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return url.slice(0, 40); } })(), url, w: DEFAULT_W, h: DEFAULT_H });
                setUrlInput("");
              }}
              className="flex-1 flex items-center"
            >
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste URL, press Enter"
                className="w-full px-3 py-1.5 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-400 font-mono"
              />
            </form>
            <button onClick={addTabShare} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors shrink-0 border border-zinc-200">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              Live Tab
            </button>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-zinc-400 w-9 text-center font-mono">{Math.round(zoom * 100 - 10)}%</span>
            <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-zinc-200 mx-1" />
            <button onClick={() => setShowLibrary(true)} className="px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors">
              Library
            </button>
            <button onClick={() => setShowChat(!showChat)} className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
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
        onAddToRoom={addWidgetFromUrl}
        onAddTabShare={addTabShare}
        onShowAddWidget={() => setShowLibrary(false)}
      />

      {showChat && (
        <div className="absolute bottom-16 right-3 w-72 bg-white border border-zinc-200 rounded-lg shadow-md flex flex-col z-30" style={{ height: 320 }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200">
            <span className="text-xs font-medium text-zinc-900">Chat</span>
            <button onClick={() => setShowChat(false)} className="text-zinc-400 hover:text-zinc-600">
              <span className="text-xs">x</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="text-xs">
                <span className="font-medium text-zinc-700">{msg.userName}: </span>
                <span className="text-zinc-600">{msg.content}</span>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="p-2 border-t border-zinc-200 flex gap-1.5">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type..."
              className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-md transition-colors">
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

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
  const [extensionMissing, setExtensionMissing] = useState(false);

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
    const timer = setTimeout(() => {
      setExtensionMissing(!document.documentElement.dataset.cubicsExtension);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const postToFrame = (msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  };

  return (
    <div ref={containerRef} className="widget-card h-full flex flex-col">
      <div className="widget-card-header">
        <div className="widget-drag-handle flex items-center gap-1.5 flex-1 cursor-move min-w-0">
          <GripVertical className="w-3 h-3 text-zinc-300 shrink-0" />
          <span className="text-xs font-medium text-zinc-700 truncate">{widget.title}</span>
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
      <div className="widget-card-body flex-1 min-h-0">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-xs text-zinc-400">{widget.title}</span>
        </div>
        {extensionMissing ? (
          <div className="flex flex-col items-center justify-center h-full bg-zinc-50 gap-2">
            <Puzzle className="w-5 h-5 text-zinc-300" />
            <span className="text-xs text-zinc-400">Cubics Companion is missing</span>
          </div>
        ) : isVisible ? (
          <iframe
            ref={iframeRef}
            data-widget-id={widget.id}
            src={widget.url}
            title={widget.title}
            allowFullScreen
            loading="lazy"
            className="w-full h-full border-0"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-zinc-50">
            <span className="text-xs text-zinc-300">{widget.title}</span>
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
