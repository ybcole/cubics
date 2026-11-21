interface Pose { x: number; y: number; zoom: number }
interface MotionClock { now(): number; schedule(callback: () => void, ms: number): number; cancel(id: number): void }
/** Suppress native surfaces before camera transforms, including uncached/heavy guests. */
export function createPreviewMotion(clock: MotionClock, initial: Pose, active: (value: boolean) => void) {
  let previous = initial, deadline = 0, moving = false, timer: number | null = null;
  const holds = new Set<object>();
  const arm = () => {
    if (!moving || holds.size || timer !== null) return;
    timer = clock.schedule(() => {
      timer = null;
      if (holds.size) return;
      if (clock.now() < deadline) { arm(); return; }
      moving = false; active(false);
    }, Math.max(0, deadline - clock.now()));
  };
  const begin = () => {
    if (!moving) { moving = true; active(true); }
    deadline = clock.now() + 300;
    arm();
  };
  return {
    begin,
    sample(pose: Pose, extent: number) {
      const distance = Math.hypot(pose.x - previous.x, pose.y - previous.y) + Math.abs(Math.log(pose.zoom / previous.zoom)) * extent / 2;
      previous = pose;
      if (distance < 0.001) return;
      begin();
    },
    hold(key: object) { holds.add(key); if (timer !== null) { clock.cancel(timer); timer = null; } },
    release(key: object) { if (holds.delete(key) && moving) { deadline = clock.now() + 300; arm(); } },
    dispose() { if (timer !== null) clock.cancel(timer); timer = null; holds.clear(); if (moving) active(false); moving = false; },
  };
}
