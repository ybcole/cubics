"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface CreateRoomDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (roomId: string) => void;
}

export function CreateRoomDialog({ open, onClose, onCreate }: CreateRoomDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (response.ok) {
        const room = await response.json();
        onClose();
        onCreate(room.id);
      } else {
        const body = await response.json();
        setError(body.error || "Failed to create room");
      }
    } catch (error) {
      setError("Failed to create room");
      console.error("Failed to create room:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg p-4 shadow-xl w-72 border border-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-900">New Room</h3>
          <button onClick={onClose} className="btn-ghost p-1 text-zinc-500 hover:text-zinc-900 hover:bg-surface transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {error && (
          <div className="mb-2.5 p-2 rounded-md bg-red-50 border border-red-200 text-red-600 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 mb-1 uppercase tracking-wide">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing Dashboard"
              className="input-base w-full placeholder:text-zinc-500"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-500 mb-1 uppercase tracking-wide">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="input-base w-full placeholder:text-zinc-500"
            />
          </div>

          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Rooms are private. Share the room code to invite others.
          </p>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="btn-primary w-full py-1.5 text-xs mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create Room"}
          </button>
        </form>
      </div>
    </div>
  );
}
