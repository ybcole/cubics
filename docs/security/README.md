# Cubics security — M01 baseline

> **Status: IN PROGRESS.** Product owner has pre-approved the roadmap, but critical security findings remain open. Do not mark M01 [COMPLETED] until required integration tests and scan gates are complete.

| Document | Purpose |
| --- | --- |
| [Threat model](THREAT_MODEL.md) | Trust boundaries, attack scenarios, severity, mitigation owner, negative-test IDs |
| [Runtime inventory](runtime-inventory.json) | Machine-readable API/Socket/IPC permission surface |
| [Permissions](PERMISSIONS.md) | Least-privilege owner/admin/member/browser-host/controller/viewer matrix |
| [Controls](CONTROLS.md) | URL/SSRF, redaction, rate, validation, CORS/CSRF, secrets and release policy |
| [Vulnerability reporting](SECURITY_POLICY.md) | Private disclosure, severity, containment, review |
| [Milestone evidence](../milestones/M01.md) | Actual tests, risk debt and completion status |

## Executable checks

```bash
npm run security:check
npm run security:test
```

GitHub Actions workflow `.github/workflows/security-baseline.yml` installs dependencies, runs inventory and secret guards, runs room-isolation integration tests, produces CycloneDX SBOM and license inventory, and records `npm audit` results. [Latest CI run 42450788759](https://github.com/ybcole/cubics/actions/runs/42450788759) succeeded with 7/7 security tests (including retired SSRF probe), SBOM and license artifacts. The historical baseline dependency install reported **31 issues across the installed tree**. The latest audited production tree has **zero high/critical findings**, and the audit is now a hard CI step. Current runtime issues remain open. Existing tests are not evidence of valid Clerk auth or database authorization.

## Unresolved criticals at baseline

- D01/T08 privileged `.env` packaged with desktop; M02.
- D02/T01 signed Clerk JWT and PostgreSQL membership checks implemented in M01; **remaining** action-specific roles, revocation/failover and deployment qualification in M03/M15.
- D03/T04 Electron sandbox disabled, permissive capture/header handling; M04.
- T06 `/api/embeddable` arbitrary server fetch was **retired (HTTP 410)** in M01; do not reintroduce without safe egress controls.
- T05/T09 media consent and role scope; M04/M18.
- T16 personal vs shared profile isolation E2E; M05/M21.

A successful baseline source scan does **not** mean these risks are fixed. GA remains blocked until all critical risks are mitigated and verified.

## Realtime identity (M01 security improvement)

`socket-server.cjs` now verifies a signed Clerk JWT in the Socket.IO handshake (signature, issuer, authorized frontend party, expiry, session ID). It queries PostgreSQL to authorize each `room:join` and rechecks membership on incoming room operations. `auth:refresh` renews short-lived tokens **without disconnecting the browser host**. Browser-side connections pass `useAuth().getToken()` rather than a claimed user ID.

Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `DATABASE_URL` in `.env.local`; the realtime server loads it using `@next/env`. Configure `CUBICS_SOCKET_ALLOWED_ORIGINS` with exact authorized frontend origins when not using the localhost:3000 default. `CLERK_JWT_KEY` (PEM) can be supplied for networkless verification; otherwise verified issuer JWKS is retrieved over HTTPS and cached. Failed auth or missing DB access **deny room entry**; do not add an anonymous fallback.

**Remaining work:** eventual hosted-only DB access (M02), per-widget ownership and role matrix (M03/M17), capture permissions (M04/M18), control leases (M17), cross-instance revocation and persistence (M15/M19), and supported-build security audit. An approved room member remains able to send some legacy widget/control events pending those milestones.

## Evidence-based M01 progress

The M01 realtime-auth changes pass [11/11 security tests and the Prisma-generated TypeScript typecheck](https://github.com/ybcole/cubics/actions/runs/42451812625). Cross-room access, forged `userId` and foreign-origin Socket.IO attempts are rejected in the test harness. **The harness uses deterministic injected membership fixtures**; a real Clerk + PostgreSQL staging deployment remains an explicit M03 security test.

The baseline had 31 findings across all installed packages. After the [Next 16 / Clerk 6 upgrade](https://github.com/ybcole/cubics/commit/6717c38cf2cbc1a92bc7d2f1a3d7e65db68bd7dc), the **production npm audit reports zero high/critical vulnerabilities** and [audit failures now block the security CI job](../../.github/workflows/security-baseline.yml). Connected GitHub access still cannot read/configure required `main` branch checks (HTTP 403). That outstanding repository administration gate prevents M01 `[COMPLETED]`.

**Free-first architecture:** ADR-0008 chooses Vercel + Supabase private Realtime/Postgres + Clerk + LiveKit. Existing Supabase workspace data remains untouched. A proposed RLS SQL file is **unapplied** pending isolated staging and negative auth tests; client Broadcast cannot become a database-authoritative mutation.
