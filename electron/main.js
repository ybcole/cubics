const { app, BrowserWindow, session, desktopCapturer, shell, dialog, ipcMain, webContents } = require("electron");
const path = require("path");
const http = require("http");
const { normalizedAppOrigin, isAppUrl, isAuthUrl } = require("./app-origin.cjs");
const { safeExternalUrl, safeGuestUrl, isAllowedGuestPartition,
  isTrustedRenderer, nativePermissionAllowedRequest, safeWindowTarget,
  checkGuestAttach, partitionForVerifiedAccount } = require("./security-policy.cjs");

app.setName("Cubics");
// All main-window and guest renderers are sandboxed; never disable this for external content.
app.enableSandbox();

// Testing helper: launching with CUBICS_PROFILE=<name> uses an isolated
// profile (its own login/session/cookies) so a second instance can run at
// the same time against the same dev server + socket server.
//   CUBICS_PROFILE=b npx electron .
if (process.env.CUBICS_PROFILE) {
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(process.env.CUBICS_PROFILE)) {
    throw new Error("CUBICS_PROFILE must be a short, safe identifier");
  }
  app.setPath(
    "userData",
    path.join(app.getPath("appData"), `Cubics-${process.env.CUBICS_PROFILE}`)
  );
}

let mainWindow = null;
let appOrigin = null;
const approvedGuestIds = new Set();
const issuedGuestPartitions = new Set();
let verifiedAccountId = null;
// Serialize identity checks so slow requests cannot revive a previous account.
let browserIdentityQueue = Promise.resolve();

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

const configuredSessions = new WeakSet();
const permissions = new Map();
const PERMISSION_TTL = 5 * 60 * 1000;

// Electron Session has no public getPartition() accessor. Compare guest
// sessions against the actual Session objects for main-issued partitions.
function isIssuedGuestSession(contents) {
  return !!contents?.session && [...issuedGuestPartitions].some(
    partition => session.fromPartition(partition) === contents.session
  );
}


// Destroy any old account's live guests before allowing a different account.
// Do not delete their Chromium partitions: saved sign-ins must survive switches.
function revokeBrowserAccount() {
  for (const id of approvedGuestIds) {
    const guest = webContents.fromId(id);
    if (guest && !guest.isDestroyed()) guest.destroy();
  }
  approvedGuestIds.clear();
  issuedGuestPartitions.clear();
  verifiedAccountId = null;
  permissions.clear();
}

// Called from a trusted top-level renderer, but the renderer is NOT trusted
// to assert a userId or choose its own persistent browser partition.
async function verifyBrowserAccount(expectedUserId) {
  if (typeof expectedUserId !== "string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(expectedUserId)) {
    throw new Error("Browser account is not signed in");
  }
  let identity;
  try {
    const response = await session.defaultSession.fetch(new URL("/v1/identity", appOrigin).href, {
      method: "GET", credentials: "include", redirect: "error", cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Authentication failed");
    if (Number(response.headers.get("content-length") || "0") > 4096) throw new Error("Invalid identity response");
    identity = await response.json();
    if (!identity || typeof identity.userId !== "string" ||
        !/^[a-zA-Z0-9_-]{3,128}$/.test(identity.userId) || identity.protocolVersion !== 1) {
      throw new Error("Invalid verified identity");
    }
  } catch {
    revokeBrowserAccount();
    throw new Error("Browser session identity could not be verified");
  }
  // An auth change invalidates old webContents and all outstanding grants.
  if (verifiedAccountId && verifiedAccountId !== identity.userId) revokeBrowserAccount();
  verifiedAccountId = identity.userId;
  if (identity.userId !== expectedUserId) {
    throw new Error("Browser account does not match the authenticated session");
  }
  return identity.userId;
}


function permissionKey(contents, permission) {
  return contents.id + ":" + permission;
}
function revokeFor(contents) {
  for (const key of permissions.keys()) {
    if (key.startsWith(contents.id + ":")) permissions.delete(key);
  }
}
async function confirmNative(message, detail) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Deny", "Allow"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    title: "Cubics permission",
    message,
    detail: detail || "This request will only be allowed for the current app session.",
  });
  return response === 1;
}
async function openExternalWithConsent(target) {
  const url = safeExternalUrl(target, { development: isDev });
  if (!url) return false;
  if (!await confirmNative("Open link in your browser?", url.slice(0, 300))) return false;
  await shell.openExternal(url);
  return true;
}
function canUseNative(contents, requestingUrl, permission) {
  return nativePermissionAllowedRequest({
    sender: contents, requestingUrl, window: mainWindow, origin: appOrigin, permission,
  });
}

function setupSession(ses = session.defaultSession) {
  if (configuredSessions.has(ses)) return;
  configuredSessions.add(ses);
  // Never modify remote frame-blocking headers, CSP or cross-origin policies.
  // Chromium sites control their own framing; later native WebContentsView
  // replaces disallowed embedded frames (M07).
  const ua = ses.getUserAgent().replace(/ Electron\/[\d.]+/g, "");
  ses.setUserAgent(ua);

  ses.setPermissionRequestHandler((contents, permission, callback, details = {}) => {
    const url = details.requestingUrl || contents?.getURL?.() || "";
    // A frame embedded in the trusted app cannot inherit the host's OS
    // microphone/camera/clipboard grant. Only the top-level app may request.
    if (details.isMainFrame === false ||
      !canUseNative(contents, url, permission)) return callback(false);
    // Require a visible, user-approved permission grant; no automatic camera,
    // microphone, screen, geolocation, clipboard read or guest permissions.
    void confirmNative("Allow " + permission + " for Cubics?", url.slice(0, 300))
      .then(allowed => {
        if (allowed) permissions.set(permissionKey(contents, permission), Date.now() + PERMISSION_TTL);
        callback(allowed);
      }).catch(() => callback(false));
  });
  ses.setPermissionCheckHandler((contents, permission, requestingOrigin, details = {}) => {
    if (details.isMainFrame === false ||
      !canUseNative(contents, requestingOrigin || "", permission)) return false;
    return (permissions.get(permissionKey(contents, permission)) || 0) > Date.now();
  });

  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    // A malicious guest or iframe cannot request the host's screen.
    if (!mainWindow || !request.frame ||
      request.frame !== mainWindow.webContents.mainFrame ||
      !isAppOrigin(request.securityOrigin) || request.userGesture !== true) {
      callback(null);
      return;
    }
    try {
      const sources = (await desktopCapturer.getSources({ types: ["screen", "window"] })).slice(0, 12);
      if (!sources.length) return callback(null);
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: "question",
        title: "Choose what to share",
        message: "Share a screen or window with Cubics?",
        detail: "Screen content is private unless you explicitly start sharing it.",
        buttons: ["Cancel", ...sources.map(src => src.name.slice(0, 64))],
        defaultId: 0, cancelId: 0, noLink: true,
      });
      if (response < 1 || response > sources.length) return callback(null);
      callback({ video: sources[response - 1] });
    } catch {
      callback(null);
    }
  }, { useSystemPicker: false });

  ses.on("will-download", (event, item, sourceContents) => {
    // Downloads are a separate privilege, never auto-save arbitrary paths
    // provided by a guest website.
    const appDownload = !!(mainWindow && sourceContents === mainWindow.webContents &&
      isAppOrigin(sourceContents.getURL()));
    const guestDownload = !!(sourceContents && sourceContents.getType() === "webview" &&
      approvedGuestIds.has(sourceContents.id) &&
      sourceContents.hostWebContents === mainWindow?.webContents &&
      isIssuedGuestSession(sourceContents) &&
      safeGuestUrl(sourceContents.getURL(), isDev));
    if (!appDownload && !guestDownload) {
      event.preventDefault();
      return;
    }
    item.pause();
    if (!mainWindow || mainWindow.isDestroyed()) {
      item.cancel();
      return;
    }
    void dialog.showSaveDialog(mainWindow, {
      title: "Save download from Cubics?",
      defaultPath: item.getFilename().replace(/[\\/]/g, "_").slice(0, 120),
    }).then(({ canceled, filePath }) => {
      if (canceled || !filePath) item.cancel();
      else { item.setSavePath(filePath); item.resume(); }
    }).catch(() => item.cancel());
  });
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
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  // A remote widget must never choose a privileged preload, default browser
  // session, Node integration or a popup allowed by the webview tag.
  mainWindow.webContents.on("will-attach-webview", (event, preferences, params) => {
    if (!checkGuestAttach(params, isDev, issuedGuestPartitions)) {
      event.preventDefault();
      return;
    }
    delete preferences.preload;
    preferences.nodeIntegration = false;
    preferences.contextIsolation = true;
    preferences.sandbox = true;
    preferences.webSecurity = true;
    preferences.allowRunningInsecureContent = false;
    preferences.webviewTag = false;
    delete params.allowpopups;
  });
  mainWindow.webContents.on("did-attach-webview", (_event, guest) => {
    if (!isIssuedGuestSession(guest)) {
      guest.destroy();
      return;
    }
    approvedGuestIds.add(guest.id);
    guest.once("destroyed", () => approvedGuestIds.delete(guest.id));
  });
  mainWindow.webContents.on("did-navigate", () => revokeFor(mainWindow.webContents));
  mainWindow.webContents.on("destroyed", () => revokeFor(mainWindow.webContents));

  // Clerk auth flows (OAuth popups / handshakes) must stay inside Electron so
  // the session cookie lands in the app. Popups starting at the app origin are
  // allowed as child windows; any other external link still opens in the
  // system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    const decision = safeWindowTarget(target, appOrigin);
    if (decision === "app" || decision === "auth") return {
      action: "allow",
      overrideBrowserWindowOptions: {
        webPreferences: {
          sandbox: true, nodeIntegration: false, contextIsolation: true,
          webviewTag: false, webSecurity: true, allowRunningInsecureContent: false,
        },
      },
    };
    if (decision === "external") void openExternalWithConsent(target).catch(() => {});
    return { action: "deny" };
  });

  const stopUnsafeNavigation = (event, target) => {
    if (isAppOrigin(target) || isAuthTarget(target)) return;
    event.preventDefault();
    if (safeExternalUrl(target, { development: isDev })) {
      void openExternalWithConsent(target).catch(() => {});
    }
  };
  mainWindow.webContents.on("will-navigate", stopUnsafeNavigation);
  mainWindow.webContents.on("will-redirect", stopUnsafeNavigation);

  // Child OAuth/Clerk windows must not turn into open browsing surfaces.
  mainWindow.webContents.on("did-create-window", (childWindow) => {
    childWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    childWindow.webContents.on("will-navigate", (event, target) => {
      if (!isAuthTarget(target) && !isAppOrigin(target)) event.preventDefault();
    });
    childWindow.webContents.on("will-redirect", (event, target) => {
      if (!isAuthTarget(target) && !isAppOrigin(target)) event.preventDefault();
    });
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
  if (contents.getType() !== "webview") return;
  contents.setWindowOpenHandler(({ url }) => {
    const safe = safeExternalUrl(url, { development: isDev });
    const host = contents.hostWebContents;
    if (host && mainWindow && host === mainWindow.webContents && safe) {
      // A website cannot spawn new canvas tabs silently. Confirm first.
      void confirmNative("Open website as a new Cubics tab?", safe.slice(0, 300))
        .then(ok => { if (ok && !host.isDestroyed()) host.send("cubics:open-url", safe); })
        .catch(() => {});
    }
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (!safeGuestUrl(url, isDev)) event.preventDefault();
  });
  contents.on("will-redirect", (event, url) => {
    if (!safeGuestUrl(url, isDev)) event.preventDefault();
  });
  contents.on("destroyed", () => revokeFor(contents));
});

ipcMain.handle("cubics:get-browser-partition", (event, kind, widgetId, expectedUserId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  const issue = async () => {
    const verifiedId = await verifyBrowserAccount(expectedUserId);
    const partition = partitionForVerifiedAccount(verifiedId, kind, widgetId);
    issuedGuestPartitions.add(partition);
    return partition;
  };
  const result = browserIdentityQueue.then(issue, issue);
  browserIdentityQueue = result.catch(() => {});
  return result;
});

ipcMain.handle("cubics:get-screenshots-sources", async (event) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  if (!await confirmNative("Show screen/window thumbnails to Cubics?")) {
    throw new Error("Screen source permission denied");
  }
  const sources = (await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 240, height: 135 },
    fetchWindowIcons: false,
  })).slice(0, 20);
  return sources.map(source => ({
    id: source.id,
    name: source.name.slice(0, 120),
    thumbnail: source.thumbnail.toDataURL(),
  }));
});

ipcMain.handle("cubics:tab-media-source-id", async (event, webContentsId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  if (typeof webContentsId !== "number" || !Number.isSafeInteger(webContentsId) || webContentsId <= 0) {
    throw new Error("Invalid guest webContents ID");
  }
  const guest = webContents.fromId(webContentsId);
  if (!guest || !approvedGuestIds.has(webContentsId) ||
      guest.getType() !== "webview" ||
      guest.hostWebContents !== event.sender ||
      !isIssuedGuestSession(guest) ||
      !safeGuestUrl(guest.getURL(), isDev)) {
    throw new Error("Guest is not owned by this Cubics window");
  }
  if (!await confirmNative("Allow Cubics to capture this browser tab?")) {
    throw new Error("Tab capture permission denied");
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
