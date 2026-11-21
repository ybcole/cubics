/** M10.03/M12.06: local geometry only; never inspect page content or private URLs. */
export type Direction = "up" | "down" | "left" | "right";
export interface Point { x: number; y: number }
export interface SpatialTab { id: string; x: number; y: number; w: number; h: number }

export function keyDirection(key: string): Direction | null {
  switch (key.toLowerCase()) {
    case "w": case "arrowup": return "up";
    case "s": case "arrowdown": return "down";
    case "a": case "arrowleft": return "left";
    case "d": case "arrowright": return "right";
    default: return null;
  }
}

export function tabCenter(tab: SpatialTab): Point {
  return { x: tab.x + tab.w / 2, y: tab.y + tab.h / 2 };
}

export function cameraForTab(tab: SpatialTab, zoom: number, width: number, height: number): Point {
  const center = tabCenter(tab);
  return { x: center.x * zoom - width / 2, y: center.y * zoom - height / 2 };
}

/** A single O(n) pass, no sorting, DOM measurements, distance cap or narrow cone.
 * Distance dominates nearby choices; a continuous lateral penalty favors alignment
 * without letting an arbitrarily distant aligned tab beat every nearer diagonal.
 * Stable ID breaks exact ties independently of network/snapshot ordering.
 */
export function findDirectionalTab<T extends SpatialTab>(tabs: readonly T[], origin: Point,
  direction: Direction, excludeId?: string): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const tab of tabs) {
    if (tab.id === excludeId || !Number.isFinite(tab.x) || !Number.isFinite(tab.y) ||
        !Number.isFinite(tab.w) || !Number.isFinite(tab.h) || tab.w <= 0 || tab.h <= 0) continue;
    const dx = tab.x + tab.w / 2 - origin.x;
    const dy = tab.y + tab.h / 2 - origin.y;
    const vertical = direction === "up" || direction === "down";
    const forward = direction === "up" ? -dy : direction === "down" ? dy : direction === "left" ? -dx : dx;
    if (forward <= 0.000001) continue;
    const lateral = Math.abs(vertical ? dx : dy);
    const distance = Math.hypot(dx, dy);
    const score = distance + 2 * lateral + lateral * lateral / distance;
    if (score < bestScore || (score === bestScore && best && tab.id < best.id)) {
      best = tab;
      bestScore = score;
    }
  }
  return best;
}

/** Only the canvas owns these shortcuts. Never consume native/browser/control input. */
export function canNavigateCanvas(event: KeyboardEvent, canvas: HTMLElement | null): boolean {
  if (!canvas || event.defaultPrevented || event.repeat || event.isComposing ||
      event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
  const doc = canvas.ownerDocument;
  if ((event.target !== canvas && event.target !== doc.body) ||
      (doc.activeElement !== canvas && doc.activeElement !== doc.body)) return false;
  return !doc.querySelector('[role="dialog"], [aria-modal="true"]');
}
