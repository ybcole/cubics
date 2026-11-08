# Accessibility and interaction standard

**Version:** 1.0.0 · **Milestone:** M00.06, implemented and audited in M10–M12/M21.

## Target

Design and verify the Cubics interface against **WCAG 2.2 AA where applicable to desktop software**, supplemented with native macOS Accessibility and Windows UI Automation checks. Treat these as acceptance goals, not a claim of current conformance. A browser webpage's third-party accessibility remains its publisher's responsibility, but Cubics must not prevent native assistive use.

### Interaction contracts

- All actions can be reached and used without a pointing device. Standard `Tab` / `Shift+Tab` focus must never be hijacked by a custom "new tab" shortcut.
- Visible focus indication, consistent keyboard order, escape/close behavior and restoration to invoking controls for dialogs/popovers. No focus can remain inside an inert or visually hidden sidebar.
- Canvas supports keyboard pan/zoom and navigation to a tab without forcing users to drag, with clear semantics for active focus vs browser input mode.
- Icon-only buttons have accessible names and adequate targets; tooltips cannot be the only way to discover destructive behavior.
- Modal dialogs announce title, content, error, and recovery action; screen-reader labels for remote host/controller status and loading.
- Live media and shared remote control must show persistent, perceivable, revocable indications that are not dependent on color alone.
- Respect `prefers-reduced-motion`; animations are not required for understanding and screen-captured content is not distorted.
- Provide readable contrast with browser chrome, menus, status indicators and captions; choose fonts and line heights that remain clear under text scaling.
- Keyboard accessibility for sidebar hidden state (edge dwell is not the only way to restore it); do not rely only on hover/time-based input.
- Support OS-level zoom, high DPI, touchpad, IME/multilingual typing and accessible drag/resize alternatives.
- Do not trap focus in inactive native browser surfaces; reflect real focus owner across DOM/native view boundaries.

### Media and cognitive accessibility

- Spoken/audio alerts must be optional and governed by system mute and app preferences; do not autoplay disruptive sounds.
- Provide status text for paused/unavailable stream and host disconnected, not a frozen unexplained image.
- Avoid flicker, flashing, auto-reset/re-centering of the canvas, or forced attention changes during collaboration.
- Preserve user-entered data during navigation errors; provide explicit retry/undo for operations that can lose changes.

### Test and review requirements

| Test | Evidence | Milestone |
| --- | --- | --- |
| Keyboard-only first-run, tab creation, pan/zoom, room join, hidden rail | Recorded scenario, failures and remediation | M12/M21 |
| Screen-reader flows with macOS VoiceOver and Windows Narrator | Tested device/version, screenshots and notes | M21 |
| 200% text scaling / high-DPI and multi-monitor focus correctness | Visual and interaction test run | M11/M21 |
| Reduced-motion and readable contrast audit | Automated + manual inspection | M12/M21 |
| Full modal/popover focus lifecycle, including external browser surface | E2E trace and regression tests | M12/M21 |
| Captions/stream error states and audio controls | Media UX acceptance scenario | M18/M21 |

Any meaningful accessibility blocker in a core GA journey is release-blocking. Exceptions require an ADR with user impact, mitigation, and timed remediation; exceptions cannot silently lower the promised GA baseline.
