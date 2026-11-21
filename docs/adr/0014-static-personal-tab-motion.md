# ADR-0014: Retain static Personal-tab snapshots across movement

- Status: Implemented in source; native snapshot-overlay checks pending
- Decision version: 1.0.0
- Date: 2026-11-21
- Milestones: M10.02/M10.03/M11.04/M11.07/M05.04
- Supersedes: ADR-0012's eight-image cache limit and the legacy Personal widget-drag placeholder. ADR-0013's native guest suppression, security scope, revocation and rollback remain in force.
- Product owner: Project owner (explicit user instruction in chat; identity not independently verified). Requested static tab snapshots during dragging/panning/WASD, then running visuals after drop, instead of grey Personal-tab placeholders.
- Human engineering/security acceptance: pending. No milestone completion claimed.

## Decision

Use the same predecoded local tab snapshot during camera movement and Personal-tab drag/resize. During a widget drag, hide only that widget's guest and reveal its snapshot; restore live visuals on drop. Camera motion retains the existing 300ms quiet restoration policy. Healthy guests keep running and remain mounted. No new screenshots are initiated or encoded by input handlers; background work is held during widget drag/resize as it is during panning.

Keep up to 128 snapshots rather than eight, bounded by 32MiB encoded PNG bytes and eight million decoded pixels (approximately 32MB RGBA before browser/GPU overhead). A capture's maximum pixels are the total pixel budget divided by registered ready-tab count, capped at 960×720. As more tabs register, subsequent snapshots use lower resolution instead of routinely evicting all but eight tabs. Missing snapshots receive priority over refreshes. Captures remain serial, visible-only, idle-prepared and idle-published. Older offscreen snapshots remain cached until ordinary eviction or security invalidation.

No cache is unbounded and no screenshot is persisted, transmitted or attached to shared widget data. Navigation, account/profile changes and removal still immediately invalidate pixels. New/not-yet-loaded tabs and failed or denied captures cannot have a valid screenshot yet; those retain a temporary fallback. Capturing synchronously on pointer-down to eliminate that case is rejected because it can stall the input path.

## Validation and rollback

Unit regressions cover forty retained snapshots under the new budget, adaptive resize, missing-first capture priority and shared drag/camera presentation. The native fixture now creates an actual production snapshot, displays it during camera and widget motion, checks that no grey fallback covers it, restores live display on drop, and retains its existing guest/form/scroll/audio-context continuity assertions. Results are recorded in the implementation PR.

The previous native timing samples establish why live guest visuals are suppressed; they do not establish that every image workload costs exactly as little as a flat placeholder. Static images still consume texture memory and compositing bandwidth, with these budgets bounding that cost. Source tests do not certify the owner's native workload.

No migration. Revert this patch to restore the smaller cache and legacy drag presentation. NEXT_PUBLIC_CUBICS_MOTION_PREVIEWS=0 continues to disable camera substitution/capture; no private persisted pixels require cleanup.
