# Unified zoom/pan gesture pipeline

2026-11-21. Follow-up to [#19](https://github.com/ybcole/cubics/issues/19), M10.01–M10.03/M11.04. Source implementation; no milestone or native performance certification.

## Previous costs and changes

Wheel zoom previously called React's zoom setter on every display frame. The full widget list depended on that value, updating every react-rnd wrapper and repeatedly changing streamed-view resolution metadata. Pan and zoom also ran independent frame callbacks: the absolute pre-zoom pan origin could overwrite the zoom-adjusted camera on the next pointer event.

`camera-gesture.ts` now composes pointer pan, wheel/pinch, keyboard/control zoom and zoom-slider input into one pending `{x, y, zoom}` pose in event order. One requestAnimationFrame paints the latest pose. Multiple wheel events with different cursor anchors are composed individually before that paint. Pan uses incremental screen-space deltas against the same pending camera, preserving earlier zoom adjustments. Bounds and zoom limits remain enforced; pixel, line and page wheel modes are normalized.

The physical camera is ref/DOM-owned during movement. HUD text and slider value update directly, only when changed, with no tab-tree rebuild. The shared quiet-time work queue coalesces React zoom/stream-quality metadata into a transition after 100ms of camera quiet. Widget input flushes pending camera work and synchronously commits the physical scale before react-rnd receives the event, preventing stale-scale dragging/resizing. The committed-scale ref updates in a layout effect, not an interruptible concurrent render. Wheel/control zoom is ignored during widget drag/resize; canvas pan plus zoom remains supported.

Sidebar reflow flushes the pending pose before camera compensation. Pan release, focus/page visibility changes flush pending input; room exit cancels stale callbacks and queued metadata. Directional navigation flushes the latest gesture pose before using its zoom and camera origin. Browser guests retain their existing identities, privacy and admission/keep-alive policies.

## Verification

Eight new tests in `scripts/security/zoom-pan.test.cjs` cover anchor invariance, 1,000-event coalescing, interleaved pan/zoom order, varying wheel anchors, final release position, reflow/cancellation, wheel modes/limits/invalid input, and execution of the actual room-page callbacks.

The real page callback test with 100 tabs verifies:

- 20 zoom frames paint 20 camera transforms, call the React zoom setter zero times, and reconstruct zero widget elements during the gesture.
- The HUD reflects physical zoom before React metadata commits.
- Exactly one metadata job remains pending; committing it updates the tab wrappers once.
- Widget pointer capture synchronizes react-rnd's scale to the physical camera before interaction.
- A combined pan/wheel frame produces one transform with the correctly composed anchor and drag delta.

Combined performance/navigation/search/chrome/Personal-vault/recovery suite: 48 tests pass. Brand, TypeScript and production build smoke pass. Existing source guards were updated to check the unified scheduler's integration points.

This is operation-count and math evidence, not a macOS/Windows Electron frame-rate measurement. Native Chromium rasterization/GPU costs with real websites, high DPI, audio/video and many guests still require supported-device profiling; zero-lag behavior is not certified by these tests. Human/native acceptance remains open in #19. No data migration or new IPC contract is introduced; rollback is a commit revert.
