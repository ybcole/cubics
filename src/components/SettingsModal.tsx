"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, Clock3, Mail, Settings2, ShieldCheck, UserRound, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { AccountSettings } from "@/components/AccountSettings";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = [
  { id: "profile", label: "Profile", group: "Workspace", icon: UserRound,
    description: "Choose how your profile appears in your workspace." },
  { id: "notifications", label: "Notifications", group: "Workspace", icon: Bell,
    description: "Decide which workspace updates you hear about." },
  { id: "security", label: "Security", group: "Workspace", icon: ShieldCheck,
    description: "Manage sign-in protection and account security." },
  { id: "account", label: "Account", group: "General", icon: Settings2,
    description: "Manage your account details and photo." },
  { id: "emails", label: "Emails", group: "General", icon: Mail,
    description: "Choose the emails you receive from Cubics." },
  { id: "schedules", label: "Schedules", group: "General", icon: CalendarDays,
    description: "Keep your workspace routines in one place." },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [section, setSection] = useState<SectionId>("account");
  const accountButton = useRef<HTMLButtonElement>(null);
  const selected = SECTIONS.find(item => item.id === section)!;
  const SelectedIcon = selected.icon;

  useEffect(() => {
    if (!open) return;
    setSection("account");
    const opener = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => accountButton.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Settings" size="settings" flush>
      <div className="settings-layout">
        <aside className="settings-sidebar">
          <h2 className="settings-sidebar-title">Settings</h2>
          <nav className="settings-nav" aria-label="Settings sections">
            {(["Workspace", "General"] as const).map(group => (
              <div key={group} className="settings-nav-group">
                <p className="settings-nav-label">{group}</p>
                {SECTIONS.filter(item => item.group === group).map(item => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      ref={item.id === "account" ? accountButton : undefined}
                      type="button"
                      className={`settings-nav-item ${active ? "is-active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      aria-controls={`settings-${item.id === "account" ? "account" : "placeholder"}`}
                      onClick={() => setSection(item.id)}
                    >
                      <Icon aria-hidden="true" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <div className="settings-content">
          {/* Keep the real account form mounted so a section switch keeps its draft. */}
          <section id="settings-account" className="settings-panel" hidden={section !== "account"} aria-labelledby="account-settings-title">
            <AccountSettings open={open} onClose={onClose} />
          </section>
          {section !== "account" && (
            <section id="settings-placeholder" className="settings-panel" aria-labelledby="settings-placeholder-title">
              <header className="settings-section-header">
                <h2 id="settings-placeholder-title" className="text-h2 text-fg">{selected.label}</h2>
                <p className="text-small text-fg-muted mt-1.5">{selected.description}</p>
              </header>
              <div className="settings-placeholder">
                <span className="settings-placeholder-icon"><SelectedIcon aria-hidden="true" /></span>
                <span className="badge"><Clock3 className="w-3.5 h-3.5" aria-hidden="true" />Coming soon</span>
                <h3 className="text-body font-medium text-fg">A space for your {selected.label.toLowerCase()} preferences</h3>
                <p className="text-small text-fg-muted">These settings aren&apos;t available yet.</p>
              </div>
            </section>
          )}
        </div>

        <button type="button" onClick={onClose} className="btn-icon settings-close" aria-label="Close settings">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </Modal>
  );
}
