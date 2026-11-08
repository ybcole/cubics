# M01 least-privilege access matrix

**Status:** desired end-state authorization semantics. Current backend/socket implementation is **not** yet aligned; see [threat model](THREAT_MODEL.md).

**Roles:** O=workspace owner; A=delegated admin (future typed role); M=member; P=Personal browser owner; H=Live/Shared host; C=controller holding valid generation-fenced Shared lease; V=authorized viewer. Multiple roles can apply. Permissions are always verified server-side, not inferred from the client.

| Action/resource | O | A | M | P | H | C | V | Required condition |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | --- |
| View own workspace geometry | ✓ | ✓ | ✓ | — | — | — | — | Valid workspace membership |
| Create/move own permitted widgets | ✓ | ✓ | ✓ | — | — | — | — | Server-approved member + revision |
| Delete any member's widget | ✓ | ✓ | Restricted | — | — | — | — | Role + widget ownership policy |
| Rename/delete workspace | ✓ | Restricted | — | — | — | — | — | Owner/admin scope; destructive confirmation |
| Invite/remove members | ✓ | Restricted | — | — | — | — | — | Server role, revocation |
| Read Personal tab pixels/cookies/history | — | — | — | ✓ | — | — | — | **Local profile owner only**; owner role never overrides browsing privacy |
| Navigate Personal tab | — | — | — | ✓ | — | — | — | Same native owner/profile |
| Start/stop Live capture | — | — | — | — | ✓ | — | — | Explicit consent and capture authorization |
| Watch active Live/Shared media | — | — | — | — | ✓ | — | ✓ | Authorized viewer, current host and media grants |
| Navigate Shared hosted browser | — | — | — | — | ✓ | ✓ | — | Valid controller lease or explicit host override |
| Read/transfer host cookies | — | — | — | — | — | — | — | **Never over collaboration protocol** |
| Grant/revoke Shared controller | — | — | — | — | ✓ | — | — | Host + server policy |
| Join/leave voice chat | ✓ | ✓ | ✓ | — | — | — | — | Verified workspace member and audio consent |
| Read workspace chat | ✓ | ✓ | ✓ | — | — | — | — | Verified member; retention policy |
| Issue LiveKit media token | — | — | — | — | — | — | — | Hosted service only, role/room-scoped |
| Get screenshots or native media source ID | — | — | — | — | ✓ | — | — | Explicit app permission + validated sender/window/tab |
| Manage own Cubics account/session | — | — | — | ✓ | — | — | — | Verified identity and device/profile binding |

A check mark is conditional on verified identity and room membership; it does **not** grant unrelated private browsing access. '-' is denial by default. Admin and controller states must be explicit, not inferred from client display names.

## Enforcement points

1. HTTPS API: validated Clerk token, workspace/member role, per-object ownership, transaction and version checks.
2. Socket.IO: token verified at handshake, membership confirmed at `room:join` and each sensitive event, authenticated event schema, per-room bounded input, no cross-room peer forwards.
3. Electron IPC: permissioned authenticated renderer, sender/guest `webContents` ID and session generation match, OS capture authorization; reject unknown channels.
4. LiveKit token endpoint: workspace membership, host/viewer role, minimally necessary grant and expiration.
5. Local profile operations: user/device identity and profile owner; no background or shared copy of cookies.

## Current gaps

- Socket.IO now derives identity from verified Clerk JWTs and validates room membership against PostgreSQL. **Remaining gap:** action-specific member/owner roles, strong per-widget ownership, controller leases and multi-node revocation require M03/M15/M17.
- Existing widget API allows broad member writes and needs object/ownership rules (T02).
- Shared control signals still need exclusive leases (T14).
- Personal tab profile isolation must be proved with two real accounts (T16).

**Risk acceptance:** Users' blanket product approval does not waive the requirement for actual authorization and negative security tests.
