"use strict";
const { contextBridge, ipcRenderer } = require("electron");

// M04 v1: explicit methods only. Never expose ipcRenderer, channel names,
// fs, process or a generic native command dispatcher to remote web content.
const bridge = Object.freeze({
  bridgeVersion: 1,
  isElectron: true,
  platform: process.platform,
  electronVersion: process.versions.electron,
  onOpenUrl(callback) {
    if (typeof callback !== "function") throw new TypeError("Callback required");
    const listener = (_event, url) => {
      if (typeof url === "string" && url.length <= 2048 && /^https:\/\//i.test(url)) callback(url);
    };
    ipcRenderer.on("cubics:open-url", listener);
    return () => ipcRenderer.removeListener("cubics:open-url", listener);
  },
  getTabMediaSourceId(webContentsId) {
    if (!Number.isSafeInteger(webContentsId) || webContentsId <= 0) {
      return Promise.reject(new TypeError("Invalid browser view ID"));
    }
    return ipcRenderer.invoke("cubics:tab-media-source-id", webContentsId);
  },
  getScreenshotSources() {
    return ipcRenderer.invoke("cubics:get-screenshots-sources");
  },
});
contextBridge.exposeInMainWorld("cubics", bridge);
