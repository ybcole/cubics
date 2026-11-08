"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { useParams } from "next/navigation";

import { useUser } from "@clerk/nextjs";
import io from "socket.io-client";
import { Rnd } from "react-rnd";
import {
  RotateCw,
  Trash2,
  GripVertical,
  MessageCircle,
  ArrowUp,
  ZoomIn,
  ZoomOut,
  Plus,
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
  MonitorSmartphone } from "lucide-react";
import type { Widget } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { SpaceRail } from "@/components/SpaceRail";
import TabShareWidget from "@/components/TabShareWidget";
import PersonalTabView from "@/components/PersonalTabView";
import StreamedTabView from "@/components/StreamedTabView";
import RemoteCursors, { cursorBus } from "@/components/RemoteCursors";
import { attachSocket, detachSocket } from "@/lib/live/hub";

const CANVAS_W = 100000;
const CANVAS_H = 100000;
const DEFAULT_W = 800;
const DEFAULT_H = 600;
const DEFAULT_TAB_URL = "https://www.google.com";
const DEFAULT_TAB_TITLE = "Google";

// Chat: a new message stays on screen this long, then fades out.
const CHAT_VISIBLE_MS = 5000;
const CHAT_FADE_MS = 500;
const CHAT_MAX = 200;

// Canvas grid is painted on the viewport (not on a 100000px element) and moved with the camera.
const GRID_MAJOR_PX = 100;
const GRID_MINOR_PX = 20;
const GRID_MAJOR = "linear-gradient(var(--color-grid-major) 1px, transparent 1px), linear-gradient(90deg, var(--color-grid-major) 1px, transparent 1px)";
const GRID_FULL = `${GRID_MAJOR}, linear-gradient(var(--color-grid-minor) 1px, transparent 1px), linear-gradient(90deg, var(--color-grid-minor) 1px, transparent 1px)`;

interface ChatMessage {
  id: string;
  type?: "user" | "system";
  content: string;
  userName?: string;
  userId?: string;
  imageUrl?: string | null;
  createdAt: string;
}

export default function SpaceCanvasPage() {
  const params = useParams();
  const roomId = (params?.id as string) || "";
  const { user: clerkUser, isLoaded } = useUser();
  const userName = clerkUser?.fullName || clerkUser?.firstName || clerkUser?.emailAddresses?.[0]?.emailAddress || "You";
  const clerkUserId = clerkUser?.id;
  const clerkUserImageUrl = clerkUser?.imageUrl ?? null;
  const userNameRef = useRef(userName);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [widgetsLoaded, setWidgetsLoaded] = useState(false);
  const [widgetsLoadError, setWidgetsLoadError] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  // id -> phase for messages that are briefly shown while the chat box is closed
  const [recentChat, setRecentChat] = useState<Record<string, "shown" | "fading">>({});
  const chatTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [chatCommandsOpen, setChatCommandsOpen] = useState(false);
  const chatListRef = useRef<HTMLDivElement>(null);
  const chatRootRef = useRef<HTMLDivElement>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [presenceMembers, setPresenceMembers] = useState<any[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const membersRef = useRef<HTMLDivElement>(null);
  const roomAvatarInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomAvatar, setRoomAvatar] = useState<string | null>(null);
  const [roomOwnerId, setRoomOwnerId] = useState<string | null>(null);
  const isHome = roomName === "Home";
  const [draggingId, setDraggingId] = useState<string | null>(null);
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

  // The canvas is NOT a scroll container. A camera (screen-space offset, same meaning the old
  // scrollLeft/scrollTop had) is applied as a transform to the world layer, so wheel, space,
  // focus and scroll-chaining from tabs can never move it. Only drag-pan, pinch/ctrl+wheel and
  // the zoom controls change the camera.
  const camRef = useRef({ x: 0, y: 0 });
  const worldRef = useRef<HTMLDivElement>(null);

  const applyCamera = useCallback(() => {
    const main = mainRef.current;
    const world = worldRef.current;
    if (!main || !world) return;
    const { x, y } = camRef.current;
    const z = zoomRef.current;
    world.style.transform = `translate(${-x}px, ${-y}px) scale(${z})`;
    const pos = `${-x}px ${-y}px`;
    const major = `${GRID_MAJOR_PX * z}px ${GRID_MAJOR_PX * z}px`;
    const minor = `${GRID_MINOR_PX * z}px ${GRID_MINOR_PX * z}px`;
    if (z >= 0.4) {
      main.style.backgroundImage = GRID_FULL;
      main.style.backgroundSize = `${major}, ${major}, ${minor}, ${minor}`;
      main.style.backgroundPosition = `${pos}, ${pos}, ${pos}, ${pos}`;
    } else {
      main.style.backgroundImage = GRID_MAJOR;
      main.style.backgroundSize = `${major}, ${major}`;
      main.style.backgroundPosition = `${pos}, ${pos}`;
    }
  }, []);

  const setCamera = useCallback((x: number, y: number, save = true) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const main = mainRef.current;
    const z = zoomRef.current;
    const nx = Math.max(-(main?.clientWidth ?? 0), Math.min(CANVAS_W * z, x));
    const ny = Math.max(-(main?.clientHeight ?? 0), Math.min(CANVAS_H * z, y));
    camRef.current = { x: nx, y: ny };
    viewRef.current.scrollLeft = nx;
    viewRef.current.scrollTop = ny;
    applyCamera();
    if (save) scheduleSaveView();
  }, [applyCamera, scheduleSaveView]);

  useEffect(() => {
    if (typeof window === "undefined" || !roomId) return;
    let raf1 = 0, raf2 = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;
    try {
      const raw = localStorage.getItem(`cubics:view:${roomId}`);
      if (!raw) {
        setCamera(0, 0, false);
        return;
      }
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
        setCamera(viewRef.current.scrollLeft, viewRef.current.scrollTop, false);
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
  }, [roomId, setCamera]);

  useEffect(() => {
    applyCamera();
  }, [zoom, applyCamera]);

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
        const res = await fetch(`/api/spaces/${roomId}`, {
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
    fetch(`/api/spaces/${roomId}`)
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
    fetch(`/api/spaces/${roomId}/members`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setRoomMembers(data);
      })
      .catch(console.error);
  }, [roomId]);

  const clearRecentChat = useCallback(() => {
    chatTimers.current.forEach(clearTimeout);
    chatTimers.current.clear();
    setRecentChat({});
  }, []);

  const markRecentChat = useCallback((id: string) => {
    setRecentChat(prev => ({ ...prev, [id]: "shown" }));
    const fade = setTimeout(() => {
      chatTimers.current.delete(fade);
      setRecentChat(prev => (prev[id] ? { ...prev, [id]: "fading" } : prev));
    }, CHAT_VISIBLE_MS);
    const drop = setTimeout(() => {
      chatTimers.current.delete(drop);
      setRecentChat(prev => {
        if (!prev[id]) return prev;
        const { [id]: _gone, ...rest } = prev;
        return rest;
      });
    }, CHAT_VISIBLE_MS + CHAT_FADE_MS);
    chatTimers.current.add(fade);
    chatTimers.current.add(drop);
  }, []);

  useEffect(() => {
    const timers = chatTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  useEffect(() => {
    setChatMessages([]);
    clearRecentChat();
  }, [roomId, clearRecentChat]);

  useEffect(() => {
    if (!chatOpen) return;
    const onDown = (e: MouseEvent) => {
      if (chatRootRef.current && !chatRootRef.current.contains(e.target as Node)) {
        setChatOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [chatOpen]);

  useEffect(() => {
    if (!roomId || !clerkUserId) return;
    let socket: any;
    let cancelled = false;
    import("socket.io-client").then(({ default: io }) => {
      if (cancelled) return;
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://127.0.0.1:3001", { transports: ["websocket"] });
      mainSocketRef.current = socket;
      (window as any).__CUBICS_SOCKET__ = socket;

      const joinSpace = () => {
        socket.emit("room:join", {
          roomId,
          userName,
          imageUrl: clerkUserImageUrl,
          userId: clerkUserId,
          roomName: roomId,
        });
      };
      socket.on("connect", joinSpace);
      if (socket.connected) joinSpace();
      // after room:join is registered so the server sees room:join before any tab:* event
      attachSocket(socket);

      socket.on("chat:history", (list: ChatMessage[]) => {
        setChatMessages(Array.isArray(list) ? list.slice(-CHAT_MAX) : []);
      });

      socket.on("chat:message", (msg: ChatMessage) => {
        if (!msg || typeof msg.id !== "string") return;
        setChatMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg].slice(-CHAT_MAX)));
        if (msg.type !== "system") markRecentChat(msg.id);
      });

      socket.on("presence:update", ({ roomId: rid, members }: { roomId: string; members: any[] }) => {
        if (rid !== roomId) return;
        setPresenceMembers(Array.isArray(members) ? members : []);
      });

      socket.on("cursor:move", ({ id, x, y, userName: cursorUserName, color, userId: cursorUserId }: { id: string; x: number; y: number; userName: string; color: string; userId?: string }) => {
        if (cursorUserId && clerkUserId && cursorUserId === clerkUserId) return;
        cursorBus.move(id, { x, y, userName: cursorUserName, color });
      });

      socket.on("cursor:leave", ({ id }: { id: string }) => {
        cursorBus.leave(id);
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
      detachSocket();
      socket?.disconnect();
    };
  }, [roomId, clerkUserId, clerkUserImageUrl, userName, markRecentChat]);

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

  const zoomTo = useCallback((value: number) => {
    const oldZoom = zoomRef.current;
    const nextZoom = Math.max(0.1, Math.min(5, Number(value.toFixed(2))));
    if (nextZoom === oldZoom) return;
    const main = mainRef.current;
    const cam = camRef.current;
    const centerX = main ? (cam.x + main.clientWidth / 2) / oldZoom : 0;
    const centerY = main ? (cam.y + main.clientHeight / 2) / oldZoom : 0;
    zoomRef.current = nextZoom;
    _setZoom(nextZoom);
    if (!main) {
      scheduleSaveView();
      return;
    }
    // camera and zoom change in the same frame: no intermediate position, no flicker
    setCamera(centerX * nextZoom - main.clientWidth / 2, centerY * nextZoom - main.clientHeight / 2);
  }, [scheduleSaveView, setCamera]);

  const zoomBy = useCallback((delta: number) => {
    zoomTo(zoomRef.current + delta);
  }, [zoomTo]);

  // Native, non-passive wheel listener (React's onWheel is passive, so preventDefault was ignored).
  // The canvas never scrolls: every wheel / pinch event zooms at the cursor. Zoom is applied at
  // most once per frame so fast wheels and trackpads do not flicker.
  const wheelFrame = useRef<number | null>(null);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    let mx = 0;
    let my = 0;
    const flush = () => {
      wheelFrame.current = null;
      const oldZoom = zoomRef.current;
      const nextZoom = pendingZoom.current;
      if (nextZoom === oldZoom) return;
      const cam = camRef.current;
      const wx = (cam.x + mx) / oldZoom;
      const wy = (cam.y + my) / oldZoom;
      zoomRef.current = nextZoom;
      _setZoom(nextZoom);
      setCamera(wx * nextZoom - mx, wy * nextZoom - my);
    };
    const pendingZoom = { current: zoomRef.current };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = main.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
      const raw = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      // pinch / ctrl+wheel send small deltas; a mouse notch is ~100 (= 5%)
      const k = e.ctrlKey ? 0.01 : 0.0005;
      const lim = e.ctrlKey ? 20 : 100;
      const step = Math.max(-lim, Math.min(lim, raw));
      const base = wheelFrame.current == null ? zoomRef.current : pendingZoom.current;
      pendingZoom.current = Math.max(0.1, Math.min(5, base * Math.exp(-step * k)));
      if (wheelFrame.current == null) wheelFrame.current = requestAnimationFrame(flush);
    };
    main.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      main.removeEventListener("wheel", onWheel);
      if (wheelFrame.current != null) cancelAnimationFrame(wheelFrame.current);
      wheelFrame.current = null;
    };
  }, [setCamera]);

  // When the rail expands / collapses / enters focus mode, the canvas viewport moves. Shift the
  // camera by the same amount so the content stays exactly where it is on screen.
  useEffect(() => {
    const main = mainRef.current;
    if (!main || typeof ResizeObserver === "undefined") return;
    let enabled = false;
    let lastLeft = 0;
    let lastTop = 0;
    const arm = setTimeout(() => {
      const r = main.getBoundingClientRect();
      lastLeft = r.left;
      lastTop = r.top;
      enabled = true;
    }, 400);
    const ro = new ResizeObserver(() => {
      if (!enabled) return;
      const r = main.getBoundingClientRect();
      const dx = r.left - lastLeft;
      const dy = r.top - lastTop;
      lastLeft = r.left;
      lastTop = r.top;
      if (dx || dy) setCamera(camRef.current.x + dx, camRef.current.y + dy, false);
    });
    ro.observe(main);
    return () => {
      clearTimeout(arm);
      ro.disconnect();
    };
  }, [setCamera]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setChatOpen(false);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (showTabPicker) return;
      // Preserve native Tab focus navigation. N is the non-interfering "new tab" shortcut.
      if (
        e.key.toLowerCase() === "n" &&
        !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat &&
        (target === document.body || target === mainRef.current)
      ) {
        e.preventDefault();
        setPendingUrl(DEFAULT_TAB_URL);
        setShowTabPicker(true);
      } else if (e.key === "/" && !isHome && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setChatOpen(true);
        requestAnimationFrame(() => chatInputRef.current?.focus());
      } else if (e.code === "Space" && (target === document.body || target === mainRef.current)) {
        e.preventDefault();
      } else if (e.key === "[") {
        e.preventDefault();
        zoomBy(-0.1);
      } else if (e.key === "]") {
        e.preventDefault();
        zoomBy(0.1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showTabPicker, zoomBy, isHome]);

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

  const initialFitDone = useRef<string | null>(null);

  const fitViewToWidgets = useCallback((list: Widget[]) => {
    const main = mainRef.current;
    if (!main || list.length === 0) return;

    const vw = main.clientWidth;
    const vh = main.clientHeight;
    if (!vw || !vh) return;

    let saved: { scrollLeft: number; scrollTop: number; zoom: number } | null = null;
    try {
      const raw = localStorage.getItem(`cubics:view:${roomId}`);
      if (raw) saved = JSON.parse(raw);
    } catch {}

    if (saved) {
      const sz = typeof saved.zoom === "number" && saved.zoom > 0 ? saved.zoom : 1;
      const sl = Number(saved.scrollLeft) || 0;
      const st = Number(saved.scrollTop) || 0;
      zoomRef.current = sz;
      _setZoom(sz);
      const applySaved = () => {
        if (!mainRef.current) return;
        setCamera(Math.max(0, sl), Math.max(0, st), false);
        viewRef.current.zoom = sz;
      };
      requestAnimationFrame(() => requestAnimationFrame(applySaved));
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const w of list) {
      const x = Number(w.x) || 0;
      const y = Number(w.y) || 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + (w.w ?? DEFAULT_W));
      maxY = Math.max(maxY, y + (w.h ?? DEFAULT_H));
    }
    if (!Number.isFinite(minX)) return;

    const pad = 80;
    const bw = Math.max(maxX - minX, 1);
    const bh = Math.max(maxY - minY, 1);
    const fitAllZoom = Math.max(0.1, Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh, 1));

    let nextZoom = fitAllZoom;
    let centerX = (minX + maxX) / 2;
    let centerY = (minY + maxY) / 2;

    if (fitAllZoom < 0.35) {
      const focus = [...list].sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      )[0] ?? list[0];
      const fw = focus.w ?? DEFAULT_W;
      const fh = focus.h ?? DEFAULT_H;
      nextZoom = Math.max(0.35, Math.min((vw - pad * 2) / fw, (vh - pad * 2) / fh, 1));
      centerX = (focus.x ?? 0) + fw / 2;
      centerY = (focus.y ?? 0) + fh / 2;
    }

    zoomRef.current = nextZoom;
    _setZoom(nextZoom);

    setCamera(Math.max(0, centerX * nextZoom - vw / 2), Math.max(0, centerY * nextZoom - vh / 2), false);
    viewRef.current.zoom = nextZoom;
    try {
      localStorage.setItem(`cubics:view:${roomId}`, JSON.stringify(viewRef.current));
    } catch {}
  }, [roomId, setCamera]);

  useEffect(() => {
    let cancelled = false;
    setWidgetsLoaded(false);
    setWidgetsLoadError(false);
    fetch(`/api/spaces/${roomId}/widgets`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load tabs");
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          const parsed = data.map(w => ({
            ...w,
            type: w.url === "tab-share" ? ("tab-share" as const) : ((w.type || "iframe") as Widget["type"]),
            x: w.x ?? 0,
            y: w.y ?? 0,
            w: w.w ?? DEFAULT_W,
            h: w.h ?? DEFAULT_H,
          }));
          setWidgets(parsed);
          setZOrder(parsed.map(w => w.id));
          if (parsed.length > 0 && initialFitDone.current !== roomId) {
            initialFitDone.current = roomId;
            requestAnimationFrame(() => requestAnimationFrame(() => fitViewToWidgets(parsed)));
          }
        }
      })
      .catch((error) => { if (!cancelled) { console.error(error); setWidgetsLoadError(true); } })
      .finally(() => { if (!cancelled) setWidgetsLoaded(true); });
    return () => { cancelled = true; };
  }, [roomId, fitViewToWidgets]);

  useEffect(() => { widgetsRef.current = widgets; }, [widgets]);

  const handlePanStart = (e: React.PointerEvent) => {
    setChatOpen(false);
    if ((e.target as Element).closest(".widget-card, .widget-drag-handle, .react-rnd")) return;
    isPanning.current = true;
    setIsPanningActive(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    scrollAtStart.current = { x: camRef.current.x, y: camRef.current.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const lastCursorEmit = useRef(0);
  const handlePanMove = (e: React.PointerEvent) => {
    if (isPanning.current) {
      setCamera(
        scrollAtStart.current.x - (e.clientX - panStart.current.x),
        scrollAtStart.current.y - (e.clientY - panStart.current.y),
        false
      );
    }
    const now = Date.now();
    if (now - lastCursorEmit.current < 33) return;
    lastCursorEmit.current = now;
    const main = mainRef.current;
    if (!main) return;
    const rect = main.getBoundingClientRect();
    const zoomVal = zoomRef.current;
    const x = (camRef.current.x + (e.clientX - rect.left)) / zoomVal;
    const y = (camRef.current.y + (e.clientY - rect.top)) / zoomVal;
    const color = "#3b82f6";
    mainSocketRef.current?.volatile.emit("cursor:move", { x, y, userName, color, userId: clerkUser?.id });
  };

  const handlePanEnd = (e: React.PointerEvent) => {
    if (!isPanning.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    isPanning.current = false;
    setIsPanningActive(false);
    scheduleSaveView();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (content) {
      mainSocketRef.current?.emit("chat:send", { content, userName, userId: clerkUserId });
    }
    setNewMessage("");
    setChatOpen(false);
  };

  useEffect(() => {
    if (chatOpen) chatInputRef.current?.focus();
    else setChatCommandsOpen(false);
  }, [chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;
    const list = chatListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [chatOpen]);

  useEffect(() => {
    const list = chatListRef.current;
    if (!chatOpen || !list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }, [chatOpen, chatMessages.length]);

  const getCenterCanvasPos = useCallback((widgetW: number, widgetH: number) => {
    const main = mainRef.current;
    if (!main) return { x: 0, y: 0 };
    const z = zoomRef.current;
    const centerX = (camRef.current.x + main.clientWidth / 2) / z;
    const centerY = (camRef.current.y + main.clientHeight / 2) / z;
    const x = Math.max(0, Math.min(CANVAS_W - widgetW, centerX - widgetW / 2));
    const y = Math.max(0, Math.min(CANVAS_H - widgetH, centerY - widgetH / 2));
    return { x, y };
  }, []);

  const addWidgetFromUrl = useCallback(async ({ title, url, w, h, type = "iframe" }: { title: string; url: string; w: number; h: number; type?: Widget["type"] }) => {
    const { x, y } = getCenterCanvasPos(w, h);
    try {
      const res = await fetch(`/api/spaces/${roomId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url, type, x, y, w, h }),
      });
      if (res.ok) {
        const widget = await res.json();
        setWidgets(prev => [...prev, { ...widget, x: widget.x ?? x, y: widget.y ?? y, w: widget.w ?? w, h: widget.h ?? h }]);
        setZOrder(prev => [...prev.filter(id => id !== widget.id), widget.id]);
        mainSocketRef.current?.emit("widget:add", widget);
      }
    } catch (err) { console.error(err); }
  }, [roomId, getCenterCanvasPos]);

  const updateWidgetUrl = useCallback((widgetId: string, url: string) => {
    setWidgets(prev => prev.map(w => w.id === widgetId ? { ...w, url } : w));
    fetch(`/api/spaces/${roomId}/widgets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ id: widgetId, url }]),
    }).catch(console.error);
    mainSocketRef.current?.emit("widget:update", { id: widgetId, url });
  }, [roomId]);

  const openInNewWidget = useCallback(async (url: string) => {
    const title = (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return url.slice(0, 40); } })();
    await addWidgetFromUrl({ title, url, w: DEFAULT_W, h: DEFAULT_H });
  }, [addWidgetFromUrl]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (data?.type === "OPEN_URL" && typeof data.url === "string") {
        openInNewWidget(data.url);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [openInNewWidget]);

  useEffect(() => {
    if (!window.cubics?.isElectron) return;
    return window.cubics.onOpenUrl((url) => { openInNewWidget(url); });
  }, [openInNewWidget]);

  const deleteWidget = useCallback(async (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
    setZOrder(prev => prev.filter(z => z !== id));
    if (!id.startsWith("temp-")) {
      fetch(`/api/spaces/${roomId}/widgets?widgetId=${id}`, { method: "DELETE" }).catch(console.error);
    }
    const sock = mainSocketRef.current || (window as any).__CUBICS_SOCKET__;
    sock?.emit("widget:delete", id);
  }, [roomId]);

  // widget wrappers re-render on every zoom tick anyway; tabs only see this coarse bucket
  const lodZoom = Math.max(0.125, Math.round(zoom * 8) / 8);

  return (
    <div className="h-screen flex overflow-hidden">
      <SpaceRail currentRoomId={roomId} isHome={isHome} />
      <div className="relative flex-1 min-w-0 flex flex-col overflow-hidden">

      {/* Canvas: a camera viewport, never a scroll container */}
      <main
        ref={mainRef}
        tabIndex={0}
        aria-label={`${roomName || "Workspace"} canvas`}
        className="canvas-grid flex-1 overflow-hidden relative select-none"
        onPointerDown={handlePanStart}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanEnd}
        onPointerCancel={handlePanEnd}
        style={{ overflow: "clip", cursor: isPanningActive || draggingId ? "grabbing" : "grab", touchAction: "none" }}
      >
        <div
          ref={worldRef}
          className={(isPanningActive || draggingId) ? "canvas-interactive" : ""}
          style={{ width: CANVAS_W, height: CANVAS_H, position: "absolute", top: 0, left: 0, transformOrigin: "0 0" }}
        >
            {widgets.map((widget) => (
              <WidgetRenderer
                key={widget.id}
                widget={widget}
                zoom={zoom}
                lodZoom={lodZoom}
                isDragging={draggingId === widget.id}
                zIndex={1000 + Math.max(0, zOrder.indexOf(widget.id))}
                roomId={roomId}
                currentUserId={clerkUserId}
                currentUserName={userName}
                onDelete={deleteWidget}
                onUrlChange={updateWidgetUrl}
                setDraggingId={setDraggingId}
                setZOrder={setZOrder}
                setWidgets={setWidgets}
              />
            ))}
          <div className="absolute inset-0 pointer-events-none" style={{ width: CANVAS_W, height: CANVAS_H, zIndex: 99999 }}>
            <RemoteCursors />
          </div>
        </div>
      </main>

      {/* Single, discoverable primary canvas action. */}
      <div className="canvas-toolbar">
        <div className="canvas-toolbar-context">
          <h1 className="canvas-toolbar-name">{roomName || "Workspace"}</h1>
          <span className="canvas-toolbar-meta">
            {isHome ? "Personal canvas" : "Shared workspace"} · {widgets.length} {widgets.length === 1 ? "tab" : "tabs"}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm canvas-new-tab"
          onClick={() => { setPendingUrl(DEFAULT_TAB_URL); setShowTabPicker(true); }}
          title="New tab (N)"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          New tab
          <span className="ui-kbd" aria-hidden="true">N</span>
        </button>
      </div>

      {widgetsLoaded && widgets.length === 0 && !widgetsLoadError && (
        <div className="canvas-empty">
          <div className="canvas-empty-icon"><Globe className="w-5 h-5" aria-hidden="true" /></div>
          <h2 className="canvas-empty-title">Start with a tab</h2>
          <p className="canvas-empty-copy">
            Add a website to your canvas. Move and resize tabs to organize your workspace.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { setPendingUrl(DEFAULT_TAB_URL); setShowTabPicker(true); }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New tab
          </button>
          <span className="canvas-toolbar-meta">Tip: press N when the canvas is focused</span>
        </div>
      )}

      {widgetsLoaded && widgetsLoadError && (
        <div className="canvas-empty" role="alert">
          <h2 className="canvas-empty-title">Canvas unavailable</h2>
          <p className="canvas-empty-copy">Your tabs could not be loaded. Check your connection and try again.</p>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
            <RotateCw className="w-4 h-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30">
        <div className="canvas-zoom" role="group" aria-label="Canvas zoom">
          <button type="button" onClick={() => zoomBy(-0.1)} className="btn-icon-sm" title="Zoom out ([)" aria-label="Zoom out">
            <ZoomOut className="w-4 h-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => zoomTo(1)} className="canvas-zoom-value btn-icon-sm" title="Reset zoom to 100%" aria-label="Reset zoom to 100%">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={() => zoomBy(0.1)} className="btn-icon-sm" title="Zoom in (])" aria-label="Zoom in">
            <ZoomIn className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>



      {showTabPicker && (
        <TabPicker
          url={pendingUrl}
          isHome={isHome}
          onClose={() => setShowTabPicker(false)}
          onPersonal={(u) => {
            setShowTabPicker(false);
            addWidgetFromUrl({
              title: DEFAULT_TAB_TITLE,
              url: u,
              w: DEFAULT_W,
              h: DEFAULT_H,
            });
          }}
          onLive={() => {
            setShowTabPicker(false);
            addWidgetFromUrl({
              title: DEFAULT_TAB_TITLE,
              url: pendingUrl,
              w: DEFAULT_W,
              h: DEFAULT_H,
              type: "live-tab",
            });
          }}
          onShared={() => {
            setShowTabPicker(false);
            addWidgetFromUrl({
              title: DEFAULT_TAB_TITLE,
              url: pendingUrl,
              w: DEFAULT_W,
              h: DEFAULT_H,
              type: "shared-browser",
            });
          }}
        />
      )}

      {!isHome && (chatOpen || Object.keys(recentChat).length > 0) && (
        <div
          ref={chatRootRef}
          className="absolute bottom-4 left-4 z-30 w-96 max-w-[calc(100%-2rem)] flex flex-col gap-3 bg-transparent pointer-events-none"
        >
          {chatOpen ? (
            <div
              ref={chatListRef}
              className="chat-history pointer-events-auto max-h-[40vh] overflow-y-auto flex flex-col gap-3 pr-2 bg-transparent"
            >
              {chatMessages.length === 0 && <div className="chat-status">No messages yet</div>}
              {chatMessages.map((msg) => (
                <ChatLine key={msg.id} msg={msg} isSelf={!!clerkUserId && msg.userId === clerkUserId} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3 pr-2 bg-transparent">
              {chatMessages
                .filter((msg) => recentChat[msg.id])
                .map((msg) => (
                  <ChatLine key={msg.id} msg={msg} isSelf={!!clerkUserId && msg.userId === clerkUserId} fading={recentChat[msg.id] === "fading"} />
                ))}
            </div>
          )}
          {/* Always mounted so recent messages keep the same position closed as open;
              hidden (but still taking up its space) while closed. */}
          <form
            onSubmit={handleSendMessage}
            aria-hidden={!chatOpen}
            className={`chat-composer relative ${chatOpen ? "pointer-events-auto" : "invisible"}`}
          >
            <div className="flex items-center gap-2">
              <input
                ref={chatInputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Chat"
                maxLength={500}
                autoComplete="off"
                spellCheck={false}
                aria-label="Chat message"
                onBlur={(e) => {
                  // Focus moved away (canvas, a tab/iframe, another field): behave as closed.
                  if (!e.currentTarget.form?.contains(e.relatedTarget as Node | null)) setChatOpen(false);
                }}
                className="chat-input"
              />
              <button
                type="submit"
                aria-label="Send message"
                onMouseDown={(e) => e.preventDefault()}
                disabled={!newMessage.trim()}
                className={`chat-send ${newMessage.trim() ? "chat-send-ready" : ""}`}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
            {chatCommandsOpen && (
              <div className="menu absolute left-0 bottom-full mb-2 w-full z-10" role="menu" aria-label="Commands">
                {CHAT_COMMANDS.map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setNewMessage(`/${cmd} `);
                      setChatCommandsOpen(false);
                      chatInputRef.current?.focus();
                    }}
                    className="menu-item"
                  >
                    /{cmd}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              aria-expanded={chatCommandsOpen}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setChatCommandsOpen((v) => !v)}
              className="chat-commands-btn"
            >
              / Commands
            </button>
          </form>
        </div>
      )}
      </div>
    </div>
  );
}

// Placeholder slash commands until real ones exist.
const CHAT_COMMANDS = ["command1", "command2", "command3", "command4"];

// Dark enough to read on the light canvas; stable per person.
function chatNameColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 62%, 36%)`;
}

const ChatLine = memo(function ChatLine({ msg, isSelf, fading = false }: { msg: ChatMessage; isSelf: boolean; fading?: boolean }) {
  const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  if (msg.type === "system") {
    return (
      <div className="chat-msg" title={time} style={{ opacity: fading ? 0 : 1 }}>
        <span className="chat-avatar shrink-0" aria-hidden />
        <span className="chat-status">{msg.content}</span>
      </div>
    );
  }
  const name = msg.userName || "Guest";
  return (
    <div className="chat-msg" style={{ opacity: fading ? 0 : 1 }}>
      {msg.imageUrl ? (
        <img src={msg.imageUrl} alt="" className="chat-avatar" />
      ) : (
        <span className="chat-avatar chat-avatar-fallback" style={{ backgroundColor: chatNameColor(msg.userId || name) }} aria-hidden>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="chat-body">
        <div className="chat-meta">
          <span>{name}</span>
          {time && <span className="chat-meta-time">{time}</span>}
        </div>
        <div className={`chat-bubble ${isSelf ? "chat-bubble-self" : ""}`}>{msg.content}</div>
      </div>
    </div>
  );
});

const TabPicker = ({ url, onClose, onPersonal, onLive, onShared, isHome }: { url: string; onClose: () => void; onPersonal: (u: string) => void; onLive: () => void; onShared: () => void; isHome?: boolean }) => {
  const options = isHome
    ? [{ label: "Personal tab", hint: "Private browser session for you", icon: <Globe className="w-4 h-4" aria-hidden="true" />, onClick: () => onPersonal(url) }]
    : [
        { label: "Personal tab", hint: "Private browser session for you", icon: <Globe className="w-4 h-4" aria-hidden="true" />, onClick: () => onPersonal(url) },
        { label: "Live tab", hint: "You browse; teammates can watch", icon: <MonitorSmartphone className="w-4 h-4" aria-hidden="true" />, onClick: onLive },
        { label: "Shared tab", hint: "Everyone can interact in one tab", icon: <Users className="w-4 h-4" aria-hidden="true" />, onClick: onShared },
      ];
  return (
    <Modal
      open
      onClose={onClose}
      title="New tab"
      size="sm"
      footer={<button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>}
    >
      <p className="text-small text-fg-muted mb-4">Choose who can see and control this tab.</p>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={(e) => { e.stopPropagation(); o.onClick(); }}
            className="card card-interactive w-full flex items-center gap-3 px-3 py-3 text-left"
          >
            <span className="tab-choice-icon">{o.icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-body font-medium text-fg-strong">{o.label}</span>
              <span className="block text-caption text-fg-muted mt-0.5">{o.hint}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-fg-subtle shrink-0" aria-hidden="true" />
          </button>
        ))}
      </div>
    </Modal>
  );
};

interface WidgetRendererProps {
  widget: Widget;
  zoom: number;
  lodZoom: number;
  isDragging: boolean;
  zIndex: number;
  roomId: string;
  currentUserId?: string | null;
  currentUserName: string;
  onDelete: (id: string) => void;
  onUrlChange: (id: string, url: string) => void;
  setDraggingId: (id: string | null) => void;
  setZOrder: React.Dispatch<React.SetStateAction<string[]>>;
  setWidgets: React.Dispatch<React.SetStateAction<Widget[]>>;
}

const WidgetRenderer = memo(function WidgetRenderer({ widget, zoom, lodZoom, isDragging, zIndex, roomId, currentUserId, currentUserName, onDelete, onUrlChange, setDraggingId, setZOrder, setWidgets }: WidgetRendererProps) {
  const w = widget.w || DEFAULT_W;
  const h = widget.h || DEFAULT_H;
  const lastEmitRef = useRef(0);

  const onDragStop = useCallback((_: any, d: { x: number; y: number }) => {
    const newX = Number(Math.max(0, Math.min(CANVAS_W - w, d.x)).toFixed(1));
    const newY = Number(Math.max(0, Math.min(CANVAS_H - h, d.y)).toFixed(1));
    setWidgets(prev => prev.map(wgt => wgt.id === widget.id ? { ...wgt, x: newX, y: newY } : wgt));
    fetch(`/api/spaces/${roomId}/widgets`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ id: widget.id, x: newX, y: newY, w, h }]) }).catch(console.error);
    (window as any).__CUBICS_SOCKET__?.emit("widget:update", { id: widget.id, x: newX, y: newY, w, h });
  }, [widget.id, w, h, roomId, setWidgets]);

  const onResizeStop = useCallback((_: any, __: any, ref: HTMLElement, ___: any, pos: { x: number; y: number }) => {
    const newW = Number(Math.max(100, ref.offsetWidth).toFixed(1));
    const newH = Number(Math.max(100, ref.offsetHeight).toFixed(1));
    const newX = Number(Math.max(0, Math.min(CANVAS_W - newW, pos.x)).toFixed(1));
    const newY = Number(Math.max(0, Math.min(CANVAS_H - newH, pos.y)).toFixed(1));
    setWidgets(prev => prev.map(wgt => wgt.id === widget.id ? { ...wgt, x: newX, y: newY, w: newW, h: newH } : wgt));
    fetch(`/api/spaces/${roomId}/widgets`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ id: widget.id, x: newX, y: newY, w: newW, h: newH }]) }).catch(console.error);
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
         if (now - lastEmitRef.current < 33) return;
         lastEmitRef.current = now;
         const newX = Number(Math.max(0, Math.min(CANVAS_W - w, d.x)).toFixed(1));
         const newY = Number(Math.max(0, Math.min(CANVAS_H - h, d.y)).toFixed(1));
         (window as any).__CUBICS_SOCKET__?.volatile.emit("widget:update", { id: widget.id, x: newX, y: newY, w, h });
       }}
       onDragStop={handleDragEnd}
       onResizeStart={handleResizeStart}
       onResize={(_e: any, _dir: any, ref: HTMLElement, _delta: any, pos: { x: number; y: number }) => {
         const now = Date.now();
         if (now - lastEmitRef.current < 33) return;
         lastEmitRef.current = now;
         const newW = Number(Math.max(100, ref.offsetWidth).toFixed(1));
         const newH = Number(Math.max(100, ref.offsetHeight).toFixed(1));
         const newX = Number(Math.max(0, Math.min(CANVAS_W - newW, pos.x)).toFixed(1));
         const newY = Number(Math.max(0, Math.min(CANVAS_H - newH, pos.y)).toFixed(1));
         (window as any).__CUBICS_SOCKET__?.volatile.emit("widget:update", { id: widget.id, x: newX, y: newY, w: newW, h: newH });
       }}
       onResizeStop={handleResizeEnd}
      minWidth={100}
      minHeight={100}
      enableResizing={true}
      dragHandleClassName="widget-drag-handle"
      style={{ zIndex }}
    >
      {widget.type === "tab-share" ? (
        <TabShareCard widget={widget} onDelete={handleDelete} isDragging={isDragging} />
      ) : widget.type === "shared-browser" ? (
        <StreamedTabView
          widget={widget}
          mode="shared"
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onDelete={handleDelete}
          onUrlChange={onUrlChange}
          isDragging={isDragging}
          lodZoom={lodZoom}
        />
      ) : widget.type === "live-tab" ? (
        <StreamedTabView
          widget={widget}
          mode="live"
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onDelete={handleDelete}
          onUrlChange={onUrlChange}
          isDragging={isDragging}
          lodZoom={lodZoom}
        />
      ) : (
        <PersonalTabView widget={widget} userId={currentUserId} onDelete={handleDelete} isDragging={isDragging} />
      )}
    </Rnd>
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
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="btn-icon-danger" title="Remove tab" aria-label="Remove tab">
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


