"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";

/** Cubics' desktop shell must drop browser grants as soon as Clerk switches
 * identities or signs out. A stale old-account notice cannot revoke a freshly
 * authenticated next account; Electron verifies the previous owner itself.
 */
export default function DesktopBrowserAccountBoundary() {
  const { user, isLoaded } = useUser();
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;
    const nextUserId = user?.id ?? null;
    const previousUserId = previous.current;
    previous.current = nextUserId;
    if (!previousUserId || previousUserId === nextUserId ||
        !window.cubics?.isElectron) return;
    void window.cubics.notifyBrowserAuthChange(previousUserId, nextUserId).catch(() => {
      // A revoked server session also fails closed at the main-process
      // browser partition issuance boundary.
    });
  }, [isLoaded, user?.id]);

  return null;
}
