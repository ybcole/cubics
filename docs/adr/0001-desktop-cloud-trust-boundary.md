# ADR-0001: Desktop–cloud trust boundary

- **Status:** Accepted as target (**NOT implemented or release-verified**)
- **Decision version:** 1.0.0
- **Date recorded:** 2026-11-08
- **Owner:** Cubics engineering; **product-owner scope approval:** pending
- **Related milestones:** M02, M03, M04, M19, M22
- **Supersedes:** None

## Context
A packaged local Next server currently carries database/Clerk/LiveKit server secrets; untrusted external webpages share the desktop process environment.

## Decision
Move privileged API and signing to a hosted authenticated backend; desktop runs UI and local native browsing only. Use typed, sender-checked IPC and server-authorized HTTPS/WSS; never distribute server secrets.

## Considered alternatives
Keep a privileged embedded Next server (rejected: client holds cloud authority); add per-feature backend microservices now (rejected: unnecessary operational complexity).

## Consequences, migration and rollback
M02–M04 migration, backend availability, local cached operation queue. Stage behind versioned API adapter and scan signed artifacts before removal of legacy.

## Verification / transition to Implemented and Verified
No privileged cloud keys in installer, cross-room negative tests, hardening audit, staging rollback and OAuth flow on both target OSs.

**Status gate:** Do not change this ADR's status to Implemented until code is merged and integration tested; Verified additionally requires release-grade evidence and named review. A future incompatible decision must supersede this ADR explicitly.
