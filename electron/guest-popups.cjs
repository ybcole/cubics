"use strict";

const { safeGuestUrl } = require("./security-policy.cjs");

// Disposition describes presentation, not whether a request is OAuth.
function isLoginPopup({ url, disposition }, development = false) {
  if (!safeGuestUrl(url, development)) return false;
  if (url === "about:blank") return true;
  if (disposition === "new-window" || disposition === "default") return true;
  const target = new URL(url);
  return target.hostname === "accounts.google.com" ||
    /(?:^|\/)(?:auth|oauth2?|sso|login|signin|sign-in|authorize|callback)(?:\/|$)/i.test(target.pathname);
}

/** Native window.open implementation: never replay an OAuth URL with loadURL.
 * Electron supplies the opener, referrer and POST body to createWindow.
 * No URL, credential, cookie or OAuth state is sent to the workspace/cloud.
 */
function createGuestPopupManager({ BrowserWindow, development = false, parentWindow,
  isAllowedRoot, openCanvasTab, maxWindows = 6, maxDepth = 3 }) {
  const roots = new Map();

  function install(root) {
    if (roots.has(root)) return;
    const windows = new Set();
    const state = { windows, active: true };
    roots.set(root, state);
    const allowed = () => state.active && !root.isDestroyed() && isAllowedRoot(root);

    function bind(contents, depth) {
      const guard = (event, url) => {
        if (!allowed() || !safeGuestUrl(url, development)) event.preventDefault();
      };
      contents.on("will-navigate", guard);
      contents.on("will-redirect", guard);
      contents.setWindowOpenHandler(details => {
        if (!allowed() || !safeGuestUrl(details.url, development)) return { action: "deny" };
        if (!isLoginPopup(details, development)) {
          if (depth === 0) openCanvasTab(root, details.url);
          return { action: "deny" };
        }
        if (depth >= maxDepth || windows.size >= maxWindows) return { action: "deny" };
        return {
          action: "allow",
          outlivesOpener: false,
          // Using createWindow also supports guests whose webview tag has no
          // allowpopups attribute. Native Chromium retains the WindowProxy.
          createWindow(options) {
            if (!allowed() || contents.isDestroyed() || windows.size >= maxWindows)
              throw new Error("Cubics login window owner is no longer available");
            const preferences = { ...options.webPreferences };
            delete preferences.preload;
            delete preferences.partition;
            const child = new BrowserWindow({
              ...options,
              parent: parentWindow(),
              width: 520, height: 720, minWidth: 360, minHeight: 480,
              show: true, frame: true, autoHideMenuBar: true,
              webPreferences: {
                ...preferences, session: root.session,
                sandbox: true, nodeIntegration: false,
                nodeIntegrationInSubFrames: false, nodeIntegrationInWorker: false,
                contextIsolation: true, webviewTag: false,
                webSecurity: true, allowRunningInsecureContent: false,
              },
            });
            windows.add(child);
            child.once("closed", () => windows.delete(child));
            const closeChild = () => { if (!child.isDestroyed()) child.destroy(); };
            contents.once("destroyed", closeChild);
            child.once("closed", () => contents.removeListener("destroyed", closeChild));
            bind(child.webContents, depth + 1);
            return child.webContents;
          },
        };
      });
    }

    bind(root, 0);
    root.once("destroyed", () => closeRoot(root));
  }

  function closeRoot(root) {
    const state = roots.get(root);
    if (!state) return;
    state.active = false;
    roots.delete(root);
    for (const child of [...state.windows]) {
      if (!child.isDestroyed()) child.destroy();
    }
    state.windows.clear();
  }

  function closeAll() { for (const root of [...roots.keys()]) closeRoot(root); }
  return { install, closeAll };
}

module.exports = { isLoginPopup, createGuestPopupManager };
