"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New room"
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
