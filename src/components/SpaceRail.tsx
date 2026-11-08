"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { MdDelete, MdEdit } from "react-icons/md";
import { Eye, Inbox, Settings } from "lucide-react";
import type { Space } from "@/types";
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog";
import { SettingsModal } from "@/components/SettingsModal";
import { Modal } from "@/components/ui/Modal";
import {
  ChevronDownIcon,
  HomeIcon,
  JoinIcon,
  MoreIcon,
  PlusCircleIcon,
  SpaceTile,
} from "@/components/RailIcons";

interface SpaceRailProps {
  currentRoomId: string;
  isHome: boolean;
}

let cachedRooms: Space[] = [];
// Survives client-side navigation (the rail remounts on every space), so
// collapsed / focus state does not flash back to expanded.
const railState = { expanded: true, focused: false };

export function SpaceRail({ currentRoomId, isHome }: SpaceRailProps) {
  const router = useRouter();
  const { user } = useUser();
  const [rooms, setRooms] = useState<Space[]>(() => cachedRooms);
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => railState.expanded);
  const [focused, setFocused] = useState(() => railState.focused);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [spacesOpen, setSpacesOpen] = useState(true);
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [settingsMenu, setSettingsMenu] = useState<{ roomId: string; top: number; left: number } | null>(null);
  const [renameRoomId, setRenameRoomId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const onCollapse = () => setExpanded(false);
    window.addEventListener("cubics:collapse-sidebar", onCollapse);
    return () => window.removeEventListener("cubics:collapse-sidebar", onCollapse);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("cubics:rail:expanded");
      if (saved !== null) setExpanded(saved === "true");
      const spaces = window.localStorage.getItem("cubics:rail:spaces-open");
      if (spaces !== null) setSpacesOpen(spaces === "true");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("cubics:rail:spaces-open", String(spacesOpen));
    } catch {}
  }, [spacesOpen]);

  useEffect(() => {
    setTip(null);
  }, [expanded]);

  useEffect(() => {
    railState.expanded = expanded;
    try {
      window.localStorage.setItem("cubics:rail:expanded", String(expanded));
    } catch {}
  }, [expanded]);

  // Preserve hidden state on client-side room navigation. The full sidebar is
  // unmounted while focused, so no background, border or focusable rows remain.
  useEffect(() => {
    railState.focused = focused;
    if (focused) {
      setTip(null);
      setSettingsMenu(null);
    }
  }, [focused]);

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
  const deleteTarget = deleteRoomId ? rooms.find((room) => room.id === deleteRoomId) : null;

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

  const deleteRoom = async () => {
    const roomId = deleteRoomId;
    if (!roomId || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/spaces?roomId=${encodeURIComponent(roomId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Failed to delete room");
        return;
      }
      setRooms((prev) => {
        const next = prev.filter((room) => room.id !== roomId);
        cachedRooms = next;
        return next;
      });
      setDeleteRoomId(null);
      if (roomId === currentRoomId) router.push(homeRoom ? `/spaces/${homeRoom.id}` : "/");
    } catch (err) {
      console.error(err);
      setDeleteError("Failed to delete room");
    } finally {
      setDeleting(false);
    }
  };

  const showTip = (el: HTMLElement, label: string) => {
    if (expanded) return;
    const card = cardRef.current?.getBoundingClientRect();
    if (!card) return;
    const rect = el.getBoundingClientRect();
    setTip({ label, top: rect.top + rect.height / 2, left: card.right + 8 });
  };
  const tipProps = (label: string) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showTip(e.currentTarget, label),
    onFocus: (e: React.FocusEvent<HTMLElement>) => showTip(e.currentTarget, label),
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  });
  const goHome = () => {
    if (isHome) return;
    setSettingsMenu(null);
    router.push(homeRoom ? `/spaces/${homeRoom.id}` : "/");
  };
  const openJoin = () => {
    setJoinCode("");
    setJoinError("");
    setJoinOpen(true);
  };
  const openSettings = (e: React.MouseEvent<HTMLButtonElement>, roomId: string) => {
    e.stopPropagation();
    if (settingsMenu?.roomId === roomId) {
      setSettingsMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 104;
    const top =
      rect.bottom + 4 + menuHeight > window.innerHeight
        ? Math.max(8, rect.top - menuHeight - 4)
        : rect.bottom + 4;
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
    setSettingsMenu({ roomId, top, left });
  };
  const openRoom = (roomId: string) => {
    setSettingsMenu(null);
    router.push(`/spaces/${roomId}`);
  };

  return (
    <>
    {focused && (
      <button
        type="button"
        onClick={() => {
          // A restored rail starts in the collapsed 84px state.
          setExpanded(false);
          setFocused(false);
        }}
        className="rail-restore-logo"
        title="Show collapsed sidebar"
        aria-label="Show collapsed sidebar"
      >
        <span className="rail-logo" aria-hidden="true" />
      </button>
    )}
    {!focused && <aside
      className={`rail-shell ${expanded ? "" : "is-collapsed"}`}
      onClick={(e) => {
        // Collapsed rail: a click on empty space expands it. Icons keep their own action.
        if (expanded) return;
        if ((e.target as Element).closest("button, a, [role=menuitem]")) return;
        setExpanded(true);
      }}
    >
      <div ref={cardRef} className={`rail-card ${expanded ? "" : "is-collapsed"}`}>
        <div className="rail-header">
          <span className="rail-brand" style={{ marginLeft: "10px" }}>
            <span className="rail-logo" aria-hidden="true" />
            {expanded && <span className="rail-wordmark" style={{ marginLeft: "8px" }}>cubics</span>}
          </span>
          {expanded && (
            <button
              type="button"
              onClick={() => setFocused(true)}
              className="rail-bare"
              title="Hide sidebar"
              aria-label="Hide sidebar"
              style={{ marginLeft: "4px" }}
            >
              <Eye className="rail-icon" />
            </button>
          )}

        </div>

        <nav className="rail-body rail-nav" aria-label="Main">
          <button
            type="button"
            onClick={goHome}
            className={`rail-item ${isHome ? "is-active" : ""}`}
            aria-label="Home"
            aria-current={isHome ? "page" : undefined}
            {...tipProps("Home")}
          >
            <HomeIcon className="rail-icon" />
            {expanded && <span className="rail-label">Home</span>}
          </button>
          <button
            type="button"
            onClick={() => router.push("/inbox")}
            className="rail-item"
            aria-label="Inbox"
            {...tipProps("Inbox")}
          >
            <Inbox className="rail-icon" />
            {expanded && <span className="rail-label">Inbox</span>}
          </button>
        </nav>

        <div className="rail-divider" />

        {expanded ? (
          <div className="rail-body rail-item-row">
            <div className="rail-item rail-item-strong rail-section">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rail-bare"
                aria-label="New space"
              >
                <PlusCircleIcon className="rail-icon" />
              </button>
              <button
                type="button"
                onClick={() => setSpacesOpen((value) => !value)}
                className="rail-bare rail-section-toggle"
                aria-expanded={spacesOpen}
              >
                <span className="rail-label">Spaces</span>
                <ChevronDownIcon className={`rail-chevron ${spacesOpen ? "" : "is-closed"}`} />
              </button>
            </div>
          </div>
        ) : (
          <div className="rail-body">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rail-item rail-item-strong"
              aria-label="New space"
              {...tipProps("New space")}
            >
              <PlusCircleIcon className="rail-icon" />
            </button>
          </div>
        )}

        <div className="rail-scroll" onScroll={() => { setSettingsMenu(null); setTip(null); }}>
          {expanded ? (
            spacesOpen && (
              <div className="rail-body">
                <div className="rail-children">
                  {roomList.map((room) => {
                    const active = room.id === currentRoomId;
                    return (
                      <div key={room.id} data-room-settings={room.id} className="rail-child-wrap group">
                        <button
                          type="button"
                          onClick={() => openRoom(room.id)}
                          className={`rail-item rail-child ${active ? "is-active" : ""}`}
                          aria-label={room.name}
                          aria-current={active ? "page" : undefined}
                        >
                          <SpaceTile id={room.id} name={room.name} avatar={room.avatar} />
                          <span className="rail-label">{room.name}</span>
                        </button>
                        {room.ownerId === user?.id && (
                          <button
                            type="button"
                            onClick={(e) => openSettings(e, room.id)}
                            className={`rail-more ${
                              settingsMenu?.roomId === room.id ? "is-open" : ""
                            }`}
                            title="Space settings"
                            aria-label="Space settings"
                            aria-expanded={settingsMenu?.roomId === room.id}
                            aria-haspopup="menu"
                          >
                            <MoreIcon />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={openJoin}
                    className="rail-item rail-child rail-child-add"
                    aria-label="Join space"
                  >
                    <SpaceTile id="join" name="Join space" add />
                    <span className="rail-label">Join space</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="rail-body rail-nav">
              {roomList.map((room) => {
                const active = room.id === currentRoomId;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => openRoom(room.id)}
                    className={`rail-item ${active ? "is-active" : ""}`}
                    aria-label={room.name}
                    aria-current={active ? "page" : undefined}
                    {...tipProps(room.name)}
                  >
                    <SpaceTile id={room.id} name={room.name} avatar={room.avatar} />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={openJoin}
                className="rail-item rail-child rail-child-add"
                aria-label="Join space"
                {...tipProps("Join space")}
              >
                <SpaceTile id="join" name="Join space" add />
              </button>
            </div>
          )}
        </div>

        {settingsMenu && (() => {
          const room = rooms.find((r) => r.id === settingsMenu.roomId);
          if (!room) return null;
          return (
            <div
              data-room-settings-menu
              role="menu"
              className="fixed w-44 rail-card z-50 rounded-md border border-line shadow-md overflow-hidden p-1"
              style={{ top: settingsMenu.top, left: settingsMenu.left }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSettingsMenu(null);
                  setRenameRoomId(room.id);
                  setRenameInput(room.name);
                }}
                className="rail-item rail-item-strong"
              >
                <MdEdit className="w-5 h-5 text-fg-muted" />
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSettingsMenu(null);
                  setDeleteError("");
                  setDeleteRoomId(room.id);
                }}
                className="rail-item rail-item-strong text-danger hover:bg-danger-soft"
              >
                <MdDelete className="w-5 h-5" />
                Delete
              </button>
            </div>
          );
        })()}

        <div className="rail-footer">
          <div className="rail-body">
            <button
              type="button"
              onClick={() => {
                setTip(null);
                setSettingsOpen(true);
              }}
              className="rail-item"
              aria-label="Settings"
              {...tipProps("Settings")}
            >
              <Settings className="rail-icon" />
              {expanded && <span className="rail-label">Settings</span>}
            </button>
          </div>
        </div>

        {tip && !expanded && (
          <div className="rail-tooltip" style={{ top: tip.top, left: tip.left }} role="tooltip">
            {tip.label}
          </div>
        )}
      </div>
    </aside>}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

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
      <Modal
        open={!!deleteRoomId}
        onClose={() => {
          if (deleting) return;
          setDeleteRoomId(null);
          setDeleteError("");
        }}
        title="Delete room"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setDeleteRoomId(null);
                setDeleteError("");
              }}
              disabled={deleting}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button onClick={deleteRoom} disabled={deleting} className="btn btn-danger btn-sm">
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </>
        }
      >
        <p className="text-small text-fg-muted">
          This permanently deletes{" "}
          <span className="text-fg font-medium">{deleteTarget?.name || "this room"}</span> and all of
          its widgets. This cannot be undone.
        </p>
        {deleteError && <p className="alert-danger mt-3">{deleteError}</p>}
      </Modal>
    </>
  );
}
