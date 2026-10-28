"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MonitorOff,
  MonitorSmartphone,
  RotateCw,
  Trash2,
  Users,
} from "lucide-react";
import type { Widget } from "@/types";

const isElectron = typeof window !== "undefined" && Boolean(window.cubics?.isElectron);
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://127.0.0.1:3001";

type Mode = "live" | "shared";

interface TabHostState {
  widgetId: string;
  hostId: string | null;
  hostName: string;
  kind: Mode | null;
}

interface TabFrame {
  data: string;
  width: number;
  height: number;
}

interface NativeImageLike {
  isEmpty(): boolean;
  getSize(): { width: number; height: number };
  resize(options: { width?: number; height?: number; quality?: "good" | "better" | "best" }): NativeImageLike;
  toJPEG(quality: number): Uint8Array;
}

interface WebviewElement extends HTMLElement {
  goBack(): void;
  goForward(): void;
  reload(): void;
  loadURL(url: string): Promise<void>;
  getURL(): string;
  capturePage(): Promise<NativeImageLike>;
  sendInputEvent(event: Record<string, unknown>): Promise<void>;
}

interface StreamedTabViewProps {
  widget: Widget;
  mode: Mode;
  currentUserId?: string | null;
  currentUserName: string;
  onDelete: () => void;
  onUrlChange?: (widgetId: string, url: string) => void;
  isDragging?: boolean;
}

const KEY_CODES: Record<string, string> = {
  " ": "Space",
  Spacebar: "Space",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  Escape: "Escape",
  Esc: "Escape",
  Enter: "Enter",
  Backspace: "Backspace",
  Delete: "Delete",
  Tab: "Tab",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Insert: "Insert",
};

function toKeyCode(key: string): string {
  if (KEY_CODES[key]) return KEY_CODES[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function mouseButton(button: unknown): "left" | "middle" | "right" {
  if (button === 1) return "middle";
  if (button === 2) return "right";
  return "left";
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function StreamedTabView({
  widget,
  mode,
  currentUserId,
  currentUserName,
  onDelete,
  onUrlChange,
  isDragging = false,
}: StreamedTabViewProps) {
  const webviewRef = useRef<WebviewElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<TabFrame | null>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const socketRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const hostingRef = useRef(false);
  const captureBusy = useRef(false);
  const lastMoveSent = useRef(0);
  const lastPersistedUrl = useRef(widget.url || "");
  const [hostState, setHostState] = useState<TabHostState | null>(null);
  const [hostStateLoaded, setHostStateLoaded] = useState(false);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [hosting, setHosting] = useState(false);
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState<TabFrame | null>(null);
  const [startUrl, setStartUrl] = useState(widget.url || "");
  const [draftUrl, setDraftUrl] = useState(widget.url || "");
  const [urlValue, setUrlValue] = useState(widget.url || "");
  const [error, setError] = useState("");

  useEffect(() => {
    const canvas = cursorCanvasRef.current;
    if (!canvas || typeof canvas.transferControlToOffscreen !== "function") return;
    try {
      const offscreen = canvas.transferControlToOffscreen();
      const worker = new Worker("/cursorWorker.js");
      worker.postMessage({ type: "init", canvas: offscreen }, [offscreen]);
      return () => worker.terminate();
    } catch {}
  }, []);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const isHost = hosting || (!!mySocketId && hostState?.hostId === mySocketId);
  const canStart = mode === "shared" || !widget.createdBy || widget.createdBy === currentUserId;
  const isCreator = !widget.createdBy || widget.createdBy === currentUserId;

  useEffect(() => {
    if (mode !== "live") return;
    if (!canStart && hosting) {
      hostingRef.current = false;
      setHosting(false);
    }
  }, [canStart, hosting, mode]);

  useEffect(() => {
    if (hosting) return;
    setFrame(null);
    setReady(false);
    const nextUrl = widget.url || "";
    setStartUrl(nextUrl);
    setDraftUrl(nextUrl);
    setUrlValue(nextUrl);
  }, [widget.url, hosting]);

  useEffect(() => {
    let socket: any;
    let cancelled = false;

    import("socket.io-client").then(({ default: io }) => {
      if (cancelled) return;
      socket = io(SOCKET_URL, { transports: ["websocket"] });
      socketRef.current = socket;
      try {
        const pc = new RTCPeerConnection();
        const dc = pc.createDataChannel("spatial", { ordered: false, maxRetransmits: 0 });
        dc.binaryType = "arraybuffer";
        dcRef.current = dc;
        pcRef.current = pc;
      } catch {}


      const announce = () => {
        setMySocketId(socket.id || null);
        socket.emit("room:join", {
          roomId: widget.roomId,
          userName: currentUserName,
          userId: currentUserId,
          silent: true,
        });
        socket.emit("tab:join", { widgetId: widget.id });
        if (hostingRef.current) {
          socket.emit("tab:host", {
            widgetId: widget.id,
            kind: mode,
            ownerId: widget.createdBy || currentUserId,
            hostName: currentUserName,
          });
        }
      };

      socket.on("connect", announce);
      if (socket.connected) announce();

      socket.on("tab:host-state", (state: TabHostState) => {
        if (!state || state.widgetId !== widget.id) return;
        setHostState(state);
        setHostStateLoaded(true);
        if (hostingRef.current && state.hostId !== socket.id) {
          hostingRef.current = false;
          setHosting(false);
        }
      });

      socket.on("tab:frame", ({ widgetId, frame: nextFrame }: { widgetId: string; frame: any }) => {
        if (widgetId !== widget.id || !nextFrame || !nextFrame.data) return;
        let data = nextFrame.data;
        if (typeof data !== "string") {
          try {
            const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
            const blob = new Blob([bytes], { type: "image/jpeg" });
            data = URL.createObjectURL(blob);
          } catch {
            return;
          }
        }
        const next = { data, width: nextFrame.width, height: nextFrame.height };
        frameRef.current = next as any;
        if (imgRef.current) imgRef.current.src = data;
        setFrame((prev) =>
          prev && prev.width === next.width && prev.height === next.height ? prev : (next as any)
        );
      });

      socket.on("tab:input", ({ widgetId, input }: { widgetId: string; input: any }) => {
        if (widgetId !== widget.id || !hostingRef.current) return;
        applyRemoteInput(input);
      });

      socket.on("disconnect", () => {
        setMySocketId(null);
        setReady(false);
      });
    });

    return () => {
      cancelled = true;
      if (hostingRef.current) {
        socket?.emit("tab:unhost", { widgetId: widget.id });
      }
      hostingRef.current = false;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [widget.id, widget.roomId, widget.createdBy, mode, currentUserId, currentUserName]);

  const applyRemoteInput = useCallback((input: any) => {
    const wv = webviewRef.current;
    if (!wv || !input || typeof input.type !== "string") return;
    const width = Math.max(1, wv.clientWidth);
    const height = Math.max(1, wv.clientHeight);
    const x = Math.round((Number(input.nx) || 0) * width);
    const y = Math.round((Number(input.ny) || 0) * height);
    const modifiers: string[] = [];
    if (input.shiftKey) modifiers.push("shift");
    if (input.ctrlKey) modifiers.push("control");
    if (input.altKey) modifiers.push("alt");
    if (input.metaKey) modifiers.push("meta");

    try {
      if (input.type === "mousedown") {
        wv.sendInputEvent({ type: "mouseDown", x, y, button: mouseButton(input.button), clickCount: 1, modifiers });
      } else if (input.type === "mouseup") {
        wv.sendInputEvent({ type: "mouseUp", x, y, button: mouseButton(input.button), clickCount: 1, modifiers });
      } else if (input.type === "mousemove") {
        wv.sendInputEvent({ type: "mouseMove", x, y, modifiers });
      } else if (input.type === "wheel") {
        wv.sendInputEvent({
          type: "mouseWheel",
          x,
          y,
          deltaX: Number(input.deltaX) || 0,
          deltaY: Number(input.deltaY) || 0,
          canScroll: true,
          modifiers,
        });
      } else if (input.type === "keydown") {
        const keyCode = toKeyCode(String(input.key || ""));
        if (!keyCode) return;
        wv.sendInputEvent({ type: "keyDown", keyCode, modifiers });
        if (String(input.key || "").length === 1 && !input.ctrlKey && !input.metaKey && !input.altKey) {
          wv.sendInputEvent({ type: "char", keyCode: String(input.key), modifiers });
        }
      } else if (input.type === "keyup") {
        const keyCode = toKeyCode(String(input.key || ""));
        if (!keyCode) return;
        wv.sendInputEvent({ type: "keyUp", keyCode, modifiers });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!hosting || !ready || !isElectron) return;
    const wv = webviewRef.current;
    if (!wv) return;
    let stopped = false;

    const tick = async () => {
      if (stopped || captureBusy.current || document.visibilityState !== "visible") return;
      captureBusy.current = true;
      try {
        const image = await wv.capturePage();
        if (image.isEmpty()) return;
        const size = image.getSize();
        const scale = Math.min(1, 768 / Math.max(1, size.width));
        const output = scale < 1
          ? image.resize({ width: Math.round(size.width * scale), quality: "good" })
          : image;
        const outputSize = output.getSize();
        const data = output.toJPEG(40);
        socketRef.current?.emit("tab:frame", {
          widgetId: widget.id,
          frame: {
            data,
            width: outputSize.width,
            height: outputSize.height,
          },
        });
      } catch {
      } finally {
        captureBusy.current = false;
      }
    };

    let raf = 0;
    const loop = () => {
      if (stopped) return;
      tick().finally(() => {
        if (!stopped) raf = requestAnimationFrame(loop);
      });
    };
    loop();
    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hosting, ready, widget.id]);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || !hosting) return;
    const onReady = () => setReady(true);
    const onNavigate = () => {
      const nextUrl = wv.getURL();
      if (!nextUrl || nextUrl === lastPersistedUrl.current) return;
      lastPersistedUrl.current = nextUrl;
      setUrlValue(nextUrl);
      onUrlChange?.(widget.id, nextUrl);
    };
    wv.addEventListener("dom-ready", onReady);
    wv.addEventListener("did-navigate", onNavigate);
    wv.addEventListener("did-navigate-in-page", onNavigate);
    return () => {
      wv.removeEventListener("dom-ready", onReady);
      wv.removeEventListener("did-navigate", onNavigate);
      wv.removeEventListener("did-navigate-in-page", onNavigate);
    };
  }, [hosting, onUrlChange, widget.id]);

  useEffect(() => {
    if (!hosting) return;
    const timer = setTimeout(() => webviewRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [hosting]);

  const startHosting = useCallback(() => {
    setError("");
    if (mode === "live" && !canStart) return;
    const url = normalizeUrl(startUrl || draftUrl);
    if (!url) {
      setError("Enter a URL first.");
      return;
    }
    setStartUrl(url);
    setDraftUrl(url);
    setUrlValue(url);
    lastPersistedUrl.current = url;
    hostingRef.current = true;
    setHosting(true);
    socketRef.current?.emit("tab:host", {
      widgetId: widget.id,
      kind: mode,
      ownerId: widget.createdBy || currentUserId,
      hostName: currentUserName,
    });
  }, [canStart, currentUserId, currentUserName, draftUrl, mode, startUrl, widget.createdBy, widget.id]);

  const stopHosting = useCallback(() => {
    hostingRef.current = false;
    setHosting(false);
    setReady(false);
    setFrame(null);
    socketRef.current?.emit("tab:unhost", { widgetId: widget.id });
  }, [widget.id]);

  const navigate = useCallback((target: string) => {
    const url = normalizeUrl(target);
    if (!url) return;
    setUrlValue(url);
    lastPersistedUrl.current = url;
    onUrlChange?.(widget.id, url);
    const wv = webviewRef.current;
    if (wv) {
      wv.loadURL(url).catch(() => {});
    } else {
      setStartUrl(url);
    }
  }, [onUrlChange, widget.id]);

  const sendInput = useCallback((input: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      try { dc.send(JSON.stringify(input)); return; } catch {}
    }
    socketRef.current?.emit("tab:input", { widgetId: widget.id, input });
  }, [widget.id]);

  const pointAt = useCallback((e: React.PointerEvent | React.MouseEvent | React.WheelEvent) => {
    const el = streamRef.current;
    const f = frameRef.current || frame;
    if (!el || !f) return null;
    const rect = el.getBoundingClientRect();
    const scale = Math.min(rect.width / (f?.width || 1), rect.height / (f?.height || 1));
    const drawnW = (f?.width || 1) * scale;
    const drawnH = (f?.height || 1) * scale;
    const offsetX = (rect.width - drawnW) / 2;
    const offsetY = (rect.height - drawnH) / 2;
    const localX = e.clientX - rect.left - offsetX;
    const localY = e.clientY - rect.top - offsetY;
    if (localX < 0 || localY < 0 || localX > drawnW || localY > drawnH) return null;
    return { nx: localX / drawnW, ny: localY / drawnH };
  }, [frame]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== "shared") return;
    (e.currentTarget as HTMLElement).focus();
    const point = pointAt(e);
    if (!point) return;
    e.preventDefault();
    sendInput({ type: "mousedown", ...point, button: e.button, buttons: e.buttons, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (mode !== "shared") return;
    const point = pointAt(e);
    if (!point) return;
    e.preventDefault();
    sendInput({ type: "mouseup", ...point, button: e.button, buttons: e.buttons, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode !== "shared") return;
    const now = Date.now();
    if (now - lastMoveSent.current < 40) return;
    lastMoveSent.current = now;
    const point = pointAt(e);
    if (!point) return;
    sendInput({ type: "mousemove", ...point, buttons: e.buttons, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey });
  };

  const onWheel = (e: React.WheelEvent) => {
    if (mode !== "shared") return;
    const point = pointAt(e);
    if (!point) return;
    e.preventDefault();
    sendInput({ type: "wheel", ...point, deltaX: e.deltaX, deltaY: e.deltaY, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mode !== "shared") return;
    e.preventDefault();
    sendInput({ type: "keydown", key: e.key, code: e.code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey });
  };

  const onKeyUp = (e: React.KeyboardEvent) => {
    if (mode !== "shared") return;
    e.preventDefault();
    sendInput({ type: "keyup", key: e.key, code: e.code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey });
  };

  const statusLabel = isHost
    ? mode === "live" ? "Live" : "Hosting"
    : hostState?.hostId
      ? mode === "live" ? `Watching ${hostState.hostName || "the host"}` : "Shared - click to control"
      : "Offline";

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-card-header">
        <div className="widget-drag-handle flex items-center gap-1.5 flex-1 cursor-move min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-fg-subtle shrink-0" />
          <span className="text-small font-medium text-fg truncate">{widget.title}</span>
          <span className="text-caption text-fg-muted shrink-0 flex items-center gap-1">
            {isHost && <span className="status-dot" />}
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {isHost && (
            <button onClick={(e) => { e.stopPropagation(); stopHosting(); }} className="btn-icon-sm" title="Stop" aria-label="Stop">
              <MonitorOff className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="btn-icon-danger" title="Remove" aria-label="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="widget-card-body flex-1 min-h-0 flex flex-col">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-small text-fg-muted">{widget.title}</span>
        </div>

        {!isElectron ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-1 px-4 text-center bg-surface">
            <span className="text-small text-fg-muted">This tab needs the Cubics desktop app</span>
            <span className="text-mono text-fg-subtle truncate max-w-full">{widget.url}</span>
          </div>
        ) : !hostStateLoaded ? (
          <div className="flex-1 flex items-center justify-center bg-surface">
            <div className="spinner" />
          </div>
        ) : isHost ? (
          <>
            <div className="flex items-center gap-1 px-2 py-1 bg-surface border-b border-line">
              <button onClick={(e) => { e.stopPropagation(); webviewRef.current?.goBack(); }} className="btn-icon-sm" title="Back" aria-label="Back">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); webviewRef.current?.goForward(); }} className="btn-icon-sm" title="Forward" aria-label="Forward">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); webviewRef.current?.reload(); }} className="btn-icon-sm" title="Reload" aria-label="Reload">
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <input
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(urlValue);
                }}
                onClick={(e) => e.stopPropagation()}
                className="input-base input-sm flex-1 font-mono text-mono"
                placeholder="Enter URL..."
                aria-label="Tab URL"
              />
            </div>
            <div className="flex-1 min-h-0 relative">
              {startUrl ? (
                <webview
                  ref={webviewRef as any}
                  data-widget-id={widget.id}
                  src={startUrl}
                  partition={`persist:cubics-tab-${widget.id}`}
                  allowpopups
                  className="w-full h-full border-0"
                  style={{ display: "inline-flex" }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-surface">
                  <span className="text-small text-fg-muted">Enter a URL to start</span>
                </div>
              )}
            </div>
          </>
        ) : hostState?.hostId ? (
          <div className="flex-1 relative bg-black overflow-hidden">
            {frame ? (
              <div
                ref={streamRef}
                tabIndex={mode === "shared" ? 0 : -1}
                className="absolute inset-0 outline-none"
                style={{ cursor: mode === "shared" ? "crosshair" : "default" }}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerMove={onPointerMove}
                onWheel={onWheel}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onContextMenu={(e) => { if (mode === "shared") e.preventDefault(); }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain select-none"
                  style={{ transform: "translateZ(0)", willChange: "transform" }}
                />
                <img
                  ref={imgRef}
                  src={frame?.data}
                  alt={`${widget.title} live view`}
                  className="absolute inset-0 w-full h-full object-contain select-none"
                  style={{ transform: "translateZ(0)" }}
                  draggable={false}
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="spinner" />
                <span className="text-small text-fg-muted">Connecting to {hostState.hostName || "host"}...</span>
              </div>
            )}
            <canvas
              ref={cursorCanvasRef}
              className="pointer-events-none absolute inset-0 w-full h-full"
              style={{ opacity: 0.9 }}
            />
            {mode === "shared" && frame && (
              <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/60 text-white text-caption rounded-sm">
                Click and type to control
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
            {mode === "live" ? (
              <MonitorSmartphone className="w-5 h-5 text-fg-subtle" />
            ) : (
              <Users className="w-5 h-5 text-fg-subtle" />
            )}
            <p className="text-small text-fg-muted text-center">
              {mode === "live" ? "Go live from this tab" : "Start a shared tab"}
            </p>
            <p className="text-caption text-fg-subtle text-center">
              {mode === "live"
                ? "Only you can control it. Everyone else watches."
                : "Anyone in the room can view and control it."}
            </p>
            {!widget.url && (
              <input
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); startHosting(); } }}
                placeholder="https://..."
                className="input-base input-sm w-full max-w-xs font-mono text-mono"
                aria-label="Tab URL"
              />
            )}
            {canStart ? (
              <button onClick={startHosting} className="btn btn-primary btn-sm">
                {mode === "live" ? "Go live" : "Start shared tab"}
              </button>
            ) : (
              <p className="text-caption text-fg-subtle text-center">Waiting for the creator to start</p>
            )}
            {error && <p className="text-caption text-danger text-center">{error}</p>}
            {mode === "live" && !isCreator && (
              <p className="text-caption text-fg-subtle text-center">Only the creator can start this live tab.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(StreamedTabView);
