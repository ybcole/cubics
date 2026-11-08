# Final-product contract — index

**Status:** proposed baseline for engineering; owner acceptance for M00.01/M00.E1 is pending. **Target version:** 1.0.0. This is not a declaration that the features have shipped.

Use the [master plan](../../master_plan.md) for scope and numbering, [master checklist](../../master_checklist.md) for actual completion, and the documents below for product and technical execution.

| Contract | Canonical reference | Implemented by |
| --- | --- | --- |
| Product, platform and user outcomes | [product-scope.md](product-scope.md) | M00, M12, M21–M24 |
| Browser modes, privacy, capture and audio | [browser-modes.md](browser-modes.md) | M03–M09, M17–M18 |
| Runtime, event and persistence contracts | [system-contracts.md](system-contracts.md) | M02, M06, M10–M15, M17 |
| [Free-first hosting](free-first-hosting.md) | [ADR-0008](../adr/0008-free-first-upgrade-path.md) | M02–M04, M13–M19 |
| Platform / dependency / support matrix | [support-matrix.md](support-matrix.md) | M00, M04, M19, M21–M22 |
| Accessibility and interaction standard | [accessibility.md](accessibility.md) | M10–M12, M21 |
| Current-to-target deviation inventory | [current-deviations.md](current-deviations.md) | M01–M23 |
| Dependency-ordered migration map | [migration-map.md](migration-map.md) | M00, M02, M07, M13, M23 |
| Changes, ADRs and evidence requirements | [governance.md](governance.md) | M00–M24 |
| Versioned architecture decisions | [../adr/README.md](../adr/README.md) | M00 onward |
| Initial milestone evidence | [../milestones/M00.md](../milestones/M00.md) | M00 |

## Normative language and precedence

**MUST** = release-blocking requirement; **SHOULD** = preferred implementation with documented reason to deviate; **MAY** = optional. The master plan fixes release scope and major boundaries; accepted ADRs describe the target architecture; these files refine testable contracts. Existing code may temporarily violate target requirements until its milestone is completed. No file should claim a migration already happened unless the repository and tests prove it.

Priority in conflict: security/legal requirements > master plan product guarantees > accepted ADRs > these contracts > UI design tokens. Resolve actual conflicts with a new ADR, tests and review; do not change contracts silently.
