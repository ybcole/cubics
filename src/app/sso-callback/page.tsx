"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SsoCallbackPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-3">
      <div className="w-8 h-8 border-2 border-surface border-t-zinc-900 rounded-full animate-spin" />
      <p className="text-xs text-zinc-500">Completing sign-in…</p>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
