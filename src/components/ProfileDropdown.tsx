"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useSession, useSessionList, useUser } from "@clerk/nextjs";
import { ChevronDown, LogIn, LogOut, Plus, User, Camera } from "lucide-react";

interface ProfileDropdownProps {
  afterSignOutUrl?: string;
  onJoinRoom?: () => void;
}

export function ProfileDropdown({ afterSignOutUrl = "/sign-in", onJoinRoom }: ProfileDropdownProps) {
  const { user, isLoaded } = useUser();
  const { sessions, setActive } = useSessionList();
  const { session } = useSession();
  const clerk = useClerk();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!isLoaded || !user) return null;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await user.setProfileImage({ file });
      await user.reload();
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setPhotoUrl(dataUrl);
        await fetch("/api/users/avatar", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar: dataUrl }),
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoChange}
      />
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-icon-sm gap-2"
      >
        <span className="text-small text-fg truncate max-w-[120px]">
          {user.fullName || user.emailAddresses[0]?.emailAddress || "User"}
        </span>
        {user.imageUrl ? (
          <img src={user.imageUrl} alt="Profile" className="w-6 h-6 rounded-full" />
        ) : (
          <User className="w-4 h-4 text-fg-muted" />
        )}
        <ChevronDown className="w-3 h-3 text-fg-muted" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 menu z-50">
          <div className="px-4 py-3 border-b border-line">
            <div className="flex items-center gap-3">
              {photoUrl || user.imageUrl ? (
                <img src={(photoUrl || user.imageUrl) as string} alt="Profile" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-fg-muted">
                  <User className="w-4 h-4" />
                </div>
              )}
              <div>
                <p className="text-body font-medium text-fg truncate">{user.fullName || user.emailAddresses[0]?.emailAddress || "User"}</p>
                <p className="text-small text-fg-muted truncate">{user.emailAddresses[0]?.emailAddress || ""}</p>
              </div>
            </div>
          </div>
          <div className="py-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                fileInputRef.current?.click();
              }}
              className="menu-item"
            >
              <Camera className="w-4 h-4 text-fg-muted" />
              Change photo
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                router.push("/sign-in");
              }}
              className="menu-item"
            >
              <Plus className="w-4 h-4 text-fg-muted" />
              Add account
            </button>
            {onJoinRoom && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onJoinRoom();
                }}
                className="menu-item"
              >
                <LogIn className="w-4 h-4 text-fg-muted" />
                Join room
              </button>
            )}
            <div className="px-4 py-1 text-caption font-medium text-fg-muted uppercase tracking-wide">Switch account</div>
            {(sessions || []).map((sess) => (
                  <button
                    key={sess.id}
                    onClick={async () => {
                      setIsOpen(false);
                      if (setActive && sess.id !== session?.id) {
                        await setActive({ session: sess.id });
                        router.refresh();
                      }
                    }}
                    className={`menu-item ${sess.id === session?.id ? "bg-accent-soft text-accent" : ""}`}
                  >
                    {sess.id === session?.id ? (
                      <span className="flex items-center gap-2 w-full">
                        <span className="truncate">{sess.user?.fullName || sess.user?.emailAddresses?.[0]?.emailAddress || "Account"}</span>
                        <span className="ml-auto text-caption text-accent">Active</span>
                      </span>
                    ) : (
                      <span className="truncate">{sess.user?.fullName || sess.user?.emailAddresses?.[0]?.emailAddress || "Account"}</span>
                    )}
                  </button>
                ))}
            <hr className="my-1 border-line" />
            <button
              onClick={() => {
                setIsOpen(false);
                clerk.signOut().then(() => {
                  router.push(afterSignOutUrl);
                });
              }}
              className="menu-item menu-item-danger"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
