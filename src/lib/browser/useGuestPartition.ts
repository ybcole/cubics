"use client";

import { useEffect, useState } from "react";

export type BrowserPartitionKind = "personal" | "tab" | "shared";

/** The partition name is a local capability, never a cloud widget field.
 * A profile is scoped to this Electron device's userData path and Clerk ID.
 * Shared profiles are temporary and separate from Personal/Live cookies.
 */
export function useGuestPartition(
  kind: BrowserPartitionKind,
  userId: string | null | undefined,
  widgetId: string
): { partition: string | null; generation: number } {
  const [grant, setGrant] = useState<{
    userId: string; kind: BrowserPartitionKind; widgetId: string; partition: string;
  } | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!window.cubics?.isElectron) return;
    return window.cubics.onBrowserAccountRevoked(detail => {
      if (detail.userId === userId) setGrant(null);
    });
  }, [userId]);

  useEffect(() => {
    if (!window.cubics?.isElectron) return;
    return window.cubics.onBrowserDataCleared(detail => {
      if (detail.userId !== userId || detail.kind !== kind) return;
      if (kind !== "personal" && detail.widgetId !== widgetId) return;
      // Unmount a webview whose main-process owner was destroyed before
      // accepting a replacement grant, even when the partition name matches.
      setGrant(null);
      setGeneration(value => value + 1);
    });
  }, [kind, userId, widgetId]);

  useEffect(() => {
    let cancelled = false;
    setGrant(null);
    if (!userId || !window.cubics?.isElectron) return;
    window.cubics.getBrowserPartition(kind, kind === "personal" ? null : widgetId, userId)
      .then(partition => {
        if (!cancelled) setGrant({ userId, kind, widgetId, partition });
      })
      .catch(() => { if (!cancelled) setGrant(null); });
    return () => { cancelled = true; };
  }, [kind, userId, widgetId, generation]);

  return {
    partition: grant && grant.userId === userId && grant.kind === kind &&
      grant.widgetId === widgetId ? grant.partition : null,
    generation,
  };
}
