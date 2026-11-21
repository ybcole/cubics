import { cameraDiagnostics } from "./frame-diagnostics";

/** M10.02/M11.04: non-camera work runs after interaction quiet AND browser idle. */
export interface WorkClock {
  now(): number;
  schedule(callback: () => void, delay: number): number;
  cancel(id: number): void;
  idle?: {
    request(callback: (remainingMs: number) => void): number;
    cancel(id: number): void;
  };
  sample?: (durationMs: number) => void;
}
export function createDeferredWork(clock: WorkClock, quietMs = 100, spacingMs = 32) {
  const jobs = new Map<object, { run: () => void; priority: number }>();
  const holds = new Set<object>();
  let quietUntil = 0;
  let timer: number | null = null;
  let idle: number | null = null;
  let disposed = false;
  let generation = 0;
  const cancelScheduled = () => {
    generation++;
    if (timer !== null) clock.cancel(timer);
    if (idle !== null) clock.idle?.cancel(idle);
    timer = idle = null;
  };
  const arm = () => {
    if (disposed || holds.size || timer !== null || idle !== null || jobs.size === 0) return;
    const epoch = generation;
    timer = clock.schedule(() => { if (epoch === generation) flush(); }, Math.max(spacingMs, quietUntil - clock.now()));
  };
  const run = () => {
    if (disposed || holds.size || clock.now() < quietUntil) { arm(); return; }
    let key: object | undefined;
    let priority = Infinity;
    for (const [candidate, job] of jobs) {
      if (job.priority < priority) { key = candidate; priority = job.priority; }
    }
    if (key) {
      const job = jobs.get(key)!;
      jobs.delete(key);
      const start = clock.sample ? clock.now() : 0;
      try { job.run(); } finally {
        clock.sample?.(clock.now() - start);
        arm();
      }
    }
  };
  const flush = () => {
    timer = null;
    if (disposed || holds.size) return;
    if (clock.now() < quietUntil) { arm(); return; }
    if (!clock.idle) { run(); return; }
    const epoch = generation;
    idle = clock.idle.request(remaining => {
      if (epoch !== generation) return;
      idle = null;
      if (remaining < 4) { arm(); return; }
      run();
    });
  };
  return {
    touch() {
      quietUntil = clock.now() + quietMs;
      // A native idle callback already admitted before new input must not run.
      if (idle !== null) { generation++; clock.idle?.cancel(idle); idle = null; }
      arm();
    },
    hold(key: object) { holds.add(key); cancelScheduled(); },
    release(key: object) {
      if (!holds.delete(key)) return;
      quietUntil = clock.now() + quietMs;
      arm();
    },
    enqueue(key: object, run: () => void, priority = 0) {
      if (disposed) return;
      jobs.set(key, { run, priority });
      arm();
    },
    cancel(key: object) {
      jobs.delete(key);
      if (jobs.size === 0) cancelScheduled();
    },
    dispose() {
      disposed = true;
      jobs.clear(); holds.clear(); cancelScheduled();
    },
    get pending() { return jobs.size; },
  };
}

// A burst of gestures commonly contains >100ms gaps. Keep costly startup and
// resolution changes out of those gaps; active pointer holds block them entirely.
export const canvasWork = createDeferredWork({
  now: () => performance.now(),
  sample: typeof process !== "undefined" && process.env.NODE_ENV === "development" ? duration => cameraDiagnostics.job(duration) : undefined,
  schedule: (callback, delay) => window.setTimeout(callback, delay),
  cancel: id => window.clearTimeout(id),
  idle: {
    request: callback => typeof window.requestIdleCallback === "function" && typeof window.cancelIdleCallback === "function"
      ? window.requestIdleCallback(deadline => callback(deadline.timeRemaining()))
      : window.setTimeout(() => callback(50), 0),
    cancel: id => typeof window.requestIdleCallback === "function" && typeof window.cancelIdleCallback === "function"
      ? window.cancelIdleCallback(id) : window.clearTimeout(id),
  },
}, 300);
