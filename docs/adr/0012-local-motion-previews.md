# ADR-0012: Local cached visuals during fast camera movement

- Status: Implemented in source; native acceptance pending
- Decision version: 1.0.0
- Date: 2026-11-21
- Milestones: M05.04/M05.07/M10.02/M10.03/M11.04/M11.07/M21
- Supersedes: No native lifetime or sharing policy. Refines the earlier no-preview presentation policy with explicit product-owner approval.
- Product owner: Project owner (explicit user instruction in chat; identity not independently verified), 2026-11-21. Selected “Use cached previews for performance” after disclosure that video visuals would briefly hold and audio continuity needed native testing.
- Engineering validation: automated/source tests below. Independent security/native reviewer sign-off: pending; no GA or milestone acceptance claimed.

Presentation policy superseded by [ADR-0013](0013-heavy-site-motion-isolation.md): all motion and uncached guests are now protected. The text below records the original decision.

## Context

The owner reports a hitch **during** quick pans and zooms, after JS camera scheduling improvements. No profiler trace from the owner's Electron instance is available. Native embedded-page composition remains a plausible cost, not a confirmed single cause. React/math unit tests cannot certify Chromium rasterization performance.

## Decision

Keep every authorized Personal guest mounted. When a fast camera movement is detected, display an already decoded local image for guests that have a cached preview and hide their native surface with CSS. The application does not pause/mute the page, navigate it or destroy/reparent its guest. Restore live visuals after 300ms of quiet; an active canvas drag holds preview mode across stationary pauses. Tabs without previews stay live. Live/Shared hosts and remote streams retain their existing capture/control semantics.

Capture only ready, connected Personal guests under the existing user/partition/reset-generation authority. Use the installed Electron WebviewTag `capturePage` and NativeImage APIs; no new preload or IPC capability is introduced. Capture and encoding are separate idle stages so a late native readback cannot eagerly encode during renewed movement. Decode before publication; publish through the quiet/idle queue. One capture pipeline runs at a time. Visible previews refresh no more frequently than the idle refresh cycle (1500ms); a preview may therefore show a recent older frame during motion.

Bound cache to 8 images, 8MiB of encoded image bytes, and 6 million decoded pixels; each image is at most 960×720. One in-flight preparation may temporarily coexist with that cache. Revoke evicted local blob URLs and release warming image references. Invalidate on navigation/loading, profile reset, tab removal, room departure and account/partition identity changes. Pending work is cancellable; stale results never publish under a new authority scope.

No image, URL, title, credential, DOM or profile capability is added to shared widget state, sent over a socket/API, written to application storage, or exposed in diagnostics. Images are owner-renderer local resources. Security-sensitive revocation remains immediate and is not deferred with performance work.

## Alternatives

- Keep every guest surface live: preserves continuously moving video but leaves native composition cost in the camera path.
- Unmount or freeze offscreen guests: rejected because it changes page lifetime, playback or continuity.
- Capture on every pan/zoom frame: rejected because readback/encoding can create the very stalls being addressed.
- Main-owned WebContentsView compositor: retained as future M06/M07 work, not represented as already implemented by this decision.

## Additional scheduling and measurements

Deferred work now requires both 300ms quiet and an idle budget, with explicit held-interaction blocking and cancellation of already admitted idle callbacks. This fixes a reproducible between-burst scheduling problem but does not alone explain a during-movement hitch.

Development-only `window.__CUBICS_CAMERA_PERF__` exposes bounded numeric frame-queue delay, camera callback duration, deferred-job duration and long-task summaries. It records no content or identifiers and performs no export/transmission. Renderer callback measurements are not a native GPU/presentation trace.

## Verification, migration and rollback

Unit tests cover serial capture, memory limits, visibility gating, capture failure/live fallback, revocation of pending and published resources, stale result rejection, cancellation during encoding/decode, motion hysteresis/held-pan behavior, timer cleanup, scheduling holds/idle deadlines and numeric diagnostics. Existing camera, zoom/pan, privacy, vault and tab-chrome regressions remain required.

Real Electron acceptance remains open: fast-pan/zoom frame times; capture availability; body alignment/clipping on macOS/Windows; initial uncached behavior; text/image sharpness; uninterrupted audio; native data clearing/account switching; room exit; sharing unaffected. Do not infer these from mocks. Product approval above authorizes the presentation trade-off, not a security/performance certification.

No schema or stored-data migration. Revert this change to restore live rendering throughout motion; unmount cleanup revokes local image URLs. No secret or persisted image cleanup is required by the implementation.

The public build flag `NEXT_PUBLIC_CUBICS_MOTION_PREVIEWS=0` disables preview capture/substitution for rollback while retaining the camera/idle fixes. Very large guest surfaces (>16 million estimated device pixels) decline capture and stay live, limiting initial readback pressure before resizing.
