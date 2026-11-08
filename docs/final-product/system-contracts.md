# System contracts — target v1

**Version:** 1.0.0 · **Status:** target contracts, **NOT current deployed API**. **Milestones:** M00.05, M02, M06, M10–M15, M17.

## 1. Ownership boundaries and packages

| Layer/package | Owns | Can depend on | Must not own |
| --- | --- | --- | --- |
| `apps/desktop` Electron main / browser manager | Native sessions, profile storage, permissions, captures, view bounds, crashes | Typed browser contracts, local storage | Cloud authorization policy or shared workspace DB |
| `apps/web` renderer | Canvas, UX, camera, local selection, viewport and commands | UI, canvas and typed API clients | Native browser lifetime or cloud secrets |
| `apps/api` | Verified identity, authorization, business transactions and server state | Database/domain, auth, validation | Local browser sessions |
| `services/realtime` | Authenticated socket rooms, transient collaboration, ordered durable change notifications, leases | Auth, collaboration, persistence | Master source of database records, client-claimed identity |
| `packages/browser-contracts` | Versioned IPC command/event types and lifecycle state | Portable TypeScript types only | Electron singleton or renderer state |
| `packages/canvas` | Camera transforms, spatial queries, hit-test and input arbitration | Pure math, shape types | Network, direct Electron privileges |
| `packages/collaboration` | Event contracts, leases, versions, idempotency and validation | Domain types | Browser cookies and DOM |
| `packages/database` | Prisma schema, migrations, transactions, repository | Hosted API/service only | Frontend app bundle |
| `packages/ui` | Tokens, components and accessibility | React and design tokens | Cloud policy or browser engine internals |

These are final **package boundaries**. During migration the same responsibilities may reside temporarily in existing folders. No automatic microservice split is mandated.

## 2. Browser Session Manager IPC (proposed, typed)

```ts
type TabId = string;
type ProfileId = string;
type WorkspaceId = string;
type TabGeneration = number;
type TabLifecycle =
  | "uninitialized" | "warming" | "active"
  | "background" | "suspended" | "crashed"
  | "recovering" | "closed";

interface BrowserSessionIdentity {
  tabId: TabId;
  workspaceId: WorkspaceId;
  profileId: ProfileId; // opaque local reference, not a cloud cookie jar
  generation: TabGeneration;
}
type BrowserCommand =
  | { type: "tab.create"; identity: BrowserSessionIdentity; initialUrl: string }
  | { type: "tab.attach"; identity: BrowserSessionIdentity; viewId: string; bounds: ScreenRect }
  | { type: "tab.detach"; identity: BrowserSessionIdentity; reason: "offscreen" | "space-hidden" | "window-hidden" }
  | { type: "tab.navigate"; identity: BrowserSessionIdentity; url: string }
  | { type: "tab.history"; identity: BrowserSessionIdentity; direction: "back" | "forward" | "reload" }
  | { type: "tab.bounds"; identity: BrowserSessionIdentity; bounds: ScreenRect; zIndex: number }
  | { type: "tab.priority"; identity: BrowserSessionIdentity; priority: "active" | "background" | "suspended" }
  | { type: "tab.close"; identity: BrowserSessionIdentity; reason: "user" | "workspace-deleted" };
interface ScreenRect { x: number; y: number; width: number; height: number; scaleFactor: number }
```

All handlers MUST verify the **sender's Electron webContents**, app origin, user/profile binding, tab ownership, workspace permission and generation. No arbitrary webview ID or URL is an authority token. Events MUST include a request ID, generation and bounded payload, and errors MUST be typed with retriable/not-retriable classification. Browser manager emits URL/title/loading/navigation/crash/audio/capture/lifecycle changes; actual browser URL is source-of-truth over initial widget metadata.

Native view geometry: `screenX = worldX × zoom - cameraX`; `screenY = worldY × zoom - cameraY`; account for main viewport offset, sidebar, display scale, clipping, z-order and focus. Browser view detach is NOT close.

## 3. Canonical durable operation protocol (proposed)

```ts
type WorkspaceOperation = {
  protocolVersion: 1;
  workspaceId: string;
  operationId: string;        // stable idempotency key
  actorId: string;            // server-derived from verified token
  baseRevision: number;
  kind: "widget.create" | "widget.move" | "widget.resize" | "widget.close"
      | "widget.metadata" | "workspace.rename" | "member.change"
      | "chat.send";
  payload: unknown;           // kind-specific schema validated server-side
};
type WorkspaceCommit = {
  workspaceId: string;
  operationId: string;
  sequence: number;           // monotonically increasing server revision
  committedAt: string;
  result: unknown;
};
```

- API: `POST /v1/workspaces/:id/operations` accepts validated writes with authorization and idempotency; `GET /v1/workspaces/:id/snapshot?after=revision` returns a canonical snapshot plus ordered operations (or a full resync).
- Socket: `workspace:subscribe` authenticates room access; `workspace:commit` transports only server-accepted commits; `workspace:presence`, `cursor:move` and provisional `widget:preview` are transient, throttled and may be dropped.
- Geometry conflicts: short-lived writer/drag lease, throttled provisional preview, validated final geometry with version check; stale base revision triggers explicit conflict/rebase. Do not default to opaque LWW on every domain object.
- Reconnect: obtain last acknowledged revision, fetch gaps, retry idempotent pending operations and converge before showing ready. Revoked identities may not replay.
- Chat: persistent messages in PostgreSQL with bounded pagination; avoid indefinite in-memory-only history.

## 4. Lease, presence and media contracts

- `TabHostLease { workspaceId, tabId, hostUserId, hostDeviceId, generation, expiresAt }` — server-verified owner; reconnect grace; invalidated on revocation.
- `ControlLease { workspaceId, tabId, controllerUserId, generation, expiresAt }` — exclusive; one controller; generation-fenced input.
- Media tokens: minted by hosted API with workspace/session role and narrowly scoped grants, short TTL and auditable issuance. Media SFU owns video/audio; Socket.IO carries only authenticated signaling/input, not bulk video frames.
- Presence/cursors: volatile and scoped; user identity derived from socket auth; never a durable workspace operation.
- Local camera `{workspaceId, zoom, x, y}`, selected widgets, panels, rail state: device/user preferences, not remote collaborative data.

## 5. Canonical storage mapping

| Domain object | Storage | Privacy / lifecycle |
| --- | --- | --- |
| User, Workspace, WorkspaceMember | PostgreSQL | Server auth/role checks |
| Widget | PostgreSQL | Stable ID, kind, x/y/w/h, version, tombstone, safe metadata |
| BrowserTabMetadata | PostgreSQL only for approved safe fields | Does not contain profile cookies or arbitrary personal URL tokens |
| BrowserProfile reference | Local SQLite + Chromium partition store | Per-user/device; opaque ref in cloud only if needed |
| WorkspaceOperation / Snapshot | PostgreSQL | Ordered, idempotent, restorable |
| ChatMessage | PostgreSQL | Role-scoped, retention governed |
| TabHostLease / ControlLease | Authenticated realtime + server-backed coordination | Expiry, generation, revocation |
| Camera, pending queue, local recovery | SQLite per-account | Atomic and migratable |
| Cookies, web storage, actual webContents | Chromium/Electron local profile | Never uploaded silently |
| Credentials | OS secure storage / server secrets | Never plain JSON in desktop build |

## 6. Backward compatibility

- Target protocol v1 is **not implemented yet** and MUST NOT be used as a claim that current socket handlers/API routes support it.
- During migration, ship type adapters and feature flags with version negotiation; never change persisted semantics in place without a migration/rollback.
- Current `Room`/`Widget` records map to `Workspace`/`Widget` without reusing old titles or URLs as tab IDs. Initial widget URLs and native navigated URLs must be tracked separately.
- Delete legacy handlers only after test parity, no unreconciled operations and approved data migration. Existing session profiles remain locally intact.
