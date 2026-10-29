"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function HomeRedirectPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace("/sign-in");
      return;
    }

    let cancelled = false;

    const openHome = async () => {
      try {
        const res = await fetch("/api/rooms");
        const rooms = res.ok ? await res.json() : [];
        const home = Array.isArray(rooms)
          ? rooms.find((room: { name?: string; ownerId?: string }) => room.name === "Home" && room.ownerId === user.id)
          : null;

        if (cancelled) return;
        if (home?.id) {
          router.replace(`/rooms/${home.id}`);
          return;
        }

        const created = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Home", description: "Home canvas" }),
        });

        if (cancelled) return;
        if (!created.ok) {
          setError("Could not create your Home room.");
          return;
        }

        const room = await created.json();
        if (!cancelled && room?.id) {
          router.replace(`/rooms/${room.id}`);
        }
      } catch {
        if (!cancelled) setError("Could not open Home.");
      }
    };

    openHome();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, router, user]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6">
      {error ? (
        <>
          <p className="text-small text-fg-muted text-center">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="btn btn-primary btn-sm">
            Retry
          </button>
        </>
      ) : (
        <div className="spinner" />
      )}
    </div>
  );
}
