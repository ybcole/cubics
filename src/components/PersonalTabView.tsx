"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, RotateCw, Trash2 } from "lucide-react";
import type { Widget } from "@/types";

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
  const [isVisible, setIsVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [clientId] = useState(() => {
    if (typeof window === "undefined") return "guest";
    try {
      const key = "cubics:clientId";
      let id = window.localStorage.getItem(key);
      if (!id) {
        id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
        window.localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return "guest";
    }
  });

  const partition = `persist:cubics-personal-${userId || clientId}`;

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
  }, [isVisible, partition]);

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
          <span className="text-caption text-fg-subtle shrink-0">Personal</span>
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
          <div className="w-px h-3 bg-line mx-0.5" />
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="btn-icon-danger" title="Remove" aria-label="Remove">
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
            (
              <webview
                key={partition}
                ref={frameRef as any}
                data-widget-id={widget.id}
                src={widget.url}
                partition={partition}
                allowpopups
                className="w-full h-full border-0"
                style={{ display: "inline-flex" }}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full bg-surface">
              <span className="text-small text-fg-muted">{widget.title}</span>
            </div>
          )
        ) : (
          <iframe
            data-widget-id={widget.id}
            src={widget.url}
            title={widget.title}
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
