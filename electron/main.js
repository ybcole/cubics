const { app, BrowserWindow, session, desktopCapturer, shell, dialog, ipcMain, webContents, safeStorage } = require("electron");
const path = require("path");
const { createGuestPopupManager } = require("./guest-popups.cjs");
const http = require("http");
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const { scopeDigest } = require("./personal-navigation-vault.cjs");
const { createRecoveryBundle, openRecoveryBundle } = require("./personal-navigation-recovery.cjs");
const { getOrCreateBrowserDeviceId, browserProfileDescriptor } = require("./browser-profile.cjs");
const { PersonalNavigationVault, protectedVaultAvailable } = require("./personal-navigation-vault.cjs");
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
let cachedDeviceMarker = null;
let personalVault = null;
// A cloud copy can only be removed after the owner's backup was exported,
// decrypted again from the saved file, and the local URL has not changed.
// Proof lives in RAM; restart/new navigation requires another verified backup.
const verifiedBackupProofs = new Map();
function localUrlFingerprint(value) {
  return createHash("sha256").update(value).digest("hex");
}
function recoveryProofKey(scope) {
  return scopeDigest(scope);
}
async function readSafeRecoveryFile(filePath) {
  const lstat = await fs.promises.lstat(filePath);
  if (!lstat.isFile() || lstat.isSymbolicLink() || lstat.size > 24_000)
    throw new Error("Untrusted recovery backup file");
  const file = await fs.promises.open(filePath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 24_000) throw new Error("Invalid recovery backup");
    return await file.readFile();
  } finally { await file.close(); }
}
function devicePersonalVault() {
  if (!personalVault) personalVault = new PersonalNavigationVault(app.getPath("userData"), safeStorage);
  return personalVault;
}
async function authorizedPersonalScope(roomId, widgetId, expectedUserId) {
  const userId = await verifyBrowserAccount(expectedUserId);
  if (typeof roomId !== "string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(roomId) ||
      typeof widgetId !== "string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(widgetId))
    throw new Error("Invalid Personal navigation scope");
  const endpoint = new URL(
    "/api/spaces/" + encodeURIComponent(roomId) + "/widgets/" +
    encodeURIComponent(widgetId) + "/personal-vault", appOrigin
  );
  const response = await session.defaultSession.fetch(endpoint.href, {
    method: "GET", credentials: "include", redirect: "error", cache: "no-store",
    headers: { Accept: "application/json" },
  });
  // Electron's Session.fetch may return Response.url="" for a direct
  // request. redirect:"error" already forbids redirects; compare an
  // advertised response URL only when the platform supplies one.
  if (!response.ok || response.redirected ||
      (response.url && new URL(response.url).origin !== new URL(appOrigin).origin))
    throw new Error("Personal tab owner authorization failed");
  const body = await response.text();
  if (body.length > 8192) throw new Error("Invalid Personal tab authorization");
  const data = JSON.parse(body);
  if (!data || typeof data.legacyUrl !== "string" || data.legacyUrl.length > 4096)
    throw new Error("Invalid Personal tab authorization");
  if (await verifyBrowserAccount(expectedUserId) !== userId)
    throw new Error("Browser account changed");
  return {
    scope: { roomId, widgetId, userId },
    legacyUrl: data.legacyUrl,
    cloudCleanupEnabled: data.cloudCleanupEnabled === true,
  };
}
function browserDeviceMarker() {
  // This marker is non-secret and intentionally outside room/backend records.
  if (!cachedDeviceMarker) cachedDeviceMarker = getOrCreateBrowserDeviceId(app.getPath("userData"));
  return cachedDeviceMarker;
}
function verifiedBrowserProfile(userId, kind, widgetId) {
  return browserProfileDescriptor(browserDeviceMarker(), userId, kind, widgetId);
}
function serializeBrowserTask(task) {
  const result = browserIdentityQueue.then(task, task);
  browserIdentityQueue = result.catch(() => {});
  return result;
}

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
  const previousUserId = verifiedAccountId;
  guestPopups.closeAll();
  for (const id of approvedGuestIds) {
    const guest = webContents.fromId(id);
    if (guest && !guest.isDestroyed()) guest.destroy();
  }
  approvedGuestIds.clear();
  issuedGuestPartitions.clear();
  // A backup from a previous login must not authorize cloud cleanup later.
  verifiedBackupProofs.clear();
  verifiedAccountId = null;
  permissions.clear();
  if (previousUserId && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("cubics:browser-account-revoked", { userId: previousUserId });
  }
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
  // Client hints still announce "Electron" even after the UA is cleaned. Sign-in providers and bot
  // checks (Google, Cloudflare) read them, so drop that one brand from the hint headers.
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders;
    for (const name of Object.keys(headers)) {
      const lower = name.toLowerCase();
      if (lower === "sec-ch-ua" || lower === "sec-ch-ua-full-version-list") {
        headers[name] = String(headers[name]).replace(/,?\s*"Electron";v="[^"]*"/g, "").replace(/^\s*,\s*/, "");
      }
    }
    callback({ requestHeaders: headers });
  });

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

// Native child windows preserve window.opener, POST bodies and the tab's
// session. Login windows never launch an external browser or copy cookies.
const guestPopups = createGuestPopupManager({
  BrowserWindow,
  development: isDev,
  parentWindow: () => mainWindow,
  isAllowedRoot: contents => approvedGuestIds.has(contents.id) &&
    isIssuedGuestSession(contents),
  openCanvasTab: (contents, url) => {
    const host = contents.hostWebContents;
    const safe = safeExternalUrl(url, { development: isDev });
    if (!safe || !host || !mainWindow || host !== mainWindow.webContents) return;
    void confirmNative("Open website as a new Cubics tab?", safe.slice(0, 300))
      .then(ok => {
        if (ok && !host.isDestroyed() && approvedGuestIds.has(contents.id) &&
            isIssuedGuestSession(contents)) host.send("cubics:open-url", safe);
      }).catch(() => {});
  },
});
app.on("web-contents-created", (_event, contents) => {
  if (contents.getType() !== "webview") return;
  guestPopups.install(contents);
  contents.on("destroyed", () => revokeFor(contents));
});

ipcMain.handle("cubics:notify-browser-auth-change", (event, previousUserId, nextUserId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  if (typeof previousUserId !== "string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(previousUserId) ||
      (nextUserId !== null && (typeof nextUserId !== "string" ||
       !/^[a-zA-Z0-9_-]{3,128}$/.test(nextUserId)))) {
    throw new Error("Invalid account transition");
  }
  // Idempotent and fail-safe: a stale notification for account A must never
  // revoke a freshly verified account B.
  if (verifiedAccountId !== previousUserId || nextUserId === previousUserId) {
    return { revoked: false };
  }
  revokeBrowserAccount();
  return { revoked: true };
});

ipcMain.handle("cubics:get-browser-partition", (event, kind, widgetId, expectedUserId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  const issue = async () => {
    const verifiedId = await verifyBrowserAccount(expectedUserId);
    const partition = partitionForVerifiedAccount(verifiedId, kind, widgetId);
    issuedGuestPartitions.add(partition);
    return partition;
  };
  return serializeBrowserTask(issue);
});

ipcMain.handle("cubics:personal-vault-status", (event, expectedUserId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  return serializeBrowserTask(async () => {
    await verifyBrowserAccount(expectedUserId);
    return { available: await protectedVaultAvailable(safeStorage) };
  });
});

ipcMain.handle("cubics:personal-vault-read", (event, roomId, widgetId, expectedUserId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  return serializeBrowserTask(async () => {
    const { scope, legacyUrl } = await authorizedPersonalScope(roomId, widgetId, expectedUserId);
    const vault = devicePersonalVault();
    let url = await vault.read(scope);
    let imported = false;
    if (!url && legacyUrl !== "about:blank") {
      const safe = safeExternalUrl(legacyUrl, { development: isDev });
      if (!safe) throw new Error("Legacy Personal URL cannot be imported securely");
      await vault.write(scope, safe);
      url = await vault.read(scope);
      imported = true;
    }
    // This is an import/checkpoint, never an implicit cloud deletion.
    return { url: url || "about:blank", imported };
  });
});

ipcMain.handle("cubics:personal-vault-write", (event, roomId, widgetId, expectedUserId, url) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  return serializeBrowserTask(async () => {
    const safe = safeExternalUrl(url, { development: isDev });
    if (!safe) throw new Error("Invalid Personal navigation URL");
    const { scope } = await authorizedPersonalScope(roomId, widgetId, expectedUserId);
    await devicePersonalVault().write(scope, safe);
    verifiedBackupProofs.delete(recoveryProofKey(scope));
    return { saved: true };
  });
});

ipcMain.handle("cubics:personal-vault-export-recovery", (event, roomId, widgetId, expectedUserId, passphrase) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  return serializeBrowserTask(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error("Window unavailable");
    const { scope } = await authorizedPersonalScope(roomId, widgetId, expectedUserId);
    const url = await devicePersonalVault().read(scope);
    if (!url || url === "about:blank") throw new Error("No saved destination to back up");
    // Derive the slow scrypt key exclusively inside Electron main. No cloud
    // request ever receives the recovery passphrase or recovery file.
    const bundle = await createRecoveryBundle(scope, url, passphrase);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Save encrypted Personal destination backup",
      defaultPath: "cubics-personal-" + scopeDigest(scope).slice(0, 12) + ".cubics-recovery",
      filters: [{ name: "Encrypted Cubics recovery", extensions: ["cubics-recovery"] }],
    });
    if (canceled || !filePath) return { exported: false };
    const check = await authorizedPersonalScope(roomId, widgetId, expectedUserId);
    if (check.scope.userId !== scope.userId ||
        await devicePersonalVault().read(scope) !== url)
      throw new Error("Personal destination changed during backup");
    await fs.promises.writeFile(filePath, bundle, { flag: "wx", mode: 0o600 });
    const stored = await readSafeRecoveryFile(filePath);
    if (await openRecoveryBundle(scope, stored, passphrase) !== url)
      throw new Error("Encrypted recovery backup verification failed");
    verifiedBackupProofs.set(recoveryProofKey(scope), localUrlFingerprint(url));
    return { exported: true };
  });
});

ipcMain.handle("cubics:personal-vault-import-recovery", (event, roomId, widgetId, expectedUserId, passphrase) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  return serializeBrowserTask(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error("Window unavailable");
    const { scope } = await authorizedPersonalScope(roomId, widgetId, expectedUserId);
    const selected = await dialog.showOpenDialog(mainWindow, {
      title: "Restore encrypted Personal destination",
      properties: ["openFile"],
      filters: [{ name: "Encrypted Cubics recovery", extensions: ["cubics-recovery"] }],
    });
    if (selected.canceled || selected.filePaths.length !== 1) return { restored: false };
    const backup = await readSafeRecoveryFile(selected.filePaths[0]);
    const url = await openRecoveryBundle(scope, backup, passphrase);
    if (!await confirmNative("Restore Personal destination?",
      "This replaces this tab's saved destination on this device only. Website cookies and cloud records are unchanged.")) {
      return { restored: false };
    }
    const check = await authorizedPersonalScope(roomId, widgetId, expectedUserId);
    if (check.scope.userId !== scope.userId) throw new Error("Personal account changed");
    await devicePersonalVault().write(scope, url);
    verifiedBackupProofs.delete(recoveryProofKey(scope));
    return { restored: true };
  });
});

ipcMain.handle("cubics:personal-vault-forget", (event, roomId, widgetId, expectedUserId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  return serializeBrowserTask(async () => {
    const { scope } = await authorizedPersonalScope(roomId, widgetId, expectedUserId);
    if (!await confirmNative("Forget saved Personal destination?",
      "Replace this tab's encrypted local destination with a blank record? " +
      "Cookies and the historical cloud copy (if any) are not deleted. " +
      "Export an encrypted recovery backup first if you may need this URL.")) {
      return { forgotten: false };
    }
    const verified = await authorizedPersonalScope(roomId, widgetId, expectedUserId);
    if (verified.scope.userId !== scope.userId) throw new Error("Personal account changed");
    // Encrypted blank tombstone prevents automatic reimport from old cloud
    // records when this tab is opened later. Not forensic SSD erasure.
    await devicePersonalVault().write(scope, "about:blank");
    verifiedBackupProofs.delete(recoveryProofKey(scope));
    return { forgotten: true };
  });
});

ipcMain.handle("cubics:personal-vault-cloud-status", (event, roomId, widgetId, expectedUserId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  return serializeBrowserTask(async () => {
    const { scope, legacyUrl, cloudCleanupEnabled } =
      await authorizedPersonalScope(roomId, widgetId, expectedUserId);
    const local = await devicePersonalVault().read(scope);
    const localVerified = !!local && local !== "about:blank";
    return {
      cloudCleanupEnabled,
      cloudCopyPresent: legacyUrl !== "about:blank" && legacyUrl !== "",
      localVerified,
      backupVerifiedThisSession: localVerified &&
        verifiedBackupProofs.get(recoveryProofKey(scope)) === localUrlFingerprint(local),
    };
  });
});

ipcMain.handle("cubics:personal-vault-scrub-cloud", (event, roomId, widgetId, expectedUserId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  return serializeBrowserTask(async () => {
    const { scope, legacyUrl, cloudCleanupEnabled } =
      await authorizedPersonalScope(roomId, widgetId, expectedUserId);
    if (!cloudCleanupEnabled) throw new Error("Cloud cleanup requires approved server feature flag");
    if (legacyUrl === "about:blank") return { scrubbed: false, alreadyClean: true };
    const vault = devicePersonalVault();
    const local = await vault.read(scope);
    if (!local || local === "about:blank" ||
        verifiedBackupProofs.get(recoveryProofKey(scope)) !== localUrlFingerprint(local)) {
      throw new Error("Export and verify an encrypted recovery backup before cloud cleanup");
    }
    if (!await confirmNative("Remove this Personal URL from the cloud?",
      "The original destination will be replaced with a Private tab placeholder in PostgreSQL. " +
      "Other devices cannot restore it from Cubics cloud. Keep your encrypted recovery backup and passphrase. " +
      "Database backups may retain the historical URL until they expire.")) {
      return { scrubbed: false, alreadyClean: false };
    }
    const fresh = await authorizedPersonalScope(roomId, widgetId, expectedUserId);
    if (fresh.scope.userId !== scope.userId || !fresh.cloudCleanupEnabled ||
        await vault.read(scope) !== local ||
        verifiedBackupProofs.get(recoveryProofKey(scope)) !== localUrlFingerprint(local)) {
      throw new Error("Personal recovery conditions changed before cloud cleanup");
    }
    // Hash only the historical cloud URL; the local current URL may be newer.
    const urlFingerprint = localUrlFingerprint(fresh.legacyUrl);
    const endpoint = new URL("/api/spaces/" + encodeURIComponent(roomId) +
      "/widgets/" + encodeURIComponent(widgetId) + "/personal-vault", appOrigin);
    const response = await session.defaultSession.fetch(endpoint.href, {
      method: "POST", credentials: "include", redirect: "error", cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ confirmation: "REMOVE_LEGACY_PERSONAL_URL", urlFingerprint }),
    });
    if (!response.ok || response.redirected ||
        (response.url && new URL(response.url).origin !== new URL(appOrigin).origin)) {
      throw new Error("Cloud cleanup failed or URL changed; original record may still exist");
    }
    const result = await response.json();
    if (result?.scrubbed !== true) throw new Error("Cloud cleanup not confirmed");
    verifiedBackupProofs.delete(recoveryProofKey(scope));
    return { scrubbed: true, alreadyClean: false };
  });
});

ipcMain.handle("cubics:get-browser-profile-info", (event, kind, widgetId, expectedUserId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  return serializeBrowserTask(async () => {
    const userId = await verifyBrowserAccount(expectedUserId);
    const partition = partitionForVerifiedAccount(userId, kind, widgetId);
    if (!issuedGuestPartitions.has(partition)) throw new Error("Browser profile not authorized");
    return verifiedBrowserProfile(userId, kind, widgetId);
  });
});

ipcMain.handle("cubics:export-browser-profile-info", (event, kind, widgetId, expectedUserId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  return serializeBrowserTask(async () => {
    const userId = await verifyBrowserAccount(expectedUserId);
    const partition = partitionForVerifiedAccount(userId, kind, widgetId);
    if (!issuedGuestPartitions.has(partition)) throw new Error("Browser profile not authorized");
    const record = verifiedBrowserProfile(userId, kind, widgetId);
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error("Window unavailable");
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Export profile information (no browsing data)",
      defaultPath: "cubics-browser-profile-" + record.profileId.slice(4, 16) + ".json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { exported: false };
    // The dialog can outlive an auth session. Check again before writing.
    if (await verifyBrowserAccount(expectedUserId) !== userId ||
        !issuedGuestPartitions.has(partition)) throw new Error("Browser profile changed during export");
    // No cookie, cache, site history, full partition, login or user identifier
    // is serialized. Avoid overwriting an existing user file without consent.
    const data = { ...record, exportedAt: new Date().toISOString(),
      note: "Profile information only. No browser data or credentials are included." };
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", {
      encoding: "utf8", flag: "wx", mode: 0o600,
    });
    return { exported: true };
  });
});

ipcMain.handle("cubics:clear-browser-data", (event, kind, widgetId, expectedUserId) => {
  if (!isTrustedRenderer(event, mainWindow, appOrigin)) throw new Error("Forbidden native caller");
  const clear = async () => {
    // Never clear a renderer-selected session: verify the authenticated Clerk
    // account, derive its partition in main, and require a previously issued
    // local capability.
    const userId = await verifyBrowserAccount(expectedUserId);
    const partition = partitionForVerifiedAccount(userId, kind, widgetId);
    if (!issuedGuestPartitions.has(partition)) throw new Error("Browser profile not authorized");
    const detail = kind === "personal" ? "All Personal tabs for this Cubics account on this device" :
      kind === "shared" ? "Only this temporary Shared browser profile" :
      "Only this Live browser profile";
    if (!await confirmNative("Clear local browsing data?", detail +
      " will lose website logins, cookies and local browser storage. This cannot be undone.")) {
      return { cleared: false };
    }
    // Confirm again after user interaction; an account may have changed
    // while the native confirmation dialog was on screen.
    if (await verifyBrowserAccount(expectedUserId) !== userId ||
        !issuedGuestPartitions.has(partition)) {
      throw new Error("Browser account changed before data clear");
    }
    const target = session.fromPartition(partition);
    for (const id of [...approvedGuestIds]) {
      const guest = webContents.fromId(id);
      if (guest && !guest.isDestroyed() && guest.session === target) {
        approvedGuestIds.delete(id);
        guest.destroy();
      }
    }
    // Electron 45 clearData includes cookies, cache, IndexedDB, localStorage,
    // service workers and other Chromium browsing data; it cannot affect
    // defaultSession or any other account's partition.
    await target.clearData();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("cubics:browser-data-cleared", {
        userId, kind, widgetId: kind === "personal" ? null : widgetId,
      });
    }
    return { cleared: true };
  };
  return serializeBrowserTask(clear);
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
