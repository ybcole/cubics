"use client";

/**
 * Decode budget. However many live tabs a room has, a client only ever decodes
 * a bounded number of them:
 *   live — full quality, sized to the on-screen rect (top MAX_LIVE by area)
 *   low  — lowest simulcast layer (next MAX_LOW)
 *   off  — unsubscribed; the tab shows its last frame as a still
 * Tabs that are off-screen never enter the budget at all.
 */
import { create } from "zustand";

export type Tier = "live" | "low" | "off";

export const MAX_LIVE = 6;
export const MAX_LOW = 24;

export const useBudget = create<{ tiers: Record<string, Tier> }>(() => ({ tiers: {} }));

const demand = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;

function recompute() {
  timer = null;
  const ranked = [...demand.entries()].sort((a, b) => b[1] - a[1]);
  const next: Record<string, Tier> = {};
  ranked.forEach(([id], i) => {
    next[id] = i < MAX_LIVE ? "live" : i < MAX_LIVE + MAX_LOW ? "low" : "off";
  });
  const prev = useBudget.getState().tiers;
  const a = Object.keys(prev);
  const same = a.length === ranked.length && a.every((id) => prev[id] === next[id]);
  if (!same) useBudget.setState({ tiers: next });
}

function schedule() {
  if (!timer) timer = setTimeout(recompute, 60);
}

/** area = on-screen pixels the tab occupies (0 / cleared = not visible). */
export function reportDemand(id: string, area: number) {
  demand.set(id, area);
  schedule();
}

export function clearDemand(id: string) {
  if (demand.delete(id)) schedule();
}
