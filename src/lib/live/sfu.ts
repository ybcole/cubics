"use client";

/**
 * SFU session (LiveKit). One connection per room per client, shared by every
 * live/shared tab.
 *
 *  - Host: publishes ONE simulcast track per tab (3 encodes, regardless of how
 *    many people watch). `dynacast` pauses layers nobody is subscribed to, so a
 *    tab with no viewers costs ~nothing to encode.
 *  - Viewer: autoSubscribe is OFF. A tab is only subscribed while the budget
 *    says it deserves decode time, and the requested size follows its on-screen
 *    size (adaptiveStream can't see CSS-transform zoom, so we drive it).
 *
 * livekit-client is loaded lazily so rooms without live tabs never pay for it.
 */
import type { Room, RemoteTrackPublication, RemoteVideoTrack } from "livekit-client";
import { publishedIdentityMatches } from "@/lib/security/livekit-grants.cjs";

type LK = typeof import("livekit-client");

/** Flip to "h264" for hardware encoding on macOS if you prefer less host CPU. */
const LIVE_CODEC: "vp8" | "h264" = "vp8";
const q = (n: number) => Math.max(64, Math.ceil(n / 64) * 64);

export interface Sink {
  onTrack(track: RemoteVideoTrack | null): void;
}
export type ViewRequest = { low: true } | { width: number; height: number };
export interface Published {
  stop(): Promise<void>;
}

export class LiveSession {
  readonly room: Room;
  private sinks = new Map<string, Sink>();
  private delivered = new Map<string, RemoteVideoTrack | null>();

  constructor(private lk: LK, readonly roomId: string, private userName: string) {
    this.room = new lk.Room({ adaptiveStream: false, dynacast: true });
    const sync = () => this.syncAll();
    const { RoomEvent } = lk;
    this.room.on(RoomEvent.TrackPublished, sync);
    this.room.on(RoomEvent.TrackUnpublished, sync);
    this.room.on(RoomEvent.TrackSubscribed, sync);
    this.room.on(RoomEvent.TrackUnsubscribed, sync);
    this.room.on(RoomEvent.ParticipantDisconnected, sync);
    this.room.on(RoomEvent.Reconnected, sync);
  }

  async connect() {
    const res = await fetch("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: this.roomId, name: this.userName }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `Live server unavailable (${res.status})`);
    }
    const { token, url } = await res.json();
    await this.room.connect(url, token, { autoSubscribe: false });
  }

  close() {
    this.sinks.clear();
    this.delivered.clear();
    void this.room.disconnect();
  }

  // ---- viewer -----------------------------------------------------------

  watch(widgetId: string, sink: Sink): () => void {
    this.sinks.set(widgetId, sink);
    this.sync(widgetId);
    return () => {
      if (this.sinks.get(widgetId) !== sink) return;
      this.sinks.delete(widgetId);
      this.delivered.delete(widgetId);
      this.find(widgetId)?.setSubscribed(false);
    };
  }

  setView(widgetId: string, req: ViewRequest) {
    const pub = this.find(widgetId);
    if (!pub || !pub.isDesired) return;
    if ("low" in req) pub.setVideoQuality(this.lk.VideoQuality.LOW);
    else pub.setVideoDimensions({ width: q(req.width), height: q(req.height) });
  }

  private find(widgetId: string): RemoteTrackPublication | undefined {
    let found: RemoteTrackPublication | undefined;
    for (const p of this.room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        if (publishedIdentityMatches(p.identity, widgetId) &&
            pub.trackName === widgetId && pub.kind === this.lk.Track.Kind.Video &&
            pub.source === this.lk.Track.Source.ScreenShare) found = pub;
      }
    }
    return found;
  }

  private sync(widgetId: string) {
    const sink = this.sinks.get(widgetId);
    if (!sink) return;
    const pub = this.find(widgetId);
    if (pub && !pub.isDesired) pub.setSubscribed(true);
    const track = (pub && pub.isSubscribed ? (pub.videoTrack as RemoteVideoTrack | undefined) : undefined) ?? null;
    if (this.delivered.get(widgetId) !== track) {
      this.delivered.set(widgetId, track);
      sink.onTrack(track);
    }
  }

  private syncAll() {
    for (const id of this.sinks.keys()) this.sync(id);
  }
}

// Publishing is an independent LiveKit connection granted ONLY after the
// hosted API verifies current room membership + persisted widget ownership.
// The regular viewing connection is strictly subscribe-only.
export async function publishWidgetTrack(
  roomId: string, widgetId: string, track: MediaStreamTrack, userName: string
): Promise<Published> {
  const lk = await import("livekit-client");
  const response = await fetch("/api/livekit/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ roomId, publishWidgetId: widgetId, name: userName }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Not authorized to stream this tab");
  }
  const { token, url } = await response.json();
  const publisher = new lk.Room({ adaptiveStream: false, dynacast: true });
  try {
    await publisher.connect(url, token, { autoSubscribe: false });
    const lp = publisher.localParticipant;
    const pub = await lp.publishTrack(track, {
      name: widgetId,
      source: lk.Track.Source.ScreenShare,
      simulcast: true,
      videoCodec: LIVE_CODEC,
      screenShareEncoding: { maxBitrate: 3_000_000, maxFramerate: 30 },
      screenShareSimulcastLayers: [
        new lk.VideoPreset(320, 180, 150_000, 15),
        new lk.VideoPreset(640, 360, 600_000, 24),
      ],
      degradationPreference: "maintain-resolution",
    });
    return {
      stop: async () => {
        try { if (pub.track) await lp.unpublishTrack(pub.track, false); }
        catch {}
        finally { await publisher.disconnect(); }
      },
    };
  } catch (error) {
    await publisher.disconnect().catch(() => {});
    throw error;
  }
}

// ---- ref-counted per-room registry ----------------------------------------

interface Entry {
  promise: Promise<LiveSession>;
  refs: number;
  timer?: ReturnType<typeof setTimeout>;
}
const registry = new Map<string, Entry>();

async function createSession(roomId: string, name: string) {
  const lk = await import("livekit-client");
  const session = new LiveSession(lk, roomId, name);
  await session.connect();
  return session;
}

export function acquireSession(roomId: string, userName: string) {
  let entry = registry.get(roomId);
  if (!entry) {
    const created: Entry = { refs: 0, promise: createSession(roomId, userName) };
    created.promise.catch(() => {
      if (registry.get(roomId) === created) registry.delete(roomId);
    });
    registry.set(roomId, created);
    entry = created;
  }
  const held = entry;
  if (held.timer) {
    clearTimeout(held.timer);
    held.timer = undefined;
  }
  held.refs += 1;
  let released = false;
  return {
    session: held.promise,
    release() {
      if (released) return;
      released = true;
      held.refs -= 1;
      if (held.refs > 0) return;
      // keep the connection warm briefly so scrolling around doesn't reconnect
      held.timer = setTimeout(() => {
        if (held.refs > 0) return;
        if (registry.get(roomId) === held) registry.delete(roomId);
        held.promise.then((s) => s.close()).catch(() => {});
      }, 8000);
    },
  };
}
