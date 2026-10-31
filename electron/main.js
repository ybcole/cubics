const { app, BrowserWindow, session, desktopCapturer, shell, ipcMain, webContents } = require("electron");
const path = require("path");
const http = require("http");
const net = require("net");

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
let serverProcess = null;

const isDev = !app.isPackaged;

function getDevServerUrl() {
  return process.env.CUBICS_SERVER_URL || "http://127.0.0.1:3000";
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function startNextServer(port) {
  const serverPath = path.join(process.resourcesPath, "server", "server.js");
  if (!require("fs").existsSync(serverPath)) {
    throw new Error(`Bundled Next server not found at ${serverPath}`);
  }
  const child = require("child_process").spawn(
    process.execPath,
    [serverPath],
    {
      cwd: path.dirname(serverPath),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
      },
      stdio: "inherit",
      windowsHide: true,
    }
  );
  child.on("exit", (code) => {
    console.log(`[cubics] Next server exited with code ${code}`);
  });
  return child;
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

function isAppOrigin(url) {
  try {
    const u = new URL(url);
    return u.hostname === "127.0.0.1" || u.hostname === "localhost";
  } catch {
    return false;
  }
}

const AUTH_HOST_RE =
  /(^|\.)(google\.com|clerk\.com|clerk\.accounts\.dev|lcl\.dev|github\.com|apple\.com|facebook\.com)$/;

function isAuthTarget(url) {
  try {
    return AUTH_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

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
    if (/^https?:/i.test(target)) shell.openExternal(target);
    return { action: "deny" };
  });

  // Allow top-level navigation for the app origin and known auth providers
  // (Clerk handshake + OAuth round-trip); keep anything else from taking over
  // the app window.
  mainWindow.webContents.on("will-navigate", (e, target) => {
    if (isAppOrigin(target) || isAuthTarget(target)) return;
    e.preventDefault();
    if (/^https?:/i.test(target)) shell.openExternal(target);
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
      if (host && /^https?:/i.test(url)) {
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
    setupSession();

    let url;
    if (isDev) {
      url = getDevServerUrl();
      await waitForServer(url).catch((err) => {
        console.error(err.message);
        app.quit();
      });
    } else {
      const port = await getFreePort();
      serverProcess = startNextServer(port);
      url = `http://127.0.0.1:${port}`;
      await waitForServer(url).catch((err) => {
        console.error(err.message);
        app.quit();
      });
    }

    createWindow(url);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0 && url) createWindow(url);
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });
}
