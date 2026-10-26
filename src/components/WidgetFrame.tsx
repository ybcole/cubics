"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { RotateCw, Trash2, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import type { Widget } from "@/types";

const CANVAS_W = 100000;
const CANVAS_H = 100000;

const isElectron =
  typeof window !== "undefined" && Boolean(window.cubics?.isElectron);

interface WebviewElement extends HTMLElement {
  goBack(): void;
  goForward(): void;
  reload(): void;
  stop(): void;
  getURL(): string;
}

interface WidgetFrameProps {
  widget: Widget;
  onDelete: () => void;
  isDragging?: boolean;
  onUrlChange?: (widgetId: string, url: string) => void;
}

function WidgetFrame({ widget, onDelete, isDragging = false, onUrlChange }: WidgetFrameProps) {
  const frameRef = useRef<WebviewElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !isElectron) return;
    const reportUrl = (e: Event) => {
      const url = (e as CustomEvent<{ url?: string }>).detail?.url
        ?? (e as unknown as { url?: string }).url;
      if (typeof url === "string" && url !== widget.url) {
        onUrlChange?.(widget.id, url);
      }
    };
    const onDomReady = () => setReady(true);
    frame.addEventListener("did-navigate", reportUrl);
    frame.addEventListener("did-navigate-in-page", reportUrl);
    frame.addEventListener("dom-ready", onDomReady);
    return () => {
      frame.removeEventListener("did-navigate", reportUrl);
      frame.removeEventListener("did-navigate-in-page", reportUrl);
      frame.removeEventListener("dom-ready", onDomReady);
    };
  }, [widget.id, widget.url, onUrlChange]);

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
          <span className="text-small font-medium text-fg truncate">{widget.title}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); navigate("back"); }}
            className="btn-icon-sm"
            title="Back"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigate("forward"); }}
            className="btn-icon-sm"
            title="Forward"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigate("reload"); }}
            className="btn-icon-sm"
            title="Reload"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3 bg-line mx-0.5" />
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="btn-icon-danger" title="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="widget-card-body flex-1 min-h-0">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-small text-fg-muted">{widget.title}</span>
        </div>
        {isElectron ? (
          isVisible ? (
            // eslint-disable-next-line jsx-a11y/iframe-has-title
            <webview
              ref={frameRef as any}
              data-widget-id={widget.id}
              src={widget.url}
              className="w-full h-full border-0"
              style={{ display: "inline-flex" }}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-surface">
              <span className="text-small text-fg-muted">{widget.title}</span>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-surface gap-1 px-4 text-center">
            <span className="text-small text-fg-muted">Embedding needs the Cubics desktop app</span>
            <span className="text-mono text-fg-subtle truncate max-w-full">{widget.url}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(WidgetFrame);
