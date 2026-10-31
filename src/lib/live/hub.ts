"use client";

/**
 * One socket per client for every live/shared tab.
 *
 * Previously each tab opened its own socket.io connection and joined the room,
 * so every cursor move / widget update was delivered N times (once per tab).
 * Tabs now register here and share the page's single socket.
 */
import { create } from "zustand";
import type { Socket } from "socket.io-client";

export interface TabHostState {
  widgetId: string;
  hostId: string | null;
  hostName: string;
  kind: "live" | "shared" | null;
}

export interface HostInfo {
  kind: "live" | "shared";
  ownerId?: string | null;
  hostName: string;
}

interface HubState {
  socketId: string | null;
  snapshotLoaded: boolean;
  hostStates: Record<string, TabHostState>;
  viewerCounts: Record<string, number>;
}

export const useHub = create<HubState>(() => ({
  socketId: null,
  snapshotLoaded: false,
  hostStates: {},
  viewerCounts: {},
}));

let socket: Socket | null = null;
let teardown: (() => void) | null = null;
const watching = new Map<string, number>();
const hosting = new Map<string, HostInfo>();
const inputHandlers = new Map<string, (input: any) => void>();

export function attachSocket(next: Socket) {
  detachSocket();
  socket = next;

  const onConnect = () => {
    useHub.setState({ socketId: next.id ?? null });
    for (const widgetId of watching.keys()) next.emit("tab:join", { widgetId });
    for (const [widgetId, info] of hosting) next.emit("tab:host", { widgetId, ...info });
  };
  const onDisconnect = () => useHub.setState({ socketId: null, snapshotLoaded: false });
  const onSnapshot = (states: TabHostState[]) => {
    const hostStates: Record<string, TabHostState> = {};
    for (const s of Array.isArray(states) ? states : []) hostStates[s.widgetId] = s;
    useHub.setState({ hostStates, snapshotLoaded: true });
  };
  const onHostState = (s: TabHostState) => {
    if (!s?.widgetId) return;
    useHub.setState((st) => ({ hostStates: { ...st.hostStates, [s.widgetId]: s } }));
  };
  const onViewers = ({ widgetId, count }: { widgetId: string; count: number }) => {
    if (!widgetId) return;
    useHub.setState((st) =>
      st.viewerCounts[widgetId] === count
        ? st
        : { viewerCounts: { ...st.viewerCounts, [widgetId]: count } }
    );
  };
  const onInput = ({ widgetId, input }: { widgetId: string; input: any }) => {
    inputHandlers.get(widgetId)?.(input);
  };

  next.on("connect", onConnect);
  next.on("disconnect", onDisconnect);
  next.on("tab:host-states", onSnapshot);
  next.on("tab:host-state", onHostState);
  next.on("tab:viewers", onViewers);
  next.on("tab:input", onInput);
  if (next.connected) onConnect();

  teardown = () => {
    next.off("connect", onConnect);
    next.off("disconnect", onDisconnect);
    next.off("tab:host-states", onSnapshot);
    next.off("tab:host-state", onHostState);
    next.off("tab:viewers", onViewers);
    next.off("tab:input", onInput);
  };
}

export function detachSocket() {
  teardown?.();
  teardown = null;
  socket = null;
  useHub.setState({ socketId: null, snapshotLoaded: false, hostStates: {}, viewerCounts: {} });
}

/** Count this tab as "being watched" (only call while actually streaming). */
export function watchTab(widgetId: string): () => void {
  const n = (watching.get(widgetId) ?? 0) + 1;
  watching.set(widgetId, n);
  if (n === 1) socket?.emit("tab:join", { widgetId });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (watching.get(widgetId) ?? 1) - 1;
    if (left <= 0) {
      watching.delete(widgetId);
      socket?.emit("tab:leave", { widgetId });
    } else {
      watching.set(widgetId, left);
    }
  };
}

export function hostTab(widgetId: string, info: HostInfo) {
  hosting.set(widgetId, info);
  socket?.emit("tab:host", { widgetId, ...info });
}

export function unhostTab(widgetId: string) {
  if (!hosting.delete(widgetId)) return;
  socket?.emit("tab:unhost", { widgetId });
}

export function sendTabInput(widgetId: string, input: { type: string; [k: string]: unknown }) {
  if (!socket) return;
  // mouse-move is lossy by design: drop under backpressure instead of queueing.
  (input.type === "mousemove" ? socket.volatile : socket).emit("tab:input", { widgetId, input });
}

export function onTabInput(widgetId: string, handler: (input: any) => void): () => void {
  inputHandlers.set(widgetId, handler);
  return () => {
    if (inputHandlers.get(widgetId) === handler) inputHandlers.delete(widgetId);
  };
}
