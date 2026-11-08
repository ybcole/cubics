# M02 — Hosted API and private realtime deploy contract

> **Canonical free-first target:** [ADR-0008](../docs/adr/0008-free-first-upgrade-path.md): Vercel Next.js/API + Supabase PostgreSQL/private Realtime + Clerk + LiveKit. This page retains **legacy Railway/Docker/Socket.IO deployment instructions for reversible migration**, not as the new required hosting plan. A paid always-on socket server is **not** a free-tier prerequisite. Do not retire the fallback until private RLS, revisions and media/control parity pass on isolated staging.

**Status:** deployable source/compose contract; **NOT DEPLOYED**. One existing
active **Cubics Supabase PostgreSQL project** was connected and inspected on
2026-11-08. It has real user/workspace records and **is not an isolated staging
database**. No verified hosted Next/Socket.IO domain, separate staging Clerk
tenant, staging LiveKit instance or executed rollback is available yet.
[Database inspection and migration evidence](../docs/security/SUPABASE_CUBICS_REVIEW.md).


## Services and ownership

- `web` (Dockerfile.web): hosted Next.js web UI and **server-only** Prisma,
  Clerk, LiveKit signing and `/v1` API endpoints; runtime secrets are injected
  by the hosting platform. Its public bundle contains only publishable keys.
- `realtime` (Dockerfile.realtime): Socket.IO verifies Clerk JWT and checks
  current room membership through `/api/internal/realtime/membership` using
  a **private 32+-byte service token**, not PostgreSQL access. Never set this
  token as `NEXT_PUBLIC_*` or place it in desktop config.
- `desktop` (prepare-desktop-release): shell-only Electron app pinned to
  `https://<user-facing-host>`. Its Node entrypoint never launches a local
  Next server. A local Next dev server remains supported for `npm run app:dev`.

## Required deployment inputs (never committed)

Public build settings: `NEXT_PUBLIC_SITE_URL` (HTTPS Cubics domain),
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (same Clerk tenant), 
`NEXT_PUBLIC_SOCKET_URL` (HTTPS/WSS Socket.IO ingress), 
`CUBICS_SOCKET_ALLOWED_ORIGINS` (exact frontend HTTPS origin).

Server runtime settings: `DATABASE_URL` (managed PostgreSQL least-privilege
user), `CLERK_SECRET_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
`LIVEKIT_API_SECRET`, `CUBICS_REALTIME_SERVICE_TOKEN` (32+ random bytes,
shared only by API and realtime), and `CUBICS_INTERNAL_API_ORIGIN` (the HTTPS
internal API origin). Configure the service-token lookup endpoint as
**private ingress** where possible. Use secret-manager references or protected
runtime env injection, not Docker image build args or public settings.

### Operator deployment checklist

1. Create separate **development, staging, production** identities, DBs,
   LiveKit projects, hostnames and secret-manager scopes. Use independent
   service accounts for runtime read/write DB and migration automation.
2. Configure TLS edge for `web:3000` and WSS ingress for
   `realtime:3001`; never expose these HTTP ports directly to the internet.
3. Create managed PostgreSQL backups and restore credentials. **BLOCKED until
   migration history reconciliation:** the existing repository's
   `prisma/migrations/migration_lock.toml` says `sqlite` and its initial SQL
   is SQLite-specific, while the actual database and Prisma datasource are
   PostgreSQL. **DO NOT run `npx prisma migrate deploy`, `prisma db push`
   or `migrate dev` on the populated Supabase database.** The additive
   username migration was applied via Supabase's versioned migration system,
   and is mirrored under `supabase/migrations/`. First establish a reviewed
   PostgreSQL baseline in an isolated staging database, compare its schema,
   safely mark the existing DB baseline as applied only with verified parity,
   and exercise a restore. Revisit a single migration authority (Prisma or
   Supabase). Never run schema writes on web startup.
4. Set the exact staging site origin in the Clerk Dashboard and
   `CUBICS_SOCKET_ALLOWED_ORIGINS`. Verify login redirects and Socket.IO JWT
   authorized-party checks with real staging identities.
5. Build images with `docker compose -f deploy/compose.staging.yml build`,
   supply secrets securely, and deploy via managed HTTPS ingress. Do not
   send secrets in shell logs, CI artifacts, issue bodies or tickets.
6. Run the [M02 rollback and parity drill](../docs/final-product/m02-rollback.md):
   authorized/unauthorized users, room/widget CRUD, live socket, workspace
   recovery, backup restoration, version rollback and no profile deletion.
7. Package a **separate** Electron release using a public
   `CUBICS_DESKTOP_APP_URL=https://...` at build time; scan the extracted
   .asar or unpacked .app/.exe before signing. M22 handles signing/notarization.

## Failure rules

No local-DB or anonymous fallback if cloud API or socket authorization is down.
No imaginary staging green check: M02.E2 needs actual identity, hostname,
deploy link and rollback evidence. Offline behavior/queued sync are M13–M15.
Changing this infrastructure requires an architecture/security review.

## Production image promotion

`deploy/compose.production.yml` takes immutable **already-tested image digests**
(`CUBICS_WEB_IMAGE_DIGEST`, `CUBICS_REALTIME_IMAGE_DIGEST`) and requires
production-only runtime secrets injected by the operator/platform. Do not
reuse staging accounts, database URLs, Clerk tenants, Socket.IO service tokens,
or LiveKit credentials. Both images run as an unprivileged Node user, expose
only container-local ports, and rely on trusted HTTPS/WSS ingress.

A successful `docker compose config` check is **syntax validation only**, not
evidence of deployed services, a real secret manager, rotated keys or a
successful database rollback.

## Railway staging resources (2026-11-08)

The separately created [cubics-staging Railway project](https://railway.com/project/819d1bc3-3b53-47fc-a6e5-4ed86218716a) contains a fresh PostgreSQL service and separate web/realtime placeholders. Its domains are reserved but no authenticated app deployment has been verified. Configure the missing Clerk and LiveKit staging credentials and service-to-service token in protected **Railway service variables**, not in GitHub, logs or desktop resources. Web liveness check is `/api/health`; identity and database authorization still require E2E checks. Do not point this project at the populated Supabase production database.

## Cubics Supabase data permissions (2026-11-08 inspection)

The current four Prisma tables are owned by the `postgres` role. RLS is
disabled, **but direct PostgreSQL privilege checks show neither `anon`
nor `authenticated` has SELECT/INSERT/UPDATE/DELETE on them**. Keep this
public-role denial. Supabase's table inspector marks disabled RLS as critical
because future grants could bypass per-user authorization. [Issue #4](https://github.com/ybcole/cubics/issues/4)
requests an explicit security review of a server-only RLS policy; **do not
enable RLS automatically** without checking the real backend DB role. The
separate lesson/quiz tables share the same project and are outside Cubics'
migration scope.

For Prisma, store the database URL only in the hosted API's secret store; do
not put it in a `NEXT_PUBLIC_*` variable, desktop release config, or Docker
build ARG. Use the appropriate Supabase connection pooler for serverless
deployments according to [Supabase's Prisma guide](https://supabase.com/docs/guides/database/prisma).

## Hosting target changed (ADR-0008)

**Canonical personal-development hosting is Vercel + Supabase + Clerk + LiveKit**, with paid upgrades in the same providers. Railway Compose, Dockerfiles and temporary staging services are **legacy fallback only**, not the normal deployment requirement. Deletion of Railway staging must be expressly approved because its PostgreSQL volume is populated separately and may consume credits. Realtime migration requires private Supabase RLS with Clerk JWT and full server-accepted operation parity before Socket.IO retirement.
