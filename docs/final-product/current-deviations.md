# Current `main` → final architecture: deviation inventory

**Updated:** 2026-11-21 · **Audited baseline:** main at `eb2c983`; [implementation/evidence audit](../milestones/STATUS_2026-11-21.md). **Status:** technical source audit of obvious gaps, not a penetration test, benchmark or assertion of exploitable vulnerability.

| ID | Current implementation evidence | Difference from target | Severity to investigate | Milestone that resolves |
| --- | --- | --- | --- | --- |
| D01 | M02 packaged Electron loads a pinned hosted HTTPS origin and no longer spawns local Next; CI extracts shell-only `app.asar` and rejects backend files | Deploy real HTTPS API/Socket service and managed secrets, verify cross-account staging, rollback, and signed production release | Source/unsigned Linux artifact mitigated; live deployment release gate OPEN | M02, M19, M22 |
| D02 | M01 verified Clerk JWT/Origins; M02 migrated Socket.IO membership to hosted API; M03 added owner/admin/member widget/room authorization and passive revocation heartbeat | Cross-instance authorization, invitations, deployed media revocation/retry, fenced remote-control leases and production E2E remain | Partially mitigated; release blocker for full action-specific/media policy | M03, M15, M17 |
| D03 | M04 enabled sandbox/isolated preload, denied native permissions by default, and now gates guest partition issuance on server-verified Clerk identity | Real packaged Clerk-cookie verification, native account-switch and OS permission tests, CSP nonce and signed-update provenance still need proof | Account partition source fix merged; M04 exit gates OPEN | M04, M05, M21, M22 |
| D04 | `src/components/PersonalTabView.tsx` owns the React `<webview>` element; recent sticky visibility fix avoids offscreen unmount but React/route lifecycle still owns native process | Main-process BrowserSessionManager must own tab lifetimes | Core continuity gap | M06–M09 |
| D05 | `src/components/StreamedTabView.tsx` hosts guest webviews inside React mode branches | Host browser lifecycle can change when component/host state changes | Core continuity/collaboration gap | M06–M08, M17 |
| D06 | `src/app/spaces/[id]/page.tsx` combines camera, widgets, realtime socket, chat, media UI and persistence in one page | Separate canvas engine, domain client and operation transport | Architecture/performance | M10–M12, M15 |
| D07 | `prisma/schema.prisma` has `User`, `Room`, `RoomMember`, `Widget` but no ordered operation/snapshot, tab host/control lease or local cache model | Canonical revisioned data, migrations and local-first cache are absent | Recovery/collaboration | M13–M14, M17 |
| D08 | `socket-server.cjs` retains chat history and many coordination maps in memory | Persistent chat, reconnect log and cross-instance coordination needed | Data reliability | M15–M16, M19 |
| D09 | `src/lib/live/budget.ts` has static MAX_LIVE=6 / MAX_LOW=24 tiers; actual profile/device performance not benchmark-certified | Background policy should be measured, dynamic and audio-safe | Scale/UX | M09, M18, M21 |
| D10 | `electron-builder.yml` defines macOS/Windows/Linux targets; macOS signing identity is null and hardenedRuntime is false; root README was deleted in main | Certified support matrices, signed installers, updater/rollback missing as evidence | Release quality | M21–M22 |
| D11 | `src/lib/spaceAccess.ts`, the room-policy matrix and private realtime membership API now enforce identity/room/widget roles; LiveKit grants have separate viewing/publishing checks | Full real-account cross-protocol parity, invitations and fenced control leases remain unverified | Partial implementation; acceptance/security consistency open | M03, M15 |
| D12 | Current browser widgets are based on Electron `<webview>` tags; no tested native surface compositor for camera/z-order | Prove and migrate to main-managed WebContentsView adapter after parity | Technical risk | M07, M11 |
| D13 | `src/app/spaces/[id]/page.tsx` saves camera data in browser localStorage; no tested per-account SQLite offline operation journal | Local-first cache and queue/reconciliation needed | Offline/recovery | M10, M14 |
| D14 | Native/realtime three-OS fixture matrices pass, but general security/artifact/UI CI is currently failing; full UI/stream E2E, signed updates and branch-protection gates remain unverified | Test gates, observability, signed releases and rollback must be completed | Release blocker | M20–M23 |
| D15 | The root README is absent. Native login popup fixtures pass and the user reports tried-site sign-in success; a maintained DRM/SSO/capture compatibility matrix is still absent | Define compatibility matrix and honest browser restrictions | User trust | M07–M08, M21 |
| D16 | `docs/BRAND.md` contains UI guidance; final cross-domain accessibility and design approval not evidenced | Accessibility conformance requires real device/user audit | Usability quality | M12, M21 |

## Important distinctions

- These are **gaps to investigate and fix**, not proof that the product has been hacked, is unusable, or fails every use case.
- No source-only observation is a substitute for real Chrome/Electron profile performance and permissions testing.
- The offscreen keep-alive commit is a **correct immediate fix**, but it is not yet a native session lifecycle manager.
- Mark a deviation closed only with an implementation link **and** test evidence; never automatically mark these closed when an ADR is accepted.
- Update this inventory at each milestone closeout; add newly discovered deviations with impact and owner instead of hiding them.

| D17 | Legacy `/api/spaces/[id]/widgets` and Socket.IO previously sent Personal widget URL/title to non-owners; M05 now redacts per-viewer HTTP responses and sends metadata-free socket hints | New Personal destinations use OS-encrypted storage and owner-consented recovery/scrub hooks exist; historical PostgreSQL/backups, older-client reconciliation and full Live/Shared consent E2E remain | High priority; source mitigation, staging test outstanding | M05, M13, M15 |

## Current acceptance and pipeline blockers — 2026-11-21

| ID | Current evidence | Remaining gap | Milestones |
| --- | --- | --- | --- |
| D18 | User still reported room-switch membership failure and no new terminal diagnostic; PR #14 adds worker watch/restart guidance and safe cause/status fields | Confirm full restart and successful room switch on the real running endpoint; fixture matrices alone do not resolve this incident | M03, M15, M20, M21 |
| D19 | Latest general security/artifact/UI jobs fail during dependency installation; local security suite is 117/118 with the existing Safari toolbar expectation failure | Resolve the React/lucide peer dependency conflict and reconcile the toolbar regression with the accepted UI; restore required green gates | M01, M12, M21, M22 |
