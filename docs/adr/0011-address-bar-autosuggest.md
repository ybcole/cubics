# ADR-0011: Address-bar autosuggest through the Electron main process

- **Status:** Implemented in source; live-provider and native acceptance pending
- **Decision version:** 1.0.0
- **Date:** 2026-11-21
- **Owner:** Cubics engineering
- **Related milestones:** M05.08, M04.04
- **Issue:** None; direct product instruction from the project owner in chat (identity not independently verified), 2026-11-21.
- **Supersedes:** None; refines ADR-0004 browsing privacy boundaries.

## Context

The Personal/Live/Shared Safari-style address field only accepted a URL and had no suggestions. Calling public suggest endpoints directly from the renderer would expose a CORS-dependent path and spread outbound policy across UI code. The address bar also holds private destinations, so suggestion traffic must not include complete typed URLs, browser cookies or account identity.

## Decision

1. The renderer debounces address input for 200ms and invokes a single narrow IPC method, `cubics:suggest`. It does not fetch suggestion providers itself.
2. Electron main validates the caller with the existing trusted-renderer boundary, bounds the query to 2–200 characters, rejects control characters and requests only fixed HTTPS endpoints: Google Suggest (`client=firefox`), then DuckDuckGo's `/ac/` endpoint as a silent failover when Google fails or returns no phrases.
3. Main performs the request without cookies, credentials or identity (`credentials: "omit"`, `redirect: "error"`, bounded timeout). There is no renderer-supplied endpoint, header, body or redirect target.
4. Query text that looks like a URL or hostname stays local and is never sent to a provider. Only search-shaped text reaches Google/DuckDuckGo.
5. Results combine, in order: matching open guest tabs (authoritative URL and title), bounded in-memory navigation history for the same Cubics window, then remote search phrases. URLs are restricted to HTTP(S) without credentials; labels are bounded and deduplicated; at most eight rows are returned.
6. Open-tab rows navigate to the guest URL, history rows navigate to the recorded URL, and search rows (also non-URL Enter text) open a Google results page. Arrow keys move, Enter accepts and Escape dismisses.
7. History and open-tab metadata stay in RAM only, scoped by the owning window. They are not written to disk, cloud, room state or analytics, and are cleared when the tab or window closes. Queries are not logged by this feature.

## Alternatives and consequences

Direct renderer fetches were rejected (CORS, scattered policy). A hosted server proxy was rejected because it would leak every partial query through the cloud backend. Persisting a cross-room history was rejected for privacy. A universal provider list or arbitrary proxy is out of scope. Residual behavior: search-shaped text is intentionally shared with Google or DuckDuckGo to provide suggestions; users who type a URL or hostname do not trigger that request. Provider availability and regional blocking degrade to local suggestions; failures are silent.

## Migration and rollback

No schema, data, profile-partition or IPC-version migration. The preload method and IPC handler are additive. Revert `electron/search-suggestions.cjs`, the main/preload/type wiring, the Safari tab-bar suggestion UI and related tests/docs together; no persisted state must be cleaned up. Stop/restart the desktop app after changing main-process files.

## Verification and review

`scripts/security/search-suggestions.test.cjs` covers both provider shapes, query bounds and control-character rejection, fixed/encoded endpoints, cookie-free options, Google-first ordering, DuckDuckGo failover on error or empty results, local-first combination, URL-shaped privacy stop, deduplication and bounded output. Native live-provider acceptance, CORS-free confirmation inside the packaged app and named independent security review remain pending; this record makes no universal provider or release claim.
