"use client";

import { useEffect, useState } from "react";

// A browser partition is a capability issued by Electron AFTER Clerk identity
// is verified through /v1/identity. Never construct account partition names
// from untrusted UI props. Keep the last capability scoped to its exact user
// and widget so an account switch cannot render the previous user's guest.
export function useGuestPartition(
  kind: "personal" | "tab",
  userId: string | null | undefined,
  widgetId: string
): string | null {
  const [grant, setGrant] = useState<{
    userId: string; kind: string; widgetId: string; partition: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGrant(null);
    if (!userId || !window.cubics?.isElectron) return;
    window.cubics.getBrowserPartition(kind, kind === "tab" ? widgetId : null, userId)
      .then(partition => {
        if (!cancelled) setGrant({ userId, kind, widgetId, partition });
      })
      .catch(() => { if (!cancelled) setGrant(null); });
    return () => { cancelled = true; };
  }, [kind, userId, widgetId]);

  return grant?.userId === userId && grant.kind === kind &&
    grant.widgetId === widgetId ? grant.partition : null;
}
