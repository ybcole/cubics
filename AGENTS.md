# Agent / contributor rules

## UI work: read `docs/BRAND.md` first

Every UI change in this repo, including new pages, components, dialogs and fixes, must follow `docs/BRAND.md`.

- Use the tokens and classes it defines (`bg-canvas`, `text-fg-muted`, `border-line`, `text-body`, `.btn btn-primary`, `.input-base`, `.card`, `<Modal>`…). Tailwind's default palette and size scale are disabled on purpose.
- Do not hand-roll buttons, inputs, cards, menus or modals. Use the classes/components.
- If something is missing, add it to `docs/BRAND.md` first, then `src/app/globals.css` + `tailwind.config.ts`.
- Before finishing: `npm run brand:check && npm run typecheck`.
