"use client";

import { useUser, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Users, Search, RefreshCw, Trash2, LogIn, Bell, Clock, User as UserIcon, Edit2 } from "lucide-react";
import io from "socket.io-client";
import type { Room } from "@/types";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { CreateRoomDialog } from "@/components/CreateRoomDialog";

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
  const [renameInput, setRenameInput] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [roomPresence, setRoomPresence] = useState<Map<string, Array<{ id: string; userName: string; imageUrl: string | null }>>>(new Map());
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
    const socket = io("http://localhost:3001", { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("presence:update", ({ roomId, members }: { roomId: string; members: Array<{ id: string; userName: string; imageUrl: string | null }> }) => {
      setRoomPresence((prev) => {
        const next = new Map(prev);
        next.set(roomId, members);
        return next;
      });
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
    return roomPresence.get(roomId) || [];
  }, [roomPresence]);

  const renderRoomCard = (room: Room) => {
    const presence = getPresenceForRoom(room.id);
    return (
      <div
        key={room.id}
        onClick={() => router.push(`/rooms/${room.id}`)}
        className="card p-4 cursor-pointer hover:border-accent-teal transition-colors"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-zinc-900 truncate">{room.name}</h2>
          {room.description && (
            <p className="text-xs text-zinc-500 truncate mt-0.5">{room.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <Users className="w-3 h-3" />
            {room.memberCount}
          </span>
          <span className="text-xs text-zinc-500">
            {new Date(room.createdAt).toLocaleDateString()}
          </span>
          {presence.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                Live
              </span>
              <div className="flex items-center gap-1">
                {presence.slice(0, 3).map((member) => (
                  <div
                    key={member.id}
                    className="relative w-5 h-5 flex-shrink-0"
                    title={member.userName}
                  >
                    {member.imageUrl ? (
                      <img
                        src={member.imageUrl}
                        alt={member.userName}
                        className="w-5 h-5 rounded-full border border-white border-2 object-cover"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-surface flex items-center justify-center border border-white border-2">
                        <UserIcon className="w-2.5 h-2.5 text-zinc-500" />
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 w-1.5 h-1.5 rounded-full bg-accent-lime border border-white" />
                  </div>
                ))}
                {presence.length > 3 && (
                  <div className="w-5 h-5 rounded-full bg-surface flex items-center justify-center border border-white border-2">
                    <span className="text-[9px] font-medium text-zinc-500">+{presence.length - 3}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {room.ownerId === user?.id && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setRenameRoomId(room.id); setRenameInput(room.name); }}
                className="btn-ghost p-1 text-zinc-500 hover:text-accent-teal hover:bg-surface transition-colors" title="Rename"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                className="btn-ghost p-1 text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-5 h-5 border border-surface border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SignedIn>
        <header className="sticky top-0 z-10 bg-white border-b border-surface">
          <div className="flex items-center justify-between px-6 h-14">
            <h1 className="text-sm font-semibold text-zinc-900">Cubics</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setJoinCode(""); setJoinError(""); setShowJoinDialog(true); }}
                className="btn-outline px-3 py-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Join Room
              </button>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="btn-primary px-3 py-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Room
              </button>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="btn-ghost p-1 text-zinc-500 hover:text-zinc-900 hover:bg-surface transition-colors" title="Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
              </button>
              <ProfileDropdown afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </header>

        <main className="px-6 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Search + Refresh */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-base w-full pl-9 pr-3 py-2 placeholder:text-zinc-500"
                />
              </div>
              <button
                onClick={fetchRooms}
                className="btn-ghost p-2 text-zinc-500 hover:text-zinc-900 hover:bg-surface transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Rooms */}
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 bg-surface border border-surface rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-xs text-zinc-500 mb-4">
                  {searchQuery ? "No rooms match your search" : "No rooms yet"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowCreateDialog(true)}
                    className="text-xs text-accent-teal font-medium hover:text-accent-teal-hover"
                  >
                    Create your first room
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRooms.map(renderRoomCard)}
              </div>
            )}
          </div>
        </main>

        {showJoinDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowJoinDialog(false)}>
            <div className="bg-white rounded-lg p-4 shadow-xl w-64 border border-surface" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-medium text-zinc-900 mb-3">Join Room</h3>
              <p className="text-xs text-zinc-500 mb-3">Enter a room code</p>
              <input
                autoFocus
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
                className="input-base w-full pl-3 pr-3 mb-2 placeholder:text-zinc-500"
                placeholder="Room code"
              />
              {joinError && <p className="text-xs text-red-600 mb-2">{joinError}</p>}
              <div className="flex gap-2">
                <button onClick={handleJoin} disabled={!joinCode.trim()} className="btn-primary flex-1 py-1.5 text-xs">Join</button>
                <button onClick={() => setShowJoinDialog(false)} className="btn-ghost flex-1 py-1.5 text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showCreateDialog && (
          <CreateRoomDialog
            open={showCreateDialog}
            onClose={() => setShowCreateDialog(false)}
            onCreate={handleCreate}
          />
        )}

        {notificationsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setNotificationsOpen(false)}>
            <div className="bg-white rounded-lg p-4 shadow-xl w-64 border border-surface" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-medium text-zinc-900 mb-3">Notifications</h3>
              <div className="py-1">
                <div className="px-3 py-2 text-xs text-zinc-500 text-center border-b border-surface last:border-b-0">
                  No notifications yet
                </div>
              </div>
            </div>
          </div>
        )}

        {renameRoomId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRenameRoomId(null)}>
            <div className="bg-white rounded-lg p-4 shadow-xl w-64 border border-surface" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-medium text-zinc-900 mb-3">Rename Room</h3>
              <input
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
                className="input-base w-full mb-3 placeholder:text-zinc-500"
                placeholder="New room name"
              />
              <div className="flex gap-2">
                <button onClick={handleRename} disabled={!renameInput.trim()} className="btn-primary flex-1 py-1.5 text-xs">Rename</button>
                <button onClick={() => setRenameRoomId(null)} className="btn-ghost flex-1 py-1.5 text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </SignedIn>

      <SignedOut>
        <div className="flex min-h-screen items-center justify-center bg-white p-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2 tracking-tight">Cubics</h1>
            <p className="text-zinc-500 mb-6">Collaborative canvas for anything</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/sign-in" className="btn-primary px-6 py-2.5 text-sm">
                Sign in
              </Link>
              <Link href="/sign-up" className="btn-outline px-6 py-2.5 text-sm">
                Create account
              </Link>
            </div>
          </div>
        </div>
      </SignedOut>
    </div>
  );
}
