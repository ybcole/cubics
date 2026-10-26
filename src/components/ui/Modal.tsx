"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type ModalSize = "sm" | "md" | "lg" | "wide";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** sm 360 · md 480 (default) · lg 640 (brand max) · wide 960 (embedded-content previews only) */
  size?: ModalSize;
  /** Right-aligned action row pinned to the bottom. */
  footer?: React.ReactNode;
  /** Remove body padding (lists, iframes). */
  flush?: boolean;
  children: React.ReactNode;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "modal-sm",
  md: "modal-md",
  lg: "modal-lg",
  wide: "modal-wide",
};

/** The only modal shell in Cubics. See docs/BRAND.md → Modals. */
export function Modal({ open, onClose, title, size = "md", footer, flush, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`modal ${SIZE_CLASS[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <div className="modal-header">
            <h2 className="text-h2 text-fg truncate">{title}</h2>
            <button onClick={onClose} className="btn-icon" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className={flush ? "modal-body-flush" : "modal-body"}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
