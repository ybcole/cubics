# LiveKit webhook setup and media revocation (M05)

**Status: Implemented in source, provider configuration and real-account acceptance pending.** Applies to free-first LiveKit Cloud Build and self-hosted LiveKit. This guide is not proof of a deployed environment.

## 1. Keep secrets on the server

Set `LIVEKIT_URL` (client WebSocket URL, normally `wss://...` or local `ws://...`), `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in the hosted Next.js server's protected environment. Never prefix the key or secret with `NEXT_PUBLIC_`, bundle them in Electron, commit them to GitHub or expose them through logs. Cubics derives per-workspace anonymous user tags from the server's signing secret.

For administration, Cubics converts `wss` → `https` and `ws` → `http` and uses `RoomServiceClient` to list and evict participants. A correctly provisioned service credential needs the LiveKit administrative room privileges for listing/removing participants (and room deletion for legacy connection reset).

## 2. Configure the signed webhook in LiveKit

After the Next.js API has been deployed at an **actual public HTTPS domain**, configure the URL:

```text
https://YOUR_ACTUAL_HOST/api/livekit/webhook
```

For **LiveKit Cloud**, open your LiveKit project Settings → Webhooks → Create new webhook. Choose the API key that matches the protected `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` supplied to Cubics, and use the HTTPS endpoint above. Test delivery with LiveKit's dashboard. Do not paste secrets into URLs or chat.

For **self-hosted LiveKit**, add the signing API key and endpoint in the server configuration, replacing the placeholder domain:

```yaml
webhook:
  api_key: your-signing-api-key-name
  urls:
    - https://YOUR_ACTUAL_HOST/api/livekit/webhook
```

This config lives on the LiveKit server; it must not be confused with Vercel Next.js environment variables.

## 3. What the server enforces

- The token endpoint authenticates the Clerk account and PostgreSQL room membership. Regular viewers get subscribe-only grants. A publishing token also requires the correct Live/Shared widget type and creator/host authorization.
- LiveKit participant identities use a workspace-scoped server-derived HMAC tag, not raw Clerk user IDs. A room member removal calls `removeParticipant` for that tag's active sessions; a legacy untagged session triggers a room reset to prevent untraceable access.
- The webhook validates LiveKit's signed JWT and SHA-256 signature of the **raw body**. On `participant_joined`, it rechecks current room membership and publisher widget rights before deciding whether to evict.
- Room deletion requests termination of the corresponding LiveKit media room. Database membership deletion is never reported as fully revoked after an unacknowledged admin error.

## 4. Acceptance checks before real-user release

Use two different real Clerk accounts (owner and member), a LiveKit test project, and an isolated Supabase staging database. Validate permitted viewer playback, Live host creator-only publishing, Shared host explicit consent, rejected cross-room tokens, a removed participant's forced disconnect, old-token rejoin after removal, role changes, widget deletion, provider outages, webhook invalid signatures/replays, and owner/media continuity. Retest on Linux, macOS and Windows Electron builds.

**Known limitation:** Webhooks are asynchronous and can be lost or delayed; a revoked self-hosted participant may reconnect with a previously issued token before the webhook removes it. A five-minute token TTL is a ceiling for initial join issuance, not a guarantee of immediate disconnect; refreshed tokens may complicate the window. LiveKit Cloud provides its own token-revocation semantics, whereas self-hosted LiveKit does not. Durable provider-retry/outbox reconciliation and real operator acceptance remain release requirements.

## 5. Other privacy migration

Run `npm run security:browser-metadata-audit` from an authorized backend checkout with `DATABASE_URL` for aggregate-only counts of legacy full URLs/titles in PostgreSQL. It never edits records or prints the values. Do not run destructive scrubbing until encrypted local browser navigation persistence and recovery are implemented and tested.

**Evidence:** [M05 milestone](../milestones/M05.md) · [LiveKit webhook reference](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/) · [LiveKit token lifecycle](https://docs.livekit.io/frontends/reference/tokens-grants/).
