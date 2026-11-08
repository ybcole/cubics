# Architecture Decision Record index

**Milestone:** M00.06 · **Versioned decision log** (target decisions, **not evidence that code is migrated**).

| ADR | Status | Target decision | Work milestones |
| --- | --- | --- | --- |
| [ADR-0001](0001-desktop-cloud-trust-boundary.md) | Accepted as target | Desktop/cloud trust separation and no bundled backend secrets | M02–M04 |
| [ADR-0002](0002-browser-session-manager.md) | Accepted as target | Main-owned native browser lifetime, WebContentsView after parity | M05–M09, M11 |
| [ADR-0003](0003-server-authoritative-realtime.md) | Accepted as target | Server-accepted operations and scoped authenticated Socket.IO | M13–M17 |
| [ADR-0004](0004-browsing-privacy-media.md) | Accepted as target | Personal/Live/Shared separation, consent, LiveKit SFU | M03, M05, M17–M18 |
| [ADR-0005](0005-stable-final-architecture.md) | Accepted as target | Monorepo domains, versioned contracts and GA freeze | M00, M19–M24 |
| [ADR-0006](0006-hosted-desktop-cloud-client.md) | Implemented in source; staging pending | Packaged desktop is a pinned HTTPS client, no local privileged Next server | M02, M03, M04, M22 |
| [ADR-0007](0007-supabase-postgres-baseline.md) | Proposed; RLS requires explicit owner/security decision | Additive migration on existing Postgres; plan baselining and RLS review without disturbing workspaces | M02, M03, M13 |
| [ADR-0008](0008-free-first-upgrade-path.md) | Accepted target; deployment pending | Vercel + Supabase private Realtime/Postgres + Clerk + LiveKit, upgrade-in-place | M02–M04, M13–M19 |

**Status definitions:** Proposed (not approved) / Accepted as target (design decision only) / Implemented / Verified / Superseded. All are version 1.0.0 and dated 2026-11-08; product-owner scope sign-off is pending. Future ADRs use the next unused number and name the superseded record rather than silently altering history.
