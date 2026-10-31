import type { SVGProps } from "react";

/**
 * Sidebar rail icons. Hand-drawn on an 18px grid (1.5px round stroke) so they
 * match the rail mock 1:1. Colour comes from `currentColor`.
 */
type IconProps = SVGProps<SVGSVGElement>;

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function PanelToggleIcon(props: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden {...props}>
      <rect x="1.75" y="2" width="12.5" height="12" rx="2.5" {...line} strokeWidth={1.4} />
      <path d="M10.25 2.4v11.2" {...line} strokeWidth={1.4} />
      <path d="M7.4 6.2 5.6 8l1.8 1.8" {...line} strokeWidth={1.4} />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden {...props}>
      <path d="M1.9 7.5 9 1.9l7.1 5.6v7.1a1.5 1.5 0 0 1-1.5 1.5H3.4a1.5 1.5 0 0 1-1.5-1.5z" {...line} />
      <path d="M6.9 16.1v-3.5a2.1 2.1 0 0 1 4.2 0v3.5" {...line} />
    </svg>
  );
}

export function JoinIcon(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden {...props}>
      <path d="M7.2 2.2H4A1.6 1.6 0 0 0 2.4 3.8v10.4A1.6 1.6 0 0 0 4 15.8h3.2" {...line} />
      <path d="M11 5.4 14.6 9 11 12.6M14.4 9H6.6" {...line} />
    </svg>
  );
}

export function PlusCircleIcon(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden {...props}>
      <circle cx="9" cy="9" r="7.4" {...line} strokeWidth={1.6} />
      <path d="M9 5.4v7.2M5.4 9h7.2" {...line} strokeWidth={1.6} />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden {...props}>
      <path d="M3.4 6 8 10.6 12.6 6" {...line} strokeWidth={1.6} />
    </svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden {...props}>
      <circle cx="3.5" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}

/* --- Space tiles ------------------------------------------------------- */

type Tone = "orange" | "blue" | "cyan" | "purple" | "green" | "pink" | "amber" | "gray";
type Glyph = "people" | "building" | "wheel" | "plus" | null;

const TONES: Tone[] = ["purple", "green", "pink", "amber", "orange", "blue", "cyan"];

function glyphFor(name: string): Glyph {
  const n = name.toLowerCase();
  if (/\b(employees?|people|staff|team|hr)\b/.test(n)) return "people";
  if (/\b(real estate|property|properties|building|house)\b/.test(n)) return "building";
  if (/\b(vehicles?|cars?|fleet|auto)\b/.test(n)) return "wheel";
  return null;
}

function toneFor(id: string, glyph: Glyph): Tone {
  if (glyph === "people") return "orange";
  if (glyph === "building") return "blue";
  if (glyph === "wheel") return "cyan";
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

function GlyphSvg({ glyph }: { glyph: Exclude<Glyph, null> }) {
  const common = { width: 10, height: 10, viewBox: "0 0 12 12", "aria-hidden": true } as const;
  if (glyph === "people") {
    return (
      <svg {...common}>
        <circle cx="4.6" cy="4" r="1.9" fill="white" />
        <path d="M1.2 10.2c0-1.9 1.5-3.2 3.4-3.2s3.4 1.3 3.4 3.2z" fill="white" />
        <circle cx="8.8" cy="4.6" r="1.35" fill="white" fillOpacity="0.8" />
        <path d="M8.2 7.1c1.6.1 2.7 1.2 2.7 3.1H8.9" fill="white" fillOpacity="0.8" />
      </svg>
    );
  }
  if (glyph === "building") {
    return (
      <svg {...common}>
        <rect x="2.2" y="1.2" width="7.6" height="9.8" rx="1.2" fill="white" />
        <path
          d="M4.1 3.3h1M6.9 3.3h1M4.1 5.4h1M6.9 5.4h1M4.1 7.5h1M6.9 7.5h1"
          stroke="black"
          strokeOpacity="0.3"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <rect x="5.1" y="8.8" width="1.8" height="2.2" fill="black" fillOpacity="0.3" />
      </svg>
    );
  }
  if (glyph === "wheel") {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="4.9" fill="white" />
        <circle cx="6" cy="6" r="1.6" fill="black" fillOpacity="0.3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6 2.4v7.2M2.4 6h7.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface SpaceTileProps {
  id: string;
  name: string;
  avatar?: string | null;
  /** Force the neutral "Add new" tile. */
  add?: boolean;
}

export function SpaceTile({ id, name, avatar, add }: SpaceTileProps) {
  if (add) {
    return (
      <span className="rail-tile rail-tile-gray" aria-hidden>
        <GlyphSvg glyph="plus" />
      </span>
    );
  }
  if (avatar) {
    return (
      <span className="rail-tile rail-tile-photo" aria-hidden>
        <img src={avatar} alt="" />
      </span>
    );
  }
  const glyph = glyphFor(name);
  const tone = toneFor(id, glyph);
  const initial = name.replace(/[^a-zA-Z0-9]/g, "").charAt(0).toUpperCase() || "S";
  return (
    <span className={`rail-tile rail-tile-${tone}`} aria-hidden>
      {glyph ? <GlyphSvg glyph={glyph} /> : initial}
    </span>
  );
}
