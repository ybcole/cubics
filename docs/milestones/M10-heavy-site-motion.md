# Website-dependent camera lag

2026-11-21 · M10.02/M10.03/M11.04/M11.07 · [ADR-0013](../adr/0013-heavy-site-motion-isolation.md) · follow-up to [rapid-gesture previews](M10-fast-motion-previews.md).

User reproduction: Schoolbook open causes lag during pan/zoom/WASD; removing the tab removes it. No exact owner's native GPU trace is available.

The implementation closes cached-only protection gaps. Every Personal guest is suppressed before motion transforms, with a local cached image or neutral placeholder. The native guest remains mounted. Previews can prepare after DOM readiness while subresources load; transient refresh errors retain the last good preview. Real Electron testing additionally found sandbox-incompatible NativeImage.toJPEG Buffer creation. The production path now uses a PNG data URL and browser byte decoding. No domain blacklist or third-party script injection is involved.

## Validation

- 69 targeted source regressions pass. Brand, TypeScript, plan consistency and production build smoke pass.
- 15 additional Electron hardening/policy source regressions pass (84 targeted tests total).
- [Native Electron run 44911431040](https://github.com/ybcole/cubics/actions/runs/44911431040), source `b22d7aa6c0f1fad6a81c2613cc8d6d94c20c3497`: macOS, Windows and Linux pass. The fixture executes the actual production preview preparer in the sandbox, decodes its Blob image and revokes it. It verifies uncached surface suppression, retained parent geometry, unchanged WebContents/JS identity, unsaved form, scroll and audio-context state through repeated hide/restore. Existing hostile guest/account isolation and browser-profile restart suites also pass.
- Final production code `48ff0297de7c89d649b4091f3ec509fe9862907a` also passes the complete three-OS suite in [run 44911568419](https://github.com/ybcole/cubics/actions/runs/44911568419), after replacing per-byte callbacks with a bounded decoding loop.
- The first native run caught the sandbox Buffer failure before merge. No Node privileges were added to resolve it.
- Other existing CI workflows fail at npm dependency installation because lucide-react 0.326 expects React <=18 while the repository uses React 19. Native CI uses the existing legacy-peer-deps installation policy; this patch does not modify dependency resolution. Local build smoke passes.

Descriptive RAF samples from that synthetic test (milliseconds; 39 intervals per mode, no performance pass threshold):

| Runner | Live median / p95 | Visibility-hidden median / p95 | Protected median / p95 |
| --- | --- | --- | --- |
| macOS arm64 | 33.4 / 83.8 | 16.6 / 18.8 | 16.6 / 24.7 |
| Windows | 31.3 / 31.3 | 15.6 / 15.7 | 15.6 / 15.7 |
| Linux / Xvfb | 33.4 / 66.7 | 16.7 / 16.8 | 16.7 / 16.8 |

These short CI samples support removing live guest surfaces from the motion path; they do not demonstrate a universal display-none advantage over visibility-hidden, hardware input-to-present latency, uninterrupted audible playback, or Schoolbook-specific frame rates.
- Schoolbook on the owner's device: pending acceptance. No universal zero-lag guarantee or milestone completion claimed.

No schema, backend or browser privilege changes. Product-owner performance presentation approval remains recorded in ADR-0012; independent human review is pending. Build flag rollback and tradeoffs are specified in ADR-0013.
