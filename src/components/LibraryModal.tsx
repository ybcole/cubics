"use client";

import { useEffect, useState } from "react";
import { X, Search, Trash2, Plus, Globe, MonitorSmartphone } from "lucide-react";

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

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden shadow-md"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "slideUp 150ms ease" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-surface">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Library</h2>
            <button onClick={onClose} className="btn-ghost p-1 text-zinc-500 hover:text-zinc-900 hover:bg-surface transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search widgets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-base w-full pl-8 pr-3 py-2 placeholder:text-zinc-500"
              />
            </div>
            <button
              onClick={() => { onClose(); onShowAddWidget(); }}
              className="btn-primary px-3 py-2 text-xs shrink-0"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-surface border border-surface rounded-md animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-8">
              {search ? "No widgets match" : "No widgets yet. Add one to a room first."}
            </p>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((w) => (
                <div
                  key={w.id}
                  className="card p-3 hover:border-accent-teal transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 truncate">{w.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Globe className="w-3 h-3 text-zinc-500 shrink-0" />
                      <p className="text-xs text-zinc-500 truncate">{w.url}</p>
                      <span className="text-xs text-zinc-500 shrink-0">in {w.roomName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <button
                      onClick={() => {
                        onAddToRoom({ title: w.title, url: w.url, w: w.w || 800, h: w.h || 600 });
                        onClose();
                      }}
                      className="btn-primary px-2.5 py-1 text-xs"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => handleDelete(w.id)}
                      className="btn-ghost p-1 text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove from library"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shared Browser */}
        <div className="mx-5 mb-3 p-3 flex items-center justify-between border border-zinc-200 rounded-lg bg-white">
          <div className="flex items-center gap-2.5">
            <MonitorSmartphone className="w-4 h-4 text-zinc-600" />
            <div>
              <p className="text-xs font-medium text-zinc-900">Shared Browser</p>
              <p className="text-xs text-zinc-500">Host screen + co-control</p>
            </div>
          </div>
          <button
            onClick={() => { onAddSharedBrowser?.(); onClose(); }}
            className="px-3 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
