import { createLatestFrame } from "./latest-frame";
export interface CameraPose { x: number; y: number; zoom: number }
export interface ScreenPoint { x: number; y: number }

export function zoomAt(camera: CameraPose, zoom: number, anchor: ScreenPoint): CameraPose {
  if (!Number.isFinite(zoom) || !Number.isFinite(camera.zoom) || camera.zoom <= 0) return camera;
  const next = Math.max(0.1, Math.min(5, zoom));
  if (!Number.isFinite(next) || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return camera;
  const ratio = next / camera.zoom;
  return { x: (camera.x + anchor.x) * ratio - anchor.x,
    y: (camera.y + anchor.y) * ratio - anchor.y, zoom: next };
}

/** M10.01/M10.02: pan and zoom compose in event order into ONE pending pose.
 * No React work, DOM measurement, IPC, or independent competing camera loops.
 */
export function createCameraGesture(options: {
  request: (callback: () => void) => number;
  cancel: (id: number) => void;
  read: () => CameraPose;
  constrain: (camera: CameraPose) => CameraPose;
  write: (camera: CameraPose) => void;
  pointer: (point: ScreenPoint) => void;
  measure?: { now: () => number; frame: (waitMs: number, workMs: number) => void };
}) {
  let pending: CameraPose | null = null;
  let pointer: ScreenPoint | null = null;
  let panPoint: ScreenPoint | null = null;
  let queuedAt: number | null = null;
  const current = () => pending ?? options.read();
  const frame = createLatestFrame<boolean>(options.request, options.cancel, () => {
    const camera = pending, point = pointer, queued = queuedAt;
    const start = camera && options.measure ? options.measure.now() : 0;
    pending = null;
    pointer = null;
    queuedAt = null;
    if (camera) options.write(camera);
    if (point) options.pointer(point);
    if (camera && queued !== null && options.measure) options.measure.frame(start - queued, options.measure.now() - start);
  });
  const enqueue = (camera: CameraPose) => {
    if (!pending && options.measure) queuedAt = options.measure.now();
    pending = options.constrain(camera);
    frame.push(true);
  };
  return {
    current,
    beginPan(point: ScreenPoint) { frame.flush(); if (Number.isFinite(point.x) && Number.isFinite(point.y)) panPoint = point; },
    pointer(point: ScreenPoint) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      if (panPoint) {
        const camera = current();
        enqueue({ ...camera, x: camera.x - (point.x - panPoint.x), y: camera.y - (point.y - panPoint.y) });
        panPoint = point;
      }
      pointer = point;
      frame.push(true);
    },
    endPan() { frame.flush(); panPoint = null; },
    zoomTo(value: number, anchor: ScreenPoint) {
      const camera = current();
      const next = zoomAt(camera, value, anchor);
      if (next.zoom !== camera.zoom) enqueue(next);
    },
    wheel(delta: number, mode: number, pinch: boolean, anchor: ScreenPoint, viewportHeight: number) {
      if (!Number.isFinite(delta)) return;
      const raw = mode === 1 ? delta * 33 : mode === 2 ? delta * viewportHeight : delta;
      const limit = pinch ? 20 : 100;
      const step = Math.max(-limit, Math.min(limit, raw));
      const camera = current();
      const next = zoomAt(camera, camera.zoom * Math.exp(-step * (pinch ? 0.01 : 0.0005)), anchor);
      if (next.zoom !== camera.zoom) enqueue(next);
    },
    flush() { frame.flush(); },
    cancel() { frame.cancel(); pending = null; pointer = null; panPoint = null; queuedAt = null; },
  };
}
