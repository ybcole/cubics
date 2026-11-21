"use client";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";
import AddressField from "@/components/AddressField";
export { normalizeAddress, siteLabel } from "@/components/AddressField";

interface SafariTabBarProps {
  url: string;
  onBack?: () => void;
  onForward?: () => void;
  onReload?: () => void;
  onNavigate?: (url: string) => void;
  onDelete: () => void;
  onMaximize?: () => void;
  maximized?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  canReload?: boolean;
  editable?: boolean;
  placeholder?: string;
}

export default function SafariTabBar({
  url, onBack, onForward, onReload, onNavigate, onDelete, onMaximize, maximized = false,
  canGoBack = true, canGoForward = true, canReload = true,
  editable = true, placeholder = "Search or enter URL",
}: SafariTabBarProps) {
  return (
    <div className="widget-card-header widget-drag-handle !grid !grid-cols-[64px_minmax(0,1fr)_64px] !gap-1.5 !px-2" aria-label="Browser controls">
      <div className="flex items-center justify-start gap-0.5">
        <button type="button" className="btn-icon-danger tab-control"
          title="Close tab" aria-label="Close tab" onClick={onDelete}>
          <X className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="btn-icon-sm tab-control"
          title={maximized ? "Restore tab" : "Maximize tab"}
          aria-label={maximized ? "Restore tab" : "Maximize tab"}
          disabled={!onMaximize} onClick={onMaximize}>
          {maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex items-center justify-center gap-1.5 min-w-0">
        <div className="flex items-center justify-start gap-0.5 shrink-0">
          <button type="button" className="btn-icon-sm tab-control" aria-label="Back" title="Back"
            disabled={!onBack || !canGoBack} onClick={onBack}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button type="button" className="btn-icon-sm tab-control" aria-label="Forward" title="Forward"
            disabled={!onForward || !canGoForward} onClick={onForward}>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <AddressField url={url} onNavigate={onNavigate} onReload={onReload}
          canReload={canReload} editable={editable} placeholder={placeholder} />
      </div>

      <div className="flex items-center justify-end" aria-hidden />
    </div>
  );
}
