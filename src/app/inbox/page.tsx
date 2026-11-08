"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Inbox } from "lucide-react";
import { SpaceRail } from "@/components/SpaceRail";

export default function InboxPage() {
  const { isLoaded, user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !user) router.replace("/sign-in");
  }, [isLoaded, user, router]);

  if (!isLoaded) return null;

  return (
    <div className="h-screen flex overflow-hidden">
      <SpaceRail currentRoomId="" isHome={false} />
      <main className="flex-1 min-w-0 bg-surface p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Inbox className="w-5 h-5 text-fg-muted" aria-hidden="true" />
            <h1 className="text-h1 text-fg-strong">Inbox</h1>
          </div>
          <div className="card flex flex-col items-center justify-center text-center py-16 px-6">
            <h2 className="text-h2 text-fg-strong mb-2">Inbox is coming soon</h2>
            <p className="text-small text-fg-muted max-w-md">
              This space is reserved for updates and invitations. It is not available yet.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
