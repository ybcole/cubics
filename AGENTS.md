# Agent / contributor rules

## UI work: read `docs/BRAND.md` first

Every UI change in this repo, including new pages, components, dialogs and fixes, must follow `docs/BRAND.md`.

- Use the tokens and classes it defines (`bg-canvas`, `text-fg-muted`, `border-line`, `text-body`, `.btn btn-primary`, `.input-base`, `.card`, `<Modal>`…). Tailwind's default palette and size scale are disabled on purpose.
- Do not hand-roll buttons, inputs, cards, menus or modals. Use the classes/components.
- If something is missing, add it to `docs/BRAND.md` first, then `src/app/globals.css` + `tailwind.config.ts`.
- Before finishing: `npm run brand:check && npm run typecheck`.

## Final-product architecture and milestone governance

Read [master_plan.md](master_plan.md), [master_checklist.md](master_checklist.md), [docs/final-product/README.md](docs/final-product/README.md), and applicable [ADRs](docs/adr/README.md) before implementing a milestone. Preserve the browser continuity, privacy and authoritative-cloud invariants. Treat target contracts as future obligations—not as already implemented behavior.

- Every significant change references a numbered MNN.NN item and has acceptance/negative tests.
- Cross-boundary/security/schema changes require an ADR, migration/rollback plan and named review per [governance](docs/final-product/governance.md).
- Never mark a milestone `[COMPLETED]` without all its tasks, exit checks, evidence and human reviewer sign-off.
- Run `npm run plan:check` for any master plan/checklist/ADR/governance change; preserve checklist task IDs and marker links.
- Do not put privileged cloud secrets or users' browser cookies into client artifacts or shared workspace state.

## Hosting policy and M04 native security

[ADR-0008](docs/adr/0008-free-first-upgrade-path.md) selects Vercel Hobby → Pro before commercial deployment, Supabase Free → Pro PostgreSQL/private Realtime with Clerk JWT RLS, Clerk Free → paid, LiveKit Free → paid. Keep public API/room IDs stable and Socket.IO behind temporary compatibility flags; never broadcast client-authoritative widget edits. Do not apply the proposed RLS migration on the populated Cubics database before staging, backup and security review.

M04 must comply with [Electron's security checklist](https://www.electronjs.org/docs/latest/tutorial/security), including sandbox, context isolation, narrow versioned preload, sender/guest validation, permission prompts, safe popups/external links, separate partitions and packaged fuses. Source tests are not substitutes for hostile-site native macOS/Windows permission E2E.
