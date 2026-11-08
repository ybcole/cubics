# One-way migration map to final Cubics

**Version:** 1.0.0 · **Milestones:** M00.05, M02, M06, M07, M13, M23. The current app stays functional while the target system is built behind adapters and flags.

## Ordered migration path

| Stage | Prerequisites | Implementation transition | Temporary compatibility | Exit / rollback |
| --- | --- | --- | --- | --- |
| A — Baseline/governance | M00/M01 | Product/permission contracts, ADRs, inventory, hardening tests | Current app remains unchanged | Source-level and threat-model sign-off |
| B — Hosted trust boundary | M02–M04 | Separate hosted privileged API; make Clerk identity authoritative for sockets/API; harden IPC/Electron; stop bundling server secrets | Versioned API client, isolated dev mode, temporary server route proxies | Signed staging artifact scan, denied-access E2E; revert API feature flag |
| C — Native browser ownership | M05–M06 | Profile IDs and BrowserSessionManager; native resource exists independently of React | Renderer `<webview>` kept behind browser adapter | Offscreen/route-switch continuity tests; rollback without destroying profiles |
| D — WebContentsView compositor | M07–M09 + M10–M11 | Native views with camera geometry, clipping/z-index/focus, capture, background budget | Feature flag for old webview, per-mode rollout | Full parity/benchmark and clear fallback until ready |
| E — Versioned data + local sync | M13–M15 | Extend schema, operation IDs/revisions, snapshots, local SQLite, reconnect | Dual-read / server translation when needed; migration checkpoints | Replay after partition and rollback drill; no orphan/duplicate writes |
| F — Collaborative media/control | M16–M18 | Persist chat/notifications; host/controller leases and LiveKit media policy | Protocol version negotiation and staged cohort rollout | Two-device revocation, host loss, simultaneous control and audio E2E |
| G — Production + freeze | M19–M24 | Monitoring, reference benchmarks, signed updater, migration cleanup, documentation | Temporary flags retired after cohorts proven | GA runbook and global release gates G1–G10 |

## Preserve data and browsing context

- Never identify a tab by its URL or title; migrate old widget ID to a stable tab ID with an explicit mapping.
- Preserve per-account Chromium partitions and OS protected secrets locally. Do **not** export personal cookies or authenticated webpages to PostgreSQL to ease migration.
- Store current native navigated URL separately from initial widget URL; user-visible fallback states must be honest after app restart.
- Keep old data migrations forward-only by default with full backup and a tested rollback/recovery procedure (schema changes may not be mechanically reversible).
- Stop host/media capture and revoke leases before destroying any associated tab resources.
- On reconnect or rollout reversal, use operation IDs and revisions to avoid duplicate creation, deletes or moves.

## Gates before deleting legacy code

- New implementation has parity on both target OS platforms.
- All browser mode/privacy, pointer/focus, multi-user/reconnect, and media capture tests pass.
- No unresolved queued operations, unknown schema state, or cross-user session leakage.
- Release rollback has been exercised; users can recover their previously saved workspaces.
- Architecture review approves removing old renderer-owned webviews, temporary API proxy, or duplicate socket handlers.

## Non-goal

No attempt to magically move an arbitrary already-running authenticated Chromium tab into a new process or a different device with its exact RAM/JS/DRM state. Migration should preserve profile data and recoverable metadata; it must state unavoidable limits.
