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

// A login window may only continue through authentication pages or back to the
// site that opened it. Otherwise it would linger as a full browser window
// (for example Google's post-login home page) instead of returning to its tab.
const AUTH_PATH_RE = /(?:^|\/)(?:auth|oauth2?|sso|saml|openid(?:-connect)?|login|signin|sign-in|signup|sign-up|authorize|authorization|callback|consent|mfa|2fa|verify|challenge|idp|adfs|wsfed|session)(?:\/|$)/i;
const AUTH_HOST_RE = /(^|\.)(clerk\.com|clerk\.accounts\.dev|lcl\.dev|microsoftonline\.com|okta\.com|auth0\.com|onelogin\.com|duosecurity\.com|pingidentity\.com)$/;
const GOOGLE_HOST_RE = /(^|\.)google\.com$/;
const GOOGLE_AUTH_PATH_RE = /^\/(?:accounts|o\/oauth2|gsi|signin|ServiceLogin|v3\/signin|recaptcha)(?:\/|$)/i;

function safeOrigin(url) {
  try { return new URL(url).origin; } catch { return null; }
}

const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "com.au", "net.au", "org.au", "co.jp", "co.nz",
  "co.za", "com.br", "com.mx", "co.in", "com.sg", "com.hk",
]);

function siteKey(origin) {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    const parts = host.split(".");
    const lastTwo = parts.slice(-2).join(".");
    if (parts.length >= 3 && MULTI_PART_SUFFIXES.has(lastTwo)) return parts.slice(-3).join(".");
    return parts.length <= 2 ? host : lastTwo;
  } catch { return null; }
}

function sameSite(a, b) {
  const left = siteKey(a), right = siteKey(b);
  return !!left && left === right;
}

function isGoogleAuthTarget(target) {
  const host = target.hostname.toLowerCase();
  return host === "accounts.google.com" ||
    (GOOGLE_HOST_RE.test(host) && GOOGLE_AUTH_PATH_RE.test(target.pathname));
}

// Entry into an authentication flow: blank bootstraps are resolved on the
// first real navigation, so ordinary link popups are never confined.
function isAuthTarget(url, development = false) {
  if (!safeGuestUrl(url, development) || url === "about:blank") return false;
  const target = new URL(url);
  return isGoogleAuthTarget(target) ||
    AUTH_HOST_RE.test(target.hostname.toLowerCase()) ||
    AUTH_PATH_RE.test(target.pathname);
}

function isAuthContinuation(url, openerOrigin, development = false) {
  if (!safeGuestUrl(url, development)) return false;
  if (url === "about:blank") return true;
  const target = new URL(url);
  // Google properties are checked first so a google.com tab cannot whitelist
  // a logged-in www.google.com/myaccount.google.com window.
  if (GOOGLE_HOST_RE.test(target.hostname.toLowerCase())) return isGoogleAuthTarget(target);
  if (sameSite(target.origin, openerOrigin)) return true;
  return AUTH_HOST_RE.test(target.hostname.toLowerCase()) ||
    AUTH_PATH_RE.test(target.pathname);
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

    function returnToRoot() {
      if (!allowed()) return;
      const parent = parentWindow();
      if (parent && !parent.isDestroyed()) {
        if (typeof parent.isMinimized === "function" && parent.isMinimized()) parent.restore();
        if (typeof parent.focus === "function") parent.focus();
      }
      // Cookies are shared with the root's session. Reloading puts the
      // completed sign-in back in the tab instead of a stray child window.
      if (typeof root.reload === "function") root.reload();
    }

    function bind(contents, depth, openerOrigin = null, closeSelf = null, startedAuth = false) {
      const guard = (event, url) => {
        if (!allowed() || !safeGuestUrl(url, development)) {
          event.preventDefault();
          return;
        }
        if (depth === 0) return;
        if (!startedAuth) {
          if (isAuthTarget(url, development)) startedAuth = true;
          return;
        }
        if (isAuthContinuation(url, openerOrigin, development)) return;
        event.preventDefault();
        if (typeof closeSelf === "function") closeSelf();
        returnToRoot();
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
        const rootOrigin = openerOrigin || safeOrigin(root.getURL()) || safeOrigin(contents.getURL());
        return {
          action: "allow",
          outlivesOpener: false,
          // Native child WebContents is allocated before createWindow runs.
          // Harden its preferences here as well as the owning window below.
          overrideBrowserWindowOptions: {
            webPreferences: {
              session: root.session, preload: undefined,
              sandbox: true, nodeIntegration: false,
              nodeIntegrationInSubFrames: false, nodeIntegrationInWorker: false,
              contextIsolation: true, webviewTag: false,
              webSecurity: true, allowRunningInsecureContent: false,
            },
          },
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
            bind(child.webContents, depth + 1, rootOrigin, closeChild,
              isAuthTarget(details.url, development));
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

module.exports = { isLoginPopup, isAuthTarget, isAuthContinuation, createGuestPopupManager };
