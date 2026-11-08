# M01 threat model — Cubics desktop and cloud

**Date:** 2026-11-08 · **Version:** 1.0.0 · **Status:** active baseline; not a claim of full protection. **Security release gate remains OPEN.**

## Scope and trust boundaries

```text
Potentially hostile website / livestream / external URL (UNTRUSTED)
     ↕ native browser surface (Chromium webContents, per-profile partition)
     ↕ bounded, sender-checked preload/IPC messages                 [TB-01]
App renderer (React/Next, internet-origin content not trusted)      [TB-02]
     ↕ validated native commands
Electron main (window/session/permissions/capture/download/update)  [TB-03]
     ↕ HTTPS/WSS with identity proof
Cloud API (Clerk verify + role checks)                              [TB-04]
     ↔ PostgreSQL and private object storage                         [TB-05]
Realtime (Socket.IO: room join, event relay, host/control leases)  [TB-06]
     ↔ LiveKit tokens/media SFU                                      [TB-07]
     ↔ release signing/update infrastructure                         [TB-08]
```

An attacker can control a malicious website; a forged network/socket client; an authorized but malicious room member; popup/deep-link parameters; a compromised or expired bearer token; a shared-session controller; malformed media payload; or manipulated download/update metadata. External sites are not trusted merely because the user opened them inside Cubics.

Assets: user browser cookies and profiles, personal page pixels/history, clipboard/files, Clerk sessions, DB and LiveKit secrets, room membership, widget/space data, chat, remote control and media streams, updater signature chain and desktop native permissions.

## Threat register and control + test mapping

A threat's **target mitigation** is not automatically implemented. Green tests are named only where verified in CI; all other tests have a milestone owner. Severity is prospective and must be revisited after implementation.

| Threat | Scenario / impact | Severity | Required mitigation | Test ID and status | Owning milestone |
| --- | --- | --- | --- | --- | --- |
| T01 | Forged `room:join` / identity claims yield unauthorized space events or information | Critical | Verified Clerk token at handshake, DB membership authorization on join/event, room-scoped emission | AT-01 unauthorized join / impersonation — **NOT implemented** | M03, M15 |
| T02 | Member edits/deletes a room owned by someone else | High | Server-derived actor, owner/admin/member matrix, object-level authorization | AT-02 cross-owner mutation — API tests in M03/M13 | M03, M13 |
| T03 | Direct socket offer/ICE/voice/control sent across rooms | High | Bound recipient to same authorized room and tab; session generation | AT-03 cross-room direct signal — **legacy joined-room guard + integration test**; auth still missing | M01, M03, M17 |
| T04 | Guest web content escapes sandbox, accesses Electron/Node, or calls privileged IPC | Critical | Sandboxed webContents, context isolation, narrow IPC, sender/ownership checks | AT-04 malicious page/IPC E2E — pending | M04 |
| T05 | Screen/media capture without explicit consent; control lease spoof | Critical | Explicit permission grants, scoped token, short TTL, revocation, input validation | AT-05 revoke media/controller — pending | M04, M17, M18 |
| T06 | `/api/embeddable?url=` server-side fetch targets loopback/metadata/internal infrastructure | Critical | Remove endpoint or enforce strict outbound allowlist/proxy+DNS pinning, block private/redirect targets | AT-06 SSRF and DNS rebinding — pending; **unsafe endpoint remains** | M02/M04 |
| T07 | External auth popup, deep link, download or protocol triggers unsafe navigation/native action | High | Scheme/host allowlists, no arbitrary shell opens, user consent, safe download handling | AT-07 malicious URL/downloader E2E — pending | M04 |
| T08 | Packaged `.env` exposes cloud DB, Clerk secret or LiveKit signing key | Critical | Hosted API, no bundled server secrets, artifact scanner | AT-08 installer artifact secret scan — pending | M02, M22 |
| T09 | Client issues too-powerful or mis-scoped LiveKit token or unauthorized viewer subscribes | High | Cloud-only issuance, room + publish/subscribe grants and participant authorization | AT-09 forged room/media token — pending | M03, M18 |
| T10 | Website URL/title, browser profiles or private media enter logs, other rooms or analytics | High | Data classification, redaction, least-privilege metadata sync and support bundles | AT-10 canary URL/cookie leak — pending | M05, M20 |
| T11 | Realtime floods or malformed events cause OOM/CPU load, event amplification or chat spam | High | Payload limits, per-user and per-room rate limits, validation, queues, quotas | AT-11 fuzz/rate/DoS — pending | M03, M15, M19 |
| T12 | CSRF/CORS/origin weakness permits malicious web-origin action | High | Authenticated origin allowlist, CSRF protection for cookie-auth mutations, no `cors: "*"` | AT-12 origin and CSRF probes — pending; **wildcard CORS remains** | M02, M03 |
| T13 | Widget edits lost, replayed or reordered through reconnect and duplicate operations | High | Server-issued room revision, idempotency, access checks, snapshots and durable transaction | AT-13 duplicate/reconnect test — pending | M13–M15 |
| T14 | Host/controller stale lease allows input after revocation/disconnect | High | One exclusive generation-fenced controller lease with heartbeat and expiry | AT-14 hostile stale control — pending | M17 |
| T15 | Untrusted library/dependency or unsigned update installs malicious code | Critical | SBOM/license/audit, pinned/signed release, update signing, provenance and rollback | AT-15 dependency and signed update audit — scanning added M01; signing pending | M01, M22 |
| T16 | Local profile/cookies mix between Cubics identities or Shared/Personal tab | Critical | Per-account profile separation and explicit Shared profile; never transfer cookies | AT-16 two-account isolation E2E — pending | M05 |
| T17 | Cross-room presence reveals members or host metadata | High | Scope presence/host notifications to authorized room | AT-17 current joined-room isolation test; token authority still pending | M01, M03 |
| T18 | Compromised sync cache or backups reveal private browsing credentials | High | Encrypted/OS-protected secrets, local cache classification, backup/recovery policy | AT-18 backup privacy and corruption — pending | M14, M19 |
| T19 | Global `room:update` or control token events leak across spaces | High | Bind event to joined room and room-scoped broadcasts | AT-19 joined-room broadcast regression; authorization pending | M01, M03 |
| T20 | Domain-specific DRM/SSO incompatibility gets misrepresented as universal browser support | Medium | Compatibility matrix and accurate user warnings | AT-20 external-site compatibility tests — pending | M07, M21 |

## Initial security risk decisions

**P0/critical release blockers:** T01, T04, T05, T06, T08, T15, T16. None are accepted as safe merely because M00 product approval was granted. Current `socket-server.cjs` still accepts client-declared identity and membership; `electron/main.js` has `sandbox:false`; `scripts/prepare-standalone.js` copies `.env`; and `/api/embeddable` server-fetches a caller-provided URL. They require actual remediation and negative tests in the assigned milestones.

**M01 improvement, not full auth:** `src/lib/security/realtime-room-policy.cjs` and `socket-server.cjs` now scope existing direct peer signaling, room updates, presence and host-directed tab input to a *joined room*. An attacker who can fraudulently join that room is still a risk. M03 is required to bind room joins to identity and database membership.

## Negative-test acceptance

AT-01/AT-02 must use a **real HTTP/WebSocket service** with a forged user ID/token and an actual denied room/object operation; policy-helper unit tests do **not** replace this requirement. AT-03/AT-17/AT-19 run real Socket.IO cross-room tests. AT-04/AT-05/AT-07/AT-16 require actual signed/packaged or development Electron guest and OS permission scenarios. For every test, record CI link, environment, fixture, observed result and release significance in `docs/milestones/M01.md` and the owning later milestone.

## Threat model refresh

Update at each new Electron/IPC or cloud endpoint, user-controlled URL path, new realtime event or media operation; add its permissions to `runtime-inventory.json` and regression test before merging. Re-evaluate severity with security reviewer and the user-visible risk.
