import type { Config } from "tailwindcss";

/**
 * Cubics design tokens. Source of truth: docs/BRAND.md
 * `theme.colors`, fontSize, borderRadius and boxShadow are REPLACED (not extended)
 * on purpose: off-brand classes (text-zinc-500, rounded-2xl, text-[10px]...) do not exist.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#000000",
      canvas: "var(--color-canvas)",
      surface: "var(--color-surface)",
      hover: "var(--color-hover)",
      line: {
        DEFAULT: "var(--color-line)",
        strong: "var(--color-line-strong)",
      },
      fg: {
        DEFAULT: "var(--color-fg)",
        muted: "var(--color-fg-muted)",
        subtle: "var(--color-fg-subtle)",
      },
      accent: {
        DEFAULT: "var(--color-accent)",
        hover: "var(--color-accent-hover)",
        soft: "var(--color-accent-soft)",
        ring: "var(--color-accent-ring)",
      },
      danger: {
        DEFAULT: "var(--color-danger)",
        soft: "var(--color-danger-soft)",
        line: "var(--color-danger-line)",
      },
      success: "var(--color-success)",
    },
    fontSize: {
      display: ["2.25rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
      h1: ["1.5rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "700" }],
      h2: ["1.125rem", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "600" }],
      body: ["0.875rem", { lineHeight: "1.6", letterSpacing: "0", fontWeight: "400" }],
      small: ["0.8125rem", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
      caption: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.01em", fontWeight: "500" }],
      mono: ["0.75rem", { lineHeight: "1.6", letterSpacing: "0", fontWeight: "400" }],
    },
    fontFamily: {
      sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
      mono: ["JetBrains Mono", "ui-monospace", "monospace"],
    },
    borderRadius: {
      none: "0",
      sm: "6px", // buttons, inputs, menu items
      md: "8px", // cards, widgets, dropdowns
      lg: "12px", // modals, large panels. Nothing bigger (except rounded-full)
      full: "9999px", // avatars, status dots, spinner only
    },
    boxShadow: {
      none: "none",
      sm: "0 1px 2px rgba(0,0,0,0.05)",
      md: "0 4px 12px rgba(0,0,0,0.08)",
    },
    extend: {},
  },
  plugins: [],
};

export default config;
