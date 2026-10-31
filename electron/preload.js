const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cubics", {
  isElectron: true,
  platform: process.platform,
  electronVersion: process.versions.electron,
  onOpenUrl: (callback) => {
    const listener = (_event, url) => callback(url);
    ipcRenderer.on("cubics:open-url", listener);
    return () => ipcRenderer.removeListener("cubics:open-url", listener);
  },
  getTabMediaSourceId: (webContentsId) => ipcRenderer.invoke("cubics:tab-media-source-id", webContentsId),
  getScreenshotSources: () => ipcRenderer.invoke("cubics:get-screenshots-sources"),
});
