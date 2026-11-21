/** Latest-input-wins frame coalescer. One write per display frame, final input preserved. */
export function createLatestFrame<T>(request: (callback: () => void) => number,
  cancel: (id: number) => void, write: (value: T) => void) {
  let frame: number | null = null;
  let latest: T | undefined;
  let generation = 0;
  const flush = () => {
    frame = null;
    const value = latest;
    latest = undefined;
    if (value !== undefined) write(value);
  };
  return {
    push(value: T) {
      latest = value;
      if (frame === null) {
        const epoch = generation;
        frame = request(() => { if (epoch === generation) flush(); });
      }
    },
    flush() { generation++; if (frame !== null) cancel(frame); flush(); },
    cancel() {
      generation++;
      if (frame !== null) cancel(frame);
      frame = null;
      latest = undefined;
    },
  };
}
