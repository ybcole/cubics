# Cubics Supabase PostgreSQL inspection — 2026-11-08

**Status:** read-only audit performed; one additive schema migration verified.
**Scope:** existing Supabase project named `Cubics`; not an isolated staging
environment. [M02 evidence](../milestones/M02.md).
[Issue #4: RLS / migration baseline review](https://github.com/ybcole/cubics/issues/4).

## Data parity and migration evidence

Connected project reports `ACTIVE_HEALTHY` on PostgreSQL 17.
Aggregated row counts before and after the additive migration:

| Table | Before | After | Direct `anon`/`authenticated` grants |
| --- | ---: | ---: | --- |
| `public."User"` | 2 | 2 | SELECT/INSERT/UPDATE/DELETE **not granted** |
| `public."Room"` | 8 | 8 | SELECT/INSERT/UPDATE/DELETE **not granted** |
| `public."RoomMember"` | 9 | 9 | SELECT/INSERT/UPDATE/DELETE **not granted** |
| `public."Widget"` | 15 | 15 | SELECT/INSERT/UPDATE/DELETE **not granted** |

Verified zero orphaned memberships and zero orphaned widgets. No individual
identities, emails, URLs, rows or database credentials were read or committed.

The live User table lacked two fields present in `prisma/schema.prisma`:
`username` and `usernameKey`. The official Supabase migration mechanism
successfully applied `20261108074105_cubics_add_missing_username_columns`
and verified two new columns and one unique index. Existing username fields
were not populated. SQL is mirrored at
[`supabase/migrations/20261108074105_cubics_add_missing_username_columns.sql`](../../supabase/migrations/20261108074105_cubics_add_missing_username_columns.sql).
This is **not** an account data migration or staging/rollback drill.

## Critical RLS policy decision — owner/security review required

All four core tables have **RLS disabled**; Supabase surfaces this as a
critical configuration finding. A separate SQL privilege check verifies
`anon` and `authenticated` currently have no table read/write permissions,
so those specific API roles cannot currently read or write these tables.
**Disabled RLS still leaves a defense-in-depth gap** if permissions change.

Clerk (not Supabase Auth) supplies Cubics identity. An `auth.uid()`-based RLS
policy will not automatically match Clerk's user IDs. Recommended model:
all workspace operations are authorized by the hosted Clerk/Prisma API,
Supabase Data API roles retain no grants, and RLS is enabled as an additional
deny-by-default safeguard only after verifying the server DB role.

**Owner decision required. Nothing was automatically applied for RLS.**
Proposed SQL for review only:

```sql
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoomMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Widget" ENABLE ROW LEVEL SECURITY;
```

Do not run this blindly: it can block non-owner/non-bypass server DB roles
unless suitable scoped policies or privileges are in place. Review
[Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security),
the live `DATABASE_URL` role, and negative-access tests first.

## Critical deployment procedure mismatch

`prisma/schema.prisma` declares PostgreSQL, but the committed
`prisma/migrations/migration_lock.toml` declares SQLite and the original
migration includes SQLite-specific `DATETIME` and `REAL` declarations. The
populated Supabase database has **no Prisma migration history table**.
Running `prisma migrate deploy` against it as currently configured is
unsupported and may fail. Do **not** reset/drop/recreate any populated table.

Required next steps: generate a PostgreSQL baseline using the pinned Prisma
CLI, compare against the existing schema, apply to a **fresh isolated staging
DB**, verify parity, then use the Prisma-supported baselining/resolve workflow
on any existing populated database only under a reviewed backup/rollback plan.
Until then, manage explicit additive SQL in Supabase's versioned migration
system, and do not run implicit `prisma db push` on shared environments.
[Prisma baselining guide](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/baselining).

## Other Supabase observations

The same project includes lesson/quiz tables and RPCs that appear to serve
separate functionality. Supabase's security advisors report some
`SECURITY DEFINER` functions callable by `anon`/`authenticated`; these
should receive a separate ownership/security review. **They were not touched.**

## M02 acceptance state

A connected healthy database is only one dependency. The repo still lacks a
verified isolated staging environment, real hosted web/API and realtime
deployments, a service secret manager, actual desktop two-account login,
and a backup/rollback drill. M02 remains **IN PROGRESS**. [Issue #3](https://github.com/ybcole/cubics/issues/3).
