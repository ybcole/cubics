# Architecture decisions, scope control and completion evidence

**Version:** 1.0.0 · **Milestone:** M00.06, M00.08, M00.09. This is the final-product change-management policy and remains active after GA.

## Roles / approval authority

- **Product owner:** approves scope, platform support, non-goals, tradeoffs and milestone product acceptance.
- **Engineering owner:** approves interfaces, migration designs, test adequacy and technical exit criteria.
- **Security reviewer:** approves threat model, IPC, backend auth, privacy and release security.
- **Design/accessibility reviewer:** approves user journeys, keyboard/screen-reader and supported-device UX.
- The same human may cover roles on a small team, but identity and date must be recorded. **Do not claim an approval from an automated assistant or an unrecorded user instruction.**

## Change admission (required for any foundational work)

1. Create an issue describing the user problem, affected invariants, reproduction, risk and target milestone ID.
2. Determine whether the change is within accepted contracts (normal implementation) or changes boundaries/invariants (ADR required).
3. Record alternatives, negative consequences, security/privacy implications, compatibility and migration/rollback impact.
4. Specify acceptance tests (unit, permission-negative, real Electron, multiuser, performance/OS where relevant) before coding.
5. Obtain named approval for contract-breaking changes; do not treat prototype success as GA clearance.
6. Ship behind a feature flag when migration risk warrants it; record rollout/revert steps.
7. Update checklist/evidence only after tests and review. No evidence → no completed checkbox.

## ADR lifecycle and format

ADRs in `docs/adr/NNNN-slug.md` have: context, decision, alternatives, consequences, status, version, date, owners, related milestones, supersession, and verification. Status is **Proposed → Accepted as target → Implemented/Verified**, or Rejected/Superseded. **Accepted as target never means shipped.** Edit the ADR index with every new record; never rewrite previously accepted behavior without an explicit superseding ADR.

Changes to stable API/IPC/event/domain contracts require major/minor version policy, client compatibility window, migration strategy, data protection, tests, and release notice.

## Evidence policy for checkboxes

Every checked item in `master_checklist.md` needs a traceable evidence entry by ID in `docs/milestones/MNN.md` and the summary evidence register. Evidence includes at minimum:

- **What** was implemented, **where** (link to PR/commit and file), and the milestone item ID.
- **How verified:** command/test run or recorded manual test, date, OS/environment and result. For security, a negative test; for browser lifecycle, a real Electron test; for GA, real hardware and signed update drill.
- **Who reviewed:** for interim documentary or static-source items, record the automated/manual document validation and explicitly note that human review is pending. For milestone exit criteria, risk acceptance, and final closeout, record a **named human reviewer, approval decision and date**. Never substitute an assistant's output for human authorization.
- **Remaining risks/limitations:** blockers and follow-up milestone IDs.
- Source/static review is evidence **only for documentary or static-source requirements**; do not claim it proves runtime behavior.

A milestone may show checked documentary items with links and successful static validation **before** human milestone sign-off. This is not approval of the product scope or runtime architecture. Runtime/security requirements always need their relevant executable evidence. Human approval is mandatory for the exit/sign-off checks. `[COMPLETED]` is allowed on a master-plan milestone heading **only when all MNN.NN, MNN.E1/E2 and MNN.SIGNOFF items are checked, their evidence exists, and its human owner has approved**. The plan consistency checker enforces this rule.

## Scope / architecture freeze

- Before M24: fix architectural deviations in dependency order, preferably once, with reversible migration.
- At M24: release signature, supported matrix, contracts and ADRs become the **final stable base**.
- After M24: normal bug fixes, security, OS/runtime/vendor support, legal compliance and bounded additive features continue. Architectural breaking changes require **exception ADR, security/compatibility review, tests and approval**, not aesthetic experimentation.
- The freeze is **against avoidable repeated refactoring**, not against maintenance or unavoidable security upgrades.

## Standard review template

```text
Milestone ID:
Issue / acceptance:
Invariant(s) protected:
Design / ADR:
Implementation PR/commit:
Test / audit / performance evidence:
Supported platform(s):
Security and privacy impact:
Migration and rollback:
Known risks:
Product owner and date:
Engineering reviewer and date:
Security / accessibility reviewer if required:
Status: Pending | Approved | Rejected
```
