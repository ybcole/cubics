# Cubics — MASTER CHECKLIST

> **Status: M00 complete; M01-M24 remain open.** Audited against `main` at `eb2c983` on 2026-11-21. Implemented features, remaining work and evidence are recorded in the [current status audit](docs/milestones/STATUS_2026-11-21.md).
> **Rule:** Check a box only after implementation + acceptance evidence. Link the PR/commit, test run, audit, performance report or signed manual test in the evidence register below.  
> **Target:** The finite Cubics GA end state and architecture lock in Milestone 24.

## How to use this checklist

- Work from the numbered milestones and their dependencies; the task IDs correspond one-for-one to work described in the plan.
- A checked code task without passing E2E or security evidence is **not** milestone completion. Exit checks are mandatory.
- Track blockers in issues/ADRs and do not silently skip a required item. Approved N/A requires a documented scope decision.
- Mark all global gates at the end; only then may the project be declared release complete and architecture-frozen.
- Checkboxes describe the complete numbered requirement; an unchecked item may already have substantial implementation. The status audit credits that work without treating fixtures as release acceptance.

## Progress ledger

| Milestone | Area | Recorded task boxes | Exit boxes | Implementation status |
| --- | --- | ---: | ---: | --- |
| [M00](#m00) | Final product contract, technical governance, and architecture freeze policy | 9/9 | 2/2 | Complete |
| [M01](#m01) | Trust boundaries, threat model, and security baseline | 8/8 | 1/2 | Partial |
| [M02](#m02) | Cloud boundary, deployable architecture, and secret removal | 5/9 | 0/2 | Partial |
| [M03](#m03) | Identity, roles, workspace permissions, and account management | 0/8 | 0/2 | Partial |
| [M04](#m04) | Electron hardening, privileged IPC, and native platform boundaries | 5/8 | 0/2 | Partial |
| [M05](#m05) | Browser profiles, privacy isolation, and ownership | 3/8 | 0/2 | Partial |
| [M06](#m06) | Main-process Browser Session Manager and lifecycle contracts | 0/8 | 0/2 | Not started |
| [M07](#m07) | Browser surface compositor and WebContentsView migration | 0/8 | 0/2 | Not started |
| [M08](#m08) | Tab continuity, snapshot recovery, and crash boundaries | 0/8 | 0/2 | Partial |
| [M09](#m09) | Background resource scheduler and tab performance policy | 0/8 | 0/2 | Partial |
| [M10](#m10) | Camera, interaction state machine, and canvas coordinate model | 0/8 | 0/2 | Partial |
| [M11](#m11) | Spatial index, viewport compositor, and scalable widget rendering | 0/8 | 0/2 | Partial |
| [M12](#m12) | Final UI system, accessibility, and discoverable desktop workflows | 0/8 | 0/2 | Partial |
| [M13](#m13) | Canonical domain model, migrations, and server-authoritative persistence | 0/8 | 0/2 | Partial |
| [M14](#m14) | Local-first cache, offline queue, and conflict-safe synchronization | 0/8 | 0/2 | Not started |
| [M15](#m15) | Authoritative realtime sync, ordering, and concurrent editing | 0/8 | 0/2 | Partial |
| [M16](#m16) | Presence, chat, notifications, and collaboration affordances | 0/8 | 0/2 | Partial |
| [M17](#m17) | Personal, Live, and Shared modes with host/control leases | 0/8 | 0/2 | Partial |
| [M18](#m18) | LiveKit media, streaming budgets, audio, and capture lifecycle | 0/8 | 0/2 | Partial |
| [M19](#m19) | Cloud operations, scaling, tenancy, and infrastructure | 0/8 | 0/2 | Partial |
| [M20](#m20) | Observability, diagnostics, privacy-safe telemetry, and support | 0/8 | 0/2 | Partial |
| [M21](#m21) | Automated testing, accessibility, security, and performance qualification | 0/9 | 0/2 | Partial |
| [M22](#m22) | Production desktop distribution, installation, and automatic updates | 0/8 | 0/2 | Partial |
| [M23](#m23) | Legacy compatibility, data migration, staged rollout, and operational recovery | 0/8 | 0/2 | Partial |
| [M24](#m24) | Final product acceptance, architecture lock, and maintenance contract | 0/8 | 0/2 | Not started |

Only M00 has recorded milestone closeout. Counts measure checked requirements, not a percentage of engineering effort or product readiness. Existing completed task boxes are retained; no new runtime or release sign-off is inferred from this documentation audit.

## Checklist by milestone

<a id="m00"></a>

### M00 — Final product contract, technical governance, and architecture freeze policy

**Prerequisites:** None

**Implementation status (2026-11-21): Complete.** Approved product/governance contract and a versioned inventory of 203 requirements. **Remaining:** None for M00; its sign-off covers documentation, not later implementation. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m00).

- [x] **M00.01** Approve the product definition: a desktop-first, persistent, collaborative infinite browser canvas—not a generic document editor or a web browser replacement.
- [x] **M00.02** Declare GA platforms as current supported macOS (Apple Silicon and Intel) and Windows 11 x64; explicitly document Linux and other platforms as outside GA until separately certified.
- [x] **M00.03** Specify the three tab modes (Personal, Live, Shared), their ownership, privacy, permissions, audio, capture, and control semantics.
- [x] **M00.04** Publish product invariants: panning/zooming never destroys a live tab; canvas position is personal; private browsing content is not implicitly shared; cloud operations are authorization-checked.
- [x] **M00.05** Adopt the component boundaries, service interfaces, event contracts, database model, and staged migration map described in this document.
- [x] **M00.06** Create versioned Architecture Decision Records (ADRs), a dependency/support matrix, an accessibility standard, and an evidence policy for every completion checkbox.
- [x] **M00.07** Record all current deviations from the target design, including the local Next server with bundled environment variables, unauthenticated realtime claims, and renderer-owned webview lifetimes.
- [x] **M00.08** Set scope-control rules: new work is admitted only by documented product or security need, acceptance tests, and an approved ADR.
- [x] **M00.09** Establish the final architecture freeze rule: after Milestone 24 sign-off, structural redesigns require an exceptional safety or product-compatibility justification; routine patches, supported dependency upgrades, and security maintenance continue.

**Exit verification:**

- [x] **M00.E1** Signed-off scope, target platforms, domain contracts, ADR log, deviations inventory, and final-release gates are versioned in the repository.
- [x] **M00.E2** Every required final-product feature has a numbered milestone and a traceable item in master_checklist.md.

- [x] **M00.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m01"></a>

### M01 — Trust boundaries, threat model, and security baseline

**Prerequisites:** 00

**Implementation status (2026-11-21): Partial.** Threat model, access matrix, secret/baseline scans, negative authorization tests and CI definitions. **Remaining:** Repair current CI install/test failures; require protected merge/release checks and complete security closeout. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m01).

- [x] **M01.01** Map all trust boundaries: app renderer, Electron main, external pages, preload/IPC, browser sessions, hosted API, WebSocket service, PostgreSQL, LiveKit, and updater.
- [x] **M01.02** Threat-model hostile websites, malicious workspace members, compromised tokens, forged room events, popups, downloads, media capture, deep links, and updates.
- [x] **M01.03** Inventory all endpoints, Socket.IO events, IPC handlers, third-party domains, data classes, and the permissions each requires.
- [x] **M01.04** Write a least-privilege access matrix for owner/admin/member, personal browser owner, live host, shared controller, and viewer.
- [x] **M01.05** Define safe URL/protocol handling, sensitive-field redaction, request validation, rate limits, CSRF/origin defenses, and CORS policy.
- [x] **M01.06** Add dependency/license/SBOM scanning, secret detection, and a documented vulnerability response and disclosure process.
- [x] **M01.07** Create negative authorization tests that prove cross-room and cross-user operations are denied.
- [x] **M01.08** Record explicit threat-model mitigations and their automated security tests before functionality is migrated.

**Exit verification:**

- [x] **M01.E1** Threat model and controls matrix approved; security-critical risks have a named mitigation and a test.
- [ ] **M01.E2** Security lint/scans and a denied-access integration suite run as CI merge gates.

- [ ] **M01.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m02"></a>

### M02 — Cloud boundary, deployable architecture, and secret removal

**Prerequisites:** 00, 01

**Implementation status (2026-11-21): Partial.** Hosted-only packaged Electron shell, versioned API/client scaffolding, server-side Prisma and service-authenticated membership lookup, staging/rollback contracts. **Remaining:** Verified live staging/production deployment, environment/secret separation, API migration parity and rollback drill. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m02).

- [x] **M02.01** Define the monorepo boundaries: apps/desktop, apps/web, apps/api, services/realtime, packages/canvas, browser-contracts, collaboration, ui, and database.
- [ ] **M02.02** Move all privileged PostgreSQL and Prisma operations to a hosted, authenticated API; keep the desktop frontend a client, not a backend with database authority.
- [ ] **M02.03** Move Clerk secret keys, LiveKit signing secrets, database URLs, and server-only credentials entirely into server-side secret management.
- [x] **M02.04** Design the packaged desktop UI to start without a production secret-bearing local Next server; retain a compatible local development workflow.
- [x] **M02.05** Introduce versioned HTTPS API endpoints and typed client contracts for workspaces, widgets, identity, sharing, and sync.
- [ ] **M02.06** Implement secure environment separation for development, staging, and production with infrastructure-as-code and minimal service accounts.
- [ ] **M02.07** Create backward-compatible API versioning, feature flags, and a staged migration from current Next routes.
- [x] **M02.08** Validate an extracted distributable artifact for hard-coded secrets, local privileged API availability, and insecure configuration.
- [x] **M02.09** Plan a migration rollback path that does not invalidate existing user workspaces or local browser profiles.

**Exit verification:**

- [ ] **M02.E1** Production desktop artifact contains no server-side secrets or direct privileged database access.
- [ ] **M02.E2** Desktop-to-cloud functionality works on staging using authenticated HTTPS APIs; rollback drill passes.

- [ ] **M02.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m03"></a>

### M03 — Identity, roles, workspace permissions, and account management

**Prerequisites:** 01, 02

**Implementation status (2026-11-21): Partial.** Clerk JWT verification/renewal; role/ownership checks; member changes; passive socket revocation; local membership configuration/retries and worker reload. **Remaining:** Confirm the reported real room-switch failure after restart; invitations, ownership transfer, account lifecycle and real multi-account/cross-instance acceptance. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m03).

- [ ] **M03.01** Keep Clerk as the identity provider; implement verified tokens and session renewal without inconsistent desktop origins or redirect loops.
- [ ] **M03.02** Make user IDs, room IDs, roles, and device IDs server-derived or independently validated rather than trusted from client event payloads.
- [ ] **M03.03** Enforce owner/admin/member policies on every REST handler, widget operation, room mutation, invitation, token issue, and realtime event.
- [ ] **M03.04** Implement invitation, membership, leave, revocation, ownership transfer, deletion, and private-room discovery behavior.
- [ ] **M03.05** Define multi-account switching with isolated local browser profiles and no accidental account crossover.
- [ ] **M03.06** Implement device/session sign-out, expired-session handling, account deletion, and privacy-data export/delete workflows.
- [ ] **M03.07** Restrict media and remote-control tokens to their authorized workspace, session, and capabilities.
- [ ] **M03.08** Test revocation during an active collaboration session and verify all active subscriptions/control grants are withdrawn.

**Exit verification:**

- [ ] **M03.E1** REST, WebSocket, IPC-to-cloud actions, and LiveKit issuance enforce identical authorization semantics.
- [ ] **M03.E2** Multi-account, sign-out, expired token, and membership-revocation end-to-end tests pass.

- [ ] **M03.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m04"></a>

### M04 — Electron hardening, privileged IPC, and native platform boundaries

**Prerequisites:** 01, 02, 03

**Implementation status (2026-11-21): Partial.** Sandbox/context isolation, narrow sender-checked IPC, native permission prompts, issued partitions, protected popup chains and hardened fuse configuration. **Remaining:** Signed update/protocol provenance, full native permission revocation/site qualification and independent security exit review. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m04).

- [x] **M04.01** Enable appropriate sandboxing, context isolation, and disabled Node integration for remote content; remove unnecessary sandbox:false usage.
- [x] **M04.02** Replace broad renderer privileges with a narrow, versioned, typed preload bridge whose sender and target IDs are validated.
- [x] **M04.03** Define allowlists and explicit user permission prompts for microphone, camera, screen capture, clipboard, geolocation, file selection, and downloads.
- [x] **M04.04** Handle popups, navigation, external protocols, OAuth, deep links, and shell.openExternal through validated decisions; do not blindly allow webview popups.
- [x] **M04.05** Use HTTPS for external content and a restrictive app Content Security Policy; remove broad response-header stripping where it defeats origin security.
- [ ] **M04.06** Separate and protect all browser partitions and storage contexts; validate webContents ownership on every native operation.
- [ ] **M04.07** Harden Electron fuses, application protocol handling, update signatures, and navigation restrictions.
- [ ] **M04.08** Test hostile website scenarios, untrusted IPC callers, sandbox escape boundaries, and permission revocation on macOS and Windows.

**Exit verification:**

- [ ] **M04.E1** Electron's supported security checklist is met with documented exceptions and threat-model sign-off.
- [ ] **M04.E2** Security and native-permission E2E tests pass with arbitrary external sites open.

- [ ] **M04.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m05"></a>

### M05 — Browser profiles, privacy isolation, and ownership

**Prerequisites:** 03, 04

**Implementation status (2026-11-21): Partial.** Opaque device/account profile IDs; persistent Personal/Live and temporary Shared sessions; encrypted Personal destinations/recovery; per-viewer redaction; scoped media grants. **Remaining:** Dedicated privacy/settings controls, historical cloud/backup cleanup, profile retention/deletion, durable media eviction retry and real-account privacy acceptance. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m05).

- [x] **M05.01** Define stable BrowserProfile IDs owned by a user and device, separate from workspace membership. (Device-local opaque IDs derived from verified owner/mode/widget, independent of room membership; unit and real two-process Linux/macOS/Windows restart matrix [PASS](https://github.com/ybcole/cubics/actions/runs/43539188769). Registry/export/deletion UX remain M05.06.)
- [x] **M05.02** Store cookies, localStorage, IndexedDB, service workers, caches, and history using correctly partitioned Electron profiles. (Native two-process storage matrix for Personal/Live/temporary Shared and cross-account isolation [PASS on Linux, macOS, Windows](https://github.com/ybcole/cubics/actions/runs/43540659588). Navigation history is scoped per WebContents, not a persistent global profile log.)
- [x] **M05.03** Use a distinct opt-in collaborative profile for Shared tabs; never implicitly reuse a Personal tab's authenticated profile. (Temporary per-account/widget Shared partition and explicit Start Shared action; Linux/macOS/Windows cookie-isolation matrix [PASS](https://github.com/ybcole/cubics/actions/runs/43536801635); live Clerk/restart sign-off tracked under M05.08.)
- [ ] **M05.04** Define exactly which metadata may be synced (tab ID, share mode, safe title/URL fields) and redact sensitive URL parameters, titles, and profile identifiers where applicable. (Non-owner Personal/Live/Shared metadata redaction and opaque transport payloads implemented; a read-only PostgreSQL exposure census is available. Historical Personal URLs can be migrated to an OS-encrypted vault and optionally scrubbed per tab only after verified portable recovery backup and native consent. Global migration, provider backup retention and real multi-account audit remain pending.)
- [ ] **M05.05** Make Live sharing explicit, visibly active, revocable, and restricted to authorized viewers. (Explicit host Start/Stop, DB-verified creator/widget media signaling, separate viewer-only and widget publisher LiveKit grants, sanitized Shared input; [security](https://github.com/ybcole/cubics/actions/runs/43542571565), [UI build](https://github.com/ybcole/cubics/actions/runs/43542571605), and [native 3-OS](https://github.com/ybcole/cubics/actions/runs/43542571547) PASS. Server-side LiveKit membership-remove eviction and whole-room delete implemented with room-scoped pseudonymous identity; signed LiveKit post-join webhook check added; provider webhook configuration, durable eviction retries, real self-hosted token rejoin testing, and real two-account acceptance remain pending.)
- [ ] **M05.06** Provide profile sign-out, data clearing, retention, export/delete, and account-switching controls. (Native IPC for site-data clearing, metadata export, portable encrypted per-tab backup/import, local forget and default-OFF owner-consented cloud scrub implemented; simplified Safari-style tab UI no longer exposes advanced controls, which must move to dedicated privacy settings. Complete profile export/deletion, retention policy and real-account acceptance remain open.)
- [ ] **M05.07** Keep OS-protected secrets out of ordinary synced workspace records and unencrypted local preferences. (New Personal URL writes are rejected by the cloud API and stored only in OS-encrypted device files; [native Linux/macOS/Windows restart checks PASS](https://github.com/ybcole/cubics/actions/runs/43551806678). Historical PostgreSQL URLs/backups, real-account and signed-installer keychain acceptance remain pending.)
- [ ] **M05.08** Test two Cubics accounts, multiple workspaces, cookies, shared-control interactions, and device restart for data isolation. (Mock-auth two-process device restart and cross-account cookie denial added; real Clerk, multiple workspaces, and shared-control integration still pending.)

**Exit verification:**

- [ ] **M05.E1** No test can read another user's personal cookies or personal-page pixels without explicit authorized sharing.
- [ ] **M05.E2** Profile persistence and account separation pass real Electron integration tests.

- [ ] **M05.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m06"></a>

### M06 — Main-process Browser Session Manager and lifecycle contracts

**Prerequisites:** 04, 05

**Implementation status (2026-11-21): Not started.** Main owns profile authorization and popup lifetimes; React still owns the primary browser webviews. **Remaining:** Build BrowserSessionManager, stable native tab resources/generations, lifecycle state machine and route-independent ownership. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m06).

- [ ] **M06.01** Implement a main-process BrowserSessionManager keyed by stable tab ID, browser profile, workspace context, and host generation.
- [ ] **M06.02** Define typed create, attach, detach, navigate, back, forward, reload, resize, suspend, resume, crash, and destroy commands with authorization checks.
- [ ] **M06.03** Model Uninitialized, Warming, Active, Background, Suspended, Crashed, and Closed states with explicit legal transitions.
- [ ] **M06.04** Ensure camera pan, zoom, sidebar motion, widget UI remount, and DOM virtualization do not destroy an already loaded browser process.
- [ ] **M06.05** Record current URL, navigation entries where permitted, title, favicon, loading, crash, and audio state from the native browser authority—not an initial widget URL prop.
- [ ] **M06.06** Separate the lifetime of a tab resource from the lifetime of its canvas view, React component, and route.
- [ ] **M06.07** Add per-profile resource ownership, cleanup on explicit deletion, host ownership changes, and stale tab generations.
- [ ] **M06.08** Add lifecycle tracing and tests for repeated offscreen/on-screen cycles, route changes, retries, and profile switching.

**Exit verification:**

- [ ] **M06.E1** A loaded Twitch-like page survives repeated pan/zoom and space-view transitions without reverting to its initial URL while its native session remains alive.
- [ ] **M06.E2** Lifecycle integration tests establish no unintended destroy/recreate on visibility changes.

- [ ] **M06.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m07"></a>

### M07 — Browser surface compositor and WebContentsView migration

**Prerequisites:** 06, 10

**Implementation status (2026-11-21): Not started.** Current browser surfaces remain Electron webview tags; secure capture helpers already exist. **Remaining:** Prototype WebContentsView adapter; prove native geometry, clipping, focus, input, stacking and capture parity before migration. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m07).

- [ ] **M07.01** Prototype WebContentsView for one Personal tab behind the BrowserSessionManager abstraction; retain a feature-flagged fallback during migration.
- [ ] **M07.02** Map world coordinates, camera translation, zoom, OS display scale, window resizing, sidebar width, and multi-monitor geometry to native view bounds.
- [ ] **M07.03** Implement deterministic z-order, focus, clipping, hit testing, occlusion, and overlays around native browser surfaces.
- [ ] **M07.04** Preserve web-native input, keyboard IME, touch/trackpad gestures, selection, accessibility focus, and widget drag/resize boundaries.
- [ ] **M07.05** Handle thumbnails, snapshots, previews, and offscreen placeholders separately from active native surfaces.
- [ ] **M07.06** Support capturePage/media-source acquisition without granting untrusted renderers direct native objects.
- [ ] **M07.07** Compare browser compatibility, performance, popup behavior, and security with the existing webview implementation.
- [ ] **M07.08** Migrate Personal, then Live, then Shared modes only after measurable parity; remove legacy webview code only after rollback is proven.

**Exit verification:**

- [ ] **M07.E1** Native view geometry and stacking remain correct through zoom, panning, drag, resize, hidden rail, and display-scale changes.
- [ ] **M07.E2** Supported browser sites and multi-user controls pass parity tests; fallback can be retired without data loss.

- [ ] **M07.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m08"></a>

### M08 — Tab continuity, snapshot recovery, and crash boundaries

**Prerequisites:** 06, 07, 13

**Implementation status (2026-11-21): Partial.** Personal navigation follows native events into an encrypted vault; bounded encrypted recovery files and sticky offscreen mounting exist. **Remaining:** Cross-room live-session continuity, crash/power-loss UX, comprehensive state checkpoints and native continuity/recovery acceptance. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m08).

- [ ] **M08.01** Persist current navigated URL and allowed history metadata independently of the originally created widget URL.
- [ ] **M08.02** Restore camera position, widget geometry, saved scroll cues where feasible, and browser-profile cookies after application restarts.
- [ ] **M08.03** Keep browser sessions alive when panning away, hiding the sidebar, switching canvas views, or toggling non-destructive panels.
- [ ] **M08.04** Differentiate recoverable page state from unrecoverable live DOM/JavaScript memory, DRM playback, unsaved text, and external app state.
- [ ] **M08.05** Implement renderer crash, webContents crash, app crash, and power-loss recovery flows with actionable UI.
- [ ] **M08.06** Write bounded, atomic recovery checkpoints that do not expose session tokens or private content in shared cloud data.
- [ ] **M08.07** Define explicit reopen, reload, duplicate, close, archive, and clear-session actions; never silently substitute the initial URL.
- [ ] **M08.08** Test Twitch-style navigation from Google to a new domain, scroll/media progression, offscreen return, tab crash, and full app restart.

**Exit verification:**

- [ ] **M08.E1** Viewport movement alone produces zero page reloads or lost navigation history on loaded tabs.
- [ ] **M08.E2** Recovery displays an accurate restored-state/result indicator and documents unavoidable external-site limitations.

- [ ] **M08.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m09"></a>

### M09 — Background resource scheduler and tab performance policy

**Prerequisites:** 06, 08, 11, 18

**Implementation status (2026-11-21): Partial.** Lazy Personal guest creation and visible-area viewer tiers (6 full / 24 low); offscreen viewer unsubscribe. **Remaining:** Unified browser scheduler, audio-safe background/suspend policy, hysteresis, device budgets and measured mixed-load benchmarks. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m09).

- [ ] **M09.01** Use spatial visibility, selection, active audio, capture, tab priority, and available CPU/GPU/memory to decide resource tier.
- [ ] **M09.02** Keep Uninitialized tabs uncreated; allow Active, Background, and safe Suspended policies for already loaded sessions.
- [ ] **M09.03** Throttle avoidable captures/painting and viewer decodes offscreen while retaining native web state.
- [ ] **M09.04** Respect audible-background behavior: never automatically mute or pause wanted Twitch/music audio merely because the camera moves.
- [ ] **M09.05** Apply hysteresis, minimum dwell, and cool-down intervals to stop tier thrashing at viewport boundaries.
- [ ] **M09.06** Enforce configurable per-device soft/hard resource budgets with diagnostics and explicit user consent before discarding tabs.
- [ ] **M09.07** Avoid undocumented webContents throttling APIs or aggressive sleep that breaks playback, login refresh, or host controls.
- [ ] **M09.08** Run 10/25/100-widget mixed-workload benchmarks and track memory, CPU, GPU, video decode, load time, and interruption rates.

**Exit verification:**

- [ ] **M09.E1** Pan-away/return preserves native state while background resource use demonstrably decreases in representative workloads.
- [ ] **M09.E2** Background audio, active sharing, and control leases continue according to user intent and documented policy.

- [ ] **M09.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m10"></a>

### M10 — Camera, interaction state machine, and canvas coordinate model

**Prerequisites:** 00, 06

**Implementation status (2026-11-21): Partial.** Transform-based camera, pointer-anchored wheel/pinch zoom with animation frames, sidebar compensation, fit/zoom controls and local room view storage. **Remaining:** Extract/test camera math and gesture arbitration; scope saved views by account and selection; certify display-scale/input behavior and frame budget. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m10).

- [ ] **M10.01** Isolate camera state as x, y, zoom, viewport, and world-to-screen transforms with a testable math module.
- [ ] **M10.02** Drive pan, pinch, trackpad zoom, wheel intent, and viewport changes through a requestAnimationFrame scheduler rather than React-wide rerenders.
- [ ] **M10.03** Keep pointer and keyboard gesture arbitration explicit for pan, select, widget drag/resize, native webpage input, and remote co-control.
- [ ] **M10.04** Maintain camera position when the sidebar changes width, windows resize, or display-scale factors change.
- [ ] **M10.05** Persist per-user per-space camera position, zoom, and selection in local storage rather than syncing a shared camera.
- [ ] **M10.06** Provide fit-to-content, reset zoom, zoom controls, shortcuts, accessible input semantics, and optional minimap.
- [ ] **M10.07** Make dragging, snapping, z-order, and resize constraints deterministic in world coordinates.
- [ ] **M10.08** Unit-test coordinate transforms, zoom anchoring, edge cases, device pixel ratio, and sidebar-reflow behavior.

**Exit verification:**

- [ ] **M10.E1** No pointer gesture unexpectedly pans the canvas while typing/scrolling inside a web page, or vice versa.
- [ ] **M10.E2** Camera benchmark achieves the agreed frame-time target on the reference hardware and gesture tests pass.

- [ ] **M10.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m11"></a>

### M11 — Spatial index, viewport compositor, and scalable widget rendering

**Prerequisites:** 06, 07, 10

**Implementation status (2026-11-21): Partial.** Stable database widget IDs, React shells/cursors, memoized browser components and visibility observers. **Remaining:** Spatial index, scalable shell virtualization independent of browser lifetime, batched native bounds and 100-widget/multi-display proof. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m11).

- [ ] **M11.01** Introduce a spatial index (R-tree or equivalent) of widget bounds and a fast viewport/near-viewport query.
- [ ] **M11.02** Render lightweight canvas shells, labels, selection overlays, and remote cursors based on spatial relevance.
- [ ] **M11.03** Keep browser session ownership outside React; virtualization removes visual shells or previews, not an attached native session without an explicit safe detach contract.
- [ ] **M11.04** Batch widget geometry and native view-bound updates to animation frames and coalesce redundant IPC messages.
- [ ] **M11.05** Implement correct clipping, z-order, hit tests, selection, snap guides, remote cursor scale, and overlays.
- [ ] **M11.06** Provide durable widget IDs independent of URL/title/camera, and prevent stale geometry updates after deletion or reuse.
- [ ] **M11.07** Measure performance with dense views, high zoom/low zoom, many offscreen tabs, live video, and mixed DPI monitors.
- [ ] **M11.08** Add automatic regression screenshots and interaction tests for focus, native view layering, and large-canvas navigation.

**Exit verification:**

- [ ] **M11.E1** 100 spatial widget shells can be navigated smoothly on the reference baseline without causing background browser reloads.
- [ ] **M11.E2** Geometry, focus, click targeting, overlay order, and clipping pass multi-display Electron E2E cases.

- [ ] **M11.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m12"></a>

### M12 — Final UI system, accessibility, and discoverable desktop workflows

**Prerequisites:** 00, 05, 10, 11

**Implementation status (2026-11-21): Partial.** Brand tokens/components, hidden/collapsed rail and keyboard restore, create/join/rename/delete/account workflows, shared tab chrome and compact tooltip/menu fixes. **Remaining:** Finish privacy settings and missing user flows; consistent recovery states, keyboard/screen-reader audit, overlay validation and usability study. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m12).

- [ ] **M12.01** Finalize docs/BRAND.md tokens, typography, spacing, icon sizes, motion, dark/light policy (light-first), and reusable components.
- [ ] **M12.02** Make navigation, home, spaces, inbox, account switcher, sign-in/up, settings, join/create/invite, and delete flows intuitive and predictable.
- [ ] **M12.03** Preserve the existing hidden-sidebar behavior: eye hides entirely, far-left dwell reopens collapsed, and there is a keyboard-accessible restore.
- [ ] **M12.04** Use consistent empty, loading, reconnecting, offline, failed-permission, crashed-tab, and no-access states with recovery actions.
- [ ] **M12.05** Provide clear chrome for Personal/Live/Shared modes, host/controller indicators, participant presence, viewing consent, and audio activity.
- [ ] **M12.06** Implement nonconflicting keyboard navigation, accessible labels, focus management, logical tab order, reduced-motion, contrast, and screen-reader semantics.
- [ ] **M12.07** Keep native browsing content unobscured by overlays and ensure pointer/keyboard controls work at every zoom and window size.
- [ ] **M12.08** Create UI regression stories and a final usability study for first-time tab creation, navigation, collaboration, and recovery.

**Exit verification:**

- [ ] **M12.E1** Design contract and accessibility audit pass across macOS and Windows; high-severity usability findings are resolved.
- [ ] **M12.E2** Users can discover core workflows without hidden gestures or memorized shortcuts.

- [ ] **M12.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m13"></a>

### M13 — Canonical domain model, migrations, and server-authoritative persistence

**Prerequisites:** 02, 03

**Implementation status (2026-11-21): Partial.** Prisma User/Room/RoomMember/Widget schema; authorized REST CRUD/transactions and redacted read-only compatibility snapshots. **Remaining:** Revisioned operations, idempotency, tombstones, canonical tab/lease models, PostgreSQL migration baseline and reversible backfills. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m13).

- [ ] **M13.01** Extend PostgreSQL/Prisma models for Workspace, WorkspaceMember, Widget, BrowserTabMetadata, BrowserProfile reference, WorkspaceOperation, WorkspaceSnapshot, ChatMessage, TabHostLease, and ControlLease.
- [ ] **M13.02** Keep local browser cookies, full DOM, privileged secret data, and personal session tokens out of cloud entities.
- [ ] **M13.03** Store each widget's world geometry, sharing type, version, ownership, safe URL metadata, creation/update timestamps, and tombstone semantics.
- [ ] **M13.04** Add validated operation IDs, monotonically increasing per-room revisions, optimistic concurrency, and idempotent writes.
- [ ] **M13.05** Write forward and backward-compatible schema migrations plus data backfills for existing Room/Widget records.
- [ ] **M13.06** Constrain deletes, membership relationships, and media-host metadata with proper foreign keys, indices, and retention rules.
- [ ] **M13.07** Define object storage for permitted avatars/attachments with signed URL access and content limits.
- [ ] **M13.08** Add transaction-level integration tests for concurrent edits, access revocation, deletion, data migration, and rollback.

**Exit verification:**

- [ ] **M13.E1** Server database is canonical; clients can reconcile snapshots and ordered operations without silent data loss.
- [ ] **M13.E2** Migration of production-shaped legacy fixtures is repeatable and reversible under the documented rollback plan.

- [ ] **M13.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m14"></a>

### M14 — Local-first cache, offline queue, and conflict-safe synchronization

**Prerequisites:** 08, 13, 15

**Implementation status (2026-11-21): Not started.** Camera localStorage and encrypted URL files exist outside a local-first sync engine. **Remaining:** Implement account-scoped SQLite cache, durable offline queue, operation IDs, exactly-once replay and visible conflict reconciliation. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m14).

- [ ] **M14.01** Introduce local SQLite with per-account workspaces, camera state, snapshots, safe tab metadata, pending operations, and schema version.
- [ ] **M14.02** Keep actual Chromium profile storage independent of the local cache; store sensitive local credentials using OS-protected mechanisms.
- [ ] **M14.03** Apply local mutations optimistically and assign stable client operation IDs, retries, backoff, and idempotency tokens.
- [ ] **M14.04** On reconnect, compare server room revisions, fetch missing operations/snapshots, replay validated pending edits, and resolve conflicts visibly.
- [ ] **M14.05** Define operation ordering, deletion/tombstone behavior, clock-skew tolerance, and deterministic merge rules for geometry and metadata.
- [ ] **M14.06** Persist queued work atomically, protect against corruption and abrupt power loss, and support local cache repair/reset without clearing browser profiles.
- [ ] **M14.07** Clearly distinguish locally cached canvas UI from online-dependent websites, media, invitations, and presence.
- [ ] **M14.08** Test offline create/move/delete, multi-device conflicts, network flapping, profile changes, and crash during sync.

**Exit verification:**

- [ ] **M14.E1** Authorized offline edits survive app restart and reconcile exactly once when connectivity returns.
- [ ] **M14.E2** Conflicts and unavailable external content are communicated honestly; recovery never exposes or erases unrelated profiles.

- [ ] **M14.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m15"></a>

### M15 — Authoritative realtime sync, ordering, and concurrent editing

**Prerequisites:** 03, 13

**Implementation status (2026-11-21): Partial.** Authenticated Socket.IO, authoritative membership/action lookup, volatile/throttled pointer events, membership retry recovery and an inactive Supabase ephemeral adapter. **Remaining:** Ordered durable operations/revisions, missing-operation replay, edit leases, live private Supabase RLS/event parity and conflict/load testing. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m15).

- [ ] **M15.01** Keep authenticated Socket.IO only during migration; validate Clerk JWT and room RLS on private Supabase Realtime joins, constrain client publishes to ephemeral events, and route all durable commands/host-control grants through verified APIs.
- [ ] **M15.02** Separate durable mutations, ephemeral cursor/presence, media signaling, and control-plane events into typed, versioned protocols.
- [ ] **M15.03** Assign server sequence/revision numbers, validate operation IDs, and persist durable changes before broadcasting acknowledgment.
- [ ] **M15.04** Use short drag/resize leases and provisional throttled moves; commit final world geometry with version checks.
- [ ] **M15.05** Send reconnecting clients a snapshot and missing ordered operations, detecting gaps and duplicates.
- [ ] **M15.06** Use throttled/volatile events for cursors, hover and pointer movement without storing every pointer event permanently.
- [ ] **M15.07** Choose CRDTs only for future truly concurrent document-like content, after demonstrated need—not for ordinary widget positions.
- [ ] **M15.08** Build load and fault-injection tests for multi-user conflicting operations, disconnects, duplicate events, stale clients, and authorization revocation.

**Exit verification:**

- [ ] **M15.E1** Clients converge on identical durable workspace state after partitions and reconnects.
- [ ] **M15.E2** Cross-room message injection and unauthorized collaboration actions are rejected in automated tests.

- [ ] **M15.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m16"></a>

### M16 — Presence, chat, notifications, and collaboration affordances

**Prerequisites:** 03, 13, 15

**Implementation status (2026-11-21): Partial.** Room-scoped ephemeral presence/cursors and in-memory chat history/recent-message UI; Inbox is explicitly a placeholder. **Remaining:** Persistent chat with acknowledgments/pagination/retention, real invitations/inbox, notification/privacy controls and restart/reconnect acceptance. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m16).

- [ ] **M16.01** Keep presence and cursor events ephemeral, scoped to authorized rooms, and rate-limited.
- [ ] **M16.02** Persist authorized user chat messages with retention, pagination, delivery acknowledgments, and moderation/reporting policy.
- [ ] **M16.03** Create inbox invitations and meaningful workspace notifications with read/unread and privacy controls.
- [ ] **M16.04** Show participant identity, joining/leaving, last-seen status, host/control identity, and connection quality clearly.
- [ ] **M16.05** Provide muted notifications, accessibility announcements, safe links, and anti-spam defenses.
- [ ] **M16.06** Define and test notification authorization, blocked/revoked members, account deletion, and retention requirements.
- [ ] **M16.07** Keep screen content and personal browsing history out of presence, chat logs, analytics, and notifications by default.
- [ ] **M16.08** Test multi-device presence, reconnect, message ordering, and suspended app behavior.

**Exit verification:**

- [ ] **M16.E1** Messages and invitations survive server restarts; ephemeral presence recovers without stale ghost members.
- [ ] **M16.E2** Permission revocation immediately stops access to chat, notifications, and presence for the workspace.

- [ ] **M16.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m17"></a>

### M17 — Personal, Live, and Shared modes with host/control leases

**Prerequisites:** 03, 05, 06, 15, 18

**Implementation status (2026-11-21): Partial.** Personal/Live/Shared surfaces, explicit host Start/Stop, separate Shared profile, checked host/viewer signaling and sanitized remote input. **Remaining:** Exclusive controller/host leases, fencing generations, heartbeat/grace rules, safe handoff and multi-client conflict/failure acceptance. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m17).

- [ ] **M17.01** Implement Personal as private local browser content with only authorized safe metadata shared to the canvas.
- [ ] **M17.02** Implement Live as one user's locally hosted browser with explicit capture consent and authorized viewing; no remote input by default.
- [ ] **M17.03** Implement Shared as one designated host browser plus controlled remote input over authenticated signaling.
- [ ] **M17.04** Add an exclusive, visible controller lease with request, grant, release, time-out, host override, and malicious input filtering.
- [ ] **M17.05** Add host registration leases, heartbeats, generation IDs, reconnection grace, and explicit Host disconnected states.
- [ ] **M17.06** On host failure, support deliberate new-host start and restore from permitted metadata; never promise transfer of arbitrary live JavaScript/session memory.
- [ ] **M17.07** Prevent leakage of personal profiles into Shared sessions and restrict which domains/permissions are capturable or remotely controllable.
- [ ] **M17.08** Test host handoff, two simultaneous controllers, revoked access, stale input, network partitions, and browser crash.

**Exit verification:**

- [ ] **M17.E1** Exactly one authorized controller can act at a time; viewers cannot escalate to host/control without permission.
- [ ] **M17.E2** Host loss is explicit, recoverable where possible, and does not silently substitute or expose a personal browser profile.

- [ ] **M17.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m18"></a>

### M18 — LiveKit media, streaming budgets, audio, and capture lifecycle

**Prerequisites:** 03, 06, 15

**Implementation status (2026-11-21): Partial.** LiveKit viewer/publisher grants, native tab capture/fallback, simulcast/dynacast, visibility-based subscribe tiers, posters and viewer-driven capture. **Remaining:** Background audio/device UX, dynamic measured media budgets, quality/network/codec tests and deployed revocation/webhook qualification. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m18).

- [ ] **M18.01** Retain LiveKit as the SFU; ensure hosted-only token signing and workspace-scoped publish/subscribe grants.
- [ ] **M18.02** Capture a host's webContents or screen only while explicitly shared and needed by authorized viewers or a deliberate recording workflow.
- [ ] **M18.03** Separate viewer subscription from host tab lifetime: off-screen viewers may unsubscribe without stopping the browser.
- [ ] **M18.04** Budget full-quality, low-quality, and unsubscribed streams by visible pixel area, selected tab, user priority, and device capability.
- [ ] **M18.05** Show last-frame posters/connection state for unsubscribed tabs and resume the stream smoothly when it returns onscreen.
- [ ] **M18.06** Handle audio independently of video visibility; support user-intended background listening, mute, device selection, and voice controls.
- [ ] **M18.07** Use bounded simulcast/adaptive stream parameters, capture cool-downs, and explicit pause/stop controls for CPU/GPU conservation.
- [ ] **M18.08** Test zero/one/many viewers, slow networks, device changes, track restarts, revoked permissions, codec compatibility, and host crashes.

**Exit verification:**

- [ ] **M18.E1** A host publishes at most the intended stream while authorized viewers receive only permitted media.
- [ ] **M18.E2** Offscreen streaming reduces decode/network cost without resetting browser state or unwantedly muting requested audio.

- [ ] **M18.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m19"></a>

### M19 — Cloud operations, scaling, tenancy, and infrastructure

**Prerequisites:** 02, 03, 13, 15, 18

**Implementation status (2026-11-21): Partial.** Free-first deployment contracts, Docker/compose compatibility definitions, web health endpoint and local service configuration. **Remaining:** Deploy separated environments; TLS/DNS/secrets/backups, quotas, cross-instance coordination, SLOs and failover/restore drills. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m19).

- [ ] **M19.01** Deploy Vercel Next.js/UI APIs, Supabase PostgreSQL/private Realtime, authorized object storage, Clerk and LiveKit with documented managed configuration and separated environments.
- [ ] **M19.02** Configure TLS, DNS, managed secrets, firewalls, backups, service-to-service auth, and separated dev/staging/prod environments.
- [ ] **M19.03** Instrument managed Supabase Realtime quotas and lease/control consistency; introduce dedicated room coordination only if measured scale requires it, without changing Cubics domain/API contracts.
- [ ] **M19.04** Enforce workspace/user quotas, burst limits, data retention, abuse prevention, and secure tenant isolation.
- [ ] **M19.05** Define application/database/media version compatibility, backward-compatible migrations, and staged rollout/rollback strategies.
- [ ] **M19.06** Implement service health checks, deployment readiness, graceful shutdown, reconnect handling, and regional failure procedures.
- [ ] **M19.07** Set an explicit SLO/error budget and capacity model with representative clients, workspaces, and stream counts.
- [ ] **M19.08** Rehearse failover, database restore, service restart, and multi-node concurrency in staging.

**Exit verification:**

- [ ] **M19.E1** Staging-to-production deployment and rollback are automated, audited, and reproducible.
- [ ] **M19.E2** Failure drills meet agreed recovery objectives, with data access isolated between tenants.

- [ ] **M19.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m20"></a>

### M20 — Observability, diagnostics, privacy-safe telemetry, and support

**Prerequisites:** 01, 06, 15, 18, 19

**Implementation status (2026-11-21): Partial.** Secret-redacted membership failure categories, bounded HTTP diagnostics, SQL logging off by default and stale-worker guidance. **Remaining:** Correlated lifecycle/API/realtime/media tracing, runtime metrics/dashboards/alerts and previewable opt-in support bundles. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m20).

- [ ] **M20.01** Implement structured logs and tracing across desktop, API, realtime, and media using correlation IDs without sensitive URL parameters.
- [ ] **M20.02** Measure browser process counts, memory, CPU/GPU load, crashes, navigation failures, live capture/encode, viewer decode, and canvas frame times.
- [ ] **M20.03** Track local sync queue depth, operation revisions, reconnect rates, API errors, host lease expiry, and dropped media subscriptions.
- [ ] **M20.04** Create dashboards, actionable alerts, error budgets, and privacy-preserving crash diagnostics.
- [ ] **M20.05** Redact cookies, tokens, personal page content, arbitrary form values, and sensitive URL/query/path information from telemetry.
- [ ] **M20.06** Provide in-app diagnostics and opt-in support bundles with previewable contents and redaction.
- [ ] **M20.07** Define incident severity, on-call ownership, rollback triggers, status communication, and postmortem templates.
- [ ] **M20.08** Validate metrics accuracy and privacy with synthetic incidents and adversarial test inputs.

**Exit verification:**

- [ ] **M20.E1** Operators can diagnose tab regressions and realtime incidents without inspecting personal browsing contents.
- [ ] **M20.E2** Sensitive-data leakage tests pass, and every release-critical alert has a tested response playbook.

- [ ] **M20.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m21"></a>

### M21 — Automated testing, accessibility, security, and performance qualification

**Prerequisites:** 04, 08, 11, 12, 14, 15, 17, 18, 20

**Implementation status (2026-11-21): Partial.** Security/API/identity/privacy/recovery unit and socket tests; real three-OS native popup/profile/restart and realtime regression workflows. **Remaining:** Green required CI, full UI/lifecycle/media/lease journeys, accessibility, actual-device benchmarks and supported hardware qualification. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m21).

- [ ] **M21.01** Build unit suites for geometry, camera transforms, tab lifecycle, URL validation, permissions, operation versions, and local sync algorithms.
- [ ] **M21.02** Add API integration suites for workspace authorization, role changes, partial failure, idempotency, schema migrations, and token verification.
- [ ] **M21.03** Add multi-client realtime tests for snapshot replay, presence, conflict resolution, leases, revocation, reconnection, and host failover.
- [ ] **M21.04** Add real Electron E2E tests for external websites, tab navigation/history, Twitch-like offscreen return, webContents crashes, permissions, downloads, and popup handling.
- [ ] **M21.05** Add screen/camera/native view coordinate, hit-target, stacking, drag/resize, multi-monitor, high-DPI, and sidebar animation tests.
- [ ] **M21.06** Add LiveKit and audio tests under bandwidth loss, packet loss, multiple viewers, start/stop sharing, and background listening.
- [ ] **M21.07** Run accessibility audits for keyboard, screen reader, reduced motion, contrast, focus, and error recovery on target OS versions.
- [ ] **M21.08** Define reference machines and repeatable benchmark workloads (10, 25, 100 widgets with mixed loaded/streaming tabs); establish p95 frame-time, latency, memory, and recovery targets based on baseline measurements.
- [ ] **M21.09** Make lint, typecheck, brand, unit, integration, E2E smoke, security, and packaging checks required for protected releases.

**Exit verification:**

- [ ] **M21.E1** All critical journeys and negative security tests pass in CI and on actual macOS/Windows desktop hardware.
- [ ] **M21.E2** Performance meets documented targets under repeatable workloads without offscreen tab resets or silent state loss.

- [ ] **M21.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m22"></a>

### M22 — Production desktop distribution, installation, and automatic updates

**Prerequisites:** 02, 04, 12, 19, 21

**Implementation status (2026-11-21): Partial.** Electron builder targets, allowlisted shell staging, fuse configuration and unsigned artifact validation tools. **Remaining:** Signed/notarized macOS/Windows installers, authenticated auto-update/rollback and clean-machine install/upgrade certification. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m22).

- [ ] **M22.01** Create reproducible macOS Apple Silicon/Intel and Windows 11 x64 release artifacts with correct native dependencies.
- [ ] **M22.02** Code-sign and notarize macOS builds; sign Windows binaries/installers and validate distribution trust.
- [ ] **M22.03** Implement cryptographically verified update metadata, staged rollout, rollback, and minimum-compatible backend versions.
- [ ] **M22.04** Harden first-run onboarding, OS permissions, protocol handlers, deep links, file associations, and startup recovery.
- [ ] **M22.05** Migrate local browser profiles and SQLite schema safely across app version upgrades without deleting user cookies.
- [ ] **M22.06** Add clean install, upgrade, downgrade/rollback, uninstall, multi-account, and multiple-window/profile test matrices.
- [ ] **M22.07** Document supported platforms, minimum device requirements, network dependencies, user-visible limitations, and support policies.
- [ ] **M22.08** Publish a release manifest, changelog, checksum/signature verification, support channels, and release owner sign-off.

**Exit verification:**

- [ ] **M22.E1** Both GA platform installers pass signing, onboarding, upgrade, and rollback validation on clean machines.
- [ ] **M22.E2** Upgrades preserve workspaces, browser profiles, local cache, and recoverable session metadata.

- [ ] **M22.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m23"></a>

### M23 — Legacy compatibility, data migration, staged rollout, and operational recovery

**Prerequisites:** 07, 08, 13, 14, 17, 19, 21, 22

**Implementation status (2026-11-21): Partial.** Stable partition names, legacy API/metadata adapters, encrypted per-tab import/recovery and owner-consented scrub hooks; rollout/rollback plans. **Remaining:** Versioned native/data/cache migrations, historical-build upgrade/interrupt/restore drills and retirement of temporary adapters. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m23).

- [ ] **M23.01** Inventory every old database record, browser partition, saved URL, local camera preference, and serialized widget configuration.
- [ ] **M23.02** Provide migration scripts from existing Room/Widget models and renderer-owned webviews to stable session IDs and canonical metadata.
- [ ] **M23.03** Preserve existing browser profiles and user login sessions wherever supported without copying their secrets into cloud storage.
- [ ] **M23.04** Feature-flag native browser surfaces, sync engine, and server changes; support a staged cohort rollout with safe rollback.
- [ ] **M23.05** Define dual-read/dual-write or adapter windows only where needed, and remove them after reconciliation and verification.
- [ ] **M23.06** Test upgrade paths from representative historical builds and crash during migration; include backups and versioned recovery steps.
- [ ] **M23.07** Validate tenant privacy, visibility, room membership, chat, streamed tabs, and control rights before/after migration.
- [ ] **M23.08** Demonstrate disaster recovery, backup restoration, a revoked user session, and release rollback without orphaned workspace data.

**Exit verification:**

- [ ] **M23.E1** Historical Cubics workspaces and profiles remain usable after upgrade, with no unexplained reset to initial page URLs.
- [ ] **M23.E2** Temporary compatibility paths are fully retired before architecture freeze and restoration drills pass.

- [ ] **M23.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.


<a id="m24"></a>

### M24 — Final product acceptance, architecture lock, and maintenance contract

**Prerequisites:** 00–23

**Implementation status (2026-11-21): Not started.** Final acceptance, release gates and architecture-lock policy are documented under M00. **Remaining:** Close M01-M23, run final acceptance/audits, remove legacy paths, publish support/runbooks and tag signed-off GA artifacts. [Evidence and limits](docs/milestones/STATUS_2026-11-21.md#m24).

- [ ] **M24.01** Confirm every numbered checklist item M00–M23 has testable evidence, reviewer approval, and no unresolved release-blocking issues.
- [ ] **M24.02** Perform end-to-end first-run, private browsing, shared viewing/control, multiuser sync, offline/resume, camera navigation, sign-out, and recovery acceptance sessions.
- [ ] **M24.03** Audit privacy, threat model, cloud secrets, Electron sandbox, authorization, data migration, performance, accessibility, backup/restore, and signed auto-update gates.
- [ ] **M24.04** Freeze the authoritative domain contracts, browser lifecycle states, event protocol, workspace schema, canvas input rules, and app/service deployment boundaries in versioned ADRs.
- [ ] **M24.05** Remove abandoned prototypes, shadow/duplicate implementations, temporary flags, unsafe escape hatches, unnecessary bundled secrets, and migration-only code.
- [ ] **M24.06** Publish final architecture diagrams, operator runbooks, user documentation, supported-version policies, and compatibility guarantees.
- [ ] **M24.07** Tag the GA release, preserve release artifacts and evidence, and record explicit final sign-off from engineering, security, design, and product.
- [ ] **M24.08** Adopt a post-GA policy of maintenance and additive versioned extensions only; structural changes require exceptional, documented approval, not cosmetic refactoring.

**Exit verification:**

- [ ] **M24.E1** All checklist milestones and release gates are signed off with passing evidence and no unaccepted P0/P1 defect.
- [ ] **M24.E2** A reproducible GA release is tagged, installable, supported, monitored, and protected by the frozen architecture contract.

- [ ] **M24.SIGNOFF** Implementation and verification evidence recorded; reviewer has approved milestone closeout.

## Final release gates — ALL REQUIRED

- [ ] **G1** Security threat model, access control and IPC/browser sandbox audits passed; no critical unresolved findings.
- [ ] **G2** Distributed app independently scanned: no privileged cloud secrets, signing material, or direct production database authority.
- [ ] **G3** Real Electron tab lifecycle/parity E2E passed; panning/zooming/hidden sidebar never reload an already loaded tab.
- [ ] **G4** Durable revisions, server snapshots, local-first recovery, offline replay, and data migration rollback drills passed.
- [ ] **G5** Personal privacy, host/controller leases, realtime room isolation, LiveKit permissions and revocation tested across real clients.
- [ ] **G6** Measured reference-device performance budgets accepted; accessibility/usability audits passed on both GA platforms.
- [ ] **G7** Signed/notarized Windows/macOS installers; auto-update, failed-upgrade rollback, backups and disaster restore verified.
- [ ] **G8** Required CI and real-hardware E2E suites green; no open P0/P1 or security release blockers.
- [ ] **G9** All legacy paths removed; final diagrams, contracts, ADRs, runbooks, support docs, and compatibility policy versioned.
- [ ] **G10** Milestones M00–M24 approved with named engineering, product, security and design sign-off; tagged GA artifacts retained.

## Evidence register

The [2026-11-21 audit](docs/milestones/STATUS_2026-11-21.md) identifies source evidence, verified CI, user reports and remaining qualification separately. Earlier dated milestone notes are historical; current summaries take precedence for implementation status.

| Milestone | Current implementation/evidence | Closeout |
| --- | --- | --- |
| M00 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m00); [source](docs/milestones/M00.md) | Recorded M00 owner approval, 2026-11-08 |
| M01 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m01); [source](docs/security/THREAT_MODEL.md) | Open; full exit checks and sign-off pending |
| M02 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m02); [source](electron/main.js) | Open; full exit checks and sign-off pending |
| M03 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m03); [source](src/lib/security/realtime-membership.cjs) | Open; full exit checks and sign-off pending |
| M04 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m04); [source](electron/security-policy.cjs) | Open; full exit checks and sign-off pending |
| M05 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m05); [source](electron/browser-profile.cjs) | Open; full exit checks and sign-off pending |
| M06 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m06); [source](src/components/PersonalTabView.tsx) | Open; full exit checks and sign-off pending |
| M07 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m07); [source](src/components/StreamedTabView.tsx) | Open; full exit checks and sign-off pending |
| M08 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m08); [source](electron/personal-navigation-recovery.cjs) | Open; full exit checks and sign-off pending |
| M09 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m09); [source](src/lib/live/budget.ts) | Open; full exit checks and sign-off pending |
| M10 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m10); [source](src/app/spaces/[id]/page.tsx) | Open; full exit checks and sign-off pending |
| M11 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m11); [source](src/components/RemoteCursors.tsx) | Open; full exit checks and sign-off pending |
| M12 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m12); [source](src/components/SpaceRail.tsx) | Open; full exit checks and sign-off pending |
| M13 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m13); [source](prisma/schema.prisma) | Open; full exit checks and sign-off pending |
| M14 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m14); [source](src/app/v1/workspaces/[id]/snapshot/route.ts) | Open; full exit checks and sign-off pending |
| M15 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m15); [source](socket-server.cjs) | Open; full exit checks and sign-off pending |
| M16 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m16); [source](src/app/inbox/page.tsx) | Open; full exit checks and sign-off pending |
| M17 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m17); [source](src/lib/live/hub.ts) | Open; full exit checks and sign-off pending |
| M18 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m18); [source](src/lib/live/sfu.ts) | Open; full exit checks and sign-off pending |
| M19 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m19); [source](deploy/README.md) | Open; full exit checks and sign-off pending |
| M20 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m20); [source](src/lib/cloud/room-join-recovery.cjs) | Open; full exit checks and sign-off pending |
| M21 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m21); [source](.github/workflows/native-electron-security.yml) | Open; full exit checks and sign-off pending |
| M22 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m22); [source](electron-builder.yml) | Open; full exit checks and sign-off pending |
| M23 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m23); [source](docs/final-product/migration-map.md) | Open; full exit checks and sign-off pending |
| M24 | [Current audit](docs/milestones/STATUS_2026-11-21.md#m24); [source](master_checklist.md) | Open; full exit checks and sign-off pending |

## Final sign-off

- [ ] Engineering: all architecture boundaries and lifecycle contracts verified; technical lead / date: __________
- [ ] Security/privacy: threat mitigations, permissions, data isolation and release security verified; reviewer / date: __________
- [ ] Design/accessibility: final interaction and accessibility acceptance complete; reviewer / date: __________
- [ ] Product/release: GA scope, cross-platform distribution, support and recovery validated; owner / date: __________
- [ ] Tag the immutable GA release and record its commit SHA, installer signatures, supported versions and rollback playbook here: __________
- [ ] **ARCHITECTURE LOCK APPROVED:** future development follows the stable contracts and maintenance/exception policy in master_plan.md.

**Important:** GA completeness is not a promise that future patches, supported OS/browser upgrades, legal/security updates or bug fixes will never be necessary. The architectural boundaries are what become stable.
