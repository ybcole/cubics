# Cubics hosting — free first, paid without a rewrite

**Canonical decision:** [ADR-0008](../adr/0008-free-first-upgrade-path.md) (approved target; not a deployed claim).

| Component | Development / personal use | When revenue starts or quotas require | Stable contract |
|---|---|---|---|
| Next.js + private APIs | Vercel Hobby ($0, **non-commercial personal use only**) | Vercel Pro | /v1 + existing authenticated Next routes |
| PostgreSQL | Existing Supabase Free (preserve data) | Same Supabase project, Pro tier | Prisma models and versioned migrations |
| Realtime presence/commits | Supabase private Realtime | Same service on paid tier | Cubics RealtimeTransport; validated DB commits |
| Identity | Clerk Free | Same Clerk tenant paid | Clerk JWT subject and role checks |
| Video/audio | LiveKit Cloud Free | LiveKit paid | Short-lived grant-scoped SFU tokens |
| Personal tab browser | Electron on user's device | unchanged | Opaque profile/tab IDs, no cloud cookies |

### Important implementation status

The app **still has a temporary Socket.IO transport** and a Railway-hosted staging *plan*. Neither a new Vercel application nor complete Supabase Realtime parity is proven deployed. Keep the old socket flow functional until all in-room events have an authorized replacement. Existing rooms must not silently disappear because a hosting flag was turned on.

### Environment and sensitive data

Public client config: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`. **Never** a Supabase service-role key, database password or LiveKit/Clerk secret in `NEXT_PUBLIC_*`.

Server-only Vercel protected variables: `DATABASE_URL` (pooler), `DIRECT_URL` for migration job where needed, `CLERK_SECRET_KEY`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`. Supabase Realtime must have third-party Clerk JWT integration and private-channel RLS verified before enabling client access.

Supabase has strict free-tier limits and projects may pause when inactive; monitor usage, backups, auth renewal and recovery. LiveKit free limits apply to media minutes and egress. At commercial launch upgrade Vercel Hobby to Pro **before accepting business use**.

### Transition tests and rollback

1. Snapshot current `User`, `Room`, `RoomMember`, `Widget` plus Prisma migration parity; test on isolated staging, not the populated Supabase project.
2. Configure Clerk ↔ Supabase third-party auth; apply `supabase/migrations/20261108000001_realtime_private_room_policies.sql` **only after security review** and an isolated-staging test.
3. Run anonymous, member, outsider, revoked-member, forged widget-broadcast, and token-expiry negative tests. Ensure no realtime notification counts as a committed write.
4. Enable the Supabase transport flag for test accounts, verify both operating systems, room reconnection and LiveKit host/controller grants. No transport switch in release before functional parity.
5. Disable flag on failure; reload canonical database snapshot/revisions, leave Chromium browser partitions and profiles intact; execute an actual rollback and record evidence.
6. Once no active sockets are dependent on Railway, get separate explicit approval to delete Railway resources. A Railway volume/DB can still incur resource charges when app servers aren't running.

### Migration gate

**M02 remains IN PROGRESS** until deployed hosted API, signed desktop artifact, real staging integration, executed rollback, and reviewer approval. **M04** independently requires real native hostile-site/macOS/Windows tests, not just passing Node source checks.

## Adapter implementation (not switched on)

The [portable realtime contract](../../src/lib/cloud/realtime-transport.ts) and
[Supabase Broadcast adapter](../../src/lib/cloud/supabase-realtime.cjs) now exist,
with [non-authoritative event negative tests](../../scripts/security/supabase-realtime-adapter.test.cjs).
The adapter only sends private cursor/presence events and treats commit notifications
as hints to re-fetch the authoritative versioned API. It does **not** grant
controller/host privileges or directly mutate workspace data.

**This is a foundation, not an active Supabase connection.** A vetted
`supabase-js` client, Clerk third-party JWT authentication, deployed private
RLS on a separate test database, and transport/collaboration parity are still
needed before the default Socket.IO path can be retired.

## Railway resource verification (2026-11-14)

Legacy Railway `cubics-web` and `cubics-realtime` services were confirmed **never deployed** and deleted from the `cubics-staging` environment. The independent Railway `Postgres` service and its 500 MB persistent volume **remain running** (the volume has not been deleted); this may still incur Railway usage. Railway's old staged patch also advertises pending `staged-create` entries for the removed services. **Do not apply that stale patch**. It must be explicitly discarded/reconciled in Railway before any future staging deployment. Existing Supabase tables have not been touched. Removing the independent Railway database/volume requires a confirmed no-data-needed decision or backup.
