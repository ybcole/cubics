"use client";

import { useUser, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Users, Search, RefreshCw, Trash2, LogIn, Bell, Clock, User as UserIcon, Edit2, Globe, Settings } from "lucide-react";
import io from "socket.io-client";
import type { Room } from "@/types";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { CreateRoomDialog } from "@/components/CreateRoomDialog";
import { Modal } from "@/components/ui/Modal";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [renameRoomId, setRenameRoomId] = useState<string | null>(null);
  const [settingsRoomId, setSettingsRoomId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [roomPresence, setRoomPresence] = useState<Record<string, Array<{ id: string; userName: string; imageUrl: string | null }>>>({});

  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.push("/sign-in");
      return;
    }
    fetchRooms();
  }, [user, isLoaded, router]);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://127.0.0.1:3001", { transports: ["websocket"] });
    socketRef.current = socket;

    type PresenceMember = { id: string; userId: string | null; userName: string; imageUrl: string | null };
    const realMembers = (members: PresenceMember[] | undefined) =>
      Array.isArray(members) ? members.filter((m) => m && m.userId) : [];

    const requestPresence = () => socket.emit("presence:request");

    socket.on("connect", requestPresence);
    if (socket.connected) requestPresence();
    socket.on("presence:snapshot", (rooms: Record<string, PresenceMember[]>) => {
      const clean: Record<string, PresenceMember[]> = {};
      for (const [rid, members] of Object.entries(rooms || {})) {
        const list = realMembers(members);
        if (list.length > 0) clean[rid] = list;
      }
      setRoomPresence(clean);
    });
    socket.on("presence:update", ({ roomId, members }: { roomId: string; members: PresenceMember[] }) => {
      setRoomPresence((prev) => ({ ...prev, [roomId]: realMembers(members) }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function fetchRooms() {
    try {
      const response = await fetch("/api/rooms");
      if (response.ok) {
        const data = await response.json();
        setRooms(data);
      }
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteRoom = async (roomId: string) => {
    if (!confirm("Delete this room? This will remove all widgets.")) return;
    try {
      const res = await fetch(`/api/rooms?roomId=${roomId}`, { method: "DELETE" });
      if (res.ok) fetchRooms();
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setJoinError("");
    try {
      const res = await fetch(`/api/rooms/${code}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setShowJoinDialog(false);
        setJoinCode("");
        setJoinError("");
        router.push(`/rooms/${data.roomId || code}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setJoinError(data.error || "Room not found");
      }
    } catch {
      setJoinError("Room not found");
    }
  };

  const handleRename = async () => {
    if (!renameRoomId || !renameInput.trim()) return;
    try {
      const res = await fetch(`/api/rooms/${renameRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setRooms((prev) => prev.map((r) => (r.id === renameRoomId ? { ...r, name: data.name } : r)));
        setRenameRoomId(null);
        setRenameInput("");
      } else {
        alert("Failed to rename room");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to rename room");
    }
  };

  const handleCreate = (roomId: string) => {
    setShowCreateDialog(false);
    router.push(`/rooms/${roomId}`);
  };

  const getPresenceForRoom = useCallback((roomId: string) => {
    return roomPresence[roomId] || [];
  }, [roomPresence]);

  const renderRoomCard = (room: Room) => {
    const presence = getPresenceForRoom(room.id);
    return (
      <div
        key={room.id}
        onClick={() => router.push(`/rooms/${room.id}`)}
        className="card card-interactive p-4 flex items-center justify-between gap-4 overflow-visible"
      >
        <div className="min-w-0">
          <h2 className="text-body font-medium text-fg truncate">{room.name}</h2>
          {room.description && (
            <p className="text-small text-fg-muted truncate mt-0.5">{room.description}</p>
          )}
          {presence.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 max-w-[480px]">
              {Array.from(new Map(presence.map((m: any) => [m.userId || m.id, m])).values()).map((member: any) => (
                <div key={member.id} className="relative w-6 h-6 shrink-0" title={member.userName}>
                  {member.imageUrl ? (
                    <img src={member.imageUrl} alt={member.userName} className="w-6 h-6 rounded-full ring-1 ring-line object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-surface flex items-center justify-center text-fg-muted ring-1 ring-line">
                      <UserIcon className="w-3 h-3" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {room.ownerId === user?.id && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); setSettingsRoomId(settingsRoomId === room.id ? null : room.id); }}
                className="btn-icon-sm"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              {settingsRoomId === room.id && (
                <div className="absolute right-0 mt-2 w-40 menu z-50">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSettingsRoomId(null); setRenameRoomId(room.id); setRenameInput(room.name); }}
                    className="menu-item"
                  >
                    <Edit2 className="w-4 h-4 text-fg-muted" />
                    Rename
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSettingsRoomId(null); deleteRoom(room.id); }}
                    className="menu-item menu-item-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SignedIn>
        <header className="app-header">
          <div className="app-header-inner">
            <h1 className="wordmark">Cubics</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setJoinCode(""); setJoinError(""); setShowJoinDialog(true); }}
                className="btn btn-secondary btn-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                Join room
              </button>
              <button onClick={() => setShowCreateDialog(true)} className="btn btn-primary btn-sm">
                <Plus className="w-3.5 h-3.5" />
                New room
              </button>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="btn-icon"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
              <ProfileDropdown afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </header>

        <main className="px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-h1 text-fg mb-6">Rooms</h2>

            <div className="flex items-center gap-2 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-base w-full pl-9"
                />
              </div>
              <button onClick={fetchRooms} className="btn-icon" title="Refresh" aria-label="Refresh rooms">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-[74px]" />
                ))}
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-small text-fg-muted mb-4">
                  {searchQuery ? "No rooms match your search" : "No rooms yet"}
                </p>
                {!searchQuery && (
                  <button onClick={() => setShowCreateDialog(true)} className="btn btn-primary">
                    Create your first room
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">{filteredRooms.map(renderRoomCard)}</div>
            )}
          </div>
        </main>

        <Modal
          open={showJoinDialog}
          onClose={() => setShowJoinDialog(false)}
          title="Join room"
          size="sm"
          footer={
            <>
              <button onClick={() => setShowJoinDialog(false)} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={handleJoin} disabled={!joinCode.trim()} className="btn btn-primary btn-sm">Join</button>
            </>
          }
        >
          <label className="field-label" htmlFor="join-code">Room code</label>
          <input
            id="join-code"
            autoFocus
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
            className="input-base w-full"
            placeholder="Enter a room code"
          />
          {joinError && <p className="text-small text-danger mt-2">{joinError}</p>}
        </Modal>

        {showCreateDialog && (
          <CreateRoomDialog
            open={showCreateDialog}
            onClose={() => setShowCreateDialog(false)}
            onCreate={handleCreate}
          />
        )}

        <Modal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifications" size="sm">
          <p className="text-small text-fg-muted text-center py-4">No notifications yet</p>
        </Modal>

        <Modal
          open={!!renameRoomId}
          onClose={() => setRenameRoomId(null)}
          title="Rename room"
          size="sm"
          footer={
            <>
              <button onClick={() => setRenameRoomId(null)} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={handleRename} disabled={!renameInput.trim()} className="btn btn-primary btn-sm">Rename</button>
            </>
          }
        >
          <label className="field-label" htmlFor="rename-room">Name</label>
          <input
            id="rename-room"
            autoFocus
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
            className="input-base w-full"
            placeholder="New room name"
          />
        </Modal>
      </SignedIn>

      <SignedOut>
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-display text-fg mb-2">Cubics</h1>
            <p className="text-body text-fg-muted mb-8">Collaborative canvas for anything</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/sign-in" className="btn btn-primary">Sign in</Link>
              <Link href="/sign-up" className="btn btn-secondary">Create account</Link>
            </div>
          </div>
        </div>
      </SignedOut>
    </div>
  );
}
