"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface RoomItem {
  id: string;
  name: string;
  status: "active" | "private" | "public";
  meta?: string;
  members?: number;
}

interface SpacesListFishEyeProps {
  rooms: RoomItem[];
  onSelect?: (room: RoomItem) => void;
}

const MAX_SCALE = 1.18;
const LENS_RADIUS = 96;
const BASE_ITEM_HEIGHT = 56;

function gaussian(d: number, radius: number) {
  return Math.exp(-(d * d) / (2 * radius * radius));
}

export default function SpacesListFishEye({ rooms, onSelect }: SpacesListFishEyeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [cursorY, setCursorY] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingY = useRef<number | null>(null);

  const update = useCallback(() => {
    if (pendingY.current == null) return;
    setCursorY(pendingY.current);
    rafRef.current = null;
  }, []);

  const onMove = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pendingY.current = e.clientY - rect.top + (containerRef.current?.scrollTop || 0);
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(update);
  }, [update]);

  const onLeave = useCallback(() => {
    pendingY.current = null;
    setCursorY(null);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [rooms]);

  const scales = useMemo(() => {
    if (cursorY == null) return sortedRooms.map(() => 1);
    return sortedRooms.map((_, i) => {
      const el = itemRefs.current[i];
      if (!el) return 1;
      const center = el.offsetTop + el.offsetHeight / 2;
      const d = Math.abs(cursorY - center);
      const g = gaussian(d, LENS_RADIUS);
      return 1 + (MAX_SCALE - 1) * g;
    });
  }, [cursorY, sortedRooms]);

  useEffect(() => {
    if (cursorY == null) {
      setActiveId(null);
      return;
    }
    let best = -1;
    let bestD = Infinity;
    sortedRooms.forEach((_, i) => {
      const el = itemRefs.current[i];
      if (!el) return;
      const center = el.offsetTop + el.offsetHeight / 2;
      const d = Math.abs(cursorY - center);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setActiveId(best >= 0 ? sortedRooms[best].id : null);
  }, [cursorY, sortedRooms]);

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const r of sortedRooms) {
      const ch = r.name.trim().charAt(0).toUpperCase();
      if (/[A-Z]/.test(ch)) set.add(ch);
    }
    return Array.from(set).sort();
  }, [sortedRooms]);

  const letterToIndex = useMemo(() => {
    const map: Record<string, number> = {};
    sortedRooms.forEach((r, i) => {
      const ch = r.name.trim().charAt(0).toUpperCase();
      if (!(ch in map)) map[ch] = i;
    });
    return map;
  }, [sortedRooms]);

  const scrollToLetter = useCallback((letter: string) => {
    const idx = letterToIndex[letter];
    if (idx == null) return;
    const el = itemRefs.current[idx];
    if (el && containerRef.current) {
      containerRef.current.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
    }
  }, [letterToIndex]);

  const statusColor = (s: RoomItem["status"]) => {
    if (s === "active") return "bg-success";
    if (s === "private") return "bg-fg-subtle";
    return "bg-accent";
  };

  return (
    <div className="relative w-full flex gap-3">
      <div className="flex flex-col items-center gap-0.5 py-2 select-none">
        {availableLetters.map((letter) => (
          <button
            key={letter}
            type="button"
            onClick={() => scrollToLetter(letter)}
            className="text-caption text-fg-muted hover:text-accent-ink transition-colors duration-150 w-4 text-center"
          >
            {letter}
          </button>
        ))}
      </div>
      <div
        ref={containerRef}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="relative"
      >
        {sortedRooms.map((room, i) => {
            const scale = scales[i] ?? 1;
            const zoomed = scale > 1.06;
            return (
              <div
                key={room.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                onClick={() => onSelect?.(room)}
                className="mx-2 my-1 transition-colors duration-150 hover:text-accent-ink cursor-pointer"
                style={{
                  transform: `scale(${scale}) translateY(0)`,
                  transformOrigin: "center",
                  willChange: "transform",
                  minHeight: BASE_ITEM_HEIGHT,
                  position: "relative",
                  zIndex: Math.round(scale * 10),
                }}
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor(room.status)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-small font-medium text-fg truncate">{room.name}</div>
                    {zoomed && room.meta && (
                      <div className="text-caption text-fg-muted truncate mt-0.5">{room.meta}</div>
                    )}
                  </div>
                  {zoomed && typeof room.members === "number" && (
                    <span className="text-caption text-fg-subtle shrink-0">{room.members} members</span>
                  )}
                </div>
                {zoomed && room.members && room.members > 0 && (
                  <div className="px-3 pb-2 flex -space-x-1">
                    {Array.from({ length: Math.min(4, room.members) }).map((_, k) => (
                      <span
                        key={k}
                        className="w-5 h-5 rounded-full bg-hover border border-line"
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>


      {activeId && (
        <div className="pointer-events-none absolute right-10 top-2 px-2 py-1 rounded-sm bg-surface border border-line shadow-sm">
          <span className="text-caption text-fg">
            {sortedRooms.find((r) => r.id === activeId)?.name}
          </span>
        </div>
      )}
    </div>
  );
}
