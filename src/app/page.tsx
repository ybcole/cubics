"use client";

import { useUser, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Users, Search, RefreshCw, Trash2, Puzzle, ExternalLink } from "lucide-react";
import type { Room } from "@/types";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.push("/sign-in");
      return;
    }
    fetchRooms();
  }, [user, isLoaded, router]);

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

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-5 h-5 border border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SignedIn>
        <header className="sticky top-0 z-10 bg-white border-b border-zinc-200">
          <div className="flex items-center justify-between px-6 h-14">
            <h1 className="text-sm font-semibold text-zinc-900">Cubics</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/rooms/create")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-sm font-medium rounded-md hover:bg-zinc-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Room
              </button>
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </header>

        <main className="px-6 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Extension Banner */}
            <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg mb-6">
              <div className="flex items-center gap-2.5">
                <Puzzle className="w-4 h-4 text-indigo-600 shrink-0" />
                <p className="text-sm text-indigo-900">
                  Install <span className="font-medium">Cubics Companion</span> to embed any website and intercept new-tab navigation.
                </p>
              </div>
              <a
                href="/api/download-companion"
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
                Download Extension
              </a>
            </div>

            {/* Search + Refresh */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={fetchRooms}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Rooms */}
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 bg-zinc-50 border border-zinc-200 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-sm text-zinc-500 mb-4">
                  {searchQuery ? "No rooms match your search" : "No rooms yet"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => router.push("/rooms/create")}
                    className="text-sm text-indigo-600 font-medium hover:text-indigo-700"
                  >
                    Create your first room
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => router.push(`/rooms/${room.id}`)}
                    className="flex items-center justify-between px-4 py-3 bg-white border border-zinc-200 rounded-lg cursor-pointer hover:border-zinc-300 transition-colors"
                  >
                    <div className="min-w-0">
                      <h2 className="text-sm font-medium text-zinc-900 truncate">{room.name}</h2>
                      {room.description && (
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{room.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {room.memberCount}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {new Date(room.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                        className="p-1 text-zinc-300 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </SignedIn>

      <SignedOut>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2 tracking-tight">Cubics</h1>
            <p className="text-sm text-zinc-500 mb-6">Collaborative canvas for anything</p>
            <SignInButton />
          </div>
        </div>
      </SignedOut>
    </div>
  );
}
