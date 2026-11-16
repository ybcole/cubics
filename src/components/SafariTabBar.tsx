"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw, Trash2 } from "lucide-react";

/** Safari-style minimal tab chrome shared by Personal, Live and Shared tabs.
 * Display-only hostname is never used for navigation: editing always reveals
 * the exact, full URL supplied by the owning browser/webview.
 */
export function siteLabel(value: string): string {
  const raw = value.trim();
  if (!raw || raw === "about:blank") return "";
  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.hostname.replace(/^www\./i, "") + (url.port ? `:${url.port}` : "");
  } catch { return raw; }
}

export function normalizeAddress(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if ((url.protocol !== "https:" && url.protocol !== "http:") ||
        url.username || url.password) return "";
    return url.href;
  } catch { return ""; }
}

interface SafariTabBarProps {
  url: string;
  onBack?: () => void;
  onForward?: () => void;
  onReload?: () => void;
  onNavigate?: (url: string) => void;
  onDelete: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  canReload?: boolean;
  editable?: boolean;
  placeholder?: string;
}

export default function SafariTabBar({
  url, onBack, onForward, onReload, onNavigate, onDelete,
  canGoBack = true, canGoForward = true, canReload = true,
  editable = true, placeholder = "Search or enter URL",
}: SafariTabBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url);

  useEffect(() => {
    if (!editing) setDraft(url);
  }, [url, editing]);

  // Focus changes the value from hostname to the full URL; select only after
  // React paints the expanded value, so the entire link is actually selected.
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const submit = () => {
    if (!editable || !onNavigate) return;
    const next = normalizeAddress(draft);
    if (next) onNavigate(next);
    inputRef.current?.blur();
  };

  return (
    <div className="widget-card-header widget-drag-handle !grid !grid-cols-[56px_minmax(0,1fr)_56px] !gap-1.5 !px-2" aria-label="Browser controls">
      <div className="tab-control flex items-center justify-start gap-0.5">
        <button type="button" className="btn-icon-sm" aria-label="Back" title="Back"
          disabled={!onBack || !canGoBack} onClick={onBack}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="btn-icon-sm" aria-label="Forward" title="Forward"
          disabled={!onForward || !canGoForward} onClick={onForward}>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <form className="tab-control relative min-w-0 w-full" onSubmit={e => {
        e.preventDefault();
        submit();
      }}>
        <input ref={inputRef} type="text" inputMode="url" autoComplete="off"
          autoCapitalize="off" spellCheck={false}
          value={editing ? draft : siteLabel(url)}
          onFocus={() => { setDraft(url === "about:blank" ? "" : url); setEditing(true); }}
          onBlur={() => { setEditing(false); setDraft(url); }}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Escape") { setDraft(url); inputRef.current?.blur(); }
            if (e.key === "Enter") e.stopPropagation();
          }}
          readOnly={!editable}
          placeholder={placeholder}
          aria-label="Tab URL"
          className={`w-full min-w-0 h-7 rounded-md border border-line bg-canvas text-small text-fg
            outline-none focus:border-line-strong focus:ring-1 focus:ring-line-strong
            pl-2 pr-8 truncate transition-colors ${editing ? "text-left" : "text-center"}
            ${editable ? "cursor-text" : "cursor-default"}`}
        />
        <button type="button" onMouseDown={e => e.preventDefault()}
          onClick={onReload} disabled={!onReload || !canReload}
          className="btn-icon-sm absolute right-1 top-1/2 -translate-y-1/2"
          title="Reload" aria-label="Reload">
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </form>

      <div className="tab-control flex items-center justify-end">
        <button type="button" className="btn-icon-danger" title="Remove tab"
          aria-label="Remove tab" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
