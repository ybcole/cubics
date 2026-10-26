"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Copy, Check, Grid, List, PlusCircle } from "lucide-react";
import type { Widget } from "@/types";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Modal } from "@/components/ui/Modal";

export default function WidgetsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [library, setLibrary] = useState<Array<any>>([]);
  const [addingLink, setAddingLink] = useState(false);
  const [newLink, setNewLink] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [preview, setPreview] = useState<{ type: "url"; content: string; title?: string; embedInfo?: any } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("userWidgetLibrary");
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      setLibrary(parsed);
    } catch (e) {
      setLibrary([]);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("userWidgetLibrary", JSON.stringify(library));
  }, [library]);

  const filteredWidgets = library.filter((widget) =>
    (widget.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const saveLibrary = (next: Array<any>) => {
    setLibrary(next);
  };

  const addByLink = () => {
    if (!newLink) return alert("Please provide a URL");
    const id = `lib-${Date.now()}`;
    const item = { id, title: newTitle || newLink, url: newLink, w: 4, h: 3, createdAt: new Date().toISOString() };
    saveLibrary([...library, item]);
    setNewLink("");
    setNewTitle("");
    setAddingLink(false);
  };

  // embed/code support removed — only simple URLs are supported now

  const removeFromLibrary = (id: string) => {
    saveLibrary(library.filter((w) => w.id !== id));
  };

  const previewWidget = async (w: any) => {
    if (!w.url) return;
    if (window.cubics?.isElectron) {
      setPreview({ type: "url", content: w.url, title: w.title, embedInfo: { embeddable: true } });
      return;
    }
    try {
      const res = await fetch(`/api/embeddable?url=${encodeURIComponent(w.url)}`);
      const info = await res.json();
      setPreview({ type: "url", content: w.url, title: w.title + (info.embeddable ? '' : ' (blocked)'), embedInfo: info });
    } catch (err) {
      setPreview({ type: "url", content: w.url, title: w.title + ' (check failed)' });
    }
  };

  const addToRoomPrompt = async (widget: any) => {
    const roomId = prompt("Enter room id to add this widget to:");
    if (!roomId) return;
    const finalUrl = widget.url;
    const param = prompt("Optional param (id/channel). Leave blank to use base URL:");
    const urlWithParam = param && finalUrl ? `${finalUrl}${param}` : finalUrl;
    try {
      const res = await fetch(`/api/rooms/${roomId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: widget.title, url: urlWithParam, x: 0, y: 0, w: widget.w, h: widget.h }),
      });
      if (res.ok) alert("Widget added to room");
      else alert("Failed to add widget to room");
    } catch (err) {
      console.error(err);
      alert("Error adding widget to room");
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="wordmark">Cubics</h1>
          <ProfileDropdown afterSignOutUrl="/sign-in" />
        </div>
      </header>

      <main className="px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h2 className="text-h1 text-fg">Widget library</h2>
            <p className="text-body text-fg-muted mt-1">Browse and add widgets to your rooms</p>
          </div>

          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
              <input
                type="text"
                placeholder="Search widgets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base w-full pl-9"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`btn-icon ${viewMode === "grid" ? "is-active" : ""}`}
                title="Grid view"
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`btn-icon ${viewMode === "list" ? "is-active" : ""}`}
                title="List view"
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setAddingLink((v) => !v)}
                className={`btn-icon ${addingLink ? "is-active" : ""}`}
                title="Add by link"
                aria-label="Add by link"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {addingLink && (
            <div className="card p-4 mb-6 flex flex-wrap gap-2">
              <input
                className="input-base flex-1 min-w-[160px]"
                placeholder="Optional title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <input
                className="input-base flex-[2] min-w-[240px]"
                placeholder="https://example.com/widget"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
              />
              <button onClick={addByLink} className="btn btn-primary">Add</button>
              <button
                onClick={() => { setAddingLink(false); setNewLink(""); setNewTitle(""); }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          )}

          {filteredWidgets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-small text-fg-muted">No widgets in your library yet.</p>
            </div>
          ) : (
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}>
              {filteredWidgets.map((widget) => (
                <WidgetCard
                  key={widget.id}
                  widget={widget}
                  viewMode={viewMode}
                  onCopy={() => copyUrl(widget.url ?? "", widget.id)}
                  copied={copiedId === widget.id}
                  onAdd={() => addToRoomPrompt(widget)}
                  onPreview={() => previewWidget(widget)}
                  onRemove={() => removeFromLibrary(widget.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <PreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function PreviewModal({ preview, onClose }: { preview: { type: "url"; content: string; title?: string; embedInfo?: any } | null; onClose: () => void }) {
  const blocked = !!preview?.embedInfo && !preview.embedInfo.embeddable;
  return (
    <Modal
      open={!!preview}
      onClose={onClose}
      title={preview?.title || "Preview"}
      size="wide"
      flush
      footer={
        <>
          {blocked && preview && (
            <button onClick={() => window.open(preview.content, "_blank")} className="btn btn-secondary btn-sm">
              Open in new tab
            </button>
          )}
          <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
        </>
      }
    >
      {preview && (blocked ? (
        <div className="p-5 space-y-3">
          <div className="alert-danger">
            This site blocks embedding (X-Frame-Options or Content-Security-Policy prevents framing). You can open it in a new tab instead.
          </div>
          <pre className="card-surface p-3 text-mono text-fg-muted whitespace-pre-wrap overflow-auto">
            {JSON.stringify(preview.embedInfo, null, 2)}
          </pre>
        </div>
      ) : (
        <iframe src={preview.content} title={preview.title || "Preview"} className="w-full h-full min-h-[60vh] border-0" />
      ))}
    </Modal>
  );
}

interface WidgetCardProps {
  widget: any;
  viewMode: "grid" | "list";
  onCopy: () => void;
  copied: boolean;
  onAdd?: () => void;
  onPreview?: () => void;
  onRemove?: () => void;
}

function WidgetCard({ widget, viewMode, onCopy, copied, onAdd, onPreview, onRemove }: WidgetCardProps) {
  const copyIcon = copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />;

  if (viewMode === "list") {
    return (
      <div className="card p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-body font-medium text-fg truncate">{widget.title}</h3>
          <p className="text-caption text-fg-muted truncate">{widget.url}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onCopy} className="btn btn-ghost btn-sm">
            {copyIcon}
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={() => onPreview?.()} className="btn btn-secondary btn-sm">Preview</button>
          <button onClick={onAdd} className="btn btn-primary btn-sm">Add</button>
          <button onClick={() => onRemove?.()} className="btn btn-danger btn-sm">Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-body font-medium text-fg truncate">{widget.title}</h3>
        <button onClick={onCopy} className="btn-icon-sm shrink-0" title="Copy URL" aria-label="Copy URL">
          {copyIcon}
        </button>
      </div>
      <p className="text-caption text-fg-muted truncate mb-4">{widget.url}</p>
      <div className="flex gap-2">
        <button onClick={onAdd} className="btn btn-primary btn-sm flex-1">Add to room</button>
        <button onClick={() => onPreview?.()} className="btn btn-secondary btn-sm flex-1">Preview</button>
        <button onClick={() => onRemove?.()} className="btn btn-danger btn-sm">Delete</button>
      </div>
    </div>
  );
}
