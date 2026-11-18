# ADR-0009: Account-scoped guest popup windows

- **Status:** Proposed; security review and native cross-platform acceptance pending
- **Decision version:** 1.0.0
- **Date recorded:** 2026-11-18
- **Owner:** Cubics engineering; named security reviewer pending
- **Related milestones:** M04.04, M05.08, M07.07, M21.04
- **Issue:** [#6](https://github.com/ybcole/cubics/issues/6)
- **Supersedes:** None

## Context

The app's `<webview>` elements lack `allowpopups`. Chromium denies `window.open` before the main-process handler can approve a child, breaking OAuth flows that require `window.opener`. Existing URL checks also use the shell's 2048-character limit for guest navigation. Google separately prohibits OAuth inside embedded browser frameworks; a functioning popup does not override that provider policy.

## Decision

Permit popups only on main-issued, account-scoped guest partitions. The main process validates every requested URL and disposition, creates approved child windows in the exact parent session with sandbox, context isolation, disabled Node/webview/preload, blocks nested popups and unsafe navigation, and closes children when the parent guest is destroyed. Preserve the stricter URL limit and confirmation for external shell launches; allow bounded, longer HTTPS guest redirect URLs. Preserve Electron's actual browser identity.

## Alternatives and consequences

Keeping popups disabled breaks many opener-based site flows. Opening OAuth in a new unrelated Cubics tab breaks the opener and cookie handoff. A system-browser handoff requires provider/site cooperation and cannot generically import third-party sessions. Migrating all tabs to native browser surfaces is tracked under M07, with its own parity and rollback gates.

Enabling the webview attribute increases the need for main-process validation. A site's popup may still fail because of third-party cookies, browser compatibility, provider policy, or site-specific logic. Google sign-in in embedded Cubics tabs is not an accepted capability; use the site's supported browser until a provider-supported handoff exists.

## Migration, rollback and verification

No schema or profile migration. Existing sessions remain in their partitions. Revert the popup-enablement change to restore the prior denial behavior without clearing profile data. Unit tests cover issued partitions, unsafe/long URLs and security options. Native tests exercise opener messaging and cookie isolation. Real Claude/Google sign-in, macOS/Windows behavior, hostile-site tests, and named security review remain open before this decision can be accepted or marked verified.
