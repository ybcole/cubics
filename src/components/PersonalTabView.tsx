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
  const [vaultUrl, setVaultUrl] = useState<string | null>(null);
  const [vaultLoading, setVaultLoading] = useState(true);
  const [address, setAddress] = useState("");

  // Personal navigation is supplied by the OS-protected local vault only.
  // Never use the cloud widget.url as a renderer/webview fallback.
  useEffect(() => {
    let cancelled = false;
    setVaultUrl(null);
    setVaultLoading(true);
    setReady(false);
    if (!isElectron || !partition || !userId) {
      setVaultLoading(false);
      return () => { cancelled = true; };
    }
    void window.cubics!.readPersonalNavigation(widget.roomId, widget.id, userId)
      .then(({ url }) => {
        if (cancelled) return;
        setVaultUrl(url);
        setAddress(url === "about:blank" ? "" : url);
        setProfileError("");
      })
      .catch(() => {
        if (!cancelled) setProfileError(
          "Personal navigation is unavailable. Unlock your system keychain to recover saved tabs."
        );
      })
      .finally(() => { if (!cancelled) setVaultLoading(false); });
    return () => { cancelled = true; };
  }, [partition, generation, userId, widget.roomId, widget.id]);

  const openLocalUrl = useCallback(async () => {
    if (!isElectron || !window.cubics || !partition || !userId || !address.trim()) return;
    try {
      await window.cubics.writePersonalNavigation(widget.roomId, widget.id, userId, address.trim());
      setVaultUrl(address.trim());
      setReady(false);
      setProfileError("");
    } catch {
      setProfileError("Destination could not be encrypted. No cloud copy was written.");
    }
  }, [address, partition, userId, widget.roomId, widget.id]);
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
    const onNavigate = (event: Event) => {
      // Browser back/forward, site links and redirects change only the local
      // encrypted vault, never shared widget metadata or Socket.IO updates.
      const url = (event as Event & { url?: string }).url || frame.getURL();
      if (!userId || !partition || !url || url === "about:blank") return;
      setAddress(url);
      void window.cubics?.writePersonalNavigation(widget.roomId, widget.id, userId, url)
        .catch(() => setProfileError("Could not save this page's destination locally."));
    };
    frame.addEventListener("dom-ready", onReady);
    frame.addEventListener("did-finish-load", onFinish);
    frame.addEventListener("did-navigate", onNavigate);
    frame.addEventListener("did-navigate-in-page", onNavigate);
    try {
      if (typeof (frame as any).isLoading === "function" && !(frame as any).isLoading()) {
        setReady(true);
      }
    } catch {}
    return () => {
      frame.removeEventListener("dom-ready", onReady);
      frame.removeEventListener("did-finish-load", onFinish);
      frame.removeEventListener("did-navigate", onNavigate);
      frame.removeEventListener("did-navigate-in-page", onNavigate);
    };
  }, [hasEnteredViewport, partition, generation, userId, widget.roomId, widget.id, vaultUrl]);

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
              className="btn-icon-sm" title="Clear cookies and website data for all Personal tabs (saved encrypted destinations are retained)"
              aria-label="Clear Personal website cookies and cache">
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
      {isElectron && (
        <form className="flex items-center gap-1 px-2 py-1 bg-surface" onSubmit={e => {
          e.preventDefault();
          void openLocalUrl();
        }}>
          <input value={address} onChange={e => setAddress(e.target.value)}
            type="url" placeholder="Enter a private website URL"
            aria-label="Personal tab destination"
            className="flex-1 min-w-0 text-small bg-transparent text-fg px-1 py-0.5"
            autoComplete="off" spellCheck={false} />
          <button type="submit" className="btn-icon-sm" disabled={!partition || vaultLoading || !address.trim()}
            title="Open privately on this device" aria-label="Open private URL">
            <span className="text-small">Go</span>
          </button>
        </form>
      )}
      <div className="widget-card-body flex-1 min-h-0">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-small text-fg-muted">Personal tab</span>
        </div>
        {isElectron ? (
          hasEnteredViewport && partition && vaultUrl && vaultUrl !== "about:blank" ? (
            (
              <webview
                key={partition + ":" + generation}
                ref={frameRef as any}
                data-widget-id={widget.id}
                src={vaultUrl}
                partition={partition}
                className="w-full h-full border-0"
                style={{ display: "inline-flex" }}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full bg-surface">
              <span className="text-small text-fg-muted">
                {vaultLoading ? "Unlocking private tab..." : "Enter a private URL above"}
              </span>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full px-3 text-center bg-surface">
            <span className="text-small text-fg-muted">
              Private browsing requires the Cubics desktop app and an OS-protected vault.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PersonalTabView);
