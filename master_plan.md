# Cubics — MASTER PLAN

> **Status:** Target architecture and final-product completion contract. **Not a claim that implementation is finished.**  
> **Canonical checklist:** [master_checklist.md](master_checklist.md)  
> **Source of current state:** `main` of `ybcole/cubics`, reviewed 2026-11-08.  
> **Scope:** Desktop-first GA on macOS (Apple Silicon / Intel) and Windows 11 x64. Linux is not a GA promise until explicitly certified.  
> **Completion definition:** All Milestones 00–24, their exit tests, and global release gates below are verified and signed off.

## 1. The end of the architecture — not the end of maintenance

This is the **one deliberate end-state architecture** for Cubics. The intent is to stop repeated UI, browser-engine and realtime rewrites after completion. No new foundational framework or second architecture should be introduced without a documented, exceptionally compelling need. **Absolute "never refactor again" cannot responsibly be guaranteed**: security vulnerabilities, supported OS/runtime upgrades, browser-engine changes and defects may require internal changes. The contract is to **freeze stable public/domain boundaries after Milestone 24**, perform ordinary maintenance within them, and require an Architecture Decision Record (ADR), compatibility plan, and explicit sign-off for any structural exception.

Cubics is a **persistent browser workspace with a collaborative spatial canvas**, not a whiteboard that happens to contain disposable browser elements. A browser tab is a **native resource with a stable identity and lifetime independent of its React canvas widget**.

### End-user promises

1. **Continuity:** Panning, zooming, changing sidebar visibility and temporarily moving a tab off-screen never reload or destroy a healthy browser session. A tab navigated from Google to Twitch must return as Twitch while the app/session remains alive.
2. **Performance:** A large canvas remains responsive without treating every distant widget as an actively painted web browser or decoded livestream.
3. **Explicit privacy:** A Personal tab's content, cookies, and profile remain private. Live and Shared access require authorization and obvious user consent.
4. **Reliable collaboration:** Authorized participants converge on the same durable widget geometry and room state; cursors and media are intentionally ephemeral.
5. **Honest recovery:** After application crash, forced kill, DRM restrictions or server failure, Cubics restores recoverable metadata, URLs, cookies and layout; it does **not** promise arbitrary DOM, JavaScript memory, unsaved form contents or third-party video position can be perfectly resurrected.
6. **Shippability:** A signed, secure, updateable desktop app operates against a hosted backend without embedding server secrets.

## 2. Final architecture and hard ownership boundaries

```text
Cubics Desktop (signed Electron)
├── Electron main process / BrowserSessionManager (native Chromium)
│   ├── Browser profiles, isolation, permissions, navigation, downloads
│   ├── Tab lifecycle, crash recovery, hosting, capture and bounded resources
│   └── WebContentsView / browser-surface compositor and typed IPC bridge
├── React + TypeScript UI (Next.js web UI / desktop client)
│   ├── Minimal canvas, workspace navigation, widget shells and UX
│   ├── Camera / spatial index / input arbitration / visible surfaces
│   └── Local state, offline queue, room sync, viewer subscriptions
├── SQLite local cache (per-user) + Chromium partition storage + OS keychain
└── HTTPS / WSS / WebRTC to cloud (no shipped privileged cloud secrets)
                           |
Cubics Cloud — free-first, upgrade providers in place (ADR-0008)
├── Vercel Next.js UI + versioned authenticated API (Clerk auth and room ACL)
├── Supabase PostgreSQL + Prisma (canonical durable domain model)
├── Supabase private Realtime Broadcast/Presence (ephemeral and commit hints)
├── Clerk identity (verified session tokens / Supabase third-party JWT)
├── LiveKit SFU (voice and Live/Shared audio/video)
├── Managed object storage (authorized avatars and attachments)
└── Operations: TLS, protected secrets, observability, backups and signed updates
```

**Owners of truth:**

| Responsibility | Owner | Never make this the owner |
| --- | --- | --- |
| Running browser process, URL/history, cookies, live DOM, local profile | Electron BrowserSessionManager | React component / room database |
| Camera, zoom, selection, open panels | User's local UI/cache | Shared room event stream |
| Workspace membership, geometry and versions | Vercel authenticated API + Supabase PostgreSQL | Unvalidated Realtime Broadcast / Socket.IO payload |
| Presence, transient cursors, drag preview | Supabase private Realtime channels with Clerk JWT/RLS | Permanent database log |
| Session host/controller leases | Authenticated API + durable authority; dedicated coordination only if warranted at scale | Client Broadcast or untrusted client IDs |
| Media subscription, video transport, voice | LiveKit integration | Supabase Realtime / Socket.IO binary frames |
| Offline operations and recovery snapshots | Local SQLite and server revision log | Unsynced in-memory React state |
| Server-only secrets | Server-side managed secret store | Desktop binary, client JS or browser partition |

### Technology commitments

- **Electron** with Chromium, isolated profiles and a privileged main-process browser manager. Prototype **WebContentsView** and migrate behind an adapter after parity, because it is native and offers direct lifecycle control, but **native views do not live inside the DOM**: exact overlay, clipping and camera behavior must be proven. The current `<webview>` path stays behind a temporary feature flag until verified, then is retired.
- **React / TypeScript / Next.js** for the UI and a separately hosted API; upgrade to supported releases. The desktop may initially serve bundled UI locally, but must not ship or run a privileged local database/server authority.
- **Free-first target: Vercel** Next.js UI/versioned authenticated API (Hobby for personal non-commercial development, Pro before commercial use), **Supabase PostgreSQL + Prisma** durable cloud state and **private Supabase Realtime** ephemeral presence/commit hints, **Clerk** identity/third-party JWT, **LiveKit Cloud SFU** for audio/video, **SQLite** local cache and sync log. Same managed projects upgrade to paid plans; Electron personal browsing stays local. The existing Socket.IO service is a **temporary compatibility fallback** only. Introduce a dedicated actor/coordination tier at measured scale if required by lease/control semantics; no Redis dependency for free-first hosting. See [ADR-0008](docs/adr/0008-free-first-upgrade-path.md). Use Zustand or similarly small UI stores.
- **Custom camera/spatial engine** using requestAnimationFrame, world-coordinate geometry, a spatial index and bounded native-view updates; `react-rnd` may remain where it meets interaction/parity requirements. Do not blanket-rewrite working components without failing a contract.
- **One monorepo**, target boundaries `apps/desktop`, `apps/web`, `apps/api`, `services/realtime` (compatibility/adapter code, not a required paid always-on server), `packages/{canvas,browser-contracts,collaboration,ui,database}`; these are code-ownership boundaries, **not** a mandate for many separately deployed microservices.
- **Out of scope for this GA:** full arbitrary DOM/JS-state persistence after crash, implicit screen sharing, platform-agnostic migration of logged-in browser processes, generic CRDTs for all data, custom SFU/media stack, browser automation engine, mobile-native clients, and unqualified Linux support.

Official technical references to recheck at implementation time: [Electron web embeds](https://www.electronjs.org/docs/latest/tutorial/web-embeds), [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security/), [LiveKit](https://docs.livekit.io/).

## 3. Global product constraints and service contracts

### Browser continuity contract

- A tab has **one stable ID**, a profile owner, a mode, a current native session generation and a separate visual widget.
- Off-screen != destroyed; hidden rail != closed; widget-shell virtualization != browser session deletion; disconnecting a stream viewer != stopping the host browser.
- Initialize nearby guests lazily, then preserve their live session across camera movement. Background work may be throttled only when compatible with audio, playback, authentication and capture. **No forced automatic reload to initial URL**.
- Close/destruction is an explicit lifecycle event with a well-defined ownership and cleanup path.
- Full app restart/crash is a different promise: use recovery checkpoints and user-facing limitations.

### Realtime and data contract

- Authenticated server is authoritative for room access and durable widget mutations. Every operation has an ID; every room snapshot/revision can be reconciled after reconnect.
- Temporary drag previews, presence and cursors are lossy and ephemeral. Geometry commits have deterministic conflict policy and versions. Use scoped leases for ownership; reserve CRDTs for actual text co-editing if needed.
- Browser cookies, arbitrary webpage state, DRM data and personal browser content are **never** sent to the collaborative cloud by default.
- Two users may view the same canvas but have independent local camera and personal browsing sessions.

### Security and distribution contract

- No production database URL, Clerk secret key, LiveKit secret, private signing material or other server authority in distributed Electron/Next artifacts.
- Browser sessions follow least privilege: sandbox, context isolation, no Node in remote pages, narrow sender-checked IPC, explicit capture permissions, verified popup/external URL handling.
- Network identity, authorization, versioned protocols and permitted input are enforced in the cloud—not inferred from client-declared user IDs.
- Signed installers/updates, authenticated HTTPS/WSS, staged rollouts and rollback are required.

### Practical performance qualification (targets, not current measurements)

Establish a repeatable midrange macOS and Windows reference-device matrix early in Milestone 21; **record real hardware specifications and baseline measurements**. Qualification scenarios: **10, 25, and 100 placed widget shells**, with representative subsets of active browser guests and LiveKit views, dense viewport, high DPI, mixed audio and offscreen transitions. Aim for fluid 60Hz camera interaction on supported baseline machines; frame-time and latency release thresholds must be **measured, approved and published**, not guessed. Set explicit CPU/GPU/RAM, decode, crash and resume budgets per device tier. No page reload from simply moving offscreen is a **zero-tolerance correctness requirement**, not a best-effort performance metric.

## 4. Milestone sequencing, evidence, and release gates

- Each milestone below is **required**. Dependencies are technical prerequisites; implementation may proceed in parallel when contracts and security allow. Do not call a milestone complete because code was merged.
- `master_checklist.md` mirrors all tasks and exit criteria. Every completed box needs a PR/commit, automated run, benchmark, audit, or signed manual-test link in the milestone evidence register.
- A blocker in authorization, secret hygiene, tab continuity, data loss, accessibility-critical flows, installer trust, backup recovery or release regression prevents GA sign-off.
- Compatibility adapters and feature flags are allowed **during migration only**; remove superseded paths before final architecture freeze.
- **Global release gates:** (G1) threat model / all permissions audited, (G2) no shipped backend secrets, (G3) browser life-cycle parity, (G4) durable reconnect/offline reconciliation, (G5) multiuser/media isolation, (G6) benchmark and accessible UX sign-off, (G7) signed upgrade/rollback and backup restore, (G8) full test pass with no open P0/P1 regressions, (G9) documentation/ADR frozen, (G10) named final sign-off.

### Execution phases

| Phase | Milestones | Output |
| --- | --- | --- |
| Foundation | 00–04 | Frozen product contract, cloud/identity trust boundary, hardened desktop |
| Browser | 05–09 | Isolated profiles, native session lifetime, view parity, recovery, resource budgets |
| Canvas and UX | 10–12 | Predictable camera, spatial rendering, accessible final UI |
| Data | 13–14 | Canonical schema, durable revisions, local-first recovery/sync |
| Collaboration and media | 15–18 | Authorized realtime, chat/presence, leases, LiveKit |
| Operations and qualification | 19–21 | Deployable scalable cloud, telemetry, automated performance/security gates |
| Release and architecture lock | 22–24 | Signed installers, safe migration, certified GA architecture |

## 5. Numbered delivery milestones

### Milestone 00 — Final product contract, technical governance, and architecture freeze policy [COMPLETED]

**Phase:** Foundation · **Dependencies:** None · **Tracking ID:** M00

**Objective:** Define exactly what Cubics will ship, what must never regress, and the conditions for one deliberate architectural consolidation followed by a stable, maintainable product.

**Required work:**

- **M00.01** Approve the product definition: a desktop-first, persistent, collaborative infinite browser canvas—not a generic document editor or a web browser replacement.
- **M00.02** Declare GA platforms as current supported macOS (Apple Silicon and Intel) and Windows 11 x64; explicitly document Linux and other platforms as outside GA until separately certified.
- **M00.03** Specify the three tab modes (Personal, Live, Shared), their ownership, privacy, permissions, audio, capture, and control semantics.
- **M00.04** Publish product invariants: panning/zooming never destroys a live tab; canvas position is personal; private browsing content is not implicitly shared; cloud operations are authorization-checked.
- **M00.05** Adopt the component boundaries, service interfaces, event contracts, database model, and staged migration map described in this document.
- **M00.06** Create versioned Architecture Decision Records (ADRs), a dependency/support matrix, an accessibility standard, and an evidence policy for every completion checkbox.
- **M00.07** Record all current deviations from the target design, including the local Next server with bundled environment variables, unauthenticated realtime claims, and renderer-owned webview lifetimes.
- **M00.08** Set scope-control rules: new work is admitted only by documented product or security need, acceptance tests, and an approved ADR.
- **M00.09** Establish the final architecture freeze rule: after Milestone 24 sign-off, structural redesigns require an exceptional safety or product-compatibility justification; routine patches, supported dependency upgrades, and security maintenance continue.

**Exit criteria (both mandatory):**

1. Signed-off scope, target platforms, domain contracts, ADR log, deviations inventory, and final-release gates are versioned in the repository.
2. Every required final-product feature has a numbered milestone and a traceable item in master_checklist.md.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 01 — Trust boundaries, threat model, and security baseline

**Phase:** Foundation · **Dependencies:** 00 · **Tracking ID:** M01

**Objective:** Make security architecture a release prerequisite, not a cleanup task.

**Required work:**

- **M01.01** Map all trust boundaries: app renderer, Electron main, external pages, preload/IPC, browser sessions, hosted API, WebSocket service, PostgreSQL, LiveKit, and updater.
- **M01.02** Threat-model hostile websites, malicious workspace members, compromised tokens, forged room events, popups, downloads, media capture, deep links, and updates.
- **M01.03** Inventory all endpoints, Socket.IO events, IPC handlers, third-party domains, data classes, and the permissions each requires.
- **M01.04** Write a least-privilege access matrix for owner/admin/member, personal browser owner, live host, shared controller, and viewer.
- **M01.05** Define safe URL/protocol handling, sensitive-field redaction, request validation, rate limits, CSRF/origin defenses, and CORS policy.
- **M01.06** Add dependency/license/SBOM scanning, secret detection, and a documented vulnerability response and disclosure process.
- **M01.07** Create negative authorization tests that prove cross-room and cross-user operations are denied.
- **M01.08** Record explicit threat-model mitigations and their automated security tests before functionality is migrated.

**Exit criteria (both mandatory):**

1. Threat model and controls matrix approved; security-critical risks have a named mitigation and a test.
2. Security lint/scans and a denied-access integration suite run as CI merge gates.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


**Free-first infrastructure decision (2026-11-08):** [ADR-0008](docs/adr/0008-free-first-upgrade-path.md) selects Vercel Hobby→Pro + Supabase PostgreSQL/private Realtime Free→Pro + Clerk + LiveKit. Source choice does not meet deployment/rollback exit criteria; current Socket.IO is temporary.

### Milestone 02 — Cloud boundary, deployable architecture, and secret removal

**Phase:** Foundation · **Dependencies:** 00, 01 · **Tracking ID:** M02

**Objective:** Stop shipping cloud authority and production secrets inside the desktop bundle.

**Required work:**

- **M02.01** Define the monorepo boundaries: apps/desktop, apps/web, apps/api, services/realtime, packages/canvas, browser-contracts, collaboration, ui, and database.
- **M02.02** Move all privileged PostgreSQL and Prisma operations to a hosted, authenticated API; keep the desktop frontend a client, not a backend with database authority.
- **M02.03** Move Clerk secret keys, LiveKit signing secrets, database URLs, and server-only credentials entirely into server-side secret management.
- **M02.04** Design the packaged desktop UI to start without a production secret-bearing local Next server; retain a compatible local development workflow.
- **M02.05** Introduce versioned HTTPS API endpoints and typed client contracts for workspaces, widgets, identity, sharing, and sync.
- **M02.06** Implement secure environment separation for development, staging, and production with infrastructure-as-code and minimal service accounts.
- **M02.07** Create backward-compatible API versioning, feature flags, and a staged migration from current Next routes.
- **M02.08** Validate an extracted distributable artifact for hard-coded secrets, local privileged API availability, and insecure configuration.
- **M02.09** Plan a migration rollback path that does not invalidate existing user workspaces or local browser profiles.

**Exit criteria (both mandatory):**

1. Production desktop artifact contains no server-side secrets or direct privileged database access.
2. Desktop-to-cloud functionality works on staging using authenticated HTTPS APIs; rollback drill passes.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 03 — Identity, roles, workspace permissions, and account management

**Phase:** Foundation · **Dependencies:** 01, 02 · **Tracking ID:** M03

**Objective:** Make authenticated identity and room authorization authoritative everywhere.

**Required work:**

- **M03.01** Keep Clerk as the identity provider; implement verified tokens and session renewal without inconsistent desktop origins or redirect loops.
- **M03.02** Make user IDs, room IDs, roles, and device IDs server-derived or independently validated rather than trusted from client event payloads.
- **M03.03** Enforce owner/admin/member policies on every REST handler, widget operation, room mutation, invitation, token issue, and realtime event.
- **M03.04** Implement invitation, membership, leave, revocation, ownership transfer, deletion, and private-room discovery behavior.
- **M03.05** Define multi-account switching with isolated local browser profiles and no accidental account crossover.
- **M03.06** Implement device/session sign-out, expired-session handling, account deletion, and privacy-data export/delete workflows.
- **M03.07** Restrict media and remote-control tokens to their authorized workspace, session, and capabilities.
- **M03.08** Test revocation during an active collaboration session and verify all active subscriptions/control grants are withdrawn.

**Exit criteria (both mandatory):**

1. REST, WebSocket, IPC-to-cloud actions, and LiveKit issuance enforce identical authorization semantics.
2. Multi-account, sign-out, expired token, and membership-revocation end-to-end tests pass.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 04 — Electron hardening, privileged IPC, and native platform boundaries

**Phase:** Foundation · **Dependencies:** 01, 02, 03 · **Tracking ID:** M04

**Objective:** Use Chromium as a browser engine without letting untrusted webpages control the desktop.

**Required work:**

- **M04.01** Enable appropriate sandboxing, context isolation, and disabled Node integration for remote content; remove unnecessary sandbox:false usage.
- **M04.02** Replace broad renderer privileges with a narrow, versioned, typed preload bridge whose sender and target IDs are validated.
- **M04.03** Define allowlists and explicit user permission prompts for microphone, camera, screen capture, clipboard, geolocation, file selection, and downloads.
- **M04.04** Handle popups, navigation, external protocols, OAuth, deep links, and shell.openExternal through validated decisions; do not blindly allow webview popups.
- **M04.05** Use HTTPS for external content and a restrictive app Content Security Policy; remove broad response-header stripping where it defeats origin security.
- **M04.06** Separate and protect all browser partitions and storage contexts; validate webContents ownership on every native operation.
- **M04.07** Harden Electron fuses, application protocol handling, update signatures, and navigation restrictions.
- **M04.08** Test hostile website scenarios, untrusted IPC callers, sandbox escape boundaries, and permission revocation on macOS and Windows.

**Exit criteria (both mandatory):**

1. Electron's supported security checklist is met with documented exceptions and threat-model sign-off.
2. Security and native-permission E2E tests pass with arbitrary external sites open.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 05 — Browser profiles, privacy isolation, and ownership

**Phase:** Browser · **Dependencies:** 03, 04 · **Tracking ID:** M05

**Objective:** Guarantee that personal browser data stays personal even inside shared spaces.

**Required work:**

- **M05.01** Define stable BrowserProfile IDs owned by a user and device, separate from workspace membership.
- **M05.02** Store cookies, localStorage, IndexedDB, service workers, caches, and history using correctly partitioned Electron profiles.
- **M05.03** Use a distinct opt-in collaborative profile for Shared tabs; never implicitly reuse a Personal tab's authenticated profile.
- **M05.04** Define exactly which metadata may be synced (tab ID, share mode, safe title/URL fields) and redact sensitive URL parameters, titles, and profile identifiers where applicable.
- **M05.05** Make Live sharing explicit, visibly active, revocable, and restricted to authorized viewers.
- **M05.06** Provide profile sign-out, data clearing, retention, export/delete, and account-switching controls.
- **M05.07** Keep OS-protected secrets out of ordinary synced workspace records and unencrypted local preferences.
- **M05.08** Test two Cubics accounts, multiple workspaces, cookies, shared-control interactions, and device restart for data isolation.

**Exit criteria (both mandatory):**

1. No test can read another user's personal cookies or personal-page pixels without explicit authorized sharing.
2. Profile persistence and account separation pass real Electron integration tests.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 06 — Main-process Browser Session Manager and lifecycle contracts

**Phase:** Browser · **Dependencies:** 04, 05 · **Tracking ID:** M06

**Objective:** Make a browser tab a durable native resource—not a disposable React component.

**Required work:**

- **M06.01** Implement a main-process BrowserSessionManager keyed by stable tab ID, browser profile, workspace context, and host generation.
- **M06.02** Define typed create, attach, detach, navigate, back, forward, reload, resize, suspend, resume, crash, and destroy commands with authorization checks.
- **M06.03** Model Uninitialized, Warming, Active, Background, Suspended, Crashed, and Closed states with explicit legal transitions.
- **M06.04** Ensure camera pan, zoom, sidebar motion, widget UI remount, and DOM virtualization do not destroy an already loaded browser process.
- **M06.05** Record current URL, navigation entries where permitted, title, favicon, loading, crash, and audio state from the native browser authority—not an initial widget URL prop.
- **M06.06** Separate the lifetime of a tab resource from the lifetime of its canvas view, React component, and route.
- **M06.07** Add per-profile resource ownership, cleanup on explicit deletion, host ownership changes, and stale tab generations.
- **M06.08** Add lifecycle tracing and tests for repeated offscreen/on-screen cycles, route changes, retries, and profile switching.

**Exit criteria (both mandatory):**

1. A loaded Twitch-like page survives repeated pan/zoom and space-view transitions without reverting to its initial URL while its native session remains alive.
2. Lifecycle integration tests establish no unintended destroy/recreate on visibility changes.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 07 — Browser surface compositor and WebContentsView migration

**Phase:** Browser · **Dependencies:** 06, 10 · **Tracking ID:** M07

**Objective:** Move toward supported main-process browser surfaces without compromising the canvas.

**Required work:**

- **M07.01** Prototype WebContentsView for one Personal tab behind the BrowserSessionManager abstraction; retain a feature-flagged fallback during migration.
- **M07.02** Map world coordinates, camera translation, zoom, OS display scale, window resizing, sidebar width, and multi-monitor geometry to native view bounds.
- **M07.03** Implement deterministic z-order, focus, clipping, hit testing, occlusion, and overlays around native browser surfaces.
- **M07.04** Preserve web-native input, keyboard IME, touch/trackpad gestures, selection, accessibility focus, and widget drag/resize boundaries.
- **M07.05** Handle thumbnails, snapshots, previews, and offscreen placeholders separately from active native surfaces.
- **M07.06** Support capturePage/media-source acquisition without granting untrusted renderers direct native objects.
- **M07.07** Compare browser compatibility, performance, popup behavior, and security with the existing webview implementation.
- **M07.08** Migrate Personal, then Live, then Shared modes only after measurable parity; remove legacy webview code only after rollback is proven.

**Exit criteria (both mandatory):**

1. Native view geometry and stacking remain correct through zoom, panning, drag, resize, hidden rail, and display-scale changes.
2. Supported browser sites and multi-user controls pass parity tests; fallback can be retired without data loss.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 08 — Tab continuity, snapshot recovery, and crash boundaries

**Phase:** Browser · **Dependencies:** 06, 07, 13 · **Tracking ID:** M08

**Objective:** Preserve the exact running page during healthy sessions and recover honestly after failure.

**Required work:**

- **M08.01** Persist current navigated URL and allowed history metadata independently of the originally created widget URL.
- **M08.02** Restore camera position, widget geometry, saved scroll cues where feasible, and browser-profile cookies after application restarts.
- **M08.03** Keep browser sessions alive when panning away, hiding the sidebar, switching canvas views, or toggling non-destructive panels.
- **M08.04** Differentiate recoverable page state from unrecoverable live DOM/JavaScript memory, DRM playback, unsaved text, and external app state.
- **M08.05** Implement renderer crash, webContents crash, app crash, and power-loss recovery flows with actionable UI.
- **M08.06** Write bounded, atomic recovery checkpoints that do not expose session tokens or private content in shared cloud data.
- **M08.07** Define explicit reopen, reload, duplicate, close, archive, and clear-session actions; never silently substitute the initial URL.
- **M08.08** Test Twitch-style navigation from Google to a new domain, scroll/media progression, offscreen return, tab crash, and full app restart.

**Exit criteria (both mandatory):**

1. Viewport movement alone produces zero page reloads or lost navigation history on loaded tabs.
2. Recovery displays an accurate restored-state/result indicator and documents unavoidable external-site limitations.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 09 — Background resource scheduler and tab performance policy

**Phase:** Browser · **Dependencies:** 06, 08, 11, 18 · **Tracking ID:** M09

**Objective:** Keep hundreds of spatial widgets affordable without equating out-of-view with destroyed.

**Required work:**

- **M09.01** Use spatial visibility, selection, active audio, capture, tab priority, and available CPU/GPU/memory to decide resource tier.
- **M09.02** Keep Uninitialized tabs uncreated; allow Active, Background, and safe Suspended policies for already loaded sessions.
- **M09.03** Throttle avoidable captures/painting and viewer decodes offscreen while retaining native web state.
- **M09.04** Respect audible-background behavior: never automatically mute or pause wanted Twitch/music audio merely because the camera moves.
- **M09.05** Apply hysteresis, minimum dwell, and cool-down intervals to stop tier thrashing at viewport boundaries.
- **M09.06** Enforce configurable per-device soft/hard resource budgets with diagnostics and explicit user consent before discarding tabs.
- **M09.07** Avoid undocumented webContents throttling APIs or aggressive sleep that breaks playback, login refresh, or host controls.
- **M09.08** Run 10/25/100-widget mixed-workload benchmarks and track memory, CPU, GPU, video decode, load time, and interruption rates.

**Exit criteria (both mandatory):**

1. Pan-away/return preserves native state while background resource use demonstrably decreases in representative workloads.
2. Background audio, active sharing, and control leases continue according to user intent and documented policy.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 10 — Camera, interaction state machine, and canvas coordinate model

**Phase:** Canvas · **Dependencies:** 00, 06 · **Tracking ID:** M10

**Objective:** Make navigation precise and consistent without repainting the application on every pointer tick.

**Required work:**

- **M10.01** Isolate camera state as x, y, zoom, viewport, and world-to-screen transforms with a testable math module.
- **M10.02** Drive pan, pinch, trackpad zoom, wheel intent, and viewport changes through a requestAnimationFrame scheduler rather than React-wide rerenders.
- **M10.03** Keep pointer and keyboard gesture arbitration explicit for pan, select, widget drag/resize, native webpage input, and remote co-control.
- **M10.04** Maintain camera position when the sidebar changes width, windows resize, or display-scale factors change.
- **M10.05** Persist per-user per-space camera position, zoom, and selection in local storage rather than syncing a shared camera.
- **M10.06** Provide fit-to-content, reset zoom, zoom controls, shortcuts, accessible input semantics, and optional minimap.
- **M10.07** Make dragging, snapping, z-order, and resize constraints deterministic in world coordinates.
- **M10.08** Unit-test coordinate transforms, zoom anchoring, edge cases, device pixel ratio, and sidebar-reflow behavior.

**Exit criteria (both mandatory):**

1. No pointer gesture unexpectedly pans the canvas while typing/scrolling inside a web page, or vice versa.
2. Camera benchmark achieves the agreed frame-time target on the reference hardware and gesture tests pass.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 11 — Spatial index, viewport compositor, and scalable widget rendering

**Phase:** Canvas · **Dependencies:** 06, 07, 10 · **Tracking ID:** M11

**Objective:** Efficiently render large canvases while never tying native tab lifetime to React visibility.

**Required work:**

- **M11.01** Introduce a spatial index (R-tree or equivalent) of widget bounds and a fast viewport/near-viewport query.
- **M11.02** Render lightweight canvas shells, labels, selection overlays, and remote cursors based on spatial relevance.
- **M11.03** Keep browser session ownership outside React; virtualization removes visual shells or previews, not an attached native session without an explicit safe detach contract.
- **M11.04** Batch widget geometry and native view-bound updates to animation frames and coalesce redundant IPC messages.
- **M11.05** Implement correct clipping, z-order, hit tests, selection, snap guides, remote cursor scale, and overlays.
- **M11.06** Provide durable widget IDs independent of URL/title/camera, and prevent stale geometry updates after deletion or reuse.
- **M11.07** Measure performance with dense views, high zoom/low zoom, many offscreen tabs, live video, and mixed DPI monitors.
- **M11.08** Add automatic regression screenshots and interaction tests for focus, native view layering, and large-canvas navigation.

**Exit criteria (both mandatory):**

1. 100 spatial widget shells can be navigated smoothly on the reference baseline without causing background browser reloads.
2. Geometry, focus, click targeting, overlay order, and clipping pass multi-display Electron E2E cases.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 12 — Final UI system, accessibility, and discoverable desktop workflows

**Phase:** Experience · **Dependencies:** 00, 05, 10, 11 · **Tracking ID:** M12

**Objective:** Finish the product UI as a quiet, professional instrument—not a changing series of visual experiments.

**Required work:**

- **M12.01** Finalize docs/BRAND.md tokens, typography, spacing, icon sizes, motion, dark/light policy (light-first), and reusable components.
- **M12.02** Make navigation, home, spaces, inbox, account switcher, sign-in/up, settings, join/create/invite, and delete flows intuitive and predictable.
- **M12.03** Preserve the existing hidden-sidebar behavior: eye hides entirely, far-left dwell reopens collapsed, and there is a keyboard-accessible restore.
- **M12.04** Use consistent empty, loading, reconnecting, offline, failed-permission, crashed-tab, and no-access states with recovery actions.
- **M12.05** Provide clear chrome for Personal/Live/Shared modes, host/controller indicators, participant presence, viewing consent, and audio activity.
- **M12.06** Implement nonconflicting keyboard navigation, accessible labels, focus management, logical tab order, reduced-motion, contrast, and screen-reader semantics.
- **M12.07** Keep native browsing content unobscured by overlays and ensure pointer/keyboard controls work at every zoom and window size.
- **M12.08** Create UI regression stories and a final usability study for first-time tab creation, navigation, collaboration, and recovery.

**Exit criteria (both mandatory):**

1. Design contract and accessibility audit pass across macOS and Windows; high-severity usability findings are resolved.
2. Users can discover core workflows without hidden gestures or memorized shortcuts.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 13 — Canonical domain model, migrations, and server-authoritative persistence

**Phase:** Data · **Dependencies:** 02, 03 · **Tracking ID:** M13

**Objective:** Create a stable data contract for workspaces, collaboration, tabs, and versioned state.

**Required work:**

- **M13.01** Extend PostgreSQL/Prisma models for Workspace, WorkspaceMember, Widget, BrowserTabMetadata, BrowserProfile reference, WorkspaceOperation, WorkspaceSnapshot, ChatMessage, TabHostLease, and ControlLease.
- **M13.02** Keep local browser cookies, full DOM, privileged secret data, and personal session tokens out of cloud entities.
- **M13.03** Store each widget's world geometry, sharing type, version, ownership, safe URL metadata, creation/update timestamps, and tombstone semantics.
- **M13.04** Add validated operation IDs, monotonically increasing per-room revisions, optimistic concurrency, and idempotent writes.
- **M13.05** Write forward and backward-compatible schema migrations plus data backfills for existing Room/Widget records.
- **M13.06** Constrain deletes, membership relationships, and media-host metadata with proper foreign keys, indices, and retention rules.
- **M13.07** Define object storage for permitted avatars/attachments with signed URL access and content limits.
- **M13.08** Add transaction-level integration tests for concurrent edits, access revocation, deletion, data migration, and rollback.

**Exit criteria (both mandatory):**

1. Server database is canonical; clients can reconcile snapshots and ordered operations without silent data loss.
2. Migration of production-shaped legacy fixtures is repeatable and reversible under the documented rollback plan.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 14 — Local-first cache, offline queue, and conflict-safe synchronization

**Phase:** Data · **Dependencies:** 08, 13, 15 · **Tracking ID:** M14

**Objective:** Make Cubics responsive and recoverable through outages without pretending remote webpages work offline.

**Required work:**

- **M14.01** Introduce local SQLite with per-account workspaces, camera state, snapshots, safe tab metadata, pending operations, and schema version.
- **M14.02** Keep actual Chromium profile storage independent of the local cache; store sensitive local credentials using OS-protected mechanisms.
- **M14.03** Apply local mutations optimistically and assign stable client operation IDs, retries, backoff, and idempotency tokens.
- **M14.04** On reconnect, compare server room revisions, fetch missing operations/snapshots, replay validated pending edits, and resolve conflicts visibly.
- **M14.05** Define operation ordering, deletion/tombstone behavior, clock-skew tolerance, and deterministic merge rules for geometry and metadata.
- **M14.06** Persist queued work atomically, protect against corruption and abrupt power loss, and support local cache repair/reset without clearing browser profiles.
- **M14.07** Clearly distinguish locally cached canvas UI from online-dependent websites, media, invitations, and presence.
- **M14.08** Test offline create/move/delete, multi-device conflicts, network flapping, profile changes, and crash during sync.

**Exit criteria (both mandatory):**

1. Authorized offline edits survive app restart and reconcile exactly once when connectivity returns.
2. Conflicts and unavailable external content are communicated honestly; recovery never exposes or erases unrelated profiles.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 15 — Authoritative realtime sync, ordering, and concurrent editing

**Phase:** Collaboration · **Dependencies:** 03, 13 · **Tracking ID:** M15

**Objective:** Keep all authorized clients convergent without introducing unnecessary CRDT complexity.

**Required work:**

- **M15.01** Keep authenticated Socket.IO only during migration; validate Clerk JWT and room RLS on private Supabase Realtime joins, constrain client publishes to ephemeral events, and route all durable commands/host-control grants through verified APIs.
- **M15.02** Separate durable mutations, ephemeral cursor/presence, media signaling, and control-plane events into typed, versioned protocols.
- **M15.03** Assign server sequence/revision numbers, validate operation IDs, and persist durable changes before broadcasting acknowledgment.
- **M15.04** Use short drag/resize leases and provisional throttled moves; commit final world geometry with version checks.
- **M15.05** Send reconnecting clients a snapshot and missing ordered operations, detecting gaps and duplicates.
- **M15.06** Use throttled/volatile events for cursors, hover and pointer movement without storing every pointer event permanently.
- **M15.07** Choose CRDTs only for future truly concurrent document-like content, after demonstrated need—not for ordinary widget positions.
- **M15.08** Build load and fault-injection tests for multi-user conflicting operations, disconnects, duplicate events, stale clients, and authorization revocation.

**Exit criteria (both mandatory):**

1. Clients converge on identical durable workspace state after partitions and reconnects.
2. Cross-room message injection and unauthorized collaboration actions are rejected in automated tests.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 16 — Presence, chat, notifications, and collaboration affordances

**Phase:** Collaboration · **Dependencies:** 03, 13, 15 · **Tracking ID:** M16

**Objective:** Make collaboration understandable, persistent where needed, and private by default.

**Required work:**

- **M16.01** Keep presence and cursor events ephemeral, scoped to authorized rooms, and rate-limited.
- **M16.02** Persist authorized user chat messages with retention, pagination, delivery acknowledgments, and moderation/reporting policy.
- **M16.03** Create inbox invitations and meaningful workspace notifications with read/unread and privacy controls.
- **M16.04** Show participant identity, joining/leaving, last-seen status, host/control identity, and connection quality clearly.
- **M16.05** Provide muted notifications, accessibility announcements, safe links, and anti-spam defenses.
- **M16.06** Define and test notification authorization, blocked/revoked members, account deletion, and retention requirements.
- **M16.07** Keep screen content and personal browsing history out of presence, chat logs, analytics, and notifications by default.
- **M16.08** Test multi-device presence, reconnect, message ordering, and suspended app behavior.

**Exit criteria (both mandatory):**

1. Messages and invitations survive server restarts; ephemeral presence recovers without stale ghost members.
2. Permission revocation immediately stops access to chat, notifications, and presence for the workspace.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 17 — Personal, Live, and Shared modes with host/control leases

**Phase:** Collaboration · **Dependencies:** 03, 05, 06, 15, 18 · **Tracking ID:** M17

**Objective:** Make all three browsing modes first-class, clearly controlled, and safe during failures.

**Required work:**

- **M17.01** Implement Personal as private local browser content with only authorized safe metadata shared to the canvas.
- **M17.02** Implement Live as one user's locally hosted browser with explicit capture consent and authorized viewing; no remote input by default.
- **M17.03** Implement Shared as one designated host browser plus controlled remote input over authenticated signaling.
- **M17.04** Add an exclusive, visible controller lease with request, grant, release, time-out, host override, and malicious input filtering.
- **M17.05** Add host registration leases, heartbeats, generation IDs, reconnection grace, and explicit Host disconnected states.
- **M17.06** On host failure, support deliberate new-host start and restore from permitted metadata; never promise transfer of arbitrary live JavaScript/session memory.
- **M17.07** Prevent leakage of personal profiles into Shared sessions and restrict which domains/permissions are capturable or remotely controllable.
- **M17.08** Test host handoff, two simultaneous controllers, revoked access, stale input, network partitions, and browser crash.

**Exit criteria (both mandatory):**

1. Exactly one authorized controller can act at a time; viewers cannot escalate to host/control without permission.
2. Host loss is explicit, recoverable where possible, and does not silently substitute or expose a personal browser profile.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 18 — LiveKit media, streaming budgets, audio, and capture lifecycle

**Phase:** Media · **Dependencies:** 03, 06, 15 · **Tracking ID:** M18

**Objective:** Use one host capture and selective subscriber delivery rather than an uncontrolled mesh.

**Required work:**

- **M18.01** Retain LiveKit as the SFU; ensure hosted-only token signing and workspace-scoped publish/subscribe grants.
- **M18.02** Capture a host's webContents or screen only while explicitly shared and needed by authorized viewers or a deliberate recording workflow.
- **M18.03** Separate viewer subscription from host tab lifetime: off-screen viewers may unsubscribe without stopping the browser.
- **M18.04** Budget full-quality, low-quality, and unsubscribed streams by visible pixel area, selected tab, user priority, and device capability.
- **M18.05** Show last-frame posters/connection state for unsubscribed tabs and resume the stream smoothly when it returns onscreen.
- **M18.06** Handle audio independently of video visibility; support user-intended background listening, mute, device selection, and voice controls.
- **M18.07** Use bounded simulcast/adaptive stream parameters, capture cool-downs, and explicit pause/stop controls for CPU/GPU conservation.
- **M18.08** Test zero/one/many viewers, slow networks, device changes, track restarts, revoked permissions, codec compatibility, and host crashes.

**Exit criteria (both mandatory):**

1. A host publishes at most the intended stream while authorized viewers receive only permitted media.
2. Offscreen streaming reduces decode/network cost without resetting browser state or unwantedly muting requested audio.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 19 — Cloud operations, scaling, tenancy, and infrastructure

**Phase:** Operations · **Dependencies:** 02, 03, 13, 15, 18 · **Tracking ID:** M19

**Objective:** Run the service reliably for real users with clear infrastructure and ownership.

**Required work:**

- **M19.01** Deploy Vercel Next.js/UI APIs, Supabase PostgreSQL/private Realtime, authorized object storage, Clerk and LiveKit with documented managed configuration and separated environments.
- **M19.02** Configure TLS, DNS, managed secrets, firewalls, backups, service-to-service auth, and separated dev/staging/prod environments.
- **M19.03** Instrument managed Supabase Realtime quotas and lease/control consistency; introduce dedicated room coordination only if measured scale requires it, without changing Cubics domain/API contracts.
- **M19.04** Enforce workspace/user quotas, burst limits, data retention, abuse prevention, and secure tenant isolation.
- **M19.05** Define application/database/media version compatibility, backward-compatible migrations, and staged rollout/rollback strategies.
- **M19.06** Implement service health checks, deployment readiness, graceful shutdown, reconnect handling, and regional failure procedures.
- **M19.07** Set an explicit SLO/error budget and capacity model with representative clients, workspaces, and stream counts.
- **M19.08** Rehearse failover, database restore, service restart, and multi-node concurrency in staging.

**Exit criteria (both mandatory):**

1. Staging-to-production deployment and rollback are automated, audited, and reproducible.
2. Failure drills meet agreed recovery objectives, with data access isolated between tenants.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 20 — Observability, diagnostics, privacy-safe telemetry, and support

**Phase:** Operations · **Dependencies:** 01, 06, 15, 18, 19 · **Tracking ID:** M20

**Objective:** Detect failures without collecting sensitive browsing information.

**Required work:**

- **M20.01** Implement structured logs and tracing across desktop, API, realtime, and media using correlation IDs without sensitive URL parameters.
- **M20.02** Measure browser process counts, memory, CPU/GPU load, crashes, navigation failures, live capture/encode, viewer decode, and canvas frame times.
- **M20.03** Track local sync queue depth, operation revisions, reconnect rates, API errors, host lease expiry, and dropped media subscriptions.
- **M20.04** Create dashboards, actionable alerts, error budgets, and privacy-preserving crash diagnostics.
- **M20.05** Redact cookies, tokens, personal page content, arbitrary form values, and sensitive URL/query/path information from telemetry.
- **M20.06** Provide in-app diagnostics and opt-in support bundles with previewable contents and redaction.
- **M20.07** Define incident severity, on-call ownership, rollback triggers, status communication, and postmortem templates.
- **M20.08** Validate metrics accuracy and privacy with synthetic incidents and adversarial test inputs.

**Exit criteria (both mandatory):**

1. Operators can diagnose tab regressions and realtime incidents without inspecting personal browsing contents.
2. Sensitive-data leakage tests pass, and every release-critical alert has a tested response playbook.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 21 — Automated testing, accessibility, security, and performance qualification

**Phase:** Quality · **Dependencies:** 04, 08, 11, 12, 14, 15, 17, 18, 20 · **Tracking ID:** M21

**Objective:** Make the final architecture verifiable and prevent regressions after release.

**Required work:**

- **M21.01** Build unit suites for geometry, camera transforms, tab lifecycle, URL validation, permissions, operation versions, and local sync algorithms.
- **M21.02** Add API integration suites for workspace authorization, role changes, partial failure, idempotency, schema migrations, and token verification.
- **M21.03** Add multi-client realtime tests for snapshot replay, presence, conflict resolution, leases, revocation, reconnection, and host failover.
- **M21.04** Add real Electron E2E tests for external websites, tab navigation/history, Twitch-like offscreen return, webContents crashes, permissions, downloads, and popup handling.
- **M21.05** Add screen/camera/native view coordinate, hit-target, stacking, drag/resize, multi-monitor, high-DPI, and sidebar animation tests.
- **M21.06** Add LiveKit and audio tests under bandwidth loss, packet loss, multiple viewers, start/stop sharing, and background listening.
- **M21.07** Run accessibility audits for keyboard, screen reader, reduced motion, contrast, focus, and error recovery on target OS versions.
- **M21.08** Define reference machines and repeatable benchmark workloads (10, 25, 100 widgets with mixed loaded/streaming tabs); establish p95 frame-time, latency, memory, and recovery targets based on baseline measurements.
- **M21.09** Make lint, typecheck, brand, unit, integration, E2E smoke, security, and packaging checks required for protected releases.

**Exit criteria (both mandatory):**

1. All critical journeys and negative security tests pass in CI and on actual macOS/Windows desktop hardware.
2. Performance meets documented targets under repeatable workloads without offscreen tab resets or silent state loss.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 22 — Production desktop distribution, installation, and automatic updates

**Phase:** Release · **Dependencies:** 02, 04, 12, 19, 21 · **Tracking ID:** M22

**Objective:** Deliver a securely installable, upgradeable desktop product.

**Required work:**

- **M22.01** Create reproducible macOS Apple Silicon/Intel and Windows 11 x64 release artifacts with correct native dependencies.
- **M22.02** Code-sign and notarize macOS builds; sign Windows binaries/installers and validate distribution trust.
- **M22.03** Implement cryptographically verified update metadata, staged rollout, rollback, and minimum-compatible backend versions.
- **M22.04** Harden first-run onboarding, OS permissions, protocol handlers, deep links, file associations, and startup recovery.
- **M22.05** Migrate local browser profiles and SQLite schema safely across app version upgrades without deleting user cookies.
- **M22.06** Add clean install, upgrade, downgrade/rollback, uninstall, multi-account, and multiple-window/profile test matrices.
- **M22.07** Document supported platforms, minimum device requirements, network dependencies, user-visible limitations, and support policies.
- **M22.08** Publish a release manifest, changelog, checksum/signature verification, support channels, and release owner sign-off.

**Exit criteria (both mandatory):**

1. Both GA platform installers pass signing, onboarding, upgrade, and rollback validation on clean machines.
2. Upgrades preserve workspaces, browser profiles, local cache, and recoverable session metadata.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 23 — Legacy compatibility, data migration, staged rollout, and operational recovery

**Phase:** Release · **Dependencies:** 07, 08, 13, 14, 17, 19, 21, 22 · **Tracking ID:** M23

**Objective:** Complete the one intentional architectural migration without abandoning existing Cubics users.

**Required work:**

- **M23.01** Inventory every old database record, browser partition, saved URL, local camera preference, and serialized widget configuration.
- **M23.02** Provide migration scripts from existing Room/Widget models and renderer-owned webviews to stable session IDs and canonical metadata.
- **M23.03** Preserve existing browser profiles and user login sessions wherever supported without copying their secrets into cloud storage.
- **M23.04** Feature-flag native browser surfaces, sync engine, and server changes; support a staged cohort rollout with safe rollback.
- **M23.05** Define dual-read/dual-write or adapter windows only where needed, and remove them after reconciliation and verification.
- **M23.06** Test upgrade paths from representative historical builds and crash during migration; include backups and versioned recovery steps.
- **M23.07** Validate tenant privacy, visibility, room membership, chat, streamed tabs, and control rights before/after migration.
- **M23.08** Demonstrate disaster recovery, backup restoration, a revoked user session, and release rollback without orphaned workspace data.

**Exit criteria (both mandatory):**

1. Historical Cubics workspaces and profiles remain usable after upgrade, with no unexplained reset to initial page URLs.
2. Temporary compatibility paths are fully retired before architecture freeze and restoration drills pass.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.


### Milestone 24 — Final product acceptance, architecture lock, and maintenance contract

**Phase:** Release · **Dependencies:** 00–23 · **Tracking ID:** M24

**Objective:** Declare Cubics complete against a finite, evidenced contract and stop recurring architecture reinvention.

**Required work:**

- **M24.01** Confirm every numbered checklist item M00–M23 has testable evidence, reviewer approval, and no unresolved release-blocking issues.
- **M24.02** Perform end-to-end first-run, private browsing, shared viewing/control, multiuser sync, offline/resume, camera navigation, sign-out, and recovery acceptance sessions.
- **M24.03** Audit privacy, threat model, cloud secrets, Electron sandbox, authorization, data migration, performance, accessibility, backup/restore, and signed auto-update gates.
- **M24.04** Freeze the authoritative domain contracts, browser lifecycle states, event protocol, workspace schema, canvas input rules, and app/service deployment boundaries in versioned ADRs.
- **M24.05** Remove abandoned prototypes, shadow/duplicate implementations, temporary flags, unsafe escape hatches, unnecessary bundled secrets, and migration-only code.
- **M24.06** Publish final architecture diagrams, operator runbooks, user documentation, supported-version policies, and compatibility guarantees.
- **M24.07** Tag the GA release, preserve release artifacts and evidence, and record explicit final sign-off from engineering, security, design, and product.
- **M24.08** Adopt a post-GA policy of maintenance and additive versioned extensions only; structural changes require exceptional, documented approval, not cosmetic refactoring.

**Exit criteria (both mandatory):**

1. All checklist milestones and release gates are signed off with passing evidence and no unaccepted P0/P1 defect.
2. A reproducible GA release is tagged, installable, supported, monitored, and protected by the frozen architecture contract.

**Evidence:** PRs/commits, test run links, acceptance screenshots or recorded manual cases, migration/recovery drills, benchmarks, ADRs and named reviewer approval entered in `master_checklist.md`.

## 6. Completion, architecture lock, and change-control rules

Cubics is **not done** when a feature looks correct in a screenshot. It is done when the behavior, trust boundary, persistence, recovery, accessibility and distribution implications have passed the release gates. Do not mark a task complete based only on a source-code inspection if its requirement is runtime behavior. Live Electron E2E, real multi-client sessions and OS packaging must be exercised.

**Milestone closeout protocol:** the owning contributor links implementation and verification evidence, a reviewer confirms every checklist entry and exit condition, and the milestone is marked complete. Record "N/A" only with documented scope rationale and an approved ADR; do not silently omit checklist items.

**Architecture lock after GA:** no recurring UI/framework/browser-engine redesigns. Internal repairs, OS/Chromium security upgrades, schema migrations, performance maintenance and carefully versioned additive features remain allowed; any architecture break requires an explicit ADR, compatibility assessment, test plan and release owner approval. The final product is a **maintainable system**, not an unpatchable codebase.

**Not implemented by writing this document:** these milestones describe intended work. Every checklist box starts unchecked. Release cannot be declared until Milestone 24 and G1–G10 are actually verified.
