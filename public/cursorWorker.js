// Web Worker for offscreen cursor rendering at 120Hz
let canvas = null;
let ctx = null;
const cursors = new Map();

self.onmessage = (e) => {
  const data = e.data;
  if (data && data.type === "init" && data.canvas) {
    canvas = data.canvas;
    ctx = canvas.getContext("2d");
    requestAnimationFrame(render);
    return;
  }
  if (data && data.type === "cursor") {
    cursors.set(data.id, { x: data.x, y: data.y, name: data.name });
    return;
  }
  if (data && data.type === "remove") {
    cursors.delete(data.id);
    return;
  }
};

function render() {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const c of cursors.values()) {
      // simple linear extrapolation: nudge slightly ahead
      const x = c.x + 0.5;
      const y = c.y + 0.5;
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // ~120Hz
  setTimeout(() => requestAnimationFrame(render), 8);
}
