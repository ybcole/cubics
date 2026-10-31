"use client";

import { memo, useEffect, useRef, useState } from "react";

/**
 * Remote cursors, moved out of page state.
 *
 * Every cursor:move used to call setState on the whole room page (chat, rail,
 * every widget wrapper) at up to 60 Hz per remote user. Positions are now
 * written straight to the DOM; React only re-renders when a cursor appears or
 * disappears.
 */

interface Cursor {
  x: number;
  y: number;
  userName: string;
  color: string;
}

type Listener = (id: string, cursor: Cursor | null) => void;
const listeners = new Set<Listener>();

export const cursorBus = {
  move(id: string, cursor: Cursor) {
    listeners.forEach((l) => l(id, cursor));
  },
  leave(id: string) {
    listeners.forEach((l) => l(id, null));
  },
};

const EXPIRE_MS = 3000;

function RemoteCursors() {
  const [ids, setIds] = useState<string[]>([]);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const data = useRef(new Map<string, Cursor & { seen: number }>());

  useEffect(() => {
    const remove = (id: string) => {
      if (!data.current.delete(id)) return;
      setIds((prev) => prev.filter((x) => x !== id));
    };
    const listener: Listener = (id, cursor) => {
      if (!cursor) return remove(id);
      const known = data.current.has(id);
      data.current.set(id, { ...cursor, seen: Date.now() });
      if (!known) setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      else {
        const node = nodes.current.get(id);
        if (node) node.style.transform = `translate3d(${cursor.x}px, ${cursor.y}px, 0)`;
      }
    };
    listeners.add(listener);
    const sweep = setInterval(() => {
      const cutoff = Date.now() - EXPIRE_MS;
      for (const [id, c] of data.current) if (c.seen < cutoff) remove(id);
    }, 1000);
    return () => {
      listeners.delete(listener);
      clearInterval(sweep);
    };
  }, []);

  return (
    <>
      {ids.map((id) => {
        const c = data.current.get(id);
        if (!c) return null;
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) nodes.current.set(id, el);
              else nodes.current.delete(id);
            }}
            className="absolute"
            style={{ left: 0, top: 0, transform: `translate3d(${c.x}px, ${c.y}px, 0)`, willChange: "transform" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow">
              <path d="M0 0 L0 14 L4 10 L7 17 L9 16 L6 9 L12 9 Z" fill={c.color || "#3b82f6"} stroke="#fff" strokeWidth="1" />
            </svg>
            <span className="ml-2 px-1.5 py-0.5 rounded bg-surface text-caption text-fg shadow-sm whitespace-nowrap">
              {c.userName}
            </span>
          </div>
        );
      })}
    </>
  );
}

export default memo(RemoteCursors);
