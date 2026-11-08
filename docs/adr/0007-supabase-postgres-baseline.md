# ADR-0007 — Align Cubics database migrations with PostgreSQL; review RLS

**Version:** 1.0.0 · **Date:** 2026-11-08 · **Status:** Proposed for PostgreSQL baseline and RLS policy; additive username repair implemented.

**Related milestones:** M02.02, M02.03, M02.06, M03.03, M13.
**Owner:** Project owner (explicit request to progress M02 in chat; identity not independently verified); baseline/RLS security approval **pending**. Engineering/security review required before production rollout.

## Context

The connected Supabase Cubics project already has real PostgreSQL workspace data.
The app's Prisma model uses PostgreSQL, but its original migration is SQLite
and has no applied Prisma history on Supabase. A schema mismatch left
`username`/`usernameKey` absent. Four core tables have RLS disabled even
though public Supabase database roles currently lack table permissions.

## Decision — implemented narrow repair

Add missing username columns and a unique index using the official Supabase
migration mechanism. Do not touch existing identities/rooms/widgets or
lesson/quiz data. Record and verify migration
`20261108074105_cubics_add_missing_username_columns` and keep source SQL
in sync with the applied migration.

## Proposed future migration and auth decisions

1. Keep Clerk verification and object-level authorization on the hosted
   Next API. Keep `anon` and `authenticated` privileges on Cubics' four
   tables revoked, regardless of using Supabase's published API URL.
2. Enable RLS on these four tables as defense in depth only after selecting
   the server DB role and testing how it will access RLS-protected rows.
   Do not use `auth.uid()` policies based on assumptions about Clerk's IDs.
3. Replace the SQLite-era Prisma migration chain with a verified PostgreSQL
   baseline on an **isolated fresh staging database**. Review generated SQL,
   inventory/index parity and constraints, then baseline existing populated
   databases via a tested Prisma `migrate resolve --applied` process when
   appropriate. Back up before baselining, validate counts and restore, never
   run `migrate reset` or `db push` on production.
4. Pick a **single** forward migration authority (Prisma or Supabase) and
   document compatibility with the other before any further deploy.

## Alternatives rejected

- Exposing direct Supabase `anon`/public client access without RLS: violates
  private-workspace security.
- Enabling RLS immediately without knowing the backend connection role:
  risks blocking legitimate application access.
- Re-running the SQLite `init` migration against a populated PostgreSQL
  database: incompatible SQL and destructive risk.
- Using the connected populated project as a staging database: violates
  environment isolation and risks data loss.

## Consequences and negative checks

- Existing records were unchanged by the additive repair; a unique index
  prevents duplicate non-null username keys.
- RLS and migration-baselining production risk remain **open** until owner
  review and staging tests.
- Negative tests must prove `anon`/`authenticated` cannot read/update
  rooms/users, cross-room Clerk access is forbidden, a revoked member loses
  Socket.IO access, and production DB credentials never enter desktop bundles.
- Real rollback must preserve counts, row IDs, user profile state, device
  browser partitions and pre-existing workspaces.
- No change to any lesson/quiz tables in this shared Supabase project.

**Evidence:** [audit](../security/SUPABASE_CUBICS_REVIEW.md),
[M02 ledger](../milestones/M02.md), [review issue #4](https://github.com/ybcole/cubics/issues/4),
[M02 deployment issue #3](https://github.com/ybcole/cubics/issues/3).
