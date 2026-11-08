# M01 security controls and validation contracts

**Status:** normative policy baseline; not a statement of current enforcement.

## URL and protocol handling — T06, T07

- Accept only `https:` for hosted remote fetches by default; `http:` for local development only with explicit allowlist. Reject `file:`, `data:`, `javascript:`, `ftp:`, `chrome:`, `devtools:`, `about:`, credentials in URL, malformed IPv4/IPv6, non-allowlisted ports, Unicode host confusion and unexpected redirects.
- **Server-side remote URL probe:** avoid arbitrary remote fetching. If retained, restrict to explicit approved domains through an outbound proxy with DNS pinning, rebinding defense, limits on redirect count/body/timeout/size/ports, and block loopback/private/link-local/cloud metadata addresses on *every* redirect. Normal hostname validation alone does not prevent DNS rebinding. the legacy `/api/embeddable` endpoint is retired with HTTP 410 in M01 instead of attempting incomplete DNS filters. Reintroducing any remote fetch requires proxy/pinning and adversarial tests.
- **Native navigation:** validate scheme, canonical URL and destination origin; external schemes require explicit user consent and an OS-safe handler. Only trusted app/Clerk OAuth contexts may redirect the app shell; all external browser content stays isolated.
- **Downloads, popups, capture:** user-driven decision, bounded file sizes, safe destination, permission prompt, no automatic execution and revocable grants.

## Identity, input validation and authorization — T01, T02, T09, T11

- All API/write/socket operations validate token signature, issuer, audience, expiry, actor, workspace membership, role and object ownership. Never trust `payload.userId`, hostName or socket room string as identity proof.
- Define schemas for every API method and Socket.IO event: type, required fields, length/size, range, allowed enum, generated IDs, room-scoped authorization, and safe error shapes. Do not forward arbitrary remote keyboard/clipboard/file events.
- Enforce maximum JSON size, rate limits per user/device/IP/room, and bounded queue and memory for chat, cursors, uploads, signing and stream tokens.
- Validate socket target peer is in same *authorized* workspace, and the sender has current controller/host generation for privileged actions.
- Keep abusive login/invite attempts rate-limited and audit role changes. Escalation path needs a stored audit trail.

## CORS, CSRF, cookies and transport — T01, T12

- Production Socket.IO CORS origins must be explicit configured app/HTTPS origins; reject credentialed connections from unknown origins. The previous wildcard CORS has been replaced with exact configured origins and a WebSocket `allowRequest` Origin check. The Clerk JWT and PostgreSQL membership check is implemented, but deployment needs properly configured allowed origins and role-specific authorization.
- Use HTTPS/WSS in production with short-lived authenticated connections. Never expose realtime auth credentials in URL query strings, logs or third-party analytics.
- For cookie-authenticated mutating routes apply CSRF protection or strict same-site + origin checks with server verification. Reject unsupported content types; do not assume CORS blocks all CSRF.
- Recheck membership at each privileged operation, not only handshake, so revocation actually works.

## Redaction, storage, classification — T08, T10, T16, T18

- Credentials: cloud secrets in managed server secret store only; browser cookies and saved authenticated web state in local Chromium profile; OS keychain for device-held credentials.
- Never log full third-party URLs containing query parameters, cookies, tokens, form contents, headers, raw webpage DOM or captured frames.
- Logging allowlist: event ID, hashed/opaque workspace/tab identifier, protocol version, anonymized runtime status, permission outcome, coarse latency, limited error code. Sensitive-value replacements must be tested with canary tokens.
- Do not upload personal profile or cookies to shared cloud snapshots, chat, support bundles or telemetry.
- Capture starts only on explicit user action with user-visible indicator, viewer count, immediate stop and revocation.

## Dependency, release and incident security — T15

- Inventory production dependencies, transitive licenses, SBOM, advisories and release artifact signatures. Security CI now **fails on high/critical production npm advisories**, while license/SBOM and secret scanning remain required steps. Development dependency findings still require triage; an independently scanned signed desktop artifact is a separate M02/M22 gate.
- Scan changed tracked files for committed credentials. Rotate and revoke any leaked secret **before** merely deleting a value from Git.
- Use pinned lockfile and supported Electron/Chromium/Next.js versions; never bundle backend secrets.
- Apply signed/notarized installers, secure auto-updates, rollback and protected branch policy before GA.

## Operational policy checks (current M01)

`npm run security:check` verifies API/Socket/IPC inventory parity and scans tracked text sources for common committed secrets; known legacy risks are printed as warnings, **not suppressed facts**. `npm run security:test` runs current joined-room helper and real Socket.IO cross-room leak tests. GitHub Actions runs SBOM, license inventory, and vulnerability audit; CI results must be inspected. Current tests **do** cover real socket handshake rejection, forged user IDs, private-room join denial, authenticated packet scoping, and RS256 signature verification with locally generated keys. They **do not** prove a deployed Clerk + PostgreSQL environment, object-specific ownership/host privileges, complete CSRF protection, DNS rebinding safety in any future proxy, or Electron sandboxing. Those remain assigned milestones.

### Electron account/browser partition boundary (M04)

`electron/main.js` obtains the verified current Clerk user from the cookie-bound `/v1/identity` API using `session.defaultSession.fetch` and rejects a mismatch with the account expected by the UI. `partitionForVerifiedAccount` preserves existing `persist:cubics-*` storage naming but the main process issues/allowlists each permitted partition; the renderer cannot choose another account’s cookie jar. On account changes old guests and native permission grants are revoked, not deleted from disk. Native IPC, guest attach, download and capture paths check ownership. An identity endpoint failure denies issuance. Real Clerk session-cookie interoperability and OS-level account switch are pending staging tests; the native fixture uses an isolated mock HTTP server, not actual Clerk.
