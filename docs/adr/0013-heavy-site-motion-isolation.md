# ADR-0013: Protect camera movement from uncached Personal guests

- Status: Implemented; three-OS native fixtures verified, device acceptance pending
- Decision version: 1.0.0
- Date: 2026-11-21
- Milestones: M05.04/M05.07/M10.02/M10.03/M11.04/M11.07/M21
- Supersedes: ADR-0012's fast-only activation, cached-only surface suppression and uncached live fallback. Its privacy, cache budgets and authority rules remain in force.
- Product owner: Project owner (explicit user instruction in chat; identity not independently verified). Authorized cached visuals for performance and requested resolution of website-dependent motion lag.
- Engineering/native/security reviewer: human sign-off pending; no milestone completion claimed.

## Context

The owner isolated lag to an open https://www.dlsud.edu.ph/schoolbook tab: removing it made pan, zoom and WASD responsive again. Public inspection found nested third-party content and a large raster image. Those observations do not establish which resource causes a native stall.

The source has a definite coverage gap: native surfaces are suppressed only when a decoded preview is cached. The cache is intentionally bounded and captures may fail, so heavy, uncached and still-loading tabs can remain in the camera composition path. A speed threshold also admits initial slow frames before suppression. `visibility:hidden` retains layout participation of the embedded element.

The first real Electron run on macOS and Linux also exposed a native API mismatch: NativeImage.toJPEG throws “Buffer is not available for the current Context” in the sandboxed page world. Source mocks/types did not catch it. This can prevent preview publication entirely. Use NativeImage.toDataURL (PNG string), decode base64 with browser atob/Uint8Array and create a local Blob instead; no Node access or privilege expansion. Bounded dimensions and cache byte limits still apply.

## Decision

Before wheel/zoom/navigation transforms, activate motion protection immediately. The camera's common apply path also activates protection for other camera changes. Held canvas panning retains protection until release; restore after 300ms quiet. This uses one imperative world attribute, with no per-frame React render or image capture.

Suppress **every mounted Personal guest** with `display:none !important` during motion, independently of whether its preview exists. The webview DOM node is retained, never reparented, navigated or replaced. Its fixed parent body retains geometry. Show its decoded cached image when available; otherwise show a brand-token surface with a small “Personal tab” placeholder. Address chrome remains visible. This deliberately trades moving guest visuals for camera responsiveness; the guest becomes interactive again after motion ends. Live/Shared streaming surfaces retain existing behavior.

Allow idle preview capture of DOM-ready guests even if subresources remain loading. A failed refresh retains a valid last-good image. Navigation, identity change and explicit invalidation still discard it immediately. No new native privileges, IPC, persistence or transmission are introduced. All ADR-0012 limits/cancellation rules remain.

## Alternatives and limitations

A domain-specific blocklist is rejected: the protection must work for any website. Additional synchronous capture at movement start is rejected because it puts native readback in the input path. Destroying/freezing/navigating guests changes continuity and is rejected. Moving to main-owned WebContentsView remains planned M06/M07 work, not part of this patch.

This removes embedded surfaces from the transformed layout during motion. It cannot guarantee zero latency under arbitrary CPU/GPU saturation, OS scheduling, malicious scripts or remote-stream rendering. A native synthetic fixture checks retention and records timing without claiming to reproduce Schoolbook's exact workload or hardware.

## Verification and rollback

Unit tests cover early activation, rapid redirection deadlines, held pans, capture during subresource loading, last-good retention, invalidation, cache budgets and cleanup. Native Electron CI uses production main/preload security and the exact production suppression selector, with a large-raster/nested-frame page. It checks real WebviewTag capturePage/NativeImage methods, uncached suppression, stable parent geometry, unchanged WebContents identity, JS memory, unsaved form, scroll and audio-context state across hide/restore. It logs only numeric RAF timing distributions for live, visibility-hidden and display-none modes. CI timing is descriptive, not a performance pass threshold or audio hardware measurement.

Evidence: [M10 heavy-site motion](../milestones/M10-heavy-site-motion.md). Device-specific Schoolbook acceptance and uninterrupted audible media still require native user testing; synthetic CI cannot certify those.

No migration. `NEXT_PUBLIC_CUBICS_MOTION_PREVIEWS=0` disables both motion substitution and captures at build time. Reverting restores the previous presentation policy; no stored images need cleanup.
