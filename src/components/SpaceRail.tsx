"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ChevronsLeft,
  ChevronsRight,
  Edit2,
  Home,
  LogIn,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import type { Space } from "@/types";
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Modal } from "@/components/ui/Modal";

interface SpaceRailProps {
  currentRoomId: string;
  isHome: boolean;
}

function initials(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "RM";
}

let cachedRooms: Space[] = [];

export function SpaceRail({ currentRoomId, isHome }: SpaceRailProps) {
  const router = useRouter();
  const { user } = useUser();
  const [rooms, setRooms] = useState<Space[]>(() => cachedRooms);
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [settingsMenu, setSettingsMenu] = useState<{ roomId: string; top: number; left: number } | null>(null);
  const [renameRoomId, setRenameRoomId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("cubics:rail:expanded");
      if (saved !== null) setExpanded(saved === "true");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("cubics:rail:expanded", String(expanded));
    } catch {}
  }, [expanded]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/spaces")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          cachedRooms = data;
          if (!cancelled) setRooms(data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentRoomId]);

  useEffect(() => {
    if (!settingsMenu) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest("[data-room-settings],[data-room-settings-menu]")) setSettingsMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [settingsMenu]);

  const homeRoom = rooms.find((room) => room.name === "Home" && room.ownerId === user?.id);
  const roomList = rooms
    .filter((room) => room.name !== "Home")
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const handleJoin = async () => {
    const code = joinCode.trim();
    if (!code || joining) return;
    setJoinError("");
    setJoining(true);
    try {
      const res = await fetch(`/api/spaces/${encodeURIComponent(code)}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJoinError(data.error || "space not found");
        return;
      }
      setJoinOpen(false);
      setJoinCode("");
      setJoinError("");
      router.push(`/spaces/${data.roomId || code}`);
    } catch {
      setJoinError("space not found");
    } finally {
      setJoining(false);
    }
  };

  const handleRename = async () => {
    const roomId = renameRoomId;
    const name = renameInput.trim();
    if (!roomId || !name || renaming) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/spaces/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        alert("Failed to rename room");
        return;
      }
      const data = await res.json();
      setRooms((prev) => {
        const next = prev.map((room) => (room.id === roomId ? { ...room, name: data.name } : room));
        cachedRooms = next;
        return next;
      });
      setRenameRoomId(null);
      setRenameInput("");
    } catch (err) {
      console.error(err);
      alert("Failed to rename room");
    } finally {
      setRenaming(false);
    }
  };

  const deleteRoom = async (roomId: string) => {
    if (!confirm("Delete this room? This will remove all widgets.")) return;
    try {
      const res = await fetch(`/api/spaces?roomId=${roomId}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to delete room");
        return;
      }
      setRooms((prev) => {
        const next = prev.filter((room) => room.id !== roomId);
        cachedRooms = next;
        return next;
      });
      if (roomId === currentRoomId) router.push(homeRoom ? `/spaces/${homeRoom.id}` : "/");
    } catch (err) {
      console.error(err);
      alert("Failed to delete room");
    }
  };

  return (
    <aside
      className={`${
        expanded ? "w-64" : "w-14"
      } shrink-0 bg-canvas border-r border-line flex flex-col py-2 overflow-hidden transition-[width] duration-150`}
    >
      <div className={`flex items-center h-10 shrink-0 ${expanded ? "justify-between px-2" : "justify-center"}`}>
        {expanded && <span className="wordmark px-1 truncate">Cubics</span>}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="btn-icon shrink-0"
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
        </button>
      </div>

      <div className="h-px bg-line mx-2 my-1 shrink-0" />

      <div className="px-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (isHome) return;
            setSettingsMenu(null);
            router.push(homeRoom ? `/spaces/${homeRoom.id}` : "/");
          }}
          className={`w-full h-10 flex items-center rounded-sm ${
            expanded ? "gap-2 px-2" : "justify-center"
          } ${isHome ? "bg-accent-soft text-accent-ink" : "text-fg-muted hover:bg-hover hover:text-fg"}`}
          title="Home"
          aria-label="Home"
          aria-current={isHome ? "page" : undefined}
        >
          <Home className="w-4 h-4 shrink-0" />
          {expanded && <span className="text-small truncate">Home</span>}
        </button>
        <button
          type="button"
          onClick={() => { setJoinCode(""); setJoinError(""); setJoinOpen(true); }}
          className={`w-full h-10 flex items-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg ${expanded ? "gap-2 px-2" : "justify-center"}`}
          title="Join space"
          aria-label="Join space"
        >
          <LogIn className="w-4 h-4 shrink-0" />
          {expanded && <span className="text-small truncate">Join space</span>}
        </button>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className={`w-full h-10 flex items-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg ${expanded ? "gap-2 px-2" : "justify-center"}`}
          title="New space"
          aria-label="New space"
        >
          <Plus className="w-4 h-4 shrink-0" />
          {expanded && <span className="text-small truncate">New space</span>}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pt-3 pb-1 text-caption text-fg-subtle shrink-0">Rooms</div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-0.5" onScroll={() => setSettingsMenu(null)}>
        {roomList.map((room) => {
          const active = room.id === currentRoomId;
          return (
            <div
              key={room.id}
              data-room-settings={room.id}
              className={`group relative w-[calc(100%-8px)] h-10 flex items-center rounded-sm mx-auto ${
                active ? "bg-accent-soft" : "hover:bg-hover"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSettingsMenu(null);
                  router.push(`/spaces/${room.id}`);
                }}
                className={`flex-1 min-w-0 h-full flex items-center rounded-sm ${
                  expanded ? "gap-2 px-2" : "justify-center"
                } ${active ? "text-accent-ink" : "text-fg-muted hover:text-fg"}`}
                title={room.name}
                aria-label={room.name}
                aria-current={active ? "page" : undefined}
              >
                <span className="w-6 h-6 shrink-0 rounded-sm overflow-hidden ring-1 ring-line">
                  {room.avatar ? (
                    <img src={room.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center bg-surface text-fg-muted text-caption">
                      {initials(room.name)}
                    </span>
                  )}
                </span>
                {expanded && <span className="text-small truncate">{room.name}</span>}
              </button>

              {expanded && room.ownerId === user?.id && (
                <div className="relative shrink-0 pr-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (settingsMenu?.roomId === room.id) {
                        setSettingsMenu(null);
                        return;
                      }
                      const rect = e.currentTarget.getBoundingClientRect();
                      const menuWidth = 160;
                      const menuHeight = 90;
                      const top =
                        rect.bottom + 4 + menuHeight > window.innerHeight
                          ? Math.max(8, rect.top - menuHeight - 4)
                          : rect.bottom + 4;
                      const left = Math.max(
                        8,
                        Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth)
                      );
                      setSettingsMenu({ roomId: room.id, top, left });
                    }}
                    className={`btn-icon-sm shrink-0 ${
                      active || settingsMenu?.roomId === room.id
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    }`}
                    title="Space settings"
                    aria-label="Space settings"
                    aria-expanded={settingsMenu?.roomId === room.id}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {expanded && roomList.length === 0 && (
          <p className="px-2 py-1 text-caption text-fg-subtle">No spaces yet</p>
        )}
      </div>

      {settingsMenu && (() => {
        const room = rooms.find((r) => r.id === settingsMenu.roomId);
        if (!room) return null;
        return (
          <div
            data-room-settings-menu
            className="fixed w-40 menu z-50"
            style={{ top: settingsMenu.top, left: settingsMenu.left }}
          >
            <button
              type="button"
              onClick={() => {
                setSettingsMenu(null);
                setRenameRoomId(room.id);
                setRenameInput(room.name);
              }}
              className="menu-item"
            >
              <Edit2 className="w-4 h-4 text-fg-muted" />
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsMenu(null);
                deleteRoom(room.id);
              }}
              className="menu-item menu-item-danger"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        );
      })()}

      <div className="h-px bg-line mx-2 my-1 shrink-0" />

      <div className="px-2 shrink-0 pb-1">
        <ProfileDropdown afterSignOutUrl="/sign-in" sidebar compact={!expanded} />
      </div>

      <CreateSpaceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(roomId) => router.push(`/spaces/${roomId}`)}
      />

      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join space"
        size="sm"
        footer={
          <>
            <button onClick={() => setJoinOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
            <button onClick={handleJoin} disabled={!joinCode.trim() || joining} className="btn btn-primary btn-sm">
              {joining ? "Joining..." : "Join"}
            </button>
          </>
        }
      >
        <label className="field-label" htmlFor="join-code">Space code</label>
        <input
          id="join-code"
          autoFocus
          value={joinCode}
          onChange={(e) => {
            setJoinCode(e.target.value);
            setJoinError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleJoin();
          }}
          className="input-base w-full"
          placeholder="Enter a room code"
        />
        {joinError && <p className="text-small text-danger mt-2">{joinError}</p>}
      </Modal>

      <Modal
        open={!!renameRoomId}
        onClose={() => setRenameRoomId(null)}
        title="Rename room"
        size="sm"
        footer={
          <>
            <button onClick={() => setRenameRoomId(null)} className="btn btn-ghost btn-sm">Cancel</button>
            <button onClick={handleRename} disabled={!renameInput.trim() || renaming} className="btn btn-primary btn-sm">
              {renaming ? "Renaming..." : "Rename"}
            </button>
          </>
        }
      >
        <label className="field-label" htmlFor="rename-room">Name</label>
        <input
          id="rename-room"
          autoFocus
          value={renameInput}
          onChange={(e) => setRenameInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
          }}
          className="input-base w-full"
          placeholder="New space name"
        />
      </Modal>
    </aside>
  );
}
