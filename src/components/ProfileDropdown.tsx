"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useSession, useSessionList, useUser } from "@clerk/nextjs";
import { ChevronDown, LogIn, LogOut, Plus, User } from "lucide-react";

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
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-ghost p-1 text-zinc-500 hover:text-zinc-900 hover:bg-surface transition-colors"
      >
        {user.imageUrl ? (
          <img src={user.imageUrl} alt="Profile" className="w-6 h-6 rounded-full border border-surface" />
        ) : (
          <User className="w-4 h-4 text-zinc-500" />
        )}
        <ChevronDown className="w-3 h-3 text-zinc-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 card shadow-md z-50">
          <div className="px-4 py-3 border-b border-surface">
            <div className="flex items-center gap-3">
              {user.imageUrl ? (
                <img src={user.imageUrl} alt="Profile" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-zinc-500">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-zinc-900 truncate">{user.fullName || user.emailAddresses[0]?.emailAddress || "User"}</p>
                <p className="text-xs text-zinc-500 truncate">{user.emailAddresses[0]?.emailAddress || ""}</p>
              </div>
            </div>
          </div>
          <div className="py-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                router.push("/sign-in");
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-surface transition-colors"
            >
              <Plus className="w-4 h-4 text-accent-teal" />
              Add account
            </button>
            {onJoinRoom && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onJoinRoom();
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-surface transition-colors"
              >
                <LogIn className="w-4 h-4 text-accent-teal" />
                Join room
              </button>
            )}
            <div className="px-4 py-1 text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Switch account</div>
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
                    className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
                      sess.id === session?.id ? "bg-surface text-accent-teal" : "text-zinc-500 hover:bg-surface hover:text-zinc-900"
                    }`}
                  >
                    {sess.id === session?.id ? (
                      <span className="flex items-center gap-2 w-full">
                        <span className="truncate">{sess.user?.fullName || sess.user?.emailAddresses?.[0]?.emailAddress || "Account"}</span>
                        <span className="ml-auto text-[10px] font-medium text-accent-teal">Active</span>
                      </span>
                    ) : (
                      <span className="truncate">{sess.user?.fullName || sess.user?.emailAddresses?.[0]?.emailAddress || "Account"}</span>
                    )}
                  </button>
                ))}
            <hr className="my-1 border-surface" />
            <button
              onClick={() => {
                setIsOpen(false);
                clerk.signOut().then(() => {
                  router.push(afterSignOutUrl);
                });
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <span>Sign out</span>
              <LogOut className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
