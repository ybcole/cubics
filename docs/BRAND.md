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

- **Monochrome.** The accent is black. Everything else is neutral grey. Colour stays restrained: `danger` for errors and `success` for live dots. Chat is monochrome too, including avatars and sent bubbles.
- Borders over shadows. Flat over decorated (the sidebar rail is the one documented exception).
- Small, dense, legible. Nothing animates for more than 200ms.

## 2. Colour

Tailwind's default palette is **disabled**. Only these names exist.

| Token (Tailwind) | CSS variable | Hex | Use |
|------------------|--------------|-----|-----|
| `canvas` | `--color-canvas` | `#ffffff` | Page, card, modal, input background |
| `surface` | `--color-surface` | `#fafafa` | Widget headers, empty states |
| `backdrop` | `--color-backdrop` | `#fafafa` | Canvas background behind tabs (`.canvas-backdrop`) |
| `hover` | `--color-hover` | `#f4f4f4` | Hover fill, chat bubbles, badges |
| `line` | `--color-line` | `#e5e5e5` | **Every** border and divider |
| `line-strong` | `--color-line-strong` | `#d4d4d4` | Card hover border, scrollbar thumb |
| `fg` | `--color-fg` | `#171717` | Primary text, headings |
| `fg-strong` | `--color-fg-strong` | `#000000` | Emphasised text |
| `fg-muted` | `--color-fg-muted` | `#6b6b6b` | Descriptions, secondary info, default icon colour |
| `fg-subtle` | `--color-fg-subtle` | `#a3a3a3` | Placeholders, timestamps, decorative icons |
| `accent` | `--color-accent` | `#000000` | Primary fills, highlights |
| `accent-hover` | `--color-accent-hover` | `#262626` | Hover on accent |
| `accent-soft` | `--color-accent-soft` | `#f0f0f0` | Selected/active fill, text selection |
| `accent-ink` | `--color-accent-ink` | `#000000` | Accent text, links, active labels |
| `accent-ring` | `--color-accent-ring` | `#000000` | Focus ring only |
| `danger` | `--color-danger` | `#dc2626` | Destructive actions and errors only |
| `danger-soft` / `danger-line` | same pattern | `#fef2f2` / `#fecaca` | Error fill / border, danger hover fill |
| `success` | `--color-success` | `#16a34a` | Presence/live dots and "copied" check only |

Rules
- Body text is `fg`; secondary `fg-muted`. `fg-subtle` is never used for text a person must read to complete a task.
- Filled buttons use `accent` (black) with white (`canvas`) text. Text links and active labels use `accent-ink` (black); focus rings use `accent-ring` (black).
- No colour on card backgrounds. No gradients.
- **Exceptions:** per-user collaboration cursor colours (assigned at runtime), the Google logo SVG, and `bg-black` behind video.

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
- The canvas has no grid. Its backdrop (`.canvas-backdrop`, token `backdrop` `#fafafa`) is a flat neutral light grey, matching `surface`, so white tabs (`.widget-card`, `shadow-sm`) separate from it by their border and shadow. No gradients anywhere.

## 6. Components

Always use the class or component. Never re-assemble the styles by hand.

### Buttons
Base `.btn` (14px / 500, `px-4 py-2`, `rounded-sm`) plus one variant. Add `.btn-sm` (13px, `px-3 py-1.5`) in toolbars, cards and modal footers.

| Class | Look | Use |
|-------|------|-----|
| `btn btn-primary` | black fill, white text | The main action in a view |
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
- Floating menus use the standard 13px menu text and compact rows, including workspace `…` and account menus. Never reuse `.rail-card` or `.rail-item`: their 300px minimum width and 48px navigation rows belong to the sidebar itself. Workspace action menus are 176px wide (clamped to the viewport); their icons are 16px.

### Modals
Use `<Modal>` from `@/components/ui/Modal`. Never hand-roll a backdrop.
- Props: `open`, `onClose`, `title`, `size` (`sm` 360, `md` 480, `lg` 640, `settings` 880, `wide` 960), `footer`, `flush`, `presentation` (`dialog` by default; `search` for canvas search).
- `lg` (640px) is the maximum for ordinary forms and lists. `settings` is a dedicated 880px-wide, 640px-tall shell for the two-pane settings workspace, capped by the viewport. `wide` is only for embedded-content previews.
- Footer is right-aligned: cancel = `btn btn-ghost btn-sm`, confirm = `btn btn-primary btn-sm`.
- Backdrop `rgba(0,0,0,0.4)` + 4px blur. Esc and backdrop click close it. Canvas search uses `presentation="search"`: transparent backdrop with no blur, horizontally centered, top-aligned at `clamp(48px, 20dvh, 160px)`. Suggestions grow downward without moving the input; the panel height is capped to the remaining viewport.

### Sidebar rail
`SpaceRail` (`src/components/SpaceRail.tsx`), icons in `src/components/RailIcons.tsx`, styles in the `.rail-*` classes in `globals.css`, tokens `--rail-*`. `ProfileDropdown` in sidebar mode sits in the footer.
- **Deliberate exception:** the rail follows its own visual spec (white panel, monochrome selection, greyscale gradient space tiles, 17px / 500 labels, 12px row radius). The eye icon sits inside the standard 40px `.rail-toggle` header control, centered with a 16px right inset. Do not use these values outside the rail.
- Three states. **Expanded**: 300px panel. **Collapsed**: 72px strip (the expanded rail minus its text: same 12px gutter around **square 48 x 48 rows**, so the highlight's left edge and the icons sit at the same x, rows and dividers at the same y, so nothing shifts), all icons still visible (nav, spaces, settings) with hover tooltips; clicking an icon runs its action, clicking empty space on the strip expands it. **Hidden**: clicking the eye icon animates the rail width to 0 using the same `--duration` width transition as normal collapse. The rail is clipped while sliding, then visually hidden and made inert. **No logo, panel, border, or visible trigger remains**. While hidden, a stationary mouse pointer in the leftmost **12px** for **550ms** restores the **collapsed 72px rail**, with the normal slide-out/in transition. Crossing the edge briefly or dragging must not trigger it. The reveal listener must not overlay or intercept canvas pointer interactions.
- The eye icon enters hidden state. The hidden state persists across client-side navigation. A global `pointermove` listener is active **only while hidden**; it starts a cancellable dwell timer at the far-left edge and cancels it on exit, while dragging, or when the window loses focus. A keyboard-only, visually hidden `Show sidebar` action becomes visible on focus for accessibility; it is not a persistent UI element. The full rail must remain mounted for animation.
- State lives in `SpaceRail` and a module-level `railState`, so it survives navigation between spaces.
- Header: 64px. **Expanded**: the `cubics` wordmark only (no logo mark), black, with the eye icon on the right that hides the entire rail. **Collapsed**: the logo mark (32px) in a 48 x 48 square button, aligned with the rows; on hover or keyboard focus it gets the row hover fill and the logo swaps to the expand icon (`PanelLeftOpen`), and clicking it expands the rail. The Cubics logo is **never displayed** in hidden mode; edge dwell restores the collapsed rail.
- Rows: 48px tall, 8px gap, 12px radius, 1px transparent border, 12px left padding, 22px line icons (1.5px stroke), 10px icon/label gap, 17px / 500 label.
- Active row: `--rail-accent-soft` fill, `--rail-accent-line` border, `--rail-accent` text, semibold (600) label. **No accent bar**: the grey pill and bolder label carry the active state. Hover: `--rail-hover`.
- Spaces section: a full row like Home and Inbox: `LayoutGrid` icon + "Spaces" label (collapses the list), with a `+` button (creates a space) and the chevron (collapses, rotates -90deg) on the right. In the collapsed rail the row is just the `LayoutGrid` icon with a "Spaces" hover tooltip; clicking it expands the rail and opens the Spaces list. Children hang off a 1px guide line; tiles are 24px. "Join space" is the last child row and uses a plain outline log-in icon (`LogIn`, 1.5px stroke), never a tile.
- Space tile: flat 24 x 24, 8px radius (`rounded-md`), `hover` grey fill, dark grey (`#4b4b4b`) initial or glyph, hairline inner `line` border. No gradients or drop shadows. Uploaded avatars replace the fill.
- A compact white tooltip (28px tall, 8px radius, 13px text, 10px horizontal padding) sits 8px right of the panel for hovered or keyboard-focused rows. Its width follows the label up to 240px and the available viewport width; long labels truncate with an ellipsis. Tooltips never inherit navigation-row sizing or accept pointer events.
- Footer: Settings row opens `SettingsModal` with the dedicated `settings` size. A 208px left navigation groups Profile, Notifications and Security under Workspace, and Account, Emails and Schedules under General. Account is the default working section; the others are selectable, explicitly labelled coming-soon placeholders with no fake controls.
- The settings workspace uses `.settings-*` layout classes: a quiet `surface` sidebar, 36px navigation rows with 16px icons and a monochrome active marker; a white right pane with 32px inset, section heading/description, subtle row dividers, and a pinned action footer. Account retains photo upload, validated username, read-only email and member-since information. Photo is a 64px rounded square. Buttons use the standard `btn` classes. Switching sections preserves the account draft while the dialog stays open.
- On narrow viewports (640px and below), settings navigation becomes a horizontally scrollable top strip. The right pane scrolls independently and its action footer remains reachable. The shared `Modal` supplies backdrop/Escape dismissal; the settings shell supplies its labelled close control and restores focus to its opener.

### Canvas camera
- The canvas is a viewport, not a scroll container: `<main>` is `overflow: clip`, content lives in one world layer moved with `transform`, and the grid is painted on the viewport and moved with it. Wheel, trackpad scroll, space and focus can never move it.
- Drag-pan changes the view; the wheel, pinch and ctrl/cmd+wheel zoom at the pointer (once per frame); so do the zoom controls. When the rail resizes the camera shifts by the same amount so nothing moves on screen.

- **Directional tab navigation (M10.02/M10.03/M12.06):** unmodified WASD or arrow keys, one step per press, only while the canvas/body has focus. Choose from the viewport center, considering every tab center in the requested half-plane, with a continuous distance/alignment score; no distance limit. Keep zoom and center the chosen tab. While a transition is running, subsequent presses choose from its intended destination, immediately retargeting from the current rendered camera position. No candidate means no movement. Camera transitions use a single 180ms ease-out animation frame loop; reduced-motion centers immediately. Pan, zoom, resize, widget interaction, focus loss and room changes cancel the transition. Inputs, sidebar controls, browser guests, dialogs, IME, modifiers, held-key repeats and active drags never trigger navigation. No browser reload, automatic page focus, URL/history change, remote control grant or shared camera message accompanies a move.

### Chat
- Bottom-right of the canvas, 320px wide, inset 16px and clamped to the available viewport. `.chat-dock` owns positioning; it never offsets with the left sidebar.
- Open history uses a quiet `surface` panel (`--chat-panel-bg`) with a standard `line` border, 12px radius, 12px padding and `shadow-sm`; the header labels it “Room chat”, panel height stops at 40vh and scrolls. Recent messages shown while the chat is closed keep the same footprint but are transparent (`.chat-panel-idle`: no surface, border or shadow) so the canvas shows through. Closed notifications never intercept canvas gestures.
- Message: 28px avatar (`.chat-avatar`, photo or a neutral grey initial) + caption row (`.chat-meta`: name and time in `fg-muted`, 12px) + bubble (`.chat-bubble`, 12px radius, 13px text). Names truncate; long messages and unbroken URLs wrap; line breaks are preserved. Avatar initials use `line-strong` fill with `fg` text; no per-user hue.
- Own messages use `.chat-msg-self`: avatar on the right, caption and bubble aligned right. Their bubble uses `accent` with `canvas` text (`--chat-self-bg` / `--chat-self-fg`). Other messages align left with a white bubble and standard `fg` text. Bubbles retain standard `line` borders.
- System messages are centered muted pills (`.chat-status`) with a `hover` fill, distinct from either sender.
- Composer (`.chat-composer`, white fill, standard border, 12px radius, `shadow-sm`): `.chat-input` (placeholder “Message the room...”) and a round send button (`.chat-send`, grey while empty, `accent` with `canvas` text when ready, `accent-hover` on hover). The round send shape is a chat-only exception to the radius rules.
- The history scrollbar is transparent (still scrolls).
- Closed: each new message from someone else or yourself appears for 5s, then fades out (500ms), individually. Several can be visible at once; opening or closing the chat never cuts a message's timer short.
- `/` opens the composer (focused) and shows the whole history, scrollable. `Enter` sends and hides everything again; `Esc`, a click on the canvas, or the input losing focus closes it; while it is closed new messages show for 5s and fade, in the same spot as the open history (the composer stays mounted but invisible so nothing shifts).

### Tabs
- Browser tab chrome is deliberately minimal, in a single Safari-like row: **Close (X)** and **Maximize/Restore** on the far left, **Back and Forward** beside them, and a centered URL field. **Reload** is inside the rightmost end of the URL field. There is no trash button, second address toolbar, grip icon, title label, clear-cache/export/backup button, or other profile-management action inside the tab header. The header background remains the drag handle.
- **Close (X)** deletes the tab; it uses the danger icon-hover treatment and never sits beside the other controls as a separate footer action.
- **Maximize** fills the visible canvas with that tab and brings it to the front; the same control (now **Restore**) puts it back at its previous position and size. Maximize is an in-canvas view change, not an OS window mode.
- The URL field normally shows only the safe hostname, e.g. `google.com` or `figma.com`, centered. On click/keyboard focus it shows the entire permitted URL, aligns text to the left, and selects all for instant replacement. Enter navigates, Escape cancels. Do not submit a truncated hostname when a full URL is available. Viewers never receive or reveal another member's private Personal/Live URL; the server-owned redaction rules remain authoritative.
- Typing in the URL field shows a suggestion list after a 200ms debounce: matching open tabs (globe icon), local in-memory history (history icon), then remote search phrases (search icon) in a standard `.menu`. Arrow keys move, Enter accepts, Escape dismisses. Tab/history rows navigate; search rows open Google results. Remote suggestions are fetched by Electron main only (Google first, silent DuckDuckGo failover), never from the renderer, and URL-shaped input is never sent to a provider. Selecting search text with Enter also searches when the text is not a valid URL.
- This single toolbar is shared by Personal, Live and Shared browser widgets. Its background remains a drag handle, while interactive controls are excluded from canvas dragging. Live/Shared sharing Start/Stop and active indicators belong in the page/stream body, not in a second toolbar. Advanced browser privacy/recovery actions belong in a separate settings surface (M05.06), never crowded into tab controls.
- `Enter` on the canvas opens a horizontally centered floating search in the upper part of the screen (`CanvasSearch`, shared `AddressField` with the tab toolbar). It uses the 640px `Modal` with `presentation="search"` (transparent, no dimming or blur), white surface, 12px radius, standard border/shadow, a search icon, input and primary Search action. No hero, shortcuts or news feed. Suggestions appear inline below the field using standard menu rows. Enter submits a search or URL directly to a new Personal tab; Escape/backdrop click dismisses and restores focus. Tab retains the Personal / Live / Shared picker. Shortcuts ignore editable controls, buttons, open dialogs, modifier chords, repeats and IME composition.

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
- Use radius over 12px, shadows heavier than `md`, gradients, or borders thicker than 1px
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
