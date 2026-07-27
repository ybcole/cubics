"use client";

import { useEffect, useState } from "react";
import { X, Search, Trash2, Plus, Globe, Monitor } from "lucide-react";

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
  currentRoomId: string;
  onAddToRoom: (widget: { title: string; url: string; w: number; h: number }) => void;
  onAddTabShare: () => void;
  onShowAddWidget: () => void;
}

export default function LibraryModal({ open, onClose, currentRoomId, onAddToRoom, onAddTabShare, onShowAddWidget }: LibraryModalProps) {
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
        className="bg-white border border-zinc-200 rounded-lg w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden shadow-md"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "slideUp 150ms ease" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-zinc-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Library</h2>
            <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search widgets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-400"
              />
            </div>
            <button
              onClick={() => { onClose(); onShowAddWidget(); }}
              className="flex items-center gap-1 px-3 py-2 bg-zinc-900 text-white text-xs font-medium rounded-md hover:bg-zinc-800 transition-colors shrink-0"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          </div>
        </div>

        {/* Tab Share */}
        <div className="mx-5 mt-3 flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-md">
          <div className="flex items-center gap-2.5">
            <Monitor className="w-4 h-4 text-zinc-500" />
            <div>
              <p className="text-xs font-medium text-zinc-900">Share Browser Tab</p>
              <p className="text-xs text-zinc-500">WebRTC screen capture</p>
            </div>
          </div>
          <button
            onClick={() => { onAddTabShare(); onClose(); }}
            className="px-3 py-1 bg-zinc-900 text-white text-xs font-medium rounded-md hover:bg-zinc-800 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Widget List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-zinc-50 border border-zinc-200 rounded-md animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-8">
              {search ? "No widgets match" : "No widgets yet. Add one to a room first."}
            </p>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between px-3 py-2.5 border border-zinc-200 rounded-md hover:border-zinc-300 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 truncate">{w.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Globe className="w-3 h-3 text-zinc-400 shrink-0" />
                      <p className="text-xs text-zinc-500 truncate">{w.url}</p>
                      <span className="text-xs text-zinc-400 shrink-0">in {w.roomName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <button
                      onClick={() => {
                        onAddToRoom({ title: w.title, url: w.url, w: w.w || 800, h: w.h || 600 });
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => handleDelete(w.id)}
                      className="p-1 text-zinc-300 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
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
      </div>
    </div>
  );
}
