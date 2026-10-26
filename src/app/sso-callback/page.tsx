"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SsoCallbackPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas gap-3">
      <div className="spinner" />
      <p className="text-small text-fg-muted">Completing sign-in…</p>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
