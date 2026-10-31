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
import type { RemoteVideoTrack } from "livekit-client";
import type { Widget } from "@/types";
import { hostTab, onTabInput, sendTabInput, unhostTab, useHub, watchTab } from "@/lib/live/hub";
import { acquireSession, type LiveSession } from "@/lib/live/sfu";
import { clearDemand, reportDemand, useBudget } from "@/lib/live/budget";
import { captureWebview, type Capture } from "@/lib/live/capture";

const isElectron = typeof window !== "undefined" && Boolean(window.cubics?.isElectron);

type Mode = "live" | "shared";

interface WebviewElement extends HTMLElement {
  goBack(): void;
  goForward(): void;
  reload(): void;
  loadURL(url: string): Promise<void>;
  getURL(): string;
  getWebContentsId(): number;
  capturePage(): Promise<any>;
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
  /** Quantized canvas zoom — only changes in coarse steps so tabs don't re-render every wheel tick. */
  lodZoom?: number;
}

const KEY_CODES: Record<string, string> = {
  " ": "Space", Spacebar: "Space", ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down",
  Escape: "Escape", Esc: "Escape", Enter: "Enter", Backspace: "Backspace", Delete: "Delete", Tab: "Tab",
  Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", Insert: "Insert",
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

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Last frame of each tab, kept as a small still for when its stream is paused. */
const posters = new Map<string, string>();

function snapshot(video: HTMLVideoElement, id: string, done: (url: string) => void) {
  if (!video.videoWidth || !video.videoHeight) return;
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = Math.max(1, Math.round((320 * video.videoHeight) / video.videoWidth));
  try {
    c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
  } catch {
    return;
  }
  c.toBlob(
    (blob) => {
      if (!blob) return;
      const old = posters.get(id);
      if (old) URL.revokeObjectURL(old);
      const url = URL.createObjectURL(blob);
      posters.set(id, url);
      done(url);
    },
    "image/jpeg",
    0.7
  );
}

/** Host side: replay a remote viewer's input on the real webview. */
function applyRemoteInput(wv: WebviewElement | null, input: any) {
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
        type: "mouseWheel", x, y,
        deltaX: Number(input.deltaX) || 0, deltaY: Number(input.deltaY) || 0,
        canScroll: true, modifiers,
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
}

// ---------------------------------------------------------------------------
// Viewer surface: subscribes to the SFU only while the budget allows it.
// ---------------------------------------------------------------------------

interface ViewerSurfaceProps {
  widget: Widget;
  mode: Mode;
  hostName: string;
  userName: string;
  lodZoom: number;
}

function ViewerSurface({ widget, mode, hostName, userName, lodZoom }: ViewerSurfaceProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<RemoteVideoTrack | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const aliveRef = useRef(true);
  const lastMoveSent = useRef(0);
  const [visible, setVisible] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [poster, setPoster] = useState<string | null>(() => posters.get(widget.id) ?? null);
  const [error, setError] = useState("");
  const tier = useBudget((s) => s.tiers[widget.id] ?? "off");

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // on-screen visibility (accounts for scroll clipping and canvas zoom)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        setRatio(entry.intersectionRatio);
      },
      { rootMargin: "120px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // tell the budget how many screen pixels this tab is worth
  const area = visible ? widget.w * lodZoom * widget.h * lodZoom * Math.max(ratio, 0.05) : 0;
  useEffect(() => {
    if (area > 0) reportDemand(widget.id, area);
    else clearDemand(widget.id);
  }, [area, widget.id]);
  useEffect(() => () => clearDemand(widget.id), [widget.id]);

  const attachTrack = useCallback((track: RemoteVideoTrack | null) => {
    const video = videoRef.current;
    const prev = trackRef.current;
    if (prev && video) prev.detach(video);
    trackRef.current = track;
    if (track && video) {
      track.attach(video);
      video.play().catch(() => {});
    } else {
      setPlaying(false);
    }
  }, []);

  const applyView = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    if (tier === "low") {
      session.setView(widget.id, { low: true });
    } else {
      const dpr = window.devicePixelRatio || 1;
      session.setView(widget.id, { width: widget.w * lodZoom * dpr, height: widget.h * lodZoom * dpr });
    }
  }, [tier, widget.id, widget.w, widget.h, lodZoom]);
  const applyViewRef = useRef(applyView);
  applyViewRef.current = applyView;

  // subscribe / unsubscribe by tier
  const streaming = tier !== "off";
  useEffect(() => {
    if (!streaming) return;
    let stopped = false;
    let stopWatch: (() => void) | null = null;
    setError("");
    const lease = acquireSession(widget.roomId, userName);
    const leave = watchTab(widget.id);
    lease.session
      .then((session) => {
        if (stopped) return;
        sessionRef.current = session;
        stopWatch = session.watch(widget.id, {
          onTrack: (track) => {
            attachTrack(track);
            applyViewRef.current();
          },
        });
      })
      .catch((err: Error) => {
        if (!stopped) setError(err.message || "Live server unavailable");
      });
    return () => {
      stopped = true;
      const video = videoRef.current;
      if (video) {
        snapshot(video, widget.id, (url) => {
          if (aliveRef.current) setPoster(url);
        });
      }
      stopWatch?.();
      attachTrack(null);
      sessionRef.current = null;
      leave();
      lease.release();
    };
  }, [streaming, widget.id, widget.roomId, userName, attachTrack]);

  // keep requested quality in step with tier / zoom / size
  useEffect(() => {
    applyView();
  }, [applyView]);

  // ---- shared-tab input (viewer -> host) ----
  const sendInput = useCallback((input: { type: string; [k: string]: unknown }) => {
    sendTabInput(widget.id, input);
  }, [widget.id]);

  const pointAt = useCallback((e: React.PointerEvent | React.MouseEvent | React.WheelEvent) => {
    const el = streamRef.current;
    const video = videoRef.current;
    if (!el || !video || !video.videoWidth || !video.videoHeight) return null;
    const rect = el.getBoundingClientRect();
    // account for object-contain letterboxing
    const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
    const cw = video.videoWidth * scale;
    const ch = video.videoHeight * scale;
    const lx = e.clientX - rect.left - (rect.width - cw) / 2;
    const ly = e.clientY - rect.top - (rect.height - ch) / 2;
    if (lx < 0 || ly < 0 || lx > cw || ly > ch) return null;
    return { nx: lx / cw, ny: ly / ch };
  }, []);

  const mods = (e: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }) => ({
    shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey,
  });

  const shared = mode === "shared";
  const onPointerDown = (e: React.PointerEvent) => {
    if (!shared) return;
    (e.currentTarget as HTMLElement).focus();
    const point = pointAt(e);
    if (!point) return;
    e.preventDefault();
    sendInput({ type: "mousedown", ...point, button: e.button, buttons: e.buttons, ...mods(e) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!shared) return;
    const point = pointAt(e);
    if (!point) return;
    e.preventDefault();
    sendInput({ type: "mouseup", ...point, button: e.button, buttons: e.buttons, ...mods(e) });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!shared) return;
    const now = Date.now();
    if (now - lastMoveSent.current < 40) return;
    lastMoveSent.current = now;
    const point = pointAt(e);
    if (!point) return;
    sendInput({ type: "mousemove", ...point, buttons: e.buttons, ...mods(e) });
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!shared) return;
    const point = pointAt(e);
    if (!point) return;
    e.preventDefault();
    sendInput({ type: "wheel", ...point, deltaX: e.deltaX, deltaY: e.deltaY, ...mods(e) });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!shared) return;
    e.preventDefault();
    sendInput({ type: "keydown", key: e.key, code: e.code, ...mods(e) });
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (!shared) return;
    e.preventDefault();
    sendInput({ type: "keyup", key: e.key, code: e.code, ...mods(e) });
  };

  const showVideo = streaming && playing;
  return (
    <div ref={boxRef} className="flex-1 relative bg-black overflow-hidden">
      <div
        ref={streamRef}
        tabIndex={shared ? 0 : -1}
        className="absolute inset-0 outline-none live-tab-container"
        style={{ cursor: shared ? "crosshair" : "default" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={onPointerMove}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onContextMenu={(e) => { if (shared) e.preventDefault(); }}
      >
        {poster && !showVideo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain select-none opacity-70" />
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onPlaying={() => setPlaying(true)}
          onEmptied={() => setPlaying(false)}
          className="absolute inset-0 w-full h-full object-contain select-none"
          style={{ opacity: showVideo ? 1 : 0 }}
        />
      </div>
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
          <span className="text-small text-fg-muted">{error}</span>
        </div>
      ) : streaming && !playing ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="spinner" />
          <span className="text-small text-fg-muted">Connecting to {hostName || "host"}...</span>
        </div>
      ) : !streaming && !poster ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-small text-fg-muted">{mode === "live" ? "Live" : "Shared"} · {hostName || "host"}</span>
        </div>
      ) : null}
      {shared && showVideo && (
        <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/60 text-white text-caption rounded-sm">
          Click and type to control
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StreamedTabView({
  widget,
  mode,
  currentUserId,
  currentUserName,
  onDelete,
  onUrlChange,
  isDragging = false,
  lodZoom = 1,
}: StreamedTabViewProps) {
  const webviewRef = useRef<WebviewElement | null>(null);
  const lastPersistedUrl = useRef(widget.url || "");
  const hostInfoRef = useRef({ kind: mode, ownerId: widget.createdBy || currentUserId, hostName: currentUserName });
  hostInfoRef.current = { kind: mode, ownerId: widget.createdBy || currentUserId, hostName: currentUserName };

  const hostState = useHub((s) => s.hostStates[widget.id]);
  const hostStateLoaded = useHub((s) => s.snapshotLoaded);
  const mySocketId = useHub((s) => s.socketId);
  const viewerCount = useHub((s) => s.viewerCounts[widget.id] ?? 0);

  const [hosting, setHosting] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [startUrl, setStartUrl] = useState(widget.url || "");
  const [draftUrl, setDraftUrl] = useState(widget.url || "");
  const [urlValue, setUrlValue] = useState(widget.url || "");
  const [error, setError] = useState("");

  const isHost = hosting || (!!mySocketId && hostState?.hostId === mySocketId);
  const canStart = mode === "shared" || !widget.createdBy || widget.createdBy === currentUserId;
  const isCreator = !widget.createdBy || widget.createdBy === currentUserId;

  // register with the server as host
  useEffect(() => {
    if (!hosting) return;
    hostTab(widget.id, hostInfoRef.current);
    return () => unhostTab(widget.id);
  }, [hosting, widget.id]);

  // someone else won the host slot -> stand down
  useEffect(() => {
    if (hosting && hostState?.hostId && hostState.hostId !== mySocketId) setHosting(false);
  }, [hosting, hostState?.hostId, mySocketId]);

  useEffect(() => {
    if (mode === "live" && !canStart && hosting) setHosting(false);
  }, [canStart, hosting, mode]);

  useEffect(() => {
    if (hosting) return;
    setReady(false);
    const nextUrl = widget.url || "";
    setStartUrl(nextUrl);
    setDraftUrl(nextUrl);
    setUrlValue(nextUrl);
  }, [widget.url, hosting]);

  // host: wait for the webview
  useEffect(() => {
    if (!isHost || !hostStateLoaded || !isElectron) return;
    const wv = webviewRef.current;
    if (!wv) return;
    const onReady = () => setReady(true);
    wv.addEventListener("dom-ready", onReady);
    wv.addEventListener("did-finish-load", onReady);
    try {
      if (typeof (wv as any).isLoading === "function" && !(wv as any).isLoading()) setReady(true);
    } catch {}
    return () => {
      wv.removeEventListener("dom-ready", onReady);
      wv.removeEventListener("did-finish-load", onReady);
    };
  }, [isHost, hostStateLoaded, startUrl]);

  // host: only capture/encode while someone is actually watching
  useEffect(() => {
    if (viewerCount > 0) {
      setActive(true);
      return;
    }
    const t = setTimeout(() => setActive(false), 5000);
    return () => clearTimeout(t);
  }, [viewerCount]);

  // host: capture -> SFU
  useEffect(() => {
    if (!isHost || !ready || !active || !isElectron) return;
    const wv = webviewRef.current;
    if (!wv) return;
    let cancelled = false;
    let capture: Capture | null = null;
    let stopPublish: (() => Promise<void>) | null = null;
    const lease = acquireSession(widget.roomId, currentUserName);

    (async () => {
      try {
        const session = await lease.session;
        const cap = await captureWebview(wv);
        if (cancelled) return cap.stop();
        capture = cap;
        const published = await session.publish(widget.id, cap.track);
        stopPublish = published.stop;
        if (cancelled) {
          await published.stop();
          cap.stop();
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Could not start streaming");
      }
    })();

    return () => {
      cancelled = true;
      capture?.stop();
      void stopPublish?.();
      lease.release();
    };
  }, [isHost, ready, active, widget.id, widget.roomId, currentUserName]);

  // host: apply remote input (shared tabs)
  useEffect(() => {
    if (!isHost) return;
    return onTabInput(widget.id, (input) => applyRemoteInput(webviewRef.current, input));
  }, [isHost, widget.id]);

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
    setHosting(true);
  }, [canStart, draftUrl, mode, startUrl]);

  const stopHosting = useCallback(() => {
    setHosting(false);
    setReady(false);
    setActive(false);
  }, []);

  const navigate = useCallback((target: string) => {
    const url = normalizeUrl(target);
    if (!url) return;
    setUrlValue(url);
    lastPersistedUrl.current = url;
    onUrlChange?.(widget.id, url);
    const wv = webviewRef.current;
    if (wv) wv.loadURL(url).catch(() => {});
    else setStartUrl(url);
  }, [onUrlChange, widget.id]);

  const watched = viewerCount > 0 ? ` · ${viewerCount} watching` : "";
  const statusLabel = isHost
    ? (mode === "live" ? "Live" : "Hosting") + watched
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
            <div className="flex-1 min-h-0 relative overflow-hidden">
              {startUrl ? (
                <webview
                  ref={webviewRef as any}
                  data-widget-id={widget.id}
                  src={startUrl}
                  partition={`persist:cubics-tab-${widget.id}`}
                  allowpopups
                  className="w-full h-full border-0"
                  style={{ display: "inline-flex", width: "100%", height: "100%" }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-surface">
                  <span className="text-small text-fg-muted">Enter a URL to start</span>
                </div>
              )}
              {error && (
                <div className="absolute bottom-1 left-1 right-1 alert-danger">{error}</div>
              )}
            </div>
          </>
        ) : hostState?.hostId ? (
          <ViewerSurface
            widget={widget}
            mode={mode}
            hostName={hostState.hostName}
            userName={currentUserName}
            lodZoom={lodZoom}
          />
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
