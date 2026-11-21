import { canvasWork } from "./deferred-work";

/** One native observer for all cold Personal guests; mounted guests are never evicted. */
const cold = new Map<Element, { activate: () => void; near: boolean }>();
let coldObserver: IntersectionObserver | null = null;
export function observeColdGuest(element: Element, activate: () => void): () => void {
  const record = { activate, near: false };
  cold.set(element, record);
  const queue = (priority: number) => canvasWork.enqueue(element, () => {
    if (cold.get(element) !== record || !record.near) return;
    coldObserver?.unobserve(element);
    cold.delete(element);
    activate();
  }, priority);
  if (typeof IntersectionObserver === "undefined") {
    record.near = true;
    queue(1);
  } else {
    coldObserver ??= new IntersectionObserver(entries => {
      for (const entry of entries) {
        const current = cold.get(entry.target);
        if (!current) continue;
        current.near = entry.isIntersecting;
        if (!current.near) { canvasWork.cancel(entry.target); continue; }
        const rect = entry.boundingClientRect;
        // IntersectionObserver supplies geometry; do not force a layout read.
        const distance = Math.hypot(rect.x + rect.width / 2 - window.innerWidth / 2,
          rect.y + rect.height / 2 - window.innerHeight / 2);
        const target = entry.target;
        canvasWork.enqueue(target, () => {
          if (cold.get(target) !== current || !current.near) return;
          coldObserver?.unobserve(target);
          cold.delete(target);
          current.activate();
        }, 1 + distance);
      }
    }, { rootMargin: "600px" });
    coldObserver.observe(element);
  }
  return () => {
    canvasWork.cancel(element);
    if (cold.get(element) === record) cold.delete(element);
    coldObserver?.unobserve(element);
    if (!cold.size) { coldObserver?.disconnect(); coldObserver = null; }
  };
}

/** Stream geometry changes are coalesced until the camera is quiet, then batched. */
const viewers = new Map<Element, (visible: boolean, ratio: number) => void>();
const pending = new Map<Element, IntersectionObserverEntry>();
const streamBatch = {};
let streamObserver: IntersectionObserver | null = null;
export function observeStreamVisibility(element: Element,
  update: (visible: boolean, ratio: number) => void): () => void {
  viewers.set(element, update);
  if (typeof IntersectionObserver === "undefined") {
    canvasWork.enqueue(element, () => { if (viewers.get(element) === update) update(true, 1); });
  } else {
    streamObserver ??= new IntersectionObserver(entries => {
      for (const entry of entries) if (viewers.has(entry.target)) pending.set(entry.target, entry);
      canvasWork.enqueue(streamBatch, () => {
        const updates = [...pending.values()];
        pending.clear();
        for (const entry of updates) viewers.get(entry.target)?.(entry.isIntersecting, entry.intersectionRatio);
      }, -1);
    }, { rootMargin: "120px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    streamObserver.observe(element);
  }
  return () => {
    viewers.delete(element);
    pending.delete(element);
    canvasWork.cancel(element);
    streamObserver?.unobserve(element);
    if (!viewers.size) {
      canvasWork.cancel(streamBatch);
      streamObserver?.disconnect();
      streamObserver = null;
    }
  };
}
