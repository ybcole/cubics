# Cubics — Precision Minimal UI

**This document is the source of truth for the interface.** Read it before changing UI files. Cubics is a professional desktop workspace for browsing, arranging and sharing live content on an infinite canvas. The canvas—not the chrome—is the product.

## Design principles

1. **Content first.** Use one neutral app frame around a quiet, unobstructed canvas. External websites and videos remain unmodified.
2. **Obvious actions.** Navigation labels describe destinations; primary actions are visible (not hidden behind keyboard shortcuts). A collapsed rail has a visible expand affordance.
3. **Economical detail.** One blue accent for interactive selection; no decorative gradients, glass, glowing edges, patterned chrome, or bouncy motion.
4. **Alignment before decoration.** Use a 4px unit and an 8px rhythm, consistent baselines, and predictable 40px click targets.
5. **State is explicit.** Active navigation is distinguishable by both contrast and position, hover is quiet, and destructive actions remain clearly marked.
6. **Accessibility by default.** Never steal the Tab key; give icon-only controls names, keyboard focus rings, meaningful labels, and reduced-motion support.

## Architecture

| Purpose | Source |
| --- | --- |
| Rules | `docs/BRAND.md` |
| Tokens and shared components | `src/app/globals.css` |
| Tailwind names | `tailwind.config.ts` |
| Dialog shell | `src/components/ui/Modal.tsx` |
| Navigation | `src/components/SpaceRail.tsx` |
| Canvas | `src/app/spaces/[id]/page.tsx` |
| Guardrails | `npm run brand:check`, `npm run typecheck` |

## Palette — light only

Colors use semantic tokens; never embed hexadecimal values in React class names.

| Tailwind token | Variable | Value | Use |
| --- | --- | --- | --- |
| `canvas` | `--color-canvas` | `#ffffff` | Cards, panels, inputs, dialogs, rail |
| `surface` | `--color-surface` | `#f7f8fa` | Canvas and quiet insets |
| `hover` | `--color-hover` | `#f1f3f5` | Hover and soft badges |
| `line` | `--color-line` | `#e4e7eb` | Borders and dividers |
| `line-strong` | `--color-line-strong` | `#cbd1da` | Hover/active borders |
| `fg` | `--color-fg` | `#202833` | Body and controls |
| `fg-strong` | `--color-fg-strong` | `#111827` | Primary headings |
| `fg-muted` | `--color-fg-muted` | `#667180` | Secondary information |
| `fg-subtle` | `--color-fg-subtle` | `#8993a2` | Placeholders only |
| `accent` | `--color-accent` | `#245bd6` | Primary buttons |
| `accent-hover` | `--color-accent-hover` | `#194cb9` | Primary hover |
| `accent-soft` | `--color-accent-soft` | `#edf3ff` | Selected background |
| `accent-ink` | `--color-accent-ink` | `#2454bb` | Active labels and links |
| `accent-ring` | `--color-accent-ring` | `#5486eb` | Focus indicators |
| `danger` | `--color-danger` | `#c43c3c` | Destructive action |
| `success` | `--color-success` | `#28825d` | Connected/live status |

Use `danger-soft` and `danger-line` only for validation/errors. Keep video backdrops black and user cursor colors per-user. Do not use gradients except the functional camera-aligned canvas grid.

## Typography and spacing

- **Font:** Inter, with system fallback. Body 14px / 1.5; small 13px; caption 12px; headings 18–24px. Wordmark 19px / 650.
- **Weight hierarchy:** labels 500, headings 600–700. Avoid unnecessary bold text, uppercase paragraphs and ornamental tracking.
- **Spacing:** 4/8/12/16/24/32px. Default control height 36–40px, sidebar rows 40px, icon-only minimum 32px.
- **Radii:** `rounded-sm` 6px, `rounded-md` 8px, `rounded-lg` 12px. Pill shapes only for avatars, status, micro-chips and chat send.
- **Elevation:** Flat by default. `shadow-sm` only for floating canvas controls and `shadow-md` for popovers/modals. Never shadow ordinary cards.
- **Motion:** 120–150ms color/opacity feedback; no hover motion/translate. Respect `prefers-reduced-motion`.

## Component contracts

- **Buttons:** Always `.btn` plus `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`; `.btn-sm` for dense controls. Primary = solid blue with white text, secondary = white with border, ghost = text-only. Icon-only uses `.btn-icon`, `.btn-icon-sm`, or `.btn-icon-danger`, each with an accessible name.
- **Forms:** `.input-base`, optional `.input-sm`, `.field-label`, `.field-hint`, `.alert-danger`. Focus is clear, inputs remain white, placeholders lower-contrast than entered text.
- **Cards:** `.card` white and bordered, `.card-interactive` adds a subtle hover edge; `.card-surface` is a quiet inset. No blur.
- **Menus:** `.menu` and `.menu-item`; destructive rows use `.menu-item-danger`. Menus appear above the rail with proper viewport positioning.
- **Modals:** Use the single `Modal` component; no hand-built dialog backdrops. 360/480/640/960px sizes; distinct header/body/footer; Escape, outside click and focus handling must work.
- **Rail:** `.rail-shell`, `.rail-card`, `.rail-item` and `.rail-*` define the UI. Expanded width 264px, collapsed 68px. Header contains wordmark and a **visible collapse/expand button**; collapsed rail preserves tooltips and actions. Main navigation Home/Inbox is separate from Spaces. The spaces group has a simple heading, visible create action, list of spaces, and join action. Space tiles are small neutral initials/avatars, never saturated gradients. Footer contains Settings.
- **Canvas:** A clean `.canvas-grid` full viewport with camera-aligned faint grid. A small top toolbar shows space context and a visible **New tab** action. Empty canvas has a helpful single-action prompt. The minimal bottom zoom control stays accessible. Keyboard `N` may open the tab picker when focus is not inside an interactive element; **Tab must always remain native keyboard navigation**.
- **Widgets:** `.widget-card` thin edge, white content, neutral 36px header, compact actions; maintain native interaction and legibility in `webview`/`iframe`/video. No filters on external content.
- **Chat:** Messages remain readable over canvas. Composer is a simple bordered panel. Only primary message accents get color.
- **Auth:** Center the `AuthShell` with a concise wordmark and a quiet bordered form card; no decorative imagery.

## Functionality to preserve

- Canvas pan, pinch and wheel zoom, widget drag and resize, browser popups as widgets, local persistence, WebRTC/LiveKit collaboration.
- Rooms, room codes, create/join/rename/delete flows and multi-account authentication.
- Header/rail reflow must preserve the camera position when sidebar size changes.
- All icons stay consistent and sufficiently large; avoid emoji or custom image assets.

## Verification

Before merging, run `npm run brand:check && npm run ui:check && npm run typecheck && npm run build`. Manually check expanded/collapsed rail, keyboard Tab access, N shortcut, empty canvas, modal focus/escape, adding widgets, multi-user sessions, and reduced-motion settings. If environment keys/services are missing, disclose that instead of reporting a successful build.
