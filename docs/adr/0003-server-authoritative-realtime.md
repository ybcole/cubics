# ADR-0003: Authenticated ordered collaboration

- **Status:** Accepted as target (transport selection superseded by ADR-0008; durable authority remains a target, not release-verified)
- **Decision version:** 1.0.0
- **Date recorded:** 2026-11-08
- **Owner:** Cubics engineering; **product-owner scope approval:** pending
- **Related milestones:** M03, M13, M14, M15, M16, M17
- **Supersedes:** None

## Context
Current Socket.IO accepts client-claimed identities and relies heavily on in-memory room/chat/coordination; durable edits can be out of order or lost.

## Decision
Server verifies identities/room permissions and commits validated idempotent widget operations to PostgreSQL with per-room revisions; use sockets for notifications and ephemeral events, leases for drag/control, snapshots for reconnect.

## Considered alternatives
Client-authoritative socket broadcasts (rejected: authorization/integrity); full CRDT for all geometry (rejected: unnecessary complexity); only HTTP polling (rejected: poor latency).

## Consequences, migration and rollback
Protocol versioning, migration, live reconnection and authorization tests; Redis only when multi-node coordination required.

## Verification / transition to Implemented and Verified
Cross-room attack requests rejected; duplicate/out-of-order edits reconcile to one state; two-client network partition and host lease tests pass.

**Status gate:** Do not change this ADR's status to Implemented until code is merged and integration tested; Verified additionally requires release-grade evidence and named review. A future incompatible decision must supersede this ADR explicitly.

**2026-11-08:** [ADR-0008](0008-free-first-upgrade-path.md) supersedes only the canonical Socket.IO *transport* preference; server-accepted PostgreSQL operations and control leases remain mandatory. Socket.IO runs until Supabase private Realtime permission and media parity are demonstrated.
