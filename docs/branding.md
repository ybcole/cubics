# Branding — Cubics

## Philosophy

Minimal. Functional. Quiet. The interface disappears so the canvas is the focus.

## Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `bg` | `#ffffff` | Page background |
| `surface` | `#fafafa` | Subtle surface differentiation |
| `border` | `#e5e5e5` | All borders, dividers |
| `text` | `#171717` | Primary text, headings |
| `text-secondary` | `#737373` | Descriptions, secondary info |
| `text-muted` | `#a3a3a3` | Placeholders, timestamps, metadata |
| `accent` | `#6366f1` | Buttons, links, focus rings, active states |
| `accent-hover` | `#4f46e5` | Button hover, interactive hover states |
| `danger` | `#ef4444` | Delete actions only |

## Spacing

Use an 8px grid. Common values:

- `4px` — tight internal padding (icon buttons)
- `8px` — gap between related items
- `12px` — standard internal padding
- `16px` — section padding, card padding
- `24px` — page-level horizontal padding
- `32px` — major section spacing
- `48px+` — hero/landing spacing

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | `6px` | Buttons, inputs, small cards |
| `md` | `8px` | Cards, modals |
| `lg` | `12px` | Large cards, panels |

No border radius larger than 12px anywhere.

## Shadows

Use sparingly. Prefer borders over shadows.

- `sm`: `0 1px 2px rgba(0,0,0,0.05)` — cards at rest
- `md`: `0 4px 12px rgba(0,0,0,0.08)` — cards on hover, dropdowns
- No glow shadows. No colored shadows.

## Borders

Always `1px solid #e5e5e5`. No thicker borders anywhere.

## Focus States

`ring-2 ring-indigo-500 ring-offset-2` on interactive elements.

## Components

### Buttons

- **Primary**: `bg-indigo-600 text-white hover:bg-indigo-700`, `px-4 py-2`, radius `6px`, font `14px/500`
- **Secondary**: `bg-transparent text-zinc-700 hover:bg-zinc-100 border border-zinc-200`
- **Danger**: `bg-transparent text-red-600 hover:bg-red-50`
- **Icon only**: `p-2 text-zinc-500 hover:bg-zinc-100 rounded-md`

### Inputs

- `px-3 py-2 border border-zinc-200 rounded-md text-sm`
- Focus: `ring-2 ring-indigo-500 ring-offset-1 border-transparent`
- Background: white

### Cards

- White background, `border border-zinc-200 rounded-lg`
- Hover: `border-zinc-300` (no shadow increase on list cards)
- Internal padding: `16px`

### Modals

- Backdrop: `rgba(0,0,0,0.4)` with `backdrop-blur(4px)`
- Content: white, `rounded-lg`, `border border-zinc-200`, `max-width: 640px`
- No animation beyond simple fade + slide-up

### Header / Nav

- Sticky, white background, `border-b border-zinc-200`
- No backdrop-blur. No transparency. Solid white.

## Typography

See `docs/typography.md`.

## Do Not

- Use gradients (except the extension banner)
- Use colored backgrounds on cards
- Use large border-radius (16px+)
- Use drop shadows on page-level elements
- Use animations beyond 200ms transitions
- Use emoji in the UI
