# Personal / Live / Shared — normative mode contracts

**Version:** 1.0.0 (target) · **Milestone:** M00.03 · **Implementation:** M03–M09 and M17–M18.

Mode must be visible to users at creation and throughout an active tab. One stable tab ID, workspace ID, browser profile ID (local), owner/host generation (if any), and mode must not depend on how its React widget happens to render.

| Property | Personal | Live | Shared |
| --- | --- | --- | --- |
| Actual browser | User's local native browser session | Host's local session | Designated host's local session |
| Browser profile | User-owned, isolated per Cubics identity/device | Explicit sharing of a host-owned session/profile | Distinct collaborative profile; **never silent reuse of Personal profile** |
| Who sees page pixels? | Owner only | Authorized viewers after host consent | Authorized room participants while hosted |
| Who can click/type? | Owner only | Host only by default | One authorized controller holding a time-limited exclusive lease |
| Cookies/credentials broadcast? | Never | Never (only media pixels/audio by permission) | Never; interactive state stays on host |
| Audio | User's local browser audio | Host chooses allowed audio capture and viewer controls | Explicit host/player audio policy |
| Capture | None by default | Explicit start/stop and authorization | Explicit start/stop and authorization |
| Offscreen behavior | Keep live native session; optional safe throttling | Keep host page; offscreen viewers may unsubscribe | Keep host page; offscreen viewers may unsubscribe |
| Host disconnect | Owner is local; report local failure | Viewer sees disconnected, not an implied new host | Controller lease revoked; clear host-loss state and deliberate recovery |
| Space deletion/tab close | Explicit destroy/cleanup with policy | Terminate capture and leases, then clean up | Terminate capture/control and clean collaborative profile resources |

## Control and session state machines

Browser resource: `UNINITIALIZED → WARMING → ACTIVE ↔ BACKGROUND ↔ SUSPENDED → CLOSED`, with `CRASHED → RECOVERING → ACTIVE|CLOSED` where technically possible. **Visibility** alone must never transition to `CLOSED`. Suspend is allowed only when it does not corrupt audio, active authentication, host capture or shared control. Keep state transitions typed, auditable and generation-fenced.

Live/Shared hosting: `OFFLINE → REQUESTED → HOSTING → DEGRADED|DISCONNECTED → OFFLINE|RECOVERING`. Each host needs a server-authenticated lease, heartbeat, expiry and unique generation. Stale host generations must not publish/input/control a new host.

Shared control: `NONE → REQUESTED → GRANTED(controllerId,expiresAt,generation) → RELEASED|EXPIRED|REVOKED`. One controller at a time. Host can revoke or stop. Input is validated/rate-limited and carries workspace/tab/session generation. Clipboard, file uploads, clipboard write, credential dialogs and privileged actions need separate host approval rather than blindly forwarding remote commands.

## Privacy and sharing consent

- Personal tab metadata seen by teammates is limited to an explicitly approved safe subset; private page titles/URLs may contain tokens or sensitive information and must be redacted or hidden.
- Sharing UI MUST show active indicator, audience, control owner, audio policy and an immediate stop/revoke button.
- Local browser cookies, localStorage/IndexedDB, extension data, profile files and auth tokens MUST NOT be copied to cloud records, Socket.IO, LiveKit metadata or logs.
- Viewers MUST lose access promptly after membership or media-permission revocation. Do not use client-supplied user IDs as proof of authorization.
- For shared browsing, host should use a separate profile or explicit account-free environment; sharing a personal authenticated profile is a separate, explicit and auditable user decision, if offered at all.
- Session migration between computers is **not** guaranteed; recover from safe metadata and consent instead. DRM sites may reject capture or restrict playback.

## Test cases required by M17/M18

1. Personal Twitch tab survives pan-away, zoom, rail hide/reveal, and component shell replacement during a healthy session.
2. Another room member receives geometry but cannot inspect personal pixels or browsing cookies without consent.
3. Live host can share, see audience, stop, revoke and keep desired background audio even when viewers pan away.
4. Shared host grants exactly one controller; simultaneous requests and stale input are rejected.
5. Room membership loss revokes view/capture/input immediately; reconnect does not resurrect stale leases.
6. Host crash displays truthful state and allows deliberate recovery rather than silent transfer of a live authenticated session.
