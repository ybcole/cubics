# ADR-0009: Native guest authentication inside Cubics

- **Status:** Implemented in source; native and live-provider verification pending
- **Decision version:** 1.0.0
- **Date recorded:** 2026-11-21
- **Owner:** Cubics engineering
- **Product direction:** Project owner (explicit user instruction in chat; identity not independently verified), 2026-11-21: authentication must remain inside Cubics.
- **Related milestones:** M04.04, M04.06, M05.08
- **Issue:** https://github.com/ybcole/cubics/issues/9
- **Supersedes:** None; refines native popup handling within existing browser boundaries.

## Context

Guest logins previously accepted only `new-window` requests with HTTPS URLs. Blank bootstrap windows, different Chromium dispositions, nested authentication windows and long OAuth state URLs could be blocked. Child windows were not explicitly registered for account revocation. This code snapshot has no external-browser companion bridge; prior proposals do not describe implemented main-branch behavior.

## Decision and implementation plan

1. Use Electron's `setWindowOpenHandler` / `createWindow(options)` to return the child WebContents directly. Preserve native opener, named-window reuse, referrer, POST bodies and callback navigation. Do not cancel and replay the URL.
2. Explicitly pin every child to the root tab's actual Session. No cookie transfer, account credential handling, collaboration payloads or guest preload.
3. Accept blank bootstraps and authentication routes across dispositions; preserve canvas confirmation for ordinary tab links. Keep HTTPS navigation checks (development loopback HTTP only), sandbox and context isolation. Allow up to six concurrent windows and three popup generations per root. Browser URLs allow bounded 16 KiB OAuth URLs; shell links retain their 2 KiB limit.
4. Destroy descendants when their opener closes and close all registered chains before account revocation. Keep persistent profiles intact.
5. Exercise real webview popup creation without `allowpopups`, named reuse, cross-origin redirect, callback `postMessage`/`window.close`, form-target POST, nested windows, profile isolation and account-switch cleanup in the native OS matrix. Package every native helper.
6. Separately validate Claude and Google with a real account and signed target builds. Fixture success does not establish provider acceptance.

## Provider restriction and remaining architecture decision

Google's [OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies) prohibit authorization in embedded user agents controlled by the developer. [Google's desktop guidance](https://developers.google.com/identity/protocols/oauth2/native-app) documents `disallowed_useragent`. Electron popup fixes cannot override that restriction. No universal Google/Claude compatibility claim is made.

If Google rejects the browser itself, an in-Cubics solution requires evaluating a full browser product/runtime (for example a Chromium browser fork with Cubics as its own browser UI), its distribution/update/security responsibilities and actual provider acceptance. Replacing webview with WebContentsView alone does not establish compatibility. This is a separate substantial migration, not a hidden fallback. An external Chrome window/extension, system-browser handoff or cookie import violates this request's constraint and is not used. A browser fork also cannot guarantee acceptance before live testing.

## Alternatives and consequences

Cancel-and-reopen loses native OAuth context; broad `allowpopups` gives guests unrestricted window creation; disabling sandbox or stripping COOP/CSP changes security guarantees; UA spoofing does not establish Google policy compliance. These are rejected. Native login windows remain Cubics-owned child windows, not browser canvas widgets. Resource limits can reject unusually deep or wide login chains. Site `noopener` or COOP isolation remains authoritative; no fake opener is injected.

## Migration, rollback and review

No schema, IPC or profile-name migration. Existing cookies remain in the same partition. Revert the manager, main-process wiring and packaging/test additions together to restore prior behavior. Do not erase profiles. Engineering review consists of automated source tests; named human security review and live-provider acceptance remain pending. No milestone sign-off or release certification is asserted.

## Verification

See [M04 evidence](../milestones/M04.md). Local native execution is blocked by the execution host's `socket() failed: Operation not permitted` restriction; it is not counted as a passing test. The existing three-OS native workflow includes the new fixture.
