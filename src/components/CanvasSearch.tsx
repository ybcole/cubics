"use client";

import { useEffect, useState } from "react";
import AddressField from "@/components/AddressField";
import { Modal } from "@/components/ui/Modal";

/** M12.06: canvas shortcut shares the tab address field and private creation path. */
export default function CanvasSearch({ onClose, onNavigate }: {
  onClose: () => void;
  onNavigate: (url: string) => void;
}) {
  const [opener] = useState(() => typeof document !== "undefined" ? document.activeElement : null);
  useEffect(() => {
    return () => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true }); };
  }, [opener]);

  return (
    <Modal open onClose={onClose} ariaLabel="Search or open a tab" size="lg" presentation="search">
      <div onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input, button:not(:disabled):not([tabindex="-1"])'));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}>
        <AddressField floating url="" onNavigate={onNavigate} />
      </div>
    </Modal>
  );
}
