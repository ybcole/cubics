# Cubics final product — scope and acceptance contract

**Version:** 1.0.0 (proposed) · **Milestone:** M00.01, M00.02, M00.04 · **Owner decision:** pending.

## Product definition

Cubics is a **desktop-first spatial browser workspace**: an infinite, persistent canvas for arranging browser tabs and collaborating on deliberately shared content. Its primary object is a durable `Tab` resource, not a transient React widget or a general-purpose whiteboard document.

### Shippable GA user journeys

1. Sign in/out and switch Cubics identities without leaking personal sessions; recover from session renewal errors.
2. Create/join/leave/manage private spaces with roles, memberships, invitations, and discoverable navigation.
3. Add personal web tabs, navigate through arbitrary normal websites, pan and zoom around them, drag/resize, and return to the **exact running tab** after it leaves the viewport while the application remains healthy.
4. Use a Live tab to share an authorized host's browser feed; stop/pause, see audience, manage audio and permissions.
5. Use a Shared tab with a single explicit controller lease; request/release control, host override, and safe host-disconnect recovery.
6. Collaborate in real time with persistent widget placement, ephemeral cursors/presence, saved chat, and reliable disconnect/reconnect reconciliation.
7. Keep camera/selection/navigation local to the user; open the collapsed rail by left-edge dwell if hidden, with keyboard access.
8. Recover cached canvas structure and queued work offline; distinguish unreachable websites and livestreams from an available local workspace.
9. Install/update the signed desktop app safely on both GA platforms, with consent prompts, privacy controls and supportable crash recovery.

### Non-negotiable product invariants

| ID | Product behavior | Negative regression test |
| --- | --- | --- |
| INV-01 | Camera motion and widget visibility changes do **not destroy** an active browser tab. | Navigate Google → Twitch, pan offscreen/return repeatedly; same live page and history remain. |
| INV-02 | A widget's React/UI lifecycle cannot silently replace its native browser session. | Remount shells, hide rail, resize/reorder views: no unrequested webContents recreation. |
| INV-03 | Private browsing context never becomes shared implicitly. | Two accounts in one space cannot inspect personal profile cookies or pixels without sharing consent. |
| INV-04 | Workspace data access and realtime actions are permission-checked on the server. | Forge room IDs, user IDs and socket events: deny unauthorized access. |
| INV-05 | Durable mutations converge after reconnect and idempotent retries. | Partition clients and replay duplicate operations; both converge to one authoritative revision. |
| INV-06 | Camera, zoom and local selection belong to each user. | Two users in one room can independently pan and zoom. |
| INV-07 | Offscreen media viewers may unsubscribe without killing the host page. | Host continues browser and authorized audio despite viewer scrolling away. |
| INV-08 | Browser/media permissions are deliberate and revocable. | Revoke capture/control: no further video frames or privileged input to unauthorized parties. |
| INV-09 | A crash restores recoverable state honestly, never promising arbitrary JavaScript memory. | Kill browser process and restart: exact limitations surfaced, original metadata retained. |
| INV-10 | Distributed desktop software contains no privileged cloud authority or secrets. | Scan packaged artifact and exercise API from an unauthorized renderer: denied. |
| INV-11 | OS interaction and native view bounds follow camera transforms exactly. | Drag/zoom/rail resize/high-DPI multi-display E2E tests. |
| INV-12 | Application is keyboard accessible, has reduced-motion support and honors explicit user intent. | Tab navigation, focus, voice/audio and low-motion audits. |

### Supported platforms and scope boundaries

**GA promise:** current supported macOS versions on Apple Silicon and Intel, plus Windows 11 x64. The **minimum macOS version, latest supported Windows builds, GPU/CPU/RAM floors and update compatibility** are release values to be measured and approved in M21/M22—not guessed here. macOS and Windows must both pass signed installer, permission, accessibility, crash and upgrade test matrices. Linux/AppImage may exist as experimental builds but is **not** supported GA; web-only editing and mobile are not GA promises.

**Explicit non-goals:** arbitrary page DOM/JS-memory restoration after crash, browser extension compatibility, universal DRM capture, silent login sharing, automatic live-session migration to another computer, a bespoke SFU, CRDTs for ordinary widget geometry, enterprise compliance certificates without separate audit, and one app version supporting every future OS forever.

### Acceptance and sign-off

An implementation is **not** complete because a UI is visible or a service starts locally. Completion requires the behavior in the product invariants, the relevant automated and real-Electron tests, privacy/security checks, supported-platform verification, migration/rollback readiness, and milestone exit evidence. M00.01 and M00.E1 require **explicit product-owner approval**; the instruction to start development is authorization to work, not a substitute for formal scope approval.

**Open decision for product owner:** Confirm GA scope/platforms and non-goals; record reviewer/date in `docs/milestones/M00.md`. Until then M00 remains IN PROGRESS.
