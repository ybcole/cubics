"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Monitor, MonitorOff } from "lucide-react";

interface TabShareWidgetProps {
  widgetId: string;
  onDelete: () => void;
}

export default function TabShareWidget({ widgetId, onDelete }: TabShareWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attachStream = useCallback((stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.play().catch(() => {});
  }, []);

  const startShare = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;
      setSharing(true);
      // Attach after state update so videoRef is mounted
      requestAnimationFrame(() => attachStream(stream));
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        setSharing(false);
        streamRef.current = null;
      });
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError("Could not start screen share");
      }
    }
  }, [attachStream]);

  const stopShare = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setSharing(false);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-surface">
      {!sharing ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <Monitor className="w-5 h-5 text-zinc-500" />
          <p className="text-xs text-zinc-500 text-center">Share a browser tab</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={startShare}
            className="btn-primary px-3 py-1.5"
          >
            Start
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-2.5 py-1 bg-surface border-b border-surface">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-accent-teal rounded-full animate-pulse" />
              <span className="text-xs text-zinc-500">Live</span>
            </div>
            <button
              onClick={stopShare}
              className="btn-ghost p-1 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <MonitorOff className="w-3 h-3" />
            </button>
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="flex-1 w-full object-contain bg-black"
          />
        </>
      )}
    </div>
  );
}
