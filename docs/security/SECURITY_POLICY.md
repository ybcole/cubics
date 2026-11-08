# Cubics vulnerability reporting and incident response

**Status:** initial M01 security policy. **Not a guarantee of response-time SLA until operator staffing is recorded in M19/M20.**

## Report privately

Do not post exploit details or secrets in public issues. Prefer the repository's [private vulnerability-reporting / security-advisory workflow](https://github.com/ybcole/cubics/security/advisories) **if enabled**. If unavailable, contact the maintainer through a private repository-owner channel; no email address is invented here. Do not exploit third-party users or access data beyond an authorized proof-of-concept.

## Triage and severity

- **P0/Critical:** leaked production secrets, unauthenticated private-room access, arbitrary native-code execution or large-scale account data exposure. Immediately contain the affected service/release; revoke keys and pause rollout.
- **P1/High:** cross-room data leak, unauthorized control/capture, SSRF to internal infrastructure, update tampering or repeatable profile privacy failure. Restrict attack surface, prioritize emergency patch/rollback.
- **P2/Medium:** limited denial of service or privacy leak requiring significant conditions. Schedule remediation with reproducible tests.
- **P3/Low:** defense-in-depth or non-sensitive disclosure. Track and patch on normal cycle.

A verified incident requires documented owner, repro, affected versions, protection/rollback, key rotation where relevant, regression test and user communication as needed. Preserve minimally necessary forensic evidence with access control, retention and redaction. No secrets or raw browser activity belong in public incidents or analytics.

## Disclosure

Coordinate fixes and downstream notice; avoid promising a universal time-to-fix without team capacity. Record CVE/security advisory where appropriate. Retest after patch and release via signed update, with rollback capability.

## Compliance boundary

No claim of certification (SOC 2, HIPAA, GDPR compliance audit, etc.) is made without appropriate scope, policies, implementation and independent validation.
