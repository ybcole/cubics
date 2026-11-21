"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { Widget } from "@/types";
import { useTabPreview, type PreviewGuest } from "@/lib/browser/useTabPreview";
import { useGuestPartition } from "@/lib/browser/useGuestPartition";
import { observeColdGuest } from "@/lib/canvas/visibility";
import SafariTabBar from "@/components/SafariTabBar";

const isElectron = typeof window !== "undefined" && Boolean(window.cubics?.isElectron);

interface WebviewElement extends PreviewGuest {
  goBack(): void;
  goForward(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  reload(): void;
  loadURL(url: string): Promise<void>;
  getURL(): string;
  isLoading?(): boolean;
}

interface PersonalTabViewProps {
  widget: Widget;
  userId?: string | null;
  onDelete: () => void;
  onMaximize?: () => void;
  maximized?: boolean;
  isDragging?: boolean;
}

function PersonalTabView({ widget, userId, onDelete, onMaximize, maximized = false, isDragging = false }: PersonalTabViewProps) {
  const frameRef = useRef<WebviewElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const [guestAdmitted, setGuestAdmitted] = useState(false);
  const [ready, setReady] = useState(false);
  const { partition, generation } = useGuestPartition("personal", userId, widget.id, hasEnteredViewport);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState({ back: false, forward: false });
  const previewScope = userId && partition && guestAdmitted ? `${userId}:${partition}:${generation}:${widget.id}` : null;
  const previewUrl = useTabPreview(containerRef, frameRef, previewScope, ready);

  // The personal URL is private device state, not the cloud Widget.url.
  useEffect(() => {
    let cancelled = false;
    setSrcUrl(null);
    setCurrentUrl("");
    setReady(false);
    setLoading(true);
    if (!isElectron || !partition || !userId) {
      setLoading(false);
      return () => { cancelled = true; };
    }
    void window.cubics!.readPersonalNavigation(widget.roomId, widget.id, userId)
      .then(({ url }) => {
        if (cancelled) return;
        setSrcUrl(url);
        setCurrentUrl(url === "about:blank" ? "" : url);
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("Unlock your system keychain to access this Personal tab.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [partition, generation, userId, widget.roomId, widget.id]);

  // Lazily mount the Chromium guest, but keep it mounted across canvas pans.
  useEffect(() => {
    if (!isElectron) return;
    const el = containerRef.current;
    if (!el) return;
    return observeColdGuest(el, () => setHasEnteredViewport(true));
  }, []);

  // Async keychain/profile work may finish after a pan starts. Gate the final
  // native guest mount as well as the initial authorization; never evict warm guests.
  useEffect(() => {
    setGuestAdmitted(false);
    const element = containerRef.current;
    if (!isElectron || !element || !partition || !srcUrl || srcUrl === "about:blank") return;
    // Recheck proximity too: the camera may have left while authorization ran.
    return observeColdGuest(element, () => setGuestAdmitted(true));
  }, [partition, generation, srcUrl]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!isElectron || !frame) return;
    const updateHistory = () => {
      try {
        setHistory({ back: frame.canGoBack(), forward: frame.canGoForward() });
      } catch { setHistory({ back: false, forward: false }); }
    };
    const onReady = () => { setReady(true); updateHistory(); };
    const onNavigate = (event: Event) => {
      const next = (event as Event & { url?: string }).url || frame.getURL();
      updateHistory();
      if (!next || next === "about:blank" || !userId || !partition) return;
      setCurrentUrl(next);
      // Navigation and redirects update only the encrypted per-device vault.
      void window.cubics?.writePersonalNavigation(widget.roomId, widget.id, userId, next)
        .catch(() => setError("Could not save this destination securely."));
    };
    frame.addEventListener("dom-ready", onReady);
    frame.addEventListener("did-finish-load", onReady);
    frame.addEventListener("did-navigate", onNavigate);
    frame.addEventListener("did-navigate-in-page", onNavigate);
    try { if (frame.isLoading && !frame.isLoading()) onReady(); } catch {}
    return () => {
      frame.removeEventListener("dom-ready", onReady);
      frame.removeEventListener("did-finish-load", onReady);
      frame.removeEventListener("did-navigate", onNavigate);
      frame.removeEventListener("did-navigate-in-page", onNavigate);
    };
  }, [guestAdmitted, srcUrl, partition, generation, userId, widget.roomId, widget.id]);

  const open = useCallback(async (url: string) => {
    if (!isElectron || !window.cubics || !partition || !userId) return;
    try {
      // Persist before navigating so a failed OS keychain cannot silently
      // downgrade a private URL into the cloud or unencrypted preferences.
      await window.cubics.writePersonalNavigation(widget.roomId, widget.id, userId, url);
      setError("");
      setCurrentUrl(url);
      const frame = frameRef.current;
      if (frame) await frame.loadURL(url);
      else setSrcUrl(url);
    } catch {
      setError("Could not open or encrypt that URL. Your cloud data was not changed.");
    }
  }, [partition, userId, widget.roomId, widget.id]);

  const navigate = useCallback((action: "back" | "forward" | "reload") => {
    const frame = frameRef.current;
    if (!frame || !ready) return;
    if (action === "back") frame.goBack();
    else if (action === "forward") frame.goForward();
    else frame.reload();
  }, [ready]);

  return (
    <div ref={containerRef} className="widget-card h-full flex flex-col" data-camera-preview={previewUrl ? "true" : undefined}>
      <SafariTabBar
        url={currentUrl}
        onBack={() => navigate("back")}
        onForward={() => navigate("forward")}
        onReload={() => navigate("reload")}
        onNavigate={open}
        onDelete={onDelete}
        onMaximize={onMaximize}
        maximized={maximized}
        canGoBack={ready && history.back}
        canGoForward={ready && history.forward}
        canReload={ready}
        editable={isElectron && !!partition && !!userId && !loading}
        placeholder="Search or enter URL"
      />
      {error && <p className="text-caption text-danger px-2 py-1" role="alert">{error}</p>}
      <div className="widget-card-body flex-1 min-h-0">
        <div className="widget-drag-placeholder" aria-hidden style={{ display: isDragging ? "flex" : "none" }}>
          <span className="text-small text-fg-muted">Personal tab</span>
        </div>
        {isElectron ? (
          guestAdmitted && hasEnteredViewport && partition && srcUrl && srcUrl !== "about:blank" ? (
            <webview
              key={partition + ":" + generation}
              ref={frameRef as any}
              data-widget-id={widget.id}
              src={srcUrl}
              partition={partition}
              className="w-full h-full border-0"
              style={{ display: "inline-flex" }}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface px-3">
              <span className="text-small text-fg-muted">
                {loading ? "Unlocking private tab..." : srcUrl && srcUrl !== "about:blank" ? "Opening tab..." : "Enter a URL above"}
              </span>
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center bg-surface px-3 text-center">
            <span className="text-small text-fg-muted">
              Personal tabs require the Cubics desktop app and secure device storage.
            </span>
          </div>
        )}
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" aria-hidden="true" draggable={false} className="camera-preview" />
        )}
      </div>
    </div>
  );
}

export default memo(PersonalTabView);
