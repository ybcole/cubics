# ADR-0002: Native tab lifetime independent of React

- **Status:** Accepted as target (**NOT implemented or release-verified**)
- **Decision version:** 1.0.0
- **Date recorded:** 2026-11-08
- **Owner:** Cubics engineering; **product-owner scope approval:** pending
- **Related milestones:** M06, M07, M08, M09, M11
- **Supersedes:** None

## Context
React-owned webviews can be destroyed by renderer state/route changes. Offscreen keep-alive alone cannot preserve sessions across all component lifecycles.

## Decision
Main-process BrowserSessionManager owns stable tab ID/profile/lifecycle; React only requests presentation and navigation. Prototype WebContentsView compositor; migrate after camera/z-order/parity tests, with temporary legacy adapter.

## Considered alternatives
Always-mounted React webviews forever (rejected long-term: view lifetime still coupled); virtualize and recreate guests offscreen (rejected: state loss); immediate native rewrite (rejected: stacking/capture risk).

## Consequences, migration and rollback
Native bounds compositor, IPC, resource budgeting and recovery. Additional native complexity, explicit cleanup, performance tests; no promise of arbitrary crash-persistent DOM.

## Verification / transition to Implemented and Verified
Twitch navigation state survives repeated pan/zoom/sidebar/space views; native focus/clipping/capture parity on macOS/Windows; no unintended destroy events.

**Status gate:** Do not change this ADR's status to Implemented until code is merged and integration tested; Verified additionally requires release-grade evidence and named review. A future incompatible decision must supersede this ADR explicitly.
