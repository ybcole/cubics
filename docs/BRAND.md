# Cubics Brand: Master Sheet

**This file is the single source of truth for Cubics UI.** Every screen, component, and future feature must be built from what is defined here. If something you need is missing, add it here first, then to the tokens, then use it.

| Layer | File | Role |
|-------|------|------|
| Rules (this file) | `docs/BRAND.md` | What the brand is and why |
| Tokens | `src/app/globals.css` (`:root`) and `tailwind.config.ts` | CSS variables and Tailwind names |
| Components (CSS) | `src/app/globals.css` (`@layer components`) | `.btn-*`, `.input-base`, `.card`, `.menu`, `.modal*` |
| Components (React) | `src/components/ui/` | `Modal` (more are added here) |
| Enforcement | `npm run brand:check` (`scripts/check-brand.js`) | Fails on off-brand classes |
| Agent rules | `AGENTS.md` | Tells AI tools and contributors to read this file first |

---

## 1. Philosophy

**Minimal. Functional. Quiet.** The interface disappears so the canvas is the focus.

- One accent colour (blue). Everything else is cool neutral slate.
- Borders over shadows. Flat over decorated.
- Small, dense, legible. Nothing animates for more than 200ms.

## 2. Colour

Tailwind's default palette is **disabled**. Only these names exist.

| Token (Tailwind) | CSS variable | Hex | Use |
|------------------|--------------|-----|-----|
| `canvas` | `--color-canvas` | `#ffffff` | Page, card, modal, input background |
| `surface` | `--color-surface` | `#f8fafc` | Widget headers, canvas, empty states |
| `hover` | `--color-hover` | `#f1f5f9` | Hover fill, chat bubbles, badges |
| `line` | `--color-line` | `#e2e8f0` | **Every** border and divider |
| `line-strong` | `--color-line-strong` | `#cbd5e1` | Card hover border, scrollbar thumb |
| `fg` | `--color-fg` | `#2c3e50` | Primary text, headings |
| `fg-muted` | `--color-fg-muted` | `#64748b` | Descriptions, secondary info, default icon colour |
| `fg-subtle` | `--color-fg-subtle` | `#94a3b8` | Placeholders, timestamps, decorative icons |
| `accent` | `--color-accent` | `#73b1ef` | Primary fills, highlights |
| `accent-hover` | `--color-accent-hover` | `#5c9fe3` | Hover on accent |
| `accent-soft` | `--color-accent-soft` | `#ebf4fe` | Selected/active fill, text selection |
| `accent-ink` | `--color-accent-ink` | `#245e9e` | Accent text, links, active labels |
| `accent-ring` | `--color-accent-ring` | `#4b93d6` | Focus ring only |
| `danger` | `--color-danger` | `#dc2626` | Destructive actions and errors only |
| `danger-soft` / `danger-line` | same pattern | `#fef2f2` / `#fecaca` | Error fill / border, danger hover fill |
| `success` | `--color-success` | `#16a34a` | Presence/live dots and "copied" check only |

Rules
- Body text is `fg`; secondary `fg-muted`. `fg-subtle` is never used for text a person must read to complete a task.
- Filled buttons use `accent` (`#73b1ef`) with `fg` text. The accent is light, so never use white text on it. Text links and active labels use `accent-ink` (`#245e9e`); focus rings use `accent-ring` (`#4b93d6`).
- No colour on card backgrounds. No gradients.
- **Exceptions:** per-user collaboration cursor colours (assigned at runtime), the Google logo SVG, `bg-black` behind video, the canvas grid.

## 3. Typography

**Inter** (`next/font/google`, `--font-inter`), fallback `system-ui, -apple-system, sans-serif`. Mono: JetBrains Mono (URLs, IDs, zoom %).
Antialiased everywhere. Max weight **700**. Tight tracking on headings, normal on body, slightly open on captions.

| Tailwind class | Size | Weight | Line height | Tracking | Use |
|----------------|------|--------|-------------|----------|-----|
| `text-display` | 36px | 700 | 1.2 | -0.02em | Signed-out hero, auth wordmark |
| `text-h1` | 24px | 700 | 1.3 | -0.01em | Page heading (one per page) |
| `text-h2` | 18px | 600 | 1.4 | 0 | Section heading, modal title |
| `text-body` | 14px | 400 | 1.6 | 0 | Default text, buttons, inputs |
| `text-small` | 13px | 400 | 1.5 | 0 | Secondary text, dense UI, toolbars |
| `text-caption` | 12px | 500 | 1.4 | 0.01em | Labels, metadata, timestamps |
| `text-mono` | 12px | 400 | 1.6 | 0 | With `font-mono`: code, IDs, URLs |

- Smallest allowed size is 12px. `text-xs`, `text-sm` and `text-[Npx]` do not exist.
- Wordmark: `.wordmark` (14px / 600).
- Labels are sentence case, not uppercase.

## 4. Spacing and layout

4px base unit; prefer the 8px grid.

| Value | Use |
|-------|-----|
| 4px | Icon-button padding (`p-1`) |
| 8px | Gap between related items |
| 12px | Standard internal padding |
| 16px | Card and section padding |
| 24px | Page horizontal padding (`px-6`) |
| 32px | Major section spacing (`py-8`) |
| 48px+ | Hero / landing |

- **Header:** `.app-header` + `.app-header-inner`: solid white, 56px high, `px-6`, `border-b border-line`. Identical on every page including the room canvas. No blur, no transparency.
- **Page content:** `max-w-4xl` for lists, `max-w-6xl` for grids, centred, `px-6 py-8`.
- **Page heading:** one `text-h1` per page, inside `<main>`.

## 5. Shape, borders, shadow, motion

| Token | Value | Use |
|-------|-------|-----|
| `rounded-sm` | 6px | Buttons, inputs, menu items, alerts |
| `rounded-md` | 8px | Cards, widgets, dropdowns, chat bubbles |
| `rounded-lg` | 12px | Modals, auth panel |
| `rounded-full` | n/a | Avatars, status dots, badges, spinner. Nothing else |

- Nothing larger than 12px.
- Borders are **always** `1px solid line`. Only exception: the spinner ring (2px).
- Shadows: `shadow-sm` (rest), `shadow-md` (dropdowns, modals, floating panels). No glow, no colour, no heavier, none on page-level elements.
- Motion: colour/border transitions at **150ms** (`--duration`). Modals: fade + 8px slide-up. Spinner and skeleton pulse are the only looping animations.
- Focus: 2px `accent-ring`, 2px offset on every interactive element (global `:focus-visible`). Inputs: 3px ring, 1px offset, transparent border.
- The canvas grid (`.canvas-grid`) is the only permitted gradient: functional, not decorative.

## 6. Components

Always use the class or component. Never re-assemble the styles by hand.

### Buttons
Base `.btn` (14px / 500, `px-4 py-2`, `rounded-sm`) plus one variant. Add `.btn-sm` (13px, `px-3 py-1.5`) in toolbars, cards and modal footers.

| Class | Look | Use |
|-------|------|-----|
| `btn btn-primary` | blue fill, dark text | The main action in a view |
| `btn btn-secondary` | transparent, `line` border | Alternative actions |
| `btn btn-ghost` | transparent, muted text | Cancel, tertiary |
| `btn btn-danger` | transparent, red text, red-50 hover | Destructive with a label |
| `btn-icon` / `btn-icon-sm` | 6px / 4px padding, muted icon | Icon-only (always add `aria-label`) |
| `btn-icon-danger` | icon-only, red on hover | Delete icons |
| `.is-active` on `btn-icon` | `accent-soft` fill, `accent-ink` icon | Toggled state (grid/list) |

One `btn-primary` per view region. Icons in buttons are `w-3.5` to `w-4`.

### Inputs
`.input-base` (`px-3 py-2`, `rounded-sm`, 14px). `.input-sm` for toolbars and dense areas. Labels: `.field-label` above the field. Helper text: `.field-hint`. Errors: `.alert-danger` above the form.

### Cards
`.card` = white, 1px `line`, `rounded-md`, padding `p-4` (`p-3` in dense lists). Clickable: add `.card-interactive` (border becomes `line-strong`, no shadow change). `.card-surface` for inset or secondary blocks.

### Menus and dropdowns
`.menu` container (`shadow-md`), `.menu-item` rows (+ `.menu-item-danger`), `.menu-label` for group headings.

### Modals
Use `<Modal>` from `@/components/ui/Modal`. Never hand-roll a backdrop.
- Props: `open`, `onClose`, `title`, `size` (`sm` 360, `md` 480, `lg` 640, `wide` 960), `footer`, `flush`.
- `lg` (640px) is the maximum for forms and lists. `wide` is only for embedded-content previews.
- Footer is right-aligned: cancel = `btn btn-ghost btn-sm`, confirm = `btn btn-primary btn-sm`.
- Backdrop `rgba(0,0,0,0.4)` + 4px blur. Esc and backdrop click close it.

### Sidebar rail
`SpaceRail` (`src/components/SpaceRail.tsx`) with `ProfileDropdown` in sidebar mode.
- Expanded `w-72` (288px); collapsed `w-[104px]`. Width transition 150ms.
- Rows are 56px tall, `rounded-md`, with 24px filled Material icons, `text-body` labels, and a 12px icon/label gap.
- Space avatars: 32px expanded, 36px collapsed; `rounded-md` with a 1px `line` ring.
- Section label: `text-caption font-semibold text-fg-subtle`, sentence case, with a count on the right.
- Active row: `bg-accent-soft text-accent-ink`. Hover: `bg-hover`.
- Collapsed items share one 68px pill width so hover and active states never change size.
- Footer: profile row above a 1px `line` border. The profile menu opens beside the rail when collapsed.

### Widgets (canvas)
`.widget-card` > `.widget-card-header` (surface fill, grip icon, `text-small font-medium` title, `btn-icon-sm` actions) + `.widget-card-body`. Hover border becomes `line-strong`.

### Feedback
`.spinner`, `.skeleton`, `.alert-danger`, `.status-dot`, `.badge`, `.divider` (labelled rule, e.g. "or").

### Auth
`AuthShell`, `AuthField`, `AuthError`, `AuthDivider`, `GoogleButton`: centred `text-display` wordmark, `.card rounded-lg p-8` panel (no shadow), full-width default-size buttons.

## 7. Content and iconography

- Icons: **Material Design filled** icons from `react-icons/md` in the sidebar rail; **lucide-react** elsewhere. Sized `w-3.5`/`w-4` inline, `w-5` in empty states, and `w-6` in the sidebar rail. No emoji anywhere. Use an icon component (`MdClose`), not a character (`×`).
- Copy: short, plain, **sentence case** everywhere: "New room", "Join room", "Widget library".
- Use "..." for in-progress states ("Creating...").

## 8. Do not

- Use colour utilities outside the token table (`text-zinc-*`, `bg-blue-*`, hex in `className`)
- Use radius over 12px, shadows heavier than `md`, gradients (except `.canvas-grid`), or borders thicker than 1px
- Use `text-xs`, `text-sm`, `text-[Npx]`, or weight 800/900
- Animate longer than 200ms
- Hand-build modals, dropdowns, buttons or inputs
- Use emoji

## 9. Adding to the system

1. Need a new colour, size or component? Edit **this file** first.
2. Add the token in `globals.css` + `tailwind.config.ts`; add the class under `@layer components` or a React component in `src/components/ui/`.
3. Run `npm run brand:check` and `npm run typecheck`.

## 10. Not yet defined

Dark mode (`next-themes` is installed but there are no dark tokens), mobile/responsive app shell, data-visualisation colours. Define them here before building.
