"use client";

import { useEffect, useState } from "react";
import { Search, Trash2, Plus, Globe, MonitorSmartphone } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface LibraryWidget {
  id: string;
  title: string;
  url: string;
  w: number;
  h: number;
  roomId: string;
  roomName: string;
  createdAt: string;
}

interface LibraryModalProps {
  open: boolean;
  onClose: () => void;
  currentRoomId?: string;
  onAddToRoom: (widget: { title: string; url: string; w: number; h: number }) => void;
  onAddTabShare?: () => void;
  onAddSharedBrowser?: () => void;
  onShowAddWidget: () => void;
}

export default function LibraryModal({ open, onClose, currentRoomId, onAddToRoom, onAddTabShare, onAddSharedBrowser, onShowAddWidget }: LibraryModalProps) {
  const [widgets, setWidgets] = useState<LibraryWidget[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/widgets")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setWidgets(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = widgets.filter((w) =>
    w.title.toLowerCase().includes(search.toLowerCase()) ||
    w.url.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    const w = widgets.find((w) => w.id === id);
    if (!w) return;
    if (!confirm(`Remove "${w.title}" from ${w.roomName}?`)) return;
    try {
      await fetch(`/api/rooms/${w.roomId}/widgets?widgetId=${id}`, { method: "DELETE" });
      setWidgets((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Library" size="lg" flush>
      <div className="px-5 py-3 border-b border-line flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
          <input
            type="text"
            placeholder="Search widgets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base input-sm w-full pl-9"
          />
        </div>
        <button onClick={() => { onClose(); onShowAddWidget(); }} className="btn btn-primary btn-sm shrink-0">
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      <div className="px-5 py-3">
        {loading ? (
          <div className="space-y-2 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-14" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-small text-fg-muted text-center py-8">
            {search ? "No widgets match" : "No widgets yet. Add one to a room first."}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((w) => (
              <div key={w.id} className="card card-interactive p-3 flex items-center justify-between gap-3 group">
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-fg truncate">{w.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Globe className="w-3.5 h-3.5 text-fg-subtle shrink-0" />
                    <p className="text-caption text-fg-muted truncate">{w.url}</p>
                    <span className="text-caption text-fg-subtle shrink-0">in {w.roomName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      onAddToRoom({ title: w.title, url: w.url, w: w.w || 800, h: w.h || 600 });
                      onClose();
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="btn-icon-danger opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    title="Remove from library"
                    aria-label="Remove from library"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mx-5 mb-5 p-3 flex items-center justify-between card-surface">
        <div className="flex items-center gap-3">
          <MonitorSmartphone className="w-4 h-4 text-fg-muted" />
          <div>
            <p className="text-small font-medium text-fg">Shared browser</p>
            <p className="text-caption text-fg-muted">Host screen + co-control</p>
          </div>
        </div>
        <button onClick={() => { onAddSharedBrowser?.(); onClose(); }} className="btn btn-secondary btn-sm">
          Add
        </button>
      </div>
    </Modal>
  );
}
