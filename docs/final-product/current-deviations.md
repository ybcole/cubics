# Current `main` → final architecture: deviation inventory

**Recorded:** 2026-11-08 · **Baseline:** main at `b25623abe25867656d9719053ab4bb737f6c7268`. **Status:** technical source audit of obvious gaps, not a penetration test, benchmark or assertion of exploitable vulnerability.

| ID | Current implementation evidence | Difference from target | Severity to investigate | Milestone that resolves |
| --- | --- | --- | --- | --- |
| D01 | `scripts/prepare-standalone.js` copies `.env`; `README.md` explicitly warns shipped secrets; `electron/main.js` starts bundled Next server | Cloud keys/server-only DB authority must leave desktop artifact | Release blocker | M02, M19, M22 |
| D02 | M01 replaced wildcard CORS with exact Origin validation, added verified Clerk JWT session identity and PostgreSQL membership authorization to `socket-server.cjs` | Fine-grained per-widget/host/control roles, multi-instance authorization, failure/revocation tests and deployment hardening remain | Partially mitigated; release blocker for action-specific policy | M03, M15, M17 |
| D03 | `electron/main.js` has `sandbox: false` and permissive webRequest header modifications | Sandbox, permission, network, URL/IPC policies must be hardened | Release blocker | M01, M04 |
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
| D14 | No proven release-wide CI/security/Electron E2E and signed update pipeline in the inspected tree | Test gates, observability, signed release and rollback must exist | Release blocker | M20–M23 |
| D15 | `README.md` describes app as production-capable embedding any site, but website-specific DRM/SSO/capture behavior is not qualified | Define compatibility matrix and honest browser restrictions | User trust | M07–M08, M21 |
| D16 | `docs/BRAND.md` contains UI guidance; final cross-domain accessibility and design approval not evidenced | Accessibility conformance requires real device/user audit | Usability quality | M12, M21 |

## Important distinctions

- These are **gaps to investigate and fix**, not proof that the product has been hacked, is unusable, or fails every use case.
- No source-only observation is a substitute for real Chrome/Electron profile performance and permissions testing.
- The offscreen keep-alive commit is a **correct immediate fix**, but it is not yet a native session lifecycle manager.
- Mark a deviation closed only with an implementation link **and** test evidence; never automatically mark these closed when an ADR is accepted.
- Update this inventory at each milestone closeout; add newly discovered deviations with impact and owner instead of hiding them.
