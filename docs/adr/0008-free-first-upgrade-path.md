# ADR-0008 — Free-first managed architecture with upgrade-in-place

**Date:** 2026-11-08 · **Version:** 1.0.0 · **Status:** Accepted as target by project owner (explicit chat instruction); migration **IN PROGRESS**, not deployed.  
**Related:** M02, M03, M04, M13–M19, M22. **Supersedes:** ADR-0003's choice of Socket.IO as the target notification transport (not its server-authoritative operation model). **Does not supersede:** durable PostgreSQL authority, local personal-browser privacy or native Electron browser contract.

## Decision

The canonical Cubics **personal-development / free-tier** stack is:

| Workload | Free-first provider | Paid continuation |
| --- | --- | --- |
| Next.js renderer, verified Clerk API and web hosting | **Vercel Hobby** (personal, non-commercial only) | Vercel Pro, same repository/routes |
| Relational users, workspaces, widget revisions, durable operations | **Supabase PostgreSQL Free** | Supabase Pro, same schema and IDs |
| Ephemeral cursor/presence and server-accepted change notifications | **Supabase Realtime** with private Broadcast/Presence + RLS | Supabase Realtime paid quotas, same channel protocol |
| Identity/session/token | **Clerk Free** | Clerk paid capacity, same identities/SDK |
| Voice, Live/Shared screen/tab media | **LiveKit Cloud Free/Build** | LiveKit paid quota, same grants/client SDK |
| Personal browser tabs, cookies, local profile | **Electron/Chromium on user's device** | Identical local model; never cloud-host personal tabs |

No Railway is required to run the **target** stack; existing Railway staging is **legacy temporary infrastructure** and its running PostgreSQL may continue to consume credits until the owner explicitly approves stopping/deleting it. Do not modify populated Supabase Cubics production tables without a reviewed migration and backup.

### Durable authority and private Realtime

- **All workspace mutations** go to the authenticated, versioned Next API. It validates actor/owner/role, commits to PostgreSQL with a durable revision/operation ID, then publishes a server-accepted commit. **Client Broadcast is not authoritative.**
- Clients may publish **ephemeral cursor/presence** on private topic `cubics:room:<roomId>`, never durable widget patches, auth cookies, screen pixels or control lease grants. The Supabase Realtime private channel needs matching RLS policies on `realtime.messages` checking the Clerk JWT `sub` against existing Prisma `Room`/`RoomMember` tables.
- Supabase's **Clerk third-party auth** integration must be configured in the Supabase and Clerk dashboards. `getToken()` comes from Clerk; no `service_role`/DB password/Clerk secret appears in the frontend or Electron shell. Auth access is reissued and channel subscriptions revalidated when the token changes, and on membership revocation; note that Realtime caches RLS until token refresh/reconnect.
- Shared control and host leases remain **server-authoritative**. Do not migrate socket host/control signaling directly into untrusted Broadcast as equivalent to those leases. Replace M03/M17 events only with validated API and signed grants. LiveKit sends audio/video; Supabase Realtime is **not** a video transport.

### Stable portability boundary

Keep `src/lib/cloud/contracts.ts` and the versioned API shapes canonical. A `RealtimeTransport` interface owns `connect/subscribe/ephemeralPublish/subscribeCommitted/disconnect` with provider-specific implementations behind flags. Stable room IDs, operation IDs, revisions, account IDs and local profile IDs must survive switching provider plans; no URL or tab title is a primary identifier. Record counts/checksums and test 2-user permissions during cutover.

## Costs and upgrade triggers

Vercel Hobby is non-commercial; move to Vercel Pro **before commercial deployment**, independent of user count. Monitor Supabase realtime connection/message caps, DB size/storage, LiveKit participant-minutes/egress and Vercel function budgets. An upgrade inside the same provider and project should normally be a billing/limit change, **not** a rewrite. At high scale, Cloudflare Durable Objects or dedicated Socket.IO is an option behind the transport interface—not the current target or a guaranteed zero-code switch.

## Migration and rollback (never silent)

1. Freeze source contracts/permission negative tests and capture current Supabase schema/data backups. Keep legacy Socket.IO behind a temporary feature flag; no live user switched by documentation.
2. Validate RLS migration against an **isolated empty Supabase staging project**. Test Clerk token accepted, outsider denied, revoked user loses access after channel refresh, and no client Broadcast can become a widget mutation.
3. Introduce `RealtimeTransport`, migrate presence and cursors first, then server-committed widget operations/chat and media/lease signaling with full parity. Enable by small test cohorts.
4. Deploy Next to Vercel, configure Clerk/LiveKit protected environment variables and Supabase publishable key/URL. Never package service role credentials or use a browser-side `DATABASE_URL`.
5. Run real macOS+Windows native security E2E (M04), two-account access tests (M03), rollback/restore/feature-flag drills (M02/M13–M15). Verify saved rooms and browser partitions untouched.
6. Only then retire Railway staging/Socket.IO **with owner's explicit deletion approval**. On failure revert transport flag and resync from canonical Postgres revisions, not from stale Broadcast messages.

## Alternatives

- All-Railway always-on backend: fast to prototype but spends monthly RAM/DB credits for idle development; retained only as a temporary fallback.
- Cloudflare Durable Objects now: better room actor model at scale, but requires a substantial extra backend and separate account; defer.
- Unrestricted Supabase Broadcast for widget edits: rejected as forgeable/inconsistent. Authorization at channel join alone does not prove validity of individual mutations.
- Reusing the populated Supabase project as test staging: rejected due to risk to existing data.

## Implemented transport foundation (2026-11-08)

- [Provider-neutral typed contract](../../src/lib/cloud/realtime-transport.ts) defines `connect`, `publishEphemeral`, `onEphemeral`, `onCommitted` and `disconnect`.
- [Supabase private Broadcast adapter](../../src/lib/cloud/supabase-realtime.cjs) enforces private channel options, explicit Clerk JWT injection and cursor/presence-only client publishing. Untrusted commit hints cannot become durable writes.
- [Negative adapter tests](../../scripts/security/supabase-realtime-adapter.test.cjs) pass with security CI; existing Socket.IO remains the default until real Supabase RLS and two-user E2E.
- This adapter is dependency-injected; the end-user Supabase client SDK, authentication integration and full canvas/host migration are **not** wired or verified yet.

## Verification status

Architectural selection is accepted; **end-to-end cutover, RLS deployment, Vercel account deployment, real two-user permission parity and rollback remain OPEN**. The code should fail closed if a Supabase channel isn't private/authorized. Marking M02 or M04 completed requires their independent objective tests and sign-offs.
