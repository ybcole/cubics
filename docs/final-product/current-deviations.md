# Current `main` → final architecture: deviation inventory

**Recorded:** 2026-11-08 · **Baseline:** main at `b25623abe25867656d9719053ab4bb737f6c7268`. **Status:** technical source audit of obvious gaps, not a penetration test, benchmark or assertion of exploitable vulnerability.

| ID | Current implementation evidence | Difference from target | Severity to investigate | Milestone that resolves |
| --- | --- | --- | --- | --- |
| D01 | M02 packaged Electron loads a pinned hosted HTTPS origin and no longer spawns local Next; CI extracts shell-only `app.asar` and rejects backend files | Deploy real HTTPS API/Socket service and managed secrets, verify cross-account staging, rollback, and signed production release | Source/unsigned Linux artifact mitigated; live deployment release gate OPEN | M02, M19, M22 |
| D02 | M01 verified Clerk JWT/Origins; M02 migrated Socket.IO membership to hosted API; M03 added owner/admin/member widget/room authorization and passive revocation heartbeat | Cross-instance authorization, invitations, LiveKit publishing grants, fenced remote-control leases and production E2E remain | Partially mitigated; release blocker for full action-specific/media policy | M03, M15, M17 |
| D03 | M04 enabled Chromium sandbox, isolated preload, deny-by-default native permissions and validated popup/navigation IPC; removed broad response-header stripping | Native account-bound guest partitions, nonce CSP, complete hostile-site macOS/Windows tests and signed updates still need proof | Partially mitigated; M04 exit gates OPEN | M04, M05, M21, M22 |
| D04 | `src/components/PersonalTabView.tsx` owns the React `<webview>` element; recent sticky visibility fix avoids offscreen unmount but React/route lifecycle still owns native process | Main-process BrowserSessionManager must own tab lifetimes | Core continuity gap | M06–M09 |
| D05 | `src/components/StreamedTabView.tsx` hosts guest webviews inside React mode branches | Host browser lifecycle can change when component/host state changes | Core continuity/collaboration gap | M06–M08, M17 |
| D06 | `src/app/spaces/[id]/page.tsx` combines camera, widgets, realtime socket, chat, media UI and persistence in one page | Separate canvas engine, domain client and operation transport | Architecture/performance | M10–M12, M15 |
| D07 | `prisma/schema.prisma` has `User`, `Room`, `RoomMember`, `Widget` but no ordered operation/snapshot, tab host/control lease or local cache model | Canonical revisioned data, migrations and local-first cache are absent | Recovery/collaboration | M13–M14, M17 |
| D08 | `socket-server.cjs` retains chat history and many coordination maps in memory | Persistent chat, reconnect log and cross-instance coordination needed | Data reliability | M15–M16, M19 |
| D09 | `src/lib/live/budget.ts` has static MAX_LIVE=6 / MAX_LOW=24 tiers; actual profile/device performance not benchmark-certified | Background policy should be measured, dynamic and audio-safe | Scale/UX | M09, M18, M21 |
| D10 | `README.md` names macOS builds and `electron-builder.yml` also defines Windows/Linux targets | Certified support matrices, signed installers, updater/rollback missing as evidence | Release quality | M21–M22 |
| D11 | `src/lib/spaceAccess.ts` checks membership for several API routes but socket path has no matching centralized auth evidence | Single server-side permission contract needed across protocols | Security consistency | M03, M15 |
| D12 | Current browser widgets are based on Electron `<webview>` tags; no tested native surface compositor for camera/z-order | Prove and migrate to main-managed WebContentsView adapter after parity | Technical risk | M07, M11 |
| D13 | `src/app/spaces/[id]/page.tsx` saves camera data in browser localStorage; no tested per-account SQLite offline operation journal | Local-first cache and queue/reconciliation needed | Offline/recovery | M10, M14 |
| D14 | M01 now has security CI, production audit gate and Next build smoke; full Electron UI/stream E2E, signed update and required branch protection remain unverified | Test gates, observability, signed releases and rollback must be completed | Release blocker | M20–M23 |
| D15 | `README.md` describes app as production-capable embedding any site, but website-specific DRM/SSO/capture behavior is not qualified | Define compatibility matrix and honest browser restrictions | User trust | M07–M08, M21 |
| D16 | `docs/BRAND.md` contains UI guidance; final cross-domain accessibility and design approval not evidenced | Accessibility conformance requires real device/user audit | Usability quality | M12, M21 |

## Important distinctions

- These are **gaps to investigate and fix**, not proof that the product has been hacked, is unusable, or fails every use case.
- No source-only observation is a substitute for real Chrome/Electron profile performance and permissions testing.
- The offscreen keep-alive commit is a **correct immediate fix**, but it is not yet a native session lifecycle manager.
- Mark a deviation closed only with an implementation link **and** test evidence; never automatically mark these closed when an ADR is accepted.
- Update this inventory at each milestone closeout; add newly discovered deviations with impact and owner instead of hiding them.
