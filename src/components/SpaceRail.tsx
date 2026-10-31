"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { MdDelete, MdEdit } from "react-icons/md";
import type { Space } from "@/types";
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Modal } from "@/components/ui/Modal";
import {
  ChevronDownIcon,
  HomeIcon,
  JoinIcon,
  MoreIcon,
  PanelToggleIcon,
  PlusCircleIcon,
  SpaceTile,
} from "@/components/RailIcons";

interface SpaceRailProps {
  currentRoomId: string;
  isHome: boolean;
}

let cachedRooms: Space[] = [];

export function SpaceRail({ currentRoomId, isHome }: SpaceRailProps) {
  const router = useRouter();
  const { user } = useUser();
  const [rooms, setRooms] = useState<Space[]>(() => cachedRooms);
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
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
    const menuWidth = 160;
    const menuHeight = 90;
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
    <aside className={`rail-shell ${expanded ? "" : "is-collapsed"}`}>
      <div ref={cardRef} className={`rail-card ${expanded ? "" : "is-collapsed"}`}>
        <div className="rail-header">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rail-brand"
            aria-label={expanded ? "Cubics" : "Expand sidebar"}
            tabIndex={expanded ? -1 : 0}
          >
            {expanded && <span className="rail-wordmark" style={{ marginLeft: "auto", marginRight: "8px" }}>cubics</span>}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rail-toggle"
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={expanded}
          >
            <PanelToggleIcon />
          </button>
        </div>

        {!expanded && <div className="rail-divider" />}

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
            onClick={openJoin}
            className="rail-item"
            aria-label="Join space"
            {...tipProps("Join space")}
          >
            <JoinIcon className="rail-icon" />
            {expanded && <span className="rail-label">Join space</span>}
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
                          >
                            <MoreIcon />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="rail-item rail-child rail-child-add"
                    aria-label="Add new space"
                  >
                    <SpaceTile id="add" name="Add new" add />
                    <span className="rail-label">Add new</span>
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
            </div>
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
                <MdEdit className="w-5 h-5 text-fg-muted" />
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsMenu(null);
                  setDeleteError("");
                  setDeleteRoomId(room.id);
                }}
                className="menu-item menu-item-danger"
              >
                <MdDelete className="w-5 h-5" />
                Delete
              </button>
            </div>
          );
        })()}

        <div className="rail-footer">
          <div className="rail-body">
            <ProfileDropdown afterSignOutUrl="/sign-in" sidebar compact={!expanded} />
          </div>
        </div>

        {tip && !expanded && (
          <div className="rail-tooltip" style={{ top: tip.top, left: tip.left }} role="tooltip">
            {tip.label}
          </div>
        )}
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
    </aside>
  );
}
