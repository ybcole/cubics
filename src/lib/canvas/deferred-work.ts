/** M10.02/M11.04: non-camera work runs after motion settles, one job per slot. */
export interface WorkClock {
  now(): number;
  schedule(callback: () => void, delay: number): number;
  cancel(id: number): void;
}
export function createDeferredWork(clock: WorkClock, quietMs = 100, spacingMs = 32) {
  const jobs = new Map<object, { run: () => void; priority: number }>();
  let quietUntil = 0;
  let timer: number | null = null;
  let disposed = false;
  const arm = () => {
    if (disposed || timer !== null || jobs.size === 0) return;
    timer = clock.schedule(flush, Math.max(spacingMs, quietUntil - clock.now()));
  };
  const flush = () => {
    timer = null;
    if (disposed) return;
    if (clock.now() < quietUntil) { arm(); return; }
    let key: object | undefined;
    let priority = Infinity;
    for (const [candidate, job] of jobs) {
      if (job.priority < priority) { key = candidate; priority = job.priority; }
    }
    if (key) {
      const job = jobs.get(key)!;
      jobs.delete(key);
      try { job.run(); } finally { arm(); }
    }
  };
  return {
    touch() { quietUntil = clock.now() + quietMs; },
    enqueue(key: object, run: () => void, priority = 0) {
      if (disposed) return;
      jobs.set(key, { run, priority });
      arm();
    },
    cancel(key: object) {
      jobs.delete(key);
      if (jobs.size === 0 && timer !== null) { clock.cancel(timer); timer = null; }
    },
    dispose() {
      disposed = true;
      jobs.clear();
      if (timer !== null) clock.cancel(timer);
      timer = null;
    },
    get pending() { return jobs.size; },
  };
}

// Lazy browser bindings: safe to import during Next.js server rendering.
export const canvasWork = createDeferredWork({
  now: () => performance.now(),
  schedule: (callback, delay) => window.setTimeout(callback, delay),
  cancel: id => window.clearTimeout(id),
});
