# ADR-0006 — Packaged desktop loads pinned hosted HTTPS UI

**Date:** 2026-11-08 · **Status:** implemented in source, staging verification pending · **Milestones:** M02, M03, M04, M13, M22.

## Decision

The packaged Electron runtime owns a thin native browser/OS bridge and loads one **build-time pinned, externally hosted HTTPS Cubics origin**. The desktop package contains no local Next server, Prisma client, database URL, Clerk secret key, or LiveKit signing key. The hosted Next app remains the single web UI and authenticated API service until package-boundary extraction, while Socket.IO is a separate hosted process that verifies Clerk session identity and checks membership through a private service-authenticated HTTPS endpoint. Local development still runs Next and Socket.IO on loopback.

To keep permissions reviewable, the desktop build creates an allowlisted `.desktop-staging` directory with only three Electron source files, a public origin config, and an empty-dependency package manifest. CI produces an actual unpacked Linux Electron build, extracts `app.asar`, and scans it. No cloud private key belongs in an installable resource.

## Why this route

The former packaged Next standalone server required server-side PostgreSQL/Clerk/LiveKit authority on end-user machines, an unfixable trust-boundary violation. Hosting the existing Next UI eliminates that authority without prematurely rewriting canvas/browser widgets or sacrificing local developer tooling.

## Tradeoffs and risks

- Installed desktop now requires a reachable HTTPS host to load the shell UI. M13–M15 will add offline state, local caching and durable replay.
- A compromised hosted web origin could affect the native renderer; M04 must harden sandbox/IPC sender validation, CSP, permissions and navigation. Merely pinning the origin is insufficient.
- Clerk/OAuth requires the real cloud domain and the correct session authorized party; production two-user E2E is still M03.
- `NEXT_PUBLIC_SOCKET_URL` must be an HTTPS/WSS public service, and `CUBICS_SOCKET_ALLOWED_ORIGINS` must match the hosted origin.
- Signed/notarized installers and real staging deployment remain M02.E1/M02.E2 and M22; successful CI against a placeholder staging URL does not prove production reachability.
- Any attempt to reintroduce a local Next server/Prisma client into the installer is a security regression rejected by the release artifact scanner.

## Rollback

Promote or roll back hosted API images and client feature flags without modifying Chromium profile directories, cookies, session partitions, or workspace IDs. A signed desktop application cannot safely revert to the former bundled-secret architecture. Actual database snapshot/restore and compatible client rollback must be exercised on staging before M02 is marked completed.

## Validation

- [M02 shell artifact CI](https://github.com/ybcole/cubics/actions/runs/42456531922) extracted the Electron `app.asar` and verified it contains no local API or server credentials.
- [M02 deployment contract](../../deploy/README.md) documents required staging domains/secret stores and migration/rollback drill.
- [M02 evidence](../milestones/M02.md) explicitly tracks release blockers and remaining tests.
