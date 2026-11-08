# M02 — Hosted API and private realtime deploy contract

**Status:** deployable source/compose contract; **NOT DEPLOYED**. There is no
configured domain, production Clerk tenant, PostgreSQL staging instance, LiveKit
instance, or verified rollback in this repository.

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
3. Create managed PostgreSQL backups and restore credentials, then run
   `npx prisma migrate deploy` via a **one-off privileged migration job**.
   Do not run schema writes automatically on web startup.
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
