# Typography

## Font

**Inter** — loaded via `next/font/google`, CSS variable `--font-inter`.

Fallback: `system-ui, -apple-system, sans-serif`.

## Scale

| Token | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| `display` | 36px / 2.25rem | 700 | 1.2 | -0.02em | Page titles (signed-out hero) |
| `h1` | 24px / 1.5rem | 700 | 1.3 | -0.01em | Page headings |
| `h2` | 18px / 1.125rem | 600 | 1.4 | 0 | Section headings, card titles |
| `body` | 14px / 0.875rem | 400 | 1.6 | 0 | Default body text |
| `small` | 13px / 0.8125rem | 400 | 1.5 | 0 | Secondary text, descriptions |
| `caption` | 12px / 0.75rem | 500 | 1.4 | 0.01em | Labels, metadata, timestamps |
| `mono` | 12px / 0.75rem | 400 | 1.6 | 0 | Code, IDs, technical values |

## Rules

- No text should use weight 800 or 900. Max weight is 700.
- Body text color: `#171717` (zinc-900).
- Secondary text color: `#737373` (zinc-500).
- Muted text color: `#a3a3a3` (zinc-400).
- All text uses `antialiased` rendering (`-webkit-font-smoothing: antialiased`).
- Letter spacing is tight on headings, normal on body, slightly open on captions.
