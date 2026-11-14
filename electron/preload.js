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
  // A renderer can request a scope, but the main process obtains the
  // authoritative account identity from the authenticated hosted API.
  getBrowserPartition(kind, widgetId, expectedUserId) {
    if (kind !== "personal" && kind !== "tab" && kind !== "shared") {
      return Promise.reject(new TypeError("Invalid browser partition mode"));
    }
    if (typeof expectedUserId !== "string" || expectedUserId.length > 128) {
      return Promise.reject(new TypeError("Invalid browser account"));
    }
    if ((kind === "tab" || kind === "shared") && (typeof widgetId !== "string" || widgetId.length > 80)) {
      return Promise.reject(new TypeError("Invalid browser widget"));
    }
    return ipcRenderer.invoke("cubics:get-browser-partition", kind, widgetId, expectedUserId);
  },
  clearBrowserData(kind, widgetId, expectedUserId) {
    if (!["personal", "tab", "shared"].includes(kind) ||
        typeof expectedUserId !== "string" || expectedUserId.length > 128 ||
        (kind !== "personal" && (typeof widgetId !== "string" || widgetId.length > 80))) {
      return Promise.reject(new TypeError("Invalid browser profile"));
    }
    return ipcRenderer.invoke("cubics:clear-browser-data", kind, widgetId, expectedUserId);
  },
  onBrowserDataCleared(callback) {
    if (typeof callback !== "function") throw new TypeError("Callback required");
    const listener = (_event, detail) => {
      if (detail && ["personal", "tab", "shared"].includes(detail.kind) &&
          typeof detail.userId === "string" &&
          (detail.widgetId === null || typeof detail.widgetId === "string")) callback(detail);
    };
    ipcRenderer.on("cubics:browser-data-cleared", listener);
    return () => ipcRenderer.removeListener("cubics:browser-data-cleared", listener);
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
