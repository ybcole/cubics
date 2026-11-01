"use client";

import { useEffect, useState } from "react";
import { MdChevronRight, MdPerson } from "react-icons/md";
import { Modal } from "@/components/ui/Modal";
import { AccountSettings } from "@/components/AccountSettings";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [view, setView] = useState<"menu" | "account">("menu");

  useEffect(() => {
    if (open) setView("menu");
  }, [open]);

  if (view === "account") {
    return <AccountSettings open={open} onBack={() => setView("menu")} onClose={onClose} />;
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings" size="sm" flush>
      <div className="p-2">
        <button type="button" onClick={() => setView("account")} className="menu-item rounded-sm">
          <MdPerson className="w-4 h-4 text-fg-muted" />
          <span className="flex-1">Account settings</span>
          <MdChevronRight className="w-4 h-4 text-fg-subtle" />
        </button>
      </div>
    </Modal>
  );
}
