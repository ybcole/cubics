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
- Borders over shadows. Flat over decorated (the sidebar rail is the one documented exception).
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
| `fg-strong` | `--color-fg-strong` | `#1e293b` | Emphasised text, filled accent button labels |
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
- Filled buttons use `accent` (`#73b1ef`) with `fg-strong` text. The accent is light, so never use white text on it. Text links and active labels use `accent-ink` (`#245e9e`); focus rings use `accent-ring` (`#4b93d6`).
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
`SpaceRail` (`src/components/SpaceRail.tsx`), icons in `src/components/RailIcons.tsx`, styles in the `.rail-*` classes in `globals.css`, tokens `--rail-*`. `ProfileDropdown` in sidebar mode sits in the footer.
- **Deliberate exception:** the rail follows its own visual spec (white panel, brand-blue selection, gradient space tiles, 17px / 500 labels, 12px row radius). The eye icon sits inside the standard 40px `.rail-toggle` header control, centered with a 16px right inset. Do not use these values outside the rail.
- Three states. **Expanded**: 300px panel. **Collapsed**: 84px strip (the expanded rail minus its text: same 14px gutter, icons at the same x, rows and dividers at the same y, so nothing shifts), all icons still visible (nav, spaces, settings) with hover tooltips; clicking an icon runs its action, clicking empty space on the strip expands it. **Hidden**: clicking the eye icon animates the rail width to 0 using the same `--duration` width transition as normal collapse. The rail is clipped while sliding, then visually hidden and made inert. **No logo, panel, border, or visible trigger remains**. While hidden, a stationary mouse pointer in the leftmost **12px** for **550ms** restores the **collapsed 84px rail**, with the normal slide-out/in transition. Crossing the edge briefly or dragging must not trigger it. The reveal listener must not overlay or intercept canvas pointer interactions.
- The eye icon enters hidden state. The hidden state persists across client-side navigation. A global `pointermove` listener is active **only while hidden**; it starts a cancellable dwell timer at the far-left edge and cancels it on exit, while dragging, or when the window loses focus. A keyboard-only, visually hidden `Show sidebar` action becomes visible on focus for accessibility; it is not a persistent UI element. The full rail must remain mounted for animation.
- State lives in `SpaceRail` and a module-level `railState`, so it survives navigation between spaces.
- Header: 64px, logo mark (32px) and wordmark when expanded; the wordmark is hidden when collapsed. The eye icon in the expanded header hides the entire rail. The Cubics logo is **never displayed** in hidden mode; edge dwell restores the collapsed rail.
- Rows: 48px tall, 8px gap, 12px radius, 1px transparent border, 16px left padding, 22px line icons (1.5px stroke), 10px icon/label gap, 17px / 500 label.
- Active row: `--rail-blue-soft` fill, `--rail-blue-line` border, `--rail-blue` text, plus a 3px x (row height - 24px) accent bar on the left edge. Hover: `--rail-hover`.
- Spaces section: plus-circle button (creates) + "Spaces" label + chevron (collapses, rotates -90deg). Children hang off a 1px guide line 35px from the panel edge; 22px tiles sit 59px from the edge.
- Space tile: 22px, 6px radius, vertical gradient, 1px top inner highlight, soft coloured drop shadow. Orange = people, blue = buildings, cyan = vehicles; other spaces get a deterministic tone from their id and show their initial. Uploaded avatars replace the gradient. "Create a space" is a grey tile with a plus.
- A fixed white tooltip (44px tall, 10px radius, 17px) sits 8px right of the panel for hovered rows.
- Footer: Settings row. It opens the `SettingsModal` (`sm`), a `.menu-item` list; "Account settings" opens `AccountSettings` (`md`): avatar + change photo, username (3-20 chars, unique across all accounts, no foul language, live availability hint), read-only email and member-since date. Footer: `Back` (ghost) and `Save` (primary).

### Canvas camera
- The canvas is a viewport, not a scroll container: `<main>` is `overflow: clip`, content lives in one world layer moved with `transform`, and the grid is painted on the viewport and moved with it. Wheel, trackpad scroll, space and focus can never move it.
- Drag-pan changes the view; the wheel, pinch and ctrl/cmd+wheel zoom at the pointer (once per frame); so do the zoom controls. When the rail resizes the camera shifts by the same amount so nothing moves on screen.

### Chat
- Bottom-left of the canvas, 384px wide. No panel and no background behind the messages: the canvas shows through.
- Message: 28px avatar (`.chat-avatar`, photo or coloured initial) + caption row (`.chat-meta`: name in `fg-muted`, time in `fg-subtle`, 12px) + bubble (`.chat-bubble`, `rounded-lg`, `px-3 py-2`, 14px). Every message shows its avatar and caption.
- Own messages: `.chat-bubble-self`, solid blue with white text. Everyone else: grey bubble with `fg-strong` text. Tokens `--chat-self-*` and `--chat-other-*`. **Deliberate exception:** white text on a saturated blue is allowed in chat bubbles only, like the rail.
- System messages are an outlined pill (`.chat-status`), indented under the avatar column.
- Composer (`.chat-composer`, `canvas` fill, 1px `line` border, `shadow-md`): the `.chat-input` (placeholder "Chat") and a round send button (`.chat-send`, grey while empty, blue when there is text). Underneath is the `.chat-commands-btn` chip ("/ Commands"); it toggles a `.menu` popup of slash commands that floats above the input box (it never changes the box's height) (placeholders `/command1`..`/command4` for now) and picking one fills the input. The round send button and the pill chip are chat-only exceptions to the `rounded-full` rule.
- The history scrollbar is transparent (still scrolls).
- Closed: each new message from someone else or yourself appears for 5s, then fades out (500ms), individually. Several can be visible at once; opening or closing the chat never cuts a message's timer short.
- `/` opens the composer (focused) and shows the whole history, scrollable. `Enter` sends and hides everything again; `Esc`, a click on the canvas, or the input losing focus closes it; while it is closed new messages show for 5s and fade, in the same spot as the open history (the composer stays mounted but invisible so nothing shifts).

### Tabs
- New tabs always start at google.com. `Enter` on the canvas opens the Personal / Live / Shared picker directly; there is no URL step and no link is shown on a tab. Headers read "Personal tab", "Live tab" or "Shared tab".

### Widgets (canvas)
`.widget-card` > `.widget-card-header` (surface fill, grip icon, `text-small font-medium` title, `btn-icon-sm` actions) + `.widget-card-body`. Hover border becomes `line-strong`.

- **Personal tab keep-alive:** Mount Electron `<webview>` lazily when the tab first approaches the viewport (600px margin), then leave it mounted as the canvas pans or zooms away. Do not replace a live guest with a placeholder on off-screen changes: that destroys the current page (e.g. Twitch), playback, scroll position and navigation history and falls back to the original URL. Chromium may throttle its background work, but Cubics must preserve the guest until widget deletion or leaving the room. Live/shared remote viewers can pause subscriptions off-screen without destroying the host's page.

### Feedback
`.spinner`, `.skeleton`, `.alert-danger`, `.status-dot`, `.badge`, `.divider` (labelled rule, e.g. "or").

### Auth
`AuthShell`, `AuthField`, `AuthError`, `AuthDivider`, `GoogleButton`: centred `text-display` wordmark, `.card rounded-lg p-8` panel (no shadow), full-width default-size buttons.

## 7. Content and iconography

- Icons: the sidebar rail uses the custom 1.5px line icons in `RailIcons.tsx` (22px); use **Material Design** (`react-icons/md`) or **lucide-react** elsewhere. Sized `w-3.5`/`w-4` inline and `w-5` in empty states. No emoji anywhere. Use an icon component (`MdClose`), not a character (`×`).
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
