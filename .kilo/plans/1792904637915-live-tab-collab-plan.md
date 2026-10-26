# Cubics Live Tab — Collaborative Web Browsing Plan

## Context

Cubics is an existing Next.js 14 + socket.io + Prisma + Clerk + Electron app (src/app/rooms/[id]/page.tsx). Users create rooms, drop widgets (iframe tabs, tab-share, shared-browser, live-tab) on an infinite canvas, and collaborate in real time.

This plan adds **multi-user collaborative control of a single live tab** — a website loaded in an iframe that multiple users can jointly click, scroll, and type into. One user holds the "control token" at a time; others watch.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Network | WebRTC P2P DataChannels for input events; socket.io (:3001) for signaling + room join + token arbitration | Zero-latency peer-to-peer after handshake; signaling reuses existing infra; works on LAN without internet |
| Sync model | CRDT — immutable interaction ops with Lamport timestamp + userId; deterministic merge | Concurrent events never conflict; offline-capable; reconnect syncs missed ops |
| Rendering | Iframe loads website; injected content script receives control ops via `postMessage` and dispatches real DOM events | Websites render normally; sandboxed; parent controls without same-origin restrictions |
| Input arbitration | Turn-based token — one "controller" at a time; token passed via socket.io state events | User accepted "only one at a time"; prevents conflicting input on the page |
| Deployment | Electron desktop app (existing electron/ + electron-builder.yml) | Bundles Next.js build + socket.io server; runs fully offline on LAN; zero external deps |
| Persistence | Local JSON/SQLite in Electron app data (no external DB) | Free, local-only, no VPS/third-party hosting |
| Auth | Clerk (existing) for room join; simplified for local-only if needed | Reuses existing auth infra |

## Data model additions

**src/types/index.ts** — add to `Widget` type union: `"live-tab"` (already done in prior edits). Add new types:

```ts
export type InputOp = {
  id: string;           // cuid
  widgetId: string;
  userId: string;
  userName: string;
  seq: number;          // Lamport logical clock per sender
  type: "mousedown" | "mouseup" | "click" | "mousemove" | "keydown" | "keyup" | "wheel" | "scroll";
  x?: number;           // relative to iframe (0-1 normalized)
  y?: number;
  key?: string;
  code?: string;
  button?: number;
  deltaY?: number;
  timestamp: number;    // wall-clock ms
};

export type ControlToken = {
  widgetId: string;
  holderId: string | null;   // socket.id of current controller
  holderName: string;
  version: number;           // increments on token transfer
};
```

## Architecture

```
Client A (Electron)                          Client B (Electron)
┌─────────────┐                            ┌─────────────┐
│  Iframe     │                            │  Iframe     │
│  (website)  │                            │  (website)  │
│  + content  │                            │  + content  │
│  script     │◄── postMessage ────────────│  script     │
└──────┬──────┘   control op (CRDT op)      └──────┬──────┘
       │                                           │
       │ WebRTC DataChannel (P2P)                  │ WebRTC DataChannel (P2P)
       ▼                                           ▼
┌─────────────────────────────────────────────────────────────┐
│  socket.io signaling server (:3001, local LAN)              │
│  - room:join                                                  │
│  - widget:input  (forward CRDT op to peers)                   │
│  - token:request / token:grant / token:release                │
│  - cursor:move (remote cursor overlays)                       │
└─────────────────────────────────────────────────────────────┘
```

## Implementation tasks (ordered)

### 1. Socket server — signaling + token arbitration + input forwarding
File: `src/socket-server.ts` (and `socket-server.cjs` mirror)

- Add `widget:input` handler: receive CRDT op from sender, broadcast to all other peers in room (not sender).
- Add `token:request`, `token:grant`, `token:release` handlers: maintain `ControlToken` state per widgetId; grant token to first requester if free, queue others; broadcast token state changes.
- Add `cursor:move` handler (already exists in cursor server — merge or extend).
- On disconnect: release any held tokens, remove queued requests.

### 2. Client — WebRTC P2P manager
New file: `src/components/LiveTabPeer.ts` (or hook)

- Wrap `RTCPeerConnection` + `RTCDataChannel` per room/widget.
- Use socket.io for SDP/ICE signaling exchange.
- On datachannel message: deserialize CRDT op; apply to local state; forward to iframe content script via `postMessage`.
- Expose `sendInputOp(op)` and `onInputOp(callback)`.

### 3. Client — IframeCard live-tab input forwarding
File: `src/app/rooms/[id]/page.tsx` — `IframeCard` (already partially edited)

- For `widget.type === "live-tab"`:
  - Connect WebRTC peer via `LiveTabPeer`.
  - On container mouse/key/wheel events: if this client holds the token, serialize input op (CRDT), send via WebRTC, apply locally.
  - Listen for remote ops from WebRTC: `postMessage({ type: "LIVE_INPUT", input })` to iframe contentWindow.
  - Render remote cursor overlay (small dot + user name) positioned relative to iframe.
- Token UI: show "You control" / "Waiting for [user]" badge in widget header; request token on first interaction if not held.

### 4. Content script injection
- When iframe finishes loading (same-origin proxy or same-origin site), inject a `<script>` that:
  - Listens for `window.postMessage` events of type `LIVE_INPUT`.
  - Maps normalized (x, y) to page coordinates via `document.elementFromPoint`.
  - Dispatches `MouseEvent`/`KeyboardEvent`/`WheelEvent` on the target element.
- For cross-origin sites: control is limited to same-origin pages unless a local proxy rewrites origins (documented limitation).

### 5. Electron packaging
- `electron/main.js`: load built Next.js app; spawn socket.io server as child process on :3001.
- `electron-builder.yml`: already configured for macOS build.
- `app:dev` script: already runs `next dev` + `node socket-server.cjs` + `electron .`.

### 6. Types & validation
- `src/types/index.ts`: add `InputOp`, `ControlToken`; ensure `Widget.type` includes `"live-tab"`.
- Run `tsc --noEmit` clean.

## Risks & limitations

| Risk | Mitigation |
|---|---|
| Same-origin policy blocks synthetic events on cross-origin iframes | Control works on same-origin sites; cross-origin sites are view-only unless a local origin-rewriting proxy is added later |
| WebRTC NAT traversal fails on some LANs | socket.io fallback: route input ops through the signaling server as relay |
| Token starvation (one user hogs control) | Add auto-release after N seconds of inactivity; token request queue |
| iframe content script injection blocked by CSP | Documented; sites with strict CSP are view-only |
| Large stroke/event volume | CRDT ops are small JSON; DataChannels handle high frequency; throttle mousemove to ~30fps |

## Validation steps

1. `tsc --noEmit` passes with no errors.
2. Run `npm run app:dev` locally on two machines (or two Electron instances) on the same LAN.
3. Create a room, add a live-tab widget loading `https://example.com`.
4. User A requests and receives token; clicks/scrolls in the iframe; User B sees the same interactions reflected in their iframe (via postMessage).
5. User B requests token; token transfers; User B now controls, User A is read-only.
6. Remote cursor overlay appears and moves correctly for non-controlling users.
7. Disconnect/reconnect: token releases, missed ops replay on reconnect.

## Open questions (non-blocking)

- Should token auto-release after inactivity? (Recommended: yes, 30s)
- Should missed CRDT ops be buffered and replayed on reconnect? (Recommended: yes, last-N ops)
- Should cross-origin control use a local proxy? (Out of scope for v1)
