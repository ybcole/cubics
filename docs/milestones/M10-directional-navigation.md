# Directional tab navigation

Source implementation: 2026-11-21. Tracks M10.01–M10.03, M10.06, M10.08 and M12.06. This feature does not close either milestone or certify native desktop performance.

## Behavior

- WASD / arrow keys work with canvas/body focus; one move per physical press. Website input, editable fields, sidebar controls, dialogs, IME, modifier shortcuts, held-key repeats and active pan/widget drag remain protected.
- The initial reference is the viewport center in world coordinates, not the last-clicked tab.
- Every tab center in the requested half-plane is eligible, regardless of distance or lateral offset. Ranking uses `distance + 2*lateral + lateral²/distance`, favoring near and aligned destinations continuously. Stable tab IDs break exact ties. No candidate means no camera or selection change.
- Keep zoom, center the destination exactly, and raise its existing widget. Navigation changes no URL, browser history, page focus, sharing consent, remote-control grant or server state.
- Rapid presses choose from the pending destination, retargeting immediately from the current rendered camera position. Animations do not queue.
- Pan, wheel/pinch, zoom controls, focus loss, window resize, sidebar reflow, destination deletion/movement and room exit cancel the flight. Escape also stops it. An unpainted wheel zoom is canceled when a subsequent navigation wins.
- The normal transition is 180ms cubic ease-out; reduced motion centers immediately.

## Performance boundaries

Lookup is a single O(n) pass over existing geometry, with no sorting, DOM measurements, network, IPC or page-content inspection. A successful press measures the viewport once and changes z-order once. Each animation frame updates camera refs and the existing world transform, with no React state update, layout measurement or storage write. Persistence is scheduled after settling or interruption. Existing browser widgets retain their keys and remain mounted; an offscreen tab that has never been mounted still follows the existing lazy-load behavior.

Reproduce lookup microbenchmark: `node scripts/benchmark-directional-navigation.cjs` (100 warmups, 300 samples per size, Node VM-transpiled production selector). Development container, Node v24.22.3, initial sample:

| Placed tabs | Median lookup | p95 lookup |
| --- | --- | --- |
| 100 | 0.079ms | 0.116ms |
| 1,000 | 0.572ms | 0.925ms |
| 10,000 | 4.776ms | 5.790ms |

These measurements isolate geometry lookup. They do not measure Chromium guest composition, cold page loads, native input boundaries or macOS/Windows frame rate.

## Validation

- 13 new deterministic tests: direction mapping, screen-center origin, all half-planes, unlimited-distance diagonals, proximity/alignment tradeoffs, variable sizes, stable ties, invalid geometry, no candidates, pending-destination chaining/reversal, focus/IME/repeat/modifier guards, exact centering across zoom/viewport/world edges, frame scheduling, immediate retargeting, stale-frame rejection, cancellation, reduced motion, 100 rapid redirects and a 10,000-tab layout.
- Existing search, tab chrome and Personal navigation/recovery/vault regressions: combined 28 tests pass.
- Brand check, TypeScript and production Next.js build smoke pass. The build uses inert test-only Clerk placeholders via the existing smoke script.
- Real-account native macOS/Windows navigation, guest focus/scroll/input, playback continuity, reduced-motion and frame-time acceptance remain to be exercised on supported desktop hardware. No native acceptance or human sign-off is claimed.

Rollback: revert the feature commit; existing camera pan/zoom and browser storage remain unchanged.
