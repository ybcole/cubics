# Cubics security — M01 baseline

> **Status: IN PROGRESS.** Product owner has pre-approved the roadmap, but critical security findings remain open. Do not mark M01 [COMPLETED] until required integration tests and scan gates are complete.

| Document | Purpose |
| --- | --- |
| [Threat model](THREAT_MODEL.md) | Trust boundaries, attack scenarios, severity, mitigation owner, negative-test IDs |
| [Runtime inventory](runtime-inventory.json) | Machine-readable API/Socket/IPC permission surface |
| [Permissions](PERMISSIONS.md) | Least-privilege owner/admin/member/browser-host/controller/viewer matrix |
| [Controls](CONTROLS.md) | URL/SSRF, redaction, rate, validation, CORS/CSRF, secrets and release policy |
| [Vulnerability reporting](SECURITY_POLICY.md) | Private disclosure, severity, containment, review |
| [Milestone evidence](../milestones/M01.md) | Actual tests, risk debt and completion status |

## Executable checks

```bash
npm run security:check
npm run security:test
```

GitHub Actions workflow `.github/workflows/security-baseline.yml` installs dependencies, runs inventory and secret guards, runs room-isolation integration tests, produces CycloneDX SBOM and license inventory, and records `npm audit` results. [Baseline CI run 42450506925](https://github.com/ybcole/cubics/actions/runs/42450506925) succeeded with 6/6 security tests, SBOM and license artifacts. The dependency install reported **31 issues (6 moderate, 22 high, 3 critical)** across the installed tree; the `npm audit` step returned nonzero and is **report-only during this baseline**, not a cleared security gate. Current runtime issues remain open. Existing tests are not evidence of valid Clerk auth or database authorization.

## Unresolved criticals at baseline

- D01/T08 privileged `.env` packaged with desktop; M02.
- D02/T01 client-claimed room identity and wildcard CORS; M03/M15.
- D03/T04 Electron sandbox disabled, permissive capture/header handling; M04.
- T06 `/api/embeddable` arbitrary server fetch was **retired (HTTP 410)** in M01; do not reintroduce without safe egress controls.
- T05/T09 media consent and role scope; M04/M18.
- T16 personal vs shared profile isolation E2E; M05/M21.

A successful baseline source scan does **not** mean these risks are fixed. GA remains blocked until all critical risks are mitigated and verified.
