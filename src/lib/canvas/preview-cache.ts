export interface PreparedPreview {
  url: string;
  bytes: number;
  pixels: number;
  release(): void;
}
interface PreviewWork {
  enqueue(key: object, run: () => void, priority?: number): void;
  cancel(key: object): void;
}
interface PreviewClock { now(): number; every(callback: () => void, ms: number): number; stop(id: number): void }

/** Local-only bounded LRU; no persistence or workspace metadata. */
export function createPreviewCoordinator(work: PreviewWork, clock: PreviewClock,
  limits = { count: 128, bytes: 32 * 1024 * 1024, pixels: 8_000_000 }) {
  interface Record {
    alive: boolean; visible: boolean; version: number; last: number; publishing: object;
    capture: (signal: AbortSignal, maxPixels: number) => Promise<PreparedPreview>; update: (url: string | null) => void;
    image: PreparedPreview | null; prepared: PreparedPreview | null; controller: AbortController | null;
  }
  const records = new Set<Record>(), pending = new Set<Record>(), cached = new Map<Record, PreparedPreview>();
  const worker = {};
  let active = false, interval: number | null = null, bytes = 0, pixels = 0;
  const drop = (record: Record) => {
    const image = cached.get(record);
    if (!image) return;
    cached.delete(record); bytes -= image.bytes; pixels -= image.pixels;
    record.image = null;
    if (record.alive) record.update(null);
    image.release();
  };
  const install = (record: Record, image: PreparedPreview) => {
    if (image.bytes > limits.bytes || image.pixels > limits.pixels) { image.release(); return; }
    drop(record);
    cached.set(record, image); bytes += image.bytes; pixels += image.pixels;
    record.image = image;
    record.update(image.url);
    while (cached.size > limits.count || bytes > limits.bytes || pixels > limits.pixels) drop(cached.keys().next().value!);
  };
  const pump = () => {
    if (active || !pending.size) return;
    work.enqueue(worker, () => {
      if (active) return;
      const eligible = [...pending].filter(record => record.alive && record.visible);
      const record = eligible.find(record => !record.image) ?? eligible[0];
      if (!record) { pending.clear(); return; }
      pending.delete(record);
      active = true;
      const version = record.version, controller = new AbortController();
      record.controller = controller;
      void Promise.resolve().then(() => record.capture(controller.signal, Math.max(1, Math.floor(limits.pixels / Math.max(1, records.size))))).then(image => {
        if (!record.alive || !record.visible || record.version !== version) { image.release(); return; }
        record.prepared?.release();
        record.prepared = image;
        work.enqueue(record.publishing, () => {
          record.prepared = null;
          if (!record.alive || !record.visible || record.version !== version) { image.release(); return; }
          install(record, image);
        }, -0.5);
      }).catch(() => {
        // A transient readback failure must not discard a valid last-good preview.
      }).finally(() => {
        if (record.controller === controller) record.controller = null;
        record.last = clock.now();
        if (record.version === version) pending.delete(record);
        active = false;
        pump();
      });
    }, -0.5);
  };
  const request = (record: Record, force = false) => {
    if (!record.alive || !record.visible || (!force && clock.now() - record.last < 1500)) return;
    pending.add(record); pump();
  };
  return {
    register(capture: (signal: AbortSignal, maxPixels: number) => Promise<PreparedPreview>, update: (url: string | null) => void) {
      const record: Record = { alive: true, visible: false, version: 0, last: -Infinity, publishing: {}, capture, update, image: null, prepared: null, controller: null };
      records.add(record);
      interval ??= clock.every(() => { for (const record of records) request(record); }, 1500);
      return {
        visible(visible: boolean) { record.visible = visible; if (visible) request(record); else pending.delete(record); },
        invalidate() { record.version++; record.controller?.abort(); work.cancel(record.publishing); record.prepared?.release(); record.prepared = null; drop(record); request(record, true); },
        refresh() { request(record, true); },
        dispose() {
          record.alive = false; record.version++; record.controller?.abort(); record.prepared?.release(); record.prepared = null; pending.delete(record); work.cancel(record.publishing); drop(record); records.delete(record);
          if (!records.size && interval !== null) { clock.stop(interval); interval = null; work.cancel(worker); }
        },
      };
    },
    stats: () => ({ count: cached.size, bytes, pixels, queued: pending.size, capturing: active }),
  };
}
