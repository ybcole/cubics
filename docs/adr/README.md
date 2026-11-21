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
| [ADR-0009](0009-in-app-guest-auth.md) | Implemented; native fixtures verified, release acceptance open | Native in-app guest auth popup chains with explicit profile ownership | M04.04, M04.06, M05.08 |
| [ADR-0010](0010-local-realtime-authority.md) | Implemented in source; real-account acceptance pending | Shared private loopback development credential and bounded membership join recovery | M03.03, M03.08, M15.01, M15.08 |
| [ADR-0012](0012-local-motion-previews.md) | Implemented in source; native acceptance pending | Bounded local Personal-tab previews; presentation refined by ADR-0013 | M05, M10–M11, M21 |
| [ADR-0011](0011-address-bar-autosuggest.md) | Implemented in source; live-provider acceptance pending | Main-process address suggestions with Google/DDG failover and local-only URL input | M04.04, M05.08 |

| [ADR-0013](0013-heavy-site-motion-isolation.md) | Implemented; native fixtures verified, device acceptance pending | Suppress all Personal guest surfaces during motion, including uncached/loading tabs | M05, M10–M11, M21 |

| [ADR-0014](0014-static-personal-tab-motion.md) | Implemented in source; native overlay checks pending | Retain bounded adaptive-resolution snapshots and display them during widget dragging | M05, M10–M11 |

**Status definitions:** Proposed (not approved) / Accepted as target (design decision only) / Implemented / Verified / Superseded. Individual ADRs carry their own dates and versions. M00 scope/governance approval is recorded for 2026-11-08; later runtime/security/release sign-off remains separate. Future ADRs use the next unused number and name the superseded record rather than silently altering history.
