"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InboxPage() {
  const { isLoaded, user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !user) router.replace("/sign-in");
  }, [isLoaded, user, router]);

  if (!isLoaded) return null;

  return (
    <div className="auth-screen min-h-screen flex items-center justify-center px-4">
      <div className="card auth-panel w-full max-w-md p-8 text-center"><h1 className="text-h1 text-fg mb-2">Inbox</h1><p className="text-small text-fg-muted">Inbox coming soon.</p></div>
    </div>
  );
}
