# Rapid gesture rendering and local previews

2026-11-21 · [Issue #19](https://github.com/ybcole/cubics/issues/19) · [ADR-0012](../adr/0012-local-motion-previews.md).

The owner clarified that the hitch occurs **during movement**, then explicitly chose cached previews for performance. This change addresses the rendering path as well as a separately reproduced scheduling flaw. It is not a claim that the exact owner's native stall was measured or eliminated.

## Implemented

- Predecoded local Personal-tab previews replace native guest visuals during fast pan/zoom. Slow movement remains live. Live visuals restore after 300ms quiet; held pans retain the preview across pauses. Pages stay mounted; no pause/mute/navigation/destroy call is made by this feature.
- One idle capture pipeline; a separate cancellable image-encoding stage; idle publication. Late completion cannot bypass camera work arbitration. Visible snapshots refresh in idle, at most on the 1500ms refresh cycle.
- Local memory limits: 8 cached images, 8MiB encoded, 6 million decoded pixels, 960×720 maximum. One in-flight preparation may coexist. Blob URLs are revoked on eviction or invalidation; cache failure means live fallback.
- Authority scope includes the current user, authorized partition, reset generation and tab. Loading/navigation, account/profile changes, removal and cleanup invalidate old images and abort queued preparation. No pixels are synced or application-persisted.
- Explicit deferred-work holds during an active pan. After interaction ends, jobs wait for 300ms quiet plus a browser idle budget. Native idle callbacks are canceled/invalidated when input resumes.
- Development-only numeric diagnostics distinguish renderer queue delay, callback work and long tasks. These do not measure final GPU presentation.

## Validation

66 targeted tests pass: 48 previous regressions, 6 burst/idle/diagnostics regressions, and 12 preview cache/render/lifecycle regressions. Brand, TypeScript, plan consistency and production build smoke checks pass. Capture APIs were checked against the installed Electron WebviewTag/NativeImage type contracts; native playback/frame-rate behavior remains unverified in this environment.

Project-owner presentation approval is recorded in ADR-0012. No M05/M10/M11/M21 completion or independent review is claimed. Native-device acceptance in #19 remains open.

## Local development timing capture

In Cubics' renderer DevTools console:

```js
window.__CUBICS_CAMERA_PERF__.reset()
```

Reproduce several quick gestures, then inspect:

```js
JSON.stringify(window.__CUBICS_CAMERA_PERF__.read(), null, 2)
```

The readout contains only bounded numeric timing aggregates and development mode. `inputToFrame` is handler-to-frame callback delay, not hardware-input-to-present latency. Large camera callback time suggests renderer work; large queue delay/long tasks suggests contention. Low values do not prove native rasterization is smooth and require an actual Electron trace before attributing the remaining hitch to GPU or embedded views.

Rollback: revert the change; no data migration.

The public build flag `NEXT_PUBLIC_CUBICS_MOTION_PREVIEWS=0` disables preview capture/substitution for rollback while retaining the camera/idle fixes. Very large guest surfaces (>16 million estimated device pixels) decline capture and stay live, limiting initial readback pressure before resizing.
