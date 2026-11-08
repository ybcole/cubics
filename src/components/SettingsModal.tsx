"use client";

import { useEffect, useState } from "react";
import { MdChevronRight, MdPerson, MdLogout } from "react-icons/md";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { AccountSettings } from "@/components/AccountSettings";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [view, setView] = useState<"menu" | "account">("menu");
  const clerk = useClerk();
  const router = useRouter();

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
          <MdPerson className="w-4 h-4 text-fg-muted" aria-hidden="true" />
          <span className="flex-1">Account settings</span>
          <MdChevronRight className="w-4 h-4 text-fg-subtle" aria-hidden="true" />
        </button>
        <div className="border-t border-line my-1" role="separator" />
        <button
          type="button"
          className="menu-item menu-item-danger rounded-sm"
          onClick={() => {
            clerk.signOut().then(() => router.replace("/sign-in")).catch(console.error);
          }}
        >
          <MdLogout className="w-4 h-4" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </Modal>
  );
}
