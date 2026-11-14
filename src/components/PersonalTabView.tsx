"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Eraser, GripVertical, RotateCw, Trash2 } from "lucide-react";
import type { Widget } from "@/types";
import { useGuestPartition } from "@/lib/browser/useGuestPartition";

const isElectron = typeof window !== "undefined" && Boolean(window.cubics?.isElectron);

interface WebviewElement extends HTMLElement {
  goBack(): void;
  goForward(): void;
  reload(): void;
  getURL(): string;
}

interface PersonalTabViewProps {
  widget: Widget;
  userId?: string | null;
  onDelete: () => void;
  isDragging?: boolean;
}

function PersonalTabView({ widget, userId, onDelete, isDragging = false }: PersonalTabViewProps) {
  const frameRef = useRef<WebviewElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Once the guest loads, keep it mounted across all camera movements.
  // Destroying a webview also destroys its live page and browsing state.
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const [ready, setReady] = useState(false);
  const { partition, generation } = useGuestPartition("personal", userId, widget.id);
  const [clearing, setClearing] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [exporting, setExporting] = useState(false);
  const exportProfileInfo = useCallback(async () => {
    if (!userId || !window.cubics?.isElectron || exporting) return;
    setExporting(true);
    setProfileError("");
    try {
      await window.cubics.exportBrowserProfileInfo("personal", null, userId);
    } catch {
      setProfileError("Could not export profile information. Choose a new file name.");
    } finally {
      setExporting(false);
    }
  }, [userId, exporting]);
  const clearPersonalBrowsing = useCallback(async () => {
    if (!userId || !window.cubics?.isElectron || clearing) return;
    setClearing(true);
    setProfileError("");
    try {
      await window.cubics.clearBrowserData("personal", null, userId);
    } catch {
      setProfileError("Could not clear local browser data.");
    } finally {
      setClearing(false);
    }
  }, [userId, clearing]);

  useEffect(() => {
    if (!isElectron) return;
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setHasEnteredViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEnteredViewport(true);
          // Stop observing; off-screen visibility must never unmount a webview.
          observer.disconnect();
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !isElectron) return;
    const onReady = () => setReady(true);
    const onFinish = () => setReady(true);
    frame.addEventListener("dom-ready", onReady);
    frame.addEventListener("did-finish-load", onFinish);
    try {
      if (typeof (frame as any).isLoading === "function" && !(frame as any).isLoading()) {
        setReady(true);
      }
    } catch {}
    return () => {
      frame.removeEventListener("dom-ready", onReady);
      frame.removeEventListener("did-finish-load", onFinish);
    };
  }, [hasEnteredViewport, partition, generation]);

  const navigate = useCallback((action: "back" | "forward" | "reload") => {
    const frame = frameRef.current;
    if (!frame || !isElectron || !ready) return;
    if (action === "back") frame.goBack();
    else if (action === "forward") frame.goForward();
    else frame.reload();
  }, [ready]);

  return (
    <div ref={containerRef} className="widget-card h-full flex flex-col">
      <div className="widget-card-header">
        <div className="widget-drag-handle flex items-center gap-1.5 flex-1 cursor-move min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-fg-subtle shrink-0" />
          <span className="text-small font-medium text-fg truncate">Personal tab</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); navigate("back"); }} className="btn-icon-sm" title="Back" aria-label="Back">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); navigate("forward"); }} className="btn-icon-sm" title="Forward" aria-label="Forward">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); navigate("reload"); }} className="btn-icon-sm" title="Reload" aria-label="Reload">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          {isElectron && (
            <button onClick={(e) => { e.stopPropagation(); void exportProfileInfo(); }}
              disabled={exporting || !partition || !userId}
              className="btn-icon-sm" title="Export local profile information (not browsing history)"
              aria-label="Export local Personal profile information">
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {isElectron && (
            <button onClick={(e) => { e.stopPropagation(); void clearPersonalBrowsing(); }}
              disabled={clearing || !userId}
              className="btn-icon-sm" title="Clear local Personal browsing data (all Personal tabs)"
              aria-label="Clear local Personal browsing data">
              <Eraser className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="w-px h-3 bg-line mx-0.5" />
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="btn-icon-danger" title="Remove" aria-label="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {profileError && <p className="text-caption text-danger px-2" role="alert">{profileError}</p>}
      <div className="widget-card-body flex-1 min-h-0">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-small text-fg-muted">Personal tab</span>
        </div>
        {isElectron ? (
          hasEnteredViewport && partition ? (
            (
              <webview
                key={partition + ":" + generation}
                ref={frameRef as any}
                data-widget-id={widget.id}
                src={widget.url}
                partition={partition}
                className="w-full h-full border-0"
                style={{ display: "inline-flex" }}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full bg-surface">
              <span className="text-small text-fg-muted">Personal tab</span>
            </div>
          )
        ) : (
          <iframe
            data-widget-id={widget.id}
            src={widget.url}
            title="Personal tab"
            allowFullScreen
            loading="lazy"
            className="w-full h-full border-0"
          />
        )}
      </div>
    </div>
  );
}

export default memo(PersonalTabView);
