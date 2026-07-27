"use client";

import { Puzzle, ExternalLink } from "lucide-react";

const CWS_URL = "https://chromewebstore.google.com/detail/gleekbfjekiniecknbkamfmkohkpodhe?utm_source=item-share-cb";

export default function ExtensionBanner() {
  return (
    <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
      <div className="flex items-center gap-2.5">
        <Puzzle className="w-4 h-4 text-indigo-600 shrink-0" />
        <p className="text-sm text-indigo-900">
          Install <span className="font-medium">Ignore X-Frame headers</span> to embed any website as a widget.
        </p>
      </div>
      <a
        href={CWS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors shrink-0"
      >
        <ExternalLink className="w-3 h-3" />
        Install
      </a>
    </div>
  );
}
