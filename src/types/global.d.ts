import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        allowpopups?: boolean | "true" | "false";
        partition?: string;
        useragent?: string;
      };
    }
  }
}

declare global {
  interface Window {
    cubics?: {
      isElectron: boolean;
      bridgeVersion: 1;
      platform: string;
      electronVersion: string;
      onOpenUrl: (callback: (url: string) => void) => () => void;
      notifyBrowserAuthChange: (previousUserId: string, nextUserId: string | null) => Promise<{ revoked: boolean }>;
      onBrowserAccountRevoked: (callback: (detail: { userId: string }) => void) => () => void;
      getBrowserPartition: (kind: "personal" | "tab" | "shared", widgetId: string | null, expectedUserId: string) => Promise<string>;
      getBrowserProfileInfo: (kind: "personal" | "tab" | "shared", widgetId: string | null, expectedUserId: string) => Promise<{
        schemaVersion: 1; profileId: string; kind: "personal" | "tab" | "shared";
        persistence: "temporary" | "persistent"; deviceLocal: true; containsBrowsingData: false;
      }>;
      exportBrowserProfileInfo: (kind: "personal" | "tab" | "shared", widgetId: string | null, expectedUserId: string) => Promise<{ exported: boolean }>;
      clearBrowserData: (kind: "personal" | "tab" | "shared", widgetId: string | null, expectedUserId: string) => Promise<{ cleared: boolean }>;
      onBrowserDataCleared: (callback: (detail: { kind: "personal" | "tab" | "shared"; userId: string; widgetId: string | null }) => void) => () => void;
      getTabMediaSourceId: (webContentsId: number) => Promise<string>;
      getScreenshotSources: () => Promise<
        Array<{ id: string; name: string; thumbnail: string }>
      >;
    };
  }
}

export {};
