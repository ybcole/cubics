import type { Point } from "./directional-navigation";

export interface MotionScheduler {
  now: () => number;
  request: (callback: (time: number) => void) => number;
  cancel: (id: number) => void;
}

/** M10.02: one frame in flight, no React updates, layout reads, IPC or storage per frame. */
export function createCameraMotion(scheduler: MotionScheduler,
  write: (point: Point) => void, complete: () => void) {
  let frame: number | null = null;
  let generation = 0;
  const stop = () => {
    const running = frame !== null;
    generation++;
    if (frame !== null) scheduler.cancel(frame);
    frame = null;
    return running;
  };
  return {
    stop,
    get running() { return frame !== null; },
    move(from: Point, to: Point, reducedMotion = false) {
      stop();
      if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return;
      if (reducedMotion || (from.x === to.x && from.y === to.y)) {
        write(to);
        complete();
        return;
      }
      const epoch = generation;
      const start = scheduler.now();
      const tick = (time: number) => {
        if (epoch !== generation) return;
        frame = null;
        const progress = Math.max(0, Math.min(1, (time - start) / 180));
        const eased = 1 - (1 - progress) ** 3;
        write(progress === 1 ? to : {
          x: from.x + (to.x - from.x) * eased,
          y: from.y + (to.y - from.y) * eased,
        });
        if (epoch !== generation) return;
        if (progress < 1) frame = scheduler.request(tick);
        else complete();
      };
      frame = scheduler.request(tick);
    },
  };
}
