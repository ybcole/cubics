"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

type ModalSize = "sm" | "md" | "lg" | "wide";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  size?: ModalSize;
  footer?: React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "modal-sm",
  md: "modal-md",
  lg: "modal-lg",
  wide: "modal-wide",
};

/** Shared dialog with keyboard focus containment and focus restoration. */
export function Modal({ open, onClose, title, size = "md", footer, flush, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const frame = window.requestAnimationFrame(() => {
      if (!dialog || dialog.contains(document.activeElement)) return;
      const target = dialog.querySelector<HTMLElement>("[autofocus], button:not([disabled]), input:not([disabled])");
      (target || dialog).focus();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const items = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");

      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? titleId : undefined}
        aria-label={title === undefined ? "Dialog" : undefined}
        tabIndex={-1}
        className={`modal ${SIZE_CLASS[size]}`}
        onClick={(event) => event.stopPropagation()}
      >
        {title !== undefined && (
          <div className="modal-header">
            <h2 id={titleId} className="text-h2 text-fg-strong truncate">{title}</h2>
            <button type="button" onClick={onClose} className="btn-icon" aria-label="Close dialog">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className={flush ? "modal-body-flush" : "modal-body"}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
