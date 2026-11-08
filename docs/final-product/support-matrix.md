# Platform and dependency support matrix

**Version:** 1.0.0 · **Milestone:** M00.02, M00.06 · **Decision:** GA targets fixed; exact minimum tested builds/versions set after M21/M22 qualification.

| Platform | GA status | Required qualification | Out-of-scope / caveat |
| --- | --- | --- | --- |
| macOS Apple Silicon | In scope | Signed + notarized installer, updates, native media, accessibility, recovery, high DPI | Minimum supported macOS must be certified |
| macOS Intel | In scope | Same as Apple Silicon, on real Intel hardware | Don't assume universal arm64 binaries work on Intel |
| Windows 11 x64 | In scope | Signed installer, updates, permission prompts, GPU/IME, multi-monitor, recovery | Exact supported Windows builds must be certified |
| Linux | Not GA | Community/experimental builds only | Existing AppImage target does not confer support |
| Browser-only UI | Development/limited | Fallback and authenticated workspace navigation | Arbitrary third-party webpage embedding requires desktop |
| iOS/Android | Not GA | No native app promise | No mobile-specific scope |

### Baseline dependency inventory from current main

| Layer | Present baseline | Target policy / qualification owner |
| --- | --- | --- |
| Electron | `^45.0.0` in package.json (inspect installed lockfile at build time) | Supported maintained release, security checked; M04/M22 |
| Next.js | `14.2.5` | Upgrade to maintained supported release, server/client separation; M02/M21 |
| React | `^18.3.1` | Compatibility-tested frontend; M12/M21 |
| TypeScript | `^5.5.4` | Strict typed IPC/events/build tests; M02/M21 |
| Clerk | `^5.0.0` | Compatible supported SDK, secure desktop authentication; M03 |
| Prisma + PostgreSQL | `^5.10.0`, cloud DB | Supported migrations, backups and transactions; M13/M19 |
| Socket.IO | `^4.8.3` server, `^4.8.3` client | Authenticated room sync with multi-node coordination when needed; M15/M19 |
| LiveKit client/server SDK | `^2.23.0` / `^2.19.0` | LiveKit production compatibility and token policy; M18 |
| Local SQLite | Not in current stack | Select supported native library and OS secure storage; M14 |
| Auto-updater/Crash reporting | Not proven integrated | Signed, staged, tested updater and redacted diagnostics; M20/M22 |

The version above is a **source declaration**, not a claim that the current lockfile/build is patched or compatible. Before each release, record the exact installed/resolved versions, OS patch builds, GPU details, dependency EOL notices, code-signing entitlements, Node runtime and Chromium/Electron combinations. No version is supported merely because it appears in package.json.

### Continuous support policy

- One canonical support table lives here; upgrades to Electron, browser engine, Next, Auth, Prisma and media libraries must pass security and compatibility test matrices.
- Security patches and supported OS updates remain permissible after architecture lock; preserve stable domain and IPC protocols.
- Cross-platform E2E on real hardware (not CI emulation alone) is necessary for native drag, streaming, consent, popups and crash recovery.
- If a platform falls out of vendor support, document deprecation, user migration and end date instead of silently failing.
- **Open GA approvals:** minimum macOS OS version, hardware floors, maximum supported workspace scale, installer/update infrastructure, and contractual SLOs are decided with M21/M22 evidence, not ungrounded estimates.
