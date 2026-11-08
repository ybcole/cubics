# packages/canvas

**Target responsibility:** Pure camera math, spatial index and pointer/keyboard arbitration.

**Current code remains at:** `src/app/spaces/[id]/page.tsx (temporary)`. This folder is a **documented ownership boundary**, not proof the migration has happened. The legacy code stays running until the replacement passes tests and is rolled out behind flags.

**Owning milestones:** M10–M11. **Interfaces:** [system contracts](../../docs/final-product/system-contracts.md). **Migration:** [M02 staging and rollback](../../docs/milestones/M02.md).

Rules: do not duplicate production implementations under old and new paths indefinitely; do not import server-only database or secret modules into renderer or shared UI packages. Use typed versioned boundaries, explicit authorization and compatibility tests before deleting a legacy path.
