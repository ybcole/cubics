# ADR-0010: Local realtime authority configuration and join recovery

- **Status:** Implemented in source; real-account acceptance pending
- **Decision version:** 1.0.0
- **Date:** 2026-11-21
- **Owner:** Cubics engineering
- **Related milestones:** M03.03, M03.08, M15.01, M15.08
- **Issue:** https://github.com/ybcole/cubics/issues/11
- **Supersedes:** None; refines ADR-0003/0006 local development configuration.
- **Product authorization:** Project owner (explicit user instruction in chat; identity not independently verified), 2026-11-21: fix realtime membership verification error. Independent security/release sign-off remains pending.

## Context

`room:denied` with `Unable to verify membership` means the authoritative lookup threw, not that PostgreSQL rejected the user's membership. The local startup/example environment did not supply the newly required internal API origin/service credential. Socket.IO also loaded environment files without Next's development mode. The client never retried a join after transient API startup/compile/network failures. The user's live terminal/environment was not accessible; these are confirmed source defects, not a claim to have inspected their running configuration.

## Decision

Both server processes resolve the same credential. Explicit `CUBICS_REALTIME_SERVICE_TOKEN` always wins and a short/empty configured token fails closed. In production, or when using a remote API, the token and production HTTPS origin must remain explicitly configured.

For local nonproduction loopback only, default the internal API origin to `http://127.0.0.1:3000`. Generate a cryptographically random 256-bit per-checkout credential in an OS-user-private temporary directory outside the repository. The absolute checkout path hashes into its identity; OS user ID scopes the directory where supported. Files use 0600 and directories 0700, and ownership/mode/symlink checks reject unsafe storage on POSIX. Windows uses the account's temporary directory; native ACL qualification remains separate. Atomically hard-link a completed temporary credential into place so concurrent Next/Socket.IO startup sees one complete key. Restarting either process reuses it. Never ship or log the token, embed it in renderer code, or store it in room data. It is a local service credential, not a user's browser or Google token.

Load `.env.development*` in the standalone socket process consistently with `next dev`. Keep production env loading and explicit server credentials. See Next's [environment documentation](https://nextjs.org/docs/app/guides/environment-variables).

Classify configuration, service authentication, HTTP and temporary transport failures safely on the server. Return only an additive `MEMBERSHIP_UNAVAILABLE` code and retryable boolean to the client. Keep existing membership-denied responses and all database/JWT authorization checks. Retry temporary join failures five times with bounded exponential backoff; clear timers on success, disconnect and unmount. Never enable subscriptions before `room:joined`. Log a temporary warning once; permanent denials or exhausted retries remain errors. No optimistic membership grant, public/private fallback or direct Prisma access in Socket.IO.

## Alternatives, consequences and limitations

Manually configuring development service tokens is still supported, but requiring undocumented variables broke the default dev workflow. A hardcoded shared development token, trusting the renderer's membership, silencing every denial or querying Prisma in the socket worker are rejected. Two different checkouts or OS users must explicitly configure one shared credential if they intentionally split local services. Remote/production deployment still needs its real secret and API/database health. A stopped database, wrong configured credential, wrong API origin or genuinely missing membership remains denied with a diagnostic code; retries cannot repair those configurations.

## Migration and rollback

No schema/data migration, user/room changes, browser-profile changes or deployed-secret updates. Restart both local Next and Socket.IO after updating source. An existing explicit server token remains authoritative. Revert the configuration helper, API consumer, socket consumer and client recovery together; configure the former required service variables when reverting. Private temporary credentials can be removed after stopping both local processes; no production secret store is touched. New socket fields are additive; legacy clients ignore them and still fail closed.

## Verification and review

Automated tests cover cross-process key reuse and checkout isolation, private storage/symlink rejection, production/remote denial without configuration, invalid explicit tokens, HTTP status classification, actual loopback API/service authentication, valid vs outsider membership and a real Socket.IO failure-then-rejoin flow. Retry tests cover backoff, exhaustion, duplicate notifications, permanent denial, other-room events and timer cleanup. Existing realtime identity/isolation/revocation tests remain required. Fixture APIs replace PostgreSQL/Clerk in these tests; this does not certify the user's live database or hosted deployment. No milestone completion or independent security sign-off is asserted.

## Development worker refresh follow-up (2026-11-21)

`next dev` refreshes frontend source, while a plain `node socket-server.cjs` keeps its loaded modules until restarted. The app dev launcher now runs the socket service with Node's `--watch --watch-preserve-output`, so editing/pulling its loaded sources restarts that worker too. Installing this launcher change still needs one full app-dev restart. No process on another machine or remote configured socket endpoint is restarted by this source change.

A denial using the older payload with no diagnostic code is now identified as an outdated/incompatible realtime endpoint instead of another generic membership failure. New workers include only an allowlisted failure category and bounded numeric HTTP status in the denial. The frontend translates those into actionable messages; raw exception messages, token values, API response bodies and credentials are never forwarded. Existing private-room denial and fail-closed checks remain in place. Verification covers the legacy denial and safe modern diagnostic formatting alongside existing retry/auth/isolation regressions. This does not claim to have restarted or inspected the user's Mac.
