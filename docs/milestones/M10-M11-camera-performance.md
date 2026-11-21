# Camera-path performance isolation

Date: 2026-11-21. Issue: [#19](https://github.com/ybcole/cubics/issues/19). Tracks M10.02/M10.03/M11.02/M11.04. Source implementation within existing camera/browser-lifetime contracts; no milestone closeout or native frame-rate certification.

## Problem and implementation

The owner reports stutter while panning and using directional navigation with many tabs. Source review identified several independent sources of contention:

| Previous path | Updated path |
| --- | --- |
| Sidebar reflow shifted the camera but left the active pan anchor unchanged, allowing the next pointer update to snap back | Shift both camera and drag anchor in screen coordinates during reflow |
| Pan wrote the camera on every pointer event and sampled layout for cursor reporting | Latest-input-wins scheduler writes once per display frame, preserves the release sample, and uses viewport metrics cached by ResizeObserver |
| Chat, pan UI and other page state reconstructed every widget element | Memoized widget-element list excludes unrelated UI state; browser identities remain stable |
| Each widget searched the full z-order array and maximized-ID list | Build Map/Set indexes once per relevant render; O(n) list construction replaces O(n²) z-order lookup |
| Every Personal shell immediately requested a profile and read its encrypted navigation | Cold guests qualify through a shared observer, then authorize one at a time after 100ms of camera quiet; nearer candidates first |
| Async profile/keychain completion could mount a native guest during a subsequent pan | Final native mounting also rechecks proximity through the quiet-time queue; native listeners attach when the deferred guest actually mounts |
| One visibility observer per Personal/viewer component, with immediate React and subscription-budget updates during motion | One cold-guest observer and one stream observer; coalesce stream ratios until quiet and publish the latest batch |
| Offscreen widget content participated in regular rendering | Widget-card paint/layout/style containment and Chromium `content-visibility: auto` skip offscreen content without removing guest DOM |

Deferred jobs are keyed, cancellable and paced one per 32ms slot. Camera movement advances the quiet deadline without recreating a timer on every frame. Pass-through cold tabs leaving the preload region are canceled. Existing streams keep their current bounded budget during motion, then update after settling. Account revocation and sharing authorization remain immediate and independent of this queue.

Pan cancellation, lost pointer capture, focus loss and room cleanup discard stale input. Existing camera persistence runs after movement, not in the pan frame. Native Window frame API wrappers from the previous fix are retained.

## Invariants and scope

No guest is evicted, reparented, reloaded or explicitly frozen because it goes offscreen. Personal webview keys still use the authorized partition and reset generation. No private URL/image is uploaded or added to workspace state. Profile clearing/revocation stays in the existing protected main-process path. This changes scheduling inside accepted boundaries, not IPC contracts, data ownership, native lifetime authority or database schema; no migration/ADR is required.

The final architecture's main-owned BrowserSessionManager and WebContentsView compositor remain M06/M07 work. This change does not claim those migrations happened. Many active websites can still consume CPU/GPU in their own processes; zero stutter across arbitrary pages/devices is not certified by source changes.

## Executable evidence

- Ten new tests in `scripts/security/canvas-performance.test.cjs`: 1,000 pointer samples collapse into one write; exact final sample and stale cancellation; 100 queued guests wait throughout continuous movement; paced/priority admission and latest-job replacement; shared observer count and cleanup; pass-through cancellation/fallback; latest stream-ratio batch; unchanged guest identity/gated authorization; actual room-page widget JSX reused through 20 chat renders and pan/chrome state changes; actual partition hook performs no eager IPC while revocation remains effective; execute the actual sidebar ResizeObserver callback to verify that reflow shifts the active drag anchor and prevents snap-back.
- Combined camera/performance/navigation/search/chrome/Personal-vault/recovery suite: 40 tests pass.
- Brand check, TypeScript check and production Next build smoke pass. The build uses the existing inert test-only Clerk placeholders and is not a distributable release.
- Test timing and operation counts are not macOS/Windows Chromium compositing measurements. Supported-device dense-tab pan, WASD, zoom, page-input focus, uninterrupted audio/video, reset/revocation and guest clipping acceptance remain open in #19. Local native browser probing is unavailable under the execution environment's socket restrictions.

Reviewer status: automated/source validation above; human/native acceptance pending. No checklist completion markers are changed.

## Rollback

Revert this performance commit to restore the previous scheduling/rendering behavior. No database, profile, navigation-vault or cookie migration is involved.
