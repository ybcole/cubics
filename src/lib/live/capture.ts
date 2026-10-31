"use client";

/**
 * Host-side capture of a <webview>.
 *
 * Fast path: Chromium tab capture of the guest WebContents. Hardware-composited,
 * emits frames only when pixels change, and never touches the renderer's main
 * thread — unlike the old capturePage() -> PNG -> Blob -> ImageBitmap -> canvas
 * loop, which ran flat out on the same thread that draws the canvas.
 *
 * Fallback (if the IPC/capture API is unavailable): throttled JPEG loop.
 */

export interface CaptureSource {
  getWebContentsId(): number;
  capturePage(): Promise<NativeImageLike>;
}

interface NativeImageLike {
  isEmpty(): boolean;
  getSize(): { width: number; height: number };
  resize(options: { width?: number; height?: number; quality?: "good" | "better" | "best" }): NativeImageLike;
  toJPEG(quality: number): Uint8Array;
}

export interface Capture {
  track: MediaStreamTrack;
  stop(): void;
}

export async function captureWebview(wv: CaptureSource): Promise<Capture> {
  try {
    return await captureNative(wv);
  } catch (err) {
    console.warn("[live] native tab capture unavailable, using fallback", err);
    return captureFallback(wv);
  }
}

async function captureNative(wv: CaptureSource): Promise<Capture> {
  const api = window.cubics;
  if (!api?.getTabMediaSourceId) throw new Error("getTabMediaSourceId missing");
  const chromeMediaSourceId = await api.getTabMediaSourceId(wv.getWebContentsId());
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId,
        maxWidth: 1920,
        maxHeight: 1080,
        maxFrameRate: 30,
      },
    },
  } as unknown as MediaStreamConstraints);
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error("no video track");
  track.contentHint = "detail";
  return { track, stop: () => stream.getTracks().forEach((t) => t.stop()) };
}

function captureFallback(wv: CaptureSource): Capture {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d", { alpha: false });
  const stream = canvas.captureStream(15);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    const started = performance.now();
    try {
      if (document.visibilityState === "visible") {
        const image = await wv.capturePage();
        if (!image.isEmpty() && ctx) {
          const size = image.getSize();
          const scale = Math.min(1, 1280 / Math.max(1, size.width));
          const out = scale < 1 ? image.resize({ width: Math.round(size.width * scale), quality: "good" }) : image;
          const dim = out.getSize();
          const blob = new Blob([out.toJPEG(75) as unknown as BlobPart], { type: "image/jpeg" });
          const bitmap = await createImageBitmap(blob);
          if (canvas.width !== dim.width || canvas.height !== dim.height) {
            canvas.width = dim.width;
            canvas.height = dim.height;
          }
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
        }
      }
    } catch {}
    if (!stopped) timer = setTimeout(tick, Math.max(0, 66 - (performance.now() - started)));
  };
  void tick();

  const track = stream.getVideoTracks()[0];
  track.contentHint = "detail";
  return {
    track,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
