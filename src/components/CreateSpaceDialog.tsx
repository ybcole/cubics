"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

interface CreateSpaceDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (roomId: string) => void;
}

export function CreateSpaceDialog({ open, onClose, onCreate }: CreateSpaceDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, avatar }),
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New space"
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button
            type="submit"
            form="create-room-form"
            disabled={loading || !name.trim()}
            className="btn btn-primary btn-sm"
          >
            {loading ? "Creating..." : "Create room"}
          </button>
        </>
      }
    >
      <form id="create-room-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="alert-danger">{error}</div>}
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt="Space avatar" className="w-10 h-10 rounded-md object-cover ring-1 ring-line" />
          ) : (
            <div className="w-10 h-10 rounded-md bg-surface ring-1 ring-line flex items-center justify-center text-fg-subtle">
              <span className="text-caption">+</span>
            </div>
          )}
          <label className="btn btn-secondary btn-sm cursor-pointer">
            Upload picture
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        </div>
        <div>
          <label className="field-label" htmlFor="room-name">Name</label>
          <input
            id="room-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marketing Dashboard"
            className="input-base w-full"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="room-description">Description</label>
          <input
            id="room-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            className="input-base w-full"
          />
        </div>
        <p className="field-hint">Rooms are private. Share the room code to invite others.</p>
      </form>
    </Modal>
  );
}
