"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SsoCallbackPage() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 15000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas gap-3">
      <div className="spinner" />
      <p className="text-small text-fg-muted">
        {slow ? "Still completing sign-in…" : "Completing sign-in…"}
      </p>
      {slow ? (
        <p className="text-small text-fg-muted text-center max-w-sm">
          If this doesn&apos;t finish, go back and try again.{" "}
          <Link href="/sign-in" className="text-accent-ink font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      ) : null}
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
