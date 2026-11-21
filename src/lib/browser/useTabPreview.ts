"use client";

import { useEffect, useState, type RefObject } from "react";
import { canvasWork } from "@/lib/canvas/deferred-work";
import { observeStreamVisibility } from "@/lib/canvas/visibility";
import { createPreviewCoordinator, type PreparedPreview } from "@/lib/canvas/preview-cache";

interface NativePreviewImage {
  isEmpty(): boolean;
  getSize(): { width: number; height: number };
  resize(options: { width: number; height: number; quality: "good" }): NativePreviewImage;
  toDataURL(): string;
}
export interface PreviewGuest extends HTMLElement {
  capturePage(): Promise<NativePreviewImage>;
  isLoading?(): boolean;
}
const previews = createPreviewCoordinator(canvasWork, {
  now: () => performance.now(), every: (callback, ms) => window.setInterval(callback, ms), stop: id => window.clearInterval(id),
});

export async function prepareGuestPreview(guest: PreviewGuest, signal: AbortSignal, maxPixels = 960 * 720): Promise<PreparedPreview> {
  if (signal.aborted || !guest.isConnected) throw new Error("Guest not ready");
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  if (Number.isFinite(guest.clientWidth) && Number.isFinite(guest.clientHeight) &&
      (guest.clientWidth <= 0 || guest.clientHeight <= 0 || guest.clientWidth * guest.clientHeight * dpr * dpr > 16_000_000)) {
    throw new Error("Guest too large for preview");
  }
  const image = await guest.capturePage();
  if (signal.aborted || !guest.isConnected) throw new Error("Preview canceled");
  // Native readback may finish after movement restarts. Encoding and decoding
  // are a separate cancellable idle stage, not an eager promise continuation.
  return new Promise((resolve, reject) => {
    const stage = {};
    let url: string | null = null, warm: HTMLImageElement | null = null, released = false;
    const release = () => {
      if (released) return;
      released = true; warm?.removeAttribute("src"); if (url) URL.revokeObjectURL(url);
    };
    const abort = () => { signal.removeEventListener("abort", abort); canvasWork.cancel(stage); release(); reject(new Error("Preview canceled")); };
    signal.addEventListener("abort", abort, { once: true });
    canvasWork.enqueue(stage, () => {
      if (signal.aborted || !guest.isConnected) { abort(); return; }
      try {
        if (image.isEmpty()) throw new Error("Empty preview");
        const original = image.getSize();
        if (!original.width || !original.height) throw new Error("Invalid preview size");
        const ratio = Math.min(1, 960 / original.width, 720 / original.height, Math.sqrt(Math.max(1, maxPixels) / (original.width * original.height)));
        const width = Math.max(1, Math.floor(original.width * ratio)), height = Math.max(1, Math.floor(original.height * ratio));
        // toJPEG returns a Node Buffer, which Electron cannot construct in a
        // sandboxed page world. toDataURL returns a sandbox-safe PNG string.
        const data = image.resize({ width, height, quality: "good" }).toDataURL();
        const prefix = "data:image/png;base64,";
        if (!data.startsWith(prefix)) throw new Error("Invalid native preview encoding");
        const binary = atob(data.slice(prefix.length));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        const blob = new Blob([bytes.buffer], { type: "image/png" });
        url = URL.createObjectURL(blob); warm = new Image(); warm.src = url;
        void warm.decode().then(() => {
          signal.removeEventListener("abort", abort);
          if (signal.aborted) { release(); reject(new Error("Preview canceled")); return; }
          resolve({ url: url!, bytes: blob.size, pixels: width * height, release });
        }).catch(error => { signal.removeEventListener("abort", abort); release(); reject(error); });
      } catch (error) { signal.removeEventListener("abort", abort); release(); reject(error); }
    }, -0.5);
  });
}

/** Private, in-memory previews exist only for an authorized, mounted guest. */
export function useTabPreview(container: RefObject<HTMLDivElement | null>, guest: RefObject<PreviewGuest | null>,
  scope: string | null, ready: boolean): string | null {
  const [preview, setPreview] = useState<{ scope: string; url: string | null } | null>(null);
  useEffect(() => {
    const element = container.current, frame = guest.current;
    if (process.env.NEXT_PUBLIC_CUBICS_MOTION_PREVIEWS === "0" || !scope || !ready || !element || !frame || typeof frame.capturePage !== "function") return;
    const record = previews.register((signal, maxPixels) => prepareGuestPreview(frame, signal, maxPixels), url => setPreview({ scope, url }));
    const stopVisibility = observeStreamVisibility(element, visible => record.visible(visible));
    const invalidate = () => record.invalidate();
    const refresh = () => record.refresh();
    frame.addEventListener("did-start-loading", invalidate);
    frame.addEventListener("did-navigate-in-page", invalidate);
    frame.addEventListener("did-stop-loading", refresh);
    return () => {
      stopVisibility(); record.dispose();
      frame.removeEventListener("did-start-loading", invalidate);
      frame.removeEventListener("did-navigate-in-page", invalidate);
      frame.removeEventListener("did-stop-loading", refresh);
    };
  }, [scope, ready, container, guest]);
  return process.env.NEXT_PUBLIC_CUBICS_MOTION_PREVIEWS !== "0" && ready && preview?.scope === scope ? preview.url : null;
}
