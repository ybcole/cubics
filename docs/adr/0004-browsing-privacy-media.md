# ADR-0004: Personal/Live/Shared isolation and media policy

- **Status:** Accepted as target (**NOT implemented or release-verified**)
- **Decision version:** 1.0.0
- **Date recorded:** 2026-11-08
- **Owner:** Cubics engineering; **product-owner scope approval:** pending
- **Related milestones:** M03, M05, M17, M18
- **Supersedes:** None

## Context
A shared canvas contains both private browsing contexts and collaboratively visible content. Sharing a screenshot does not grant consent to share cookies or remote control.

## Decision
Personal profile/page is isolated; Live is explicit authorized host media; Shared uses distinct collaborative browser profile with exclusive controller lease. LiveKit transports media; Socket.IO only scoped signaling/input.

## Considered alternatives
Mirror all personal tabs to everyone (rejected: privacy breach); server-side shared browser for every tab (rejected for GA due to complexity/cost); peer-to-peer mesh streaming (rejected for scalability).

## Consequences, migration and rollback
Strong consent UX, revocation, host failure handling, OS permission policies and independent audio/subscription budgets.

## Verification / transition to Implemented and Verified
No unconsented pixel/cookie leaks across accounts; exclusive control and host-loss tests; authorized only capture and media grants.

**Status gate:** Do not change this ADR's status to Implemented until code is merged and integration tested; Verified additionally requires release-grade evidence and named review. A future incompatible decision must supersede this ADR explicitly.
