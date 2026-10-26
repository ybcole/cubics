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
      platform: string;
      electronVersion: string;
      onOpenUrl: (callback: (url: string) => void) => () => void;
      getScreenshotSources: () => Promise<
        Array<{ id: string; name: string; thumbnail: string }>
      >;
    };
  }
}

export {};
