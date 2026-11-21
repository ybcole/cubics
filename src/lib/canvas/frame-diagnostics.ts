/** Bounded, local numeric measurements. No page URLs, titles, DOM or pixels. */
export function createFrameDiagnostics(capacity = 240) {
  const wait: number[] = [], work: number[] = [], jobs: number[] = [], longTasks: number[] = [];
  let frames = 0, jobCount = 0, longTaskCount = 0;
  const add = (ring: number[], value: number) => {
    if (!Number.isFinite(value) || value < 0) return;
    if (ring.length === capacity) ring.shift();
    ring.push(value);
  };
  const stats = (ring: number[]) => {
    const sorted = [...ring].sort((a, b) => a - b);
    const at = (fraction: number) => sorted.length ? Number(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))].toFixed(2)) : 0;
    return { samples: sorted.length, medianMs: at(0.5), p95Ms: at(0.95), maxMs: at(1) };
  };
  return {
    frame(waitMs: number, workMs: number) { frames++; add(wait, waitMs); add(work, workMs); },
    job(duration: number) { jobCount++; add(jobs, duration); },
    longTask(duration: number) { longTaskCount++; add(longTasks, duration); },
    reset() { frames = jobCount = longTaskCount = 0; wait.length = work.length = jobs.length = longTasks.length = 0; },
    read() {
      return { frames, inputToFrame: stats(wait), cameraCallback: stats(work),
        deferredJobs: { count: jobCount, ...stats(jobs) }, longTasks: { count: longTaskCount, ...stats(longTasks) } };
    },
  };
}
export const cameraDiagnostics = createFrameDiagnostics();
