# Website-dependent camera lag

2026-11-21 · M10.02/M10.03/M11.04/M11.07 · [ADR-0013](../adr/0013-heavy-site-motion-isolation.md) · follow-up to [rapid-gesture previews](M10-fast-motion-previews.md).

User reproduction: Schoolbook open causes lag during pan/zoom/WASD; removing the tab removes it. No exact owner's native GPU trace is available.

The implementation closes cached-only protection gaps. Every Personal guest is suppressed before motion transforms, with a local cached image or neutral placeholder. The native guest remains mounted. Previews can prepare after DOM readiness while subresources load; transient refresh errors retain the last good preview. Real Electron testing additionally found sandbox-incompatible NativeImage.toJPEG Buffer creation. The production path now uses a PNG data URL and browser byte decoding. No domain blacklist or third-party script injection is involved.

## Validation

- 69 targeted source regressions pass. Brand, TypeScript, plan consistency and production build smoke pass.
- Native Electron three-OS CI: pending. The new synthetic heavy-page fixture checks actual capture APIs and preserved guest/form/scroll/audio-context state, plus numeric timing samples. First run caught the sandbox Buffer failure before merge. It does not claim native device performance or audio playback acceptance.
- Schoolbook on the owner's device: pending acceptance. No universal zero-lag guarantee or milestone completion claimed.

No schema, backend or browser privilege changes. Product-owner performance presentation approval remains recorded in ADR-0012; independent human review is pending. Build flag rollback and tradeoffs are specified in ADR-0013.
