# ADR-0005: One final architecture with controlled evolution

- **Status:** Accepted as target (**NOT implemented or release-verified**)
- **Decision version:** 1.0.0
- **Date recorded:** 2026-11-08
- **Owner:** Cubics engineering; **product-owner scope approval:** pending
- **Related milestones:** M00, M19, M21, M23, M24
- **Supersedes:** None

## Context
Repeated large UI/stack rewrites risk regressions, fragile migrations and indefinite release postponement.

## Decision
Use one monorepo with stable UI/canvas/browser-contracts/collaboration/database domains; honor M00–M24 contract and staged migrations. After GA, prohibit unreviewed structural rewrites; permit tested maintenance and exceptional approved ADRs.

## Considered alternatives
Permanent architecture ban with no upgrades (rejected: insecure/unrealistic); unreviewed continuous redesign (rejected: instability).

## Consequences, migration and rollback
ADR requirements and evidence reviews create process cost but protect compatibility, security, user state and scoped delivery.

## Verification / transition to Implemented and Verified
All target contracts documented, CI checklist parity, migration flags retired, M24 release sign-off and supported upgrades demonstrated.

**Status gate:** Do not change this ADR's status to Implemented until code is merged and integration tested; Verified additionally requires release-grade evidence and named review. A future incompatible decision must supersede this ADR explicitly.
