# Personal / Live / Shared — normative mode contracts

**Version:** 1.0.0 (target) · **Milestone:** M00.03 · **Implementation:** M03–M09 and M17–M18.

Mode must be visible to users at creation and throughout an active tab. One stable tab ID, workspace ID, browser profile ID (local), owner/host generation (if any), and mode must not depend on how its React widget happens to render.

| Property | Personal | Live | Shared |
| --- | --- | --- | --- |
| Actual browser | User's local native browser session | Host's local session | Designated host's local session |
| Browser profile | Persistent user-owned account-scoped Electron partition, local to device | Existing persistent per-account/widget host partition; explicit Go live | Temporary **in-memory**, per-account/widget collaborative partition, never Personal/Live cookies |
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

## M05 privacy hardening: peer-visible metadata contract (2026-11-14)

For legacy `iframe`/Personal widgets, a non-owner may receive only the stable widget ID, room ID, geometry, type and an opaque owner reference; the title becomes `Private tab` and URL becomes `about:blank`. A missing legacy owner is private to **all** viewers until ownership is safely resolved. This rule is enforced by `/api/spaces/[id]/widgets` and must also apply to all future API versions. The owner can use their saved full URL through the authenticated API; **this remains migration debt** because the existing PostgreSQL widget record still stores it. Long term, private navigation tokens should live in a device-local protected browser/profile vault, not a synced room record.

Socket.IO peers now receive widget-add IDs and bounded geometry or metadata-change hints, **never peer-supplied title or URL strings**. Recipients re-fetch redacted records through authenticated HTTP. Live/Shared media still requires consent and server-authorized roles; these changes do not imply complete media/control security or profile export/clear implementation. See `docs/milestones/M05.md` for tests and outstanding work.

## M05 local browser data controls (2026-11-14)

The existing Personal partition uses `persist:cubics-personal-<account>` within the device-local Cubics Electron `userData`. Live retains `persist:cubics-tab-<account>-<widget>` for compatibility. Shared now uses a distinct `cubics-shared-<account>-<widget>` partition **without persistence**. This is an intentional privacy-first break from any legacy Shared-tab cookie jar. No browser profile credentials may be synced to Supabase or Vercel or included in LiveKit/Socket.IO events.

A native-confirmed **Clear local browsing data** control is available in Personal and Shared UI. It erases the selected Chromium session (cookies/cache/site storage), destroys any active guest attached to that session, and remounts browser widgets after a completion event. Personal clearing affects **all** Personal tabs for that account on this device. The current Clerk login (separate default session), server-held widgets, account profile, downloads saved to the filesystem, and other account/mode partitions are not wiped. Signed-out users cannot perform these privileged clears until their identity is verified. Data export and complete device/profile deletion are future M05 work; clearing browsing data is not an account deletion feature.

**2026-11-14 native fixture evidence:** [three-platform success](https://github.com/ybcole/cubics/actions/runs/43536801635) verifies distinct Personal, Live, Shared cookie jars and scoped Shared cookie deletion. A real Clerk sign-in, OS restart and non-cookie browser-data qualification are still required before full M05 sign-off.

**Non-owner widget metadata:** Personal exposes no title or site URL; Live exposes a generic title and no URL; Shared exposes a generic title and optionally the public site origin only, never paths, queries or fragments. The v1 workspace summary always uses origin-only `safeUrl`. Only authenticated owners may retrieve their full existing URL through the legacy widget API; this remains transitional until private navigation can move to device-local storage.

**Stable local BrowserProfile IDs:** Electron computes an opaque `bp1_...` ID per installed device/verified account/mode/widget from a local non-secret device marker. The ID is for local support and ownership tracking only, not authentication. It deliberately excludes workspace and is never emitted to realtime, cloud database or other room users. A Personal tab can export a safe *profile metadata* JSON through a native file dialog, which excludes all browsing contents. This is not a transfer of cookies or browser state to another device.

**Deprecated URL relay:** `sb:nav` is intentionally no longer broadcast over Socket.IO. It previously disclosed full URLs to participants independently of the consented media session. No viewer may infer a host's private URL tokens from signalling events.

**Verified two-process Electron storage evidence (2026-11-14):** [Linux/macOS/Windows successful CI](https://github.com/ybcole/cubics/actions/runs/43539188769) confirms a stable device-bound opaque profile ID and actual cross-process persistent Personal/Live cookie separation from temporary Shared cookies. This does not cover every browser data class or real Clerk two-account login.

**M05.02 full storage test (2026-11-14):** [Linux/macOS/Windows CI PASS](https://github.com/ybcole/cubics/actions/runs/43540659588) confirms real Chromium cookies, localStorage, IndexedDB, CacheStorage and Service Workers in distinct per-mode/account sessions across a real process restart. Shared stays temporary. Back/forward navigation history belongs to a WebContents/tab, not a durable profile-wide database.

## Live/Shared media authorization boundary (2026-11-14)

Legacy Socket.IO mode requests are checked against verified PostgreSQL room membership, widget owner and persisted widget type. Only the Live creator may start their own Live tab; an authorized member may opt in to a Shared host session. Shared controller input requires active host/watch state, is bounded to mouse/keyboard primitives and may never control a Live tab. Host Stop revokes previous watcher signaling and unpublishes the host's track. A normal LiveKit viewer connection has **subscribe-only grants**; a distinct short-lived publisher connection is issued after verifying the specific widget, and viewers match the server-minted widget publisher identity rather than trusting arbitrary track names. This is not a blanket permission for any room member to publish Live content.

**Release gate:** These controls still do not forcibly disconnect existing LiveKit viewers after membership removal. LiveKit room-service revocation, recovery/retry on provider errors and a production two-account acceptance suite are required before claiming media-level privacy or closing M05.05.

**Historical metadata risk:** Existing PostgreSQL Widget records may contain full Personal/Live navigation URLs and custom titles. The server redacts them to other room members but that is not yet local-only storage. `npm run security:browser-metadata-audit` provides an aggregate, redacted **read-only** count; do not delete originals until an OS-protected local navigation migration is successfully verified.

**Personal navigation vault implementation:** New Personal tab destinations are encrypted device-locally using Electron async safeStorage before use. Server-side Personal iframe creation accepts only a generic title and `about:blank`; PATCH refuses new private URLs. The existing owner-only historical URL may be imported to the local vault after validation and read-after-write verification. No historical cloud URL is automatically removed yet. If OS-protected encryption is unavailable (including Linux basic_text) Cubics fails closed rather than persisting plaintext; browser-only clients cannot create local Personal tabs.

**Native encrypted-vault acceptance (partial, 2026-11-14):** [Linux/macOS/Windows successful run](https://github.com/ybcole/cubics/actions/runs/43551806678) verified local URL import and encrypted restart persistence when OS keychain is available, and fail-closed behavior when it is not. Clearing Chromium cookies/site data is a **different operation** from deleting saved encrypted destinations; complete vault deletion/export remains M05.06. No historical cloud or backup scrub is claimed.
