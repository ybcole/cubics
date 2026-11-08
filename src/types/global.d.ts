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
      getBrowserPartition: (kind: "personal" | "tab", widgetId: string | null, expectedUserId: string) => Promise<string>;
      getTabMediaSourceId: (webContentsId: number) => Promise<string>;
      getScreenshotSources: () => Promise<
        Array<{ id: string; name: string; thumbnail: string }>
      >;
    };
  }
}

export {};
