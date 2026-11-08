const { app, BrowserWindow, session, desktopCapturer, shell, ipcMain, webContents } = require("electron");
const path = require("path");
const http = require("http");
const { normalizedAppOrigin, isAppUrl, isAuthUrl, isExternalBrowserUrl } = require("./app-origin.cjs");

app.setName("Cubics");

// Testing helper: launching with CUBICS_PROFILE=<name> uses an isolated
// profile (its own login/session/cookies) so a second instance can run at
// the same time against the same dev server + socket server.
//   CUBICS_PROFILE=b npx electron .
if (process.env.CUBICS_PROFILE) {
  app.setPath(
    "userData",
    path.join(app.getPath("appData"), `Cubics-${process.env.CUBICS_PROFILE}`)
  );
}

let mainWindow = null;
let appOrigin = null;

const isDev = !app.isPackaged;
if (isDev) {
  // In local development only, the legacy standalone Next server receives
  // credentials from the developer's environment. Never do this in packaged
  // distributions: M02 moves privileged APIs to the hosted backend.
  try { require("@next/env").loadEnvConfig(process.cwd()); }
  catch (error) { console.warn("[cubics] Dev environment unavailable:", error.message); }
}

function getAppOrigin() {
  if (isDev) return normalizedAppOrigin(process.env.CUBICS_SERVER_URL || "http://localhost:3000");
  // Pinned into the installer at build time: no user environment override.
  const config = require("./release-config.json");
  if (config.schemaVersion !== 1) throw new Error("Unsupported Cubics release configuration");
  return normalizedAppOrigin(config.appOrigin, { packaged: true });
}

function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, () => resolve());
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for server at ${url}`));
        } else {
          setTimeout(tryOnce, 300);
        }
      });
    };
    tryOnce();
  });
}

function isAppOrigin(url) { return isAppUrl(url, appOrigin); }
function isAuthTarget(url) { return isAuthUrl(url); }

function setupSession(targetSession) {
  const ses = targetSession || session.defaultSession;

  // Strip frame-blocking headers for all external origins. This replaces the
  // Cubics Companion extension's declarativeNetRequest rules.
  ses.webRequest.onHeadersReceived((details, callback) => {
    if (isAppOrigin(details.url)) {
      callback({});
      return;
    }
    // Keep auth providers' headers intact so OAuth/login flows work.
    if (isAuthTarget(details.url)) {
      callback({});
      return;
    }
    const headers = details.responseHeaders || {};
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase();
      if (
        lower === "x-frame-options" ||
        lower === "content-security-policy" ||
        lower === "cross-origin-opener-policy" ||
        lower === "cross-origin-embedder-policy"
      ) {
        delete headers[key];
      }
    }
    callback({ responseHeaders: headers });
  });

  // Present a plain Chromium UA — some sites misbehave with the Electron token.
  const ua = ses.getUserAgent().replace(/ Electron\/[\d.]+/g, "");
  ses.setUserAgent(ua);

  const ALLOWED = new Set([
    "media",
    "display-capture",
    "fullscreen",
    "pointerLock",
    "notifications",
    "clipboard-sanitized-write",
  ]);
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED.has(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED.has(permission));

  // Native screen/window capture for Live Tab widgets — intercepts
  // navigator.mediaDevices.getDisplayMedia inside the app and webviews.
  ses.setDisplayMediaRequestHandler(async (_options, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ["screen", "window"] });
      const preferred =
        sources.find((s) => s.display_id !== "") || sources[0];
      if (!preferred) {
        callback({});
        return;
      }
      try {
        callback({ video: preferred, audio: "loopback" });
      } catch {
        callback({ video: preferred });
      }
    } catch (err) {
      console.error("[cubics] display media error", err);
      callback({});
    }
  }, { useSystemPicker: false });
}

app.on("session-created", (ses) => {
  if (ses !== session.defaultSession) setupSession(ses);
});

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: "Cubics",
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  // Clerk auth flows (OAuth popups / handshakes) must stay inside Electron so
  // the session cookie lands in the app. Popups starting at the app origin are
  // allowed as child windows; any other external link still opens in the
  // system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isAppOrigin(target) || isAuthTarget(target)) return { action: "allow" };
    if (isExternalBrowserUrl(target)) shell.openExternal(target);
    return { action: "deny" };
  });

  // Allow top-level navigation for the app origin and known auth providers
  // (Clerk handshake + OAuth round-trip); keep anything else from taking over
  // the app window.
  mainWindow.webContents.on("will-navigate", (e, target) => {
    if (isAppOrigin(target) || isAuthTarget(target)) return;
    e.preventDefault();
    if (isExternalBrowserUrl(target)) shell.openExternal(target);
  });

  mainWindow.loadURL(url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Links opened via window.open/target=_blank inside widget webviews are
// forwarded to the renderer so it can spawn a new canvas widget (this
// replaces the extension content script's OPEN_URL postMessage).
app.on("web-contents-created", (_event, contents) => {
  if (contents.getType() === "webview") {
    contents.setWindowOpenHandler(({ url }) => {
      if (isAuthTarget(url)) return { action: "allow" };
      const host = contents.hostWebContents;
      if (host && isExternalBrowserUrl(url)) {
        host.send("cubics:open-url", url);
      }
      return { action: "deny" };
    });
  }
});

ipcMain.handle("cubics:get-screenshots-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    fetchWindowIcons: true,
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
  }));
});

// Tab capture id for a <webview> guest, used by the live-tab host to feed the SFU.
// Only the window that actually hosts the guest may ask for it.
ipcMain.handle("cubics:tab-media-source-id", (event, webContentsId) => {
  const guest = webContents.fromId(Number(webContentsId));
  if (!guest || guest.hostWebContents !== event.sender) {
    throw new Error("Not a webview of the calling window");
  }
  return guest.getMediaSourceId(event.sender);
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      appOrigin = getAppOrigin();
      setupSession();
      // Development uses a local Next server. Distribution uses a remote
      // HTTPS site and never starts a privileged local server.
      if (isDev) await waitForServer(appOrigin);
      createWindow(appOrigin);
    } catch (error) {
      console.error("[cubics] Secure startup failed:", error.message);
      app.quit();
      return;
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0 && appOrigin) createWindow(appOrigin);
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

}
