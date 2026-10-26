"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Copy, Check, Grid, List, PlusCircle } from "lucide-react";
import type { Widget } from "@/types";
import { ProfileDropdown } from "@/components/ProfileDropdown";

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
      <div className="flex items-center justify-center min-h-screen bg-zinc-50">
        <div className="w-8 h-8 border-2 border-surface border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 bg-white border-b border-surface">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Widget Library</h1>
            <p className="text-zinc-500">Browse and add widgets to your rooms</p>
          </div>
          <ProfileDropdown afterSignOutUrl="/sign-in" />
        </div>
      </header>

      <main className="px-6 pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search widgets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base w-full pl-10 pr-4 py-2 placeholder:text-zinc-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`btn-ghost p-2 transition-colors ${
                  viewMode === "grid" ? "bg-surface text-accent-teal border border-accent-teal" : "border-surface text-zinc-500 hover:bg-surface"
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`btn-ghost p-2 transition-colors ${
                  viewMode === "list" ? "bg-surface text-accent-teal border border-accent-teal" : "border-surface text-zinc-500 hover:bg-surface"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setAddingLink((s) => !s)}
                className="btn-ghost p-2 text-zinc-500 hover:text-zinc-900 hover:bg-surface transition-colors"
                title="Add by link"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
              {/* Embed/code support removed */}
            </div>
          </div>

          {addingLink && (
            <div className="max-w-6xl mx-auto mb-4">
              <div className="card p-4 flex gap-2">
                <input className="flex-1 input-base pl-3 pr-3" placeholder="Optional title" value={newTitle} onChange={(e)=>setNewTitle(e.target.value)} />
                <input className="flex-2 input-base pl-3 pr-3" placeholder="https://example.com/widget" value={newLink} onChange={(e)=>setNewLink(e.target.value)} />
                <button onClick={addByLink} className="btn-primary px-3 py-1">Add</button>
                <button onClick={()=>{setAddingLink(false); setNewLink(""); setNewTitle("")}} className="btn-outline px-3 py-1">Cancel</button>
              </div>
            </div>
          )}

          {filteredWidgets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xs text-zinc-500">No widgets in your library yet.</p>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  : "space-y-4"
              }
            >
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

// Preview modal
function PreviewModal({ preview, onClose }: { preview: { type: "url"; content: string; title?: string; embedInfo?: any } | null; onClose: () => void }) {
  if (!preview) return null;
  const blocked = preview.embedInfo && !preview.embedInfo.embeddable;
  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="card w-11/12 max-w-4xl h-[80vh] overflow-hidden" onClick={(e)=>e.stopPropagation()}>
          <div className="flex items-center justify-between p-3 border-b border-surface">
            <div className="font-medium text-zinc-900">{preview.title || "Preview"}</div>
            <div className="flex items-center gap-2">
              {blocked && (
                <button onClick={() => window.open(preview.content, '_blank')} className="btn-outline px-3 py-1 text-xs border">Open in new tab</button>
              )}
              <button onClick={onClose} className="btn-ghost px-3 py-1 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-surface transition-colors">Close</button>
            </div>
          </div>
          <div className="p-3 h-full">
            {blocked ? (
              <div className="h-full flex flex-col gap-3">
                <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600 text-xs">
                  This site blocks embedding (X-Frame-Options or Content-Security-Policy prevents framing). You can open it in a new tab instead.
                </div>
                <div className="overflow-auto border border-surface rounded p-3 bg-white flex-1">
                  <pre className="text-xs whitespace-pre-wrap text-zinc-500">{JSON.stringify(preview.embedInfo, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <iframe src={preview.content} className="w-full h-full border border-surface" />
            )}
          </div>
        </div>
      </div>
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
  if (viewMode === "list") {
    return (
      <div className="card p-4 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-zinc-900">{widget.title}</h3>
          <p className="text-xs text-zinc-500">{widget.url}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCopy} className="btn-ghost p-1 text-zinc-500 hover:text-accent-teal hover:bg-surface transition-colors">
            {copied ? <Check className="w-4 h-4 text-accent-lime" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button onClick={onAdd} className="btn-primary px-3 py-1">Add</button>
          <button onClick={(e)=>{e.stopPropagation(); onPreview?.()}} className="btn-ghost p-1 text-zinc-500 hover:text-accent-teal hover:bg-surface transition-colors">
            Preview
          </button>
          <button onClick={(e)=>{e.stopPropagation(); onRemove?.()}} className="btn-ghost p-1 text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors">
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-zinc-900">{widget.title}</h3>
        <button
          onClick={onCopy}
          className="btn-ghost p-1 text-zinc-500 hover:text-accent-teal hover:bg-surface transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-accent-lime" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-xs text-zinc-500 mb-3">{widget.url}</p>
      <div className="flex gap-2">
        <button onClick={onAdd} className="btn-primary flex-1 px-3 py-1.5 text-xs">Add to Room</button>
        <button onClick={()=>(onPreview ? onPreview() : null)} className="btn-secondary flex-1 px-3 py-1.5 text-xs">Preview</button>
        <button onClick={()=>(onRemove ? onRemove() : null)} className="btn-ghost px-3 py-1.5 text-xs text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors">Delete</button>
      </div>
    </div>
  );
}

// Preview modal appended at bottom of file