# M02 — hosted authority migration and rollback

**Status:** approved target, not deployed. This plan protects room/widget data and local Chromium browser sessions. The current desktop still runs its legacy local Next server with privileged API routes, so M02's release gate is **OPEN**.

## Production target

- Deploy an HTTPS `/v1` API with Clerk bearer-token verification, per-room/object authorization, Prisma/PostgreSQL, LiveKit token issuance and append-only migration evidence.
- Desktop React/Next renderer becomes a **public client** consuming the versioned API. It may not have direct DB access or bundled Clerk/LiveKit server secrets.
- Realtime service authenticates sessions and checks membership through the authoritative hosted trust boundary, not a user-supplied room ID.
- No secrets in `electron-builder.yml` resources, `.next/standalone`, renderer JS, static assets or Electron environment. Build artifacts are independently scanned.
- Host and desktop deployments have independent feature versions and compatibility windows; rejected protocol versions get a visible upgrade message.

## Flags (initially OFF)

- `NEXT_PUBLIC_CUBICS_HOSTED_API_ENABLED=false` (default): legacy authenticated Next routes remain the sole active source.
- `NEXT_PUBLIC_CUBICS_HOSTED_API_ENABLED=true`: only enable in a **staging client** after the hosted `/v1` API exists and passes tests. A URL alone never switches traffic silently.
- `NEXT_PUBLIC_CUBICS_API_ORIGIN=https://api.example...`: set only to a trusted HTTPS origin (local HTTP limited to localhost). No API secret in this public setting.

The typed API client foundation is in `src/lib/cloud/`. **It is not yet wired to UI or deployed**; this preserves current behavior.

## Migration sequence and acceptance

1. Snapshot and back up current PostgreSQL `User`, `Room`, `RoomMember`, `Widget` data and capture schema migration/checksum manifests.
2. Deploy hosted API behind a **server-side-only** secret store; verify Clerk tenant/issuer, domain, DB schema, LiveKit grants and request logging/redaction.
3. Implement `/v1` workspace/widget endpoints preserving stable legacy Room/Widget IDs; add explicit revision IDs before enabling offline write replay.
4. Add a shared adapter or dual-read strategy comparing old/new API responses by room and user; keep writes on one authoritative path until reconciliation is proven.
5. Enable the cloud client for internal test accounts; verify cross-user denied-access, full login, workspace CRUD, shared tabs, reconnection, native profile preservation.
6. Validate downloadable signed builds, **including an extracted artifact scan** that fails if server secrets or privileged DB access are present.
7. Expand rollout by cohorts only with observed API error rates, backup availability, rollback tested and migration version compatibility.
8. Remove the temporary legacy API/server components **only after** verified parity and recovery. No destructive profile migration.

## Rollback procedure

**Trigger:** API auth regressions, room data mismatch, unbounded sync queue, Electron session breakage, leaked secret in package, host control failure, or SLO breach.

- Stop advancing cohorts and disable hosted-client feature flags **for affected compatible versions**, keeping already authenticated users from losing local browser profiles.
- If the migration used dual-read, switch reads to last-known good API, but do **not** replay writes that were already committed on the new API; reconcile by durable operation IDs.
- If schema changes occurred, restore from verified backup in an isolated database or run a tested forward-fix. Never blindly downgrade a schema or overwrite data changed after snapshot.
- Preserve Chromium partition directories, userData, browser identities and local queue; backend rollback must not delete profiles or cookies.
- Compare workspace counts, member roles, widget IDs/positions and latest revisions before enabling writes again.
- Record test time, data checksum diffs, operator, linked issue, feature flag state and exact deployed versions. Provide users explicit recovery state if content is pending sync.

## Required rollback drills

- New API unavailable during login/room join, permission revoked mid-session, partial migration, duplicate operations, database restore, desktop version rollback, and browser guest still alive after backend disconnect.
- Validate against one protected test identity and one unauthorized account; both must observe correct permission checks and identical workspace geometry after reconciliation.
- **Cannot declare M02.09 complete by a drill that hasn't happened.** M02.09 is the written rollback *plan*; M02.E2 requires the real executed rollback and hosted staging E2E.
