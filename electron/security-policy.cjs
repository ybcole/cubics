"use strict";

const { isAppUrl, isAuthUrl, isExternalBrowserUrl } = require("./app-origin.cjs");

/* Static, testable Electron security boundary. A page or nested frame cannot
 * authorize itself by claiming its own userId, window ID, partition or URL. */
const PARTITION = /^persist:cubics-(?:personal|tab)-[a-zA-Z0-9_-]{3,160}$/;
const MAX_SHELL_URL_BYTES = 2048;

function safeExternalUrl(value, { development = false } = {}) {
  if (typeof value !== "string" || value.length > MAX_SHELL_URL_BYTES) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const local = host === "localhost" || host === "127.0.0.1";
    if (url.username || url.password || url.protocol !== "https:" &&
      !(development && local && url.protocol === "http:")) return null;
    if (!isExternalBrowserUrl(url.href)) return null;
    return url.href;
  } catch { return null; }
}

function safeGuestUrl(url, development = false) {
  if (url === "about:blank") return true;
  return !!safeExternalUrl(url, { development });
}

// Partition names are generated ONLY from the Clerk identity returned by the
// authenticated /v1/identity API. Caller-supplied account strings are hints,
// never account authority. Preserve existing names to preserve browser cookies.
function partitionForVerifiedAccount(userId, kind, widgetId = null) {
  if (typeof userId !== "string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(userId)) {
    throw new Error("Invalid verified account identity");
  }
  let partition;
  if (kind === "personal") {
    partition = "persist:cubics-personal-" + userId;
  } else if (kind === "tab" && typeof widgetId === "string" &&
             /^[a-zA-Z0-9_-]{3,80}$/.test(widgetId)) {
    partition = "persist:cubics-tab-" + userId + "-" + widgetId;
  } else {
    throw new Error("Invalid browser partition scope");
  }
  if (!isAllowedGuestPartition(partition)) throw new Error("Browser partition exceeds safe bounds");
  return partition;
}

function isAllowedGuestPartition(partition) {
  return typeof partition === "string" && partition.length <= 192 &&
    PARTITION.test(partition);
}

function isTrustedRenderer(event, window, appOrigin) {
  const sender = event?.sender;
  const frame = event?.senderFrame;
  return !!(window && sender && frame && appOrigin &&
    !sender.isDestroyed?.() &&
    window.webContents === sender &&
    sender.mainFrame === frame &&
    isAppUrl(frame.url, appOrigin) &&
    isAppUrl(sender.getURL?.(), appOrigin));
}

function nativePermissionAllowedRequest({ sender, requestingUrl, window, origin, permission }) {
  if (!sender || !window || sender !== window.webContents) return false;
  if (!isAppUrl(requestingUrl, origin) || !isAppUrl(sender.getURL?.(), origin)) return false;
  // Other webContents, guests and subframes are NEVER eligible for native
  // permissions. The OS/dialog confirmation happens in the main process.
  return ["media", "display-capture", "clipboard-sanitized-write"].includes(permission);
}

function safeWindowTarget(url, origin) {
  if (isAppUrl(url, origin)) return "app";
  if (isAuthUrl(url)) return "auth";
  if (safeExternalUrl(url)) return "external";
  return "deny";
}

function checkGuestAttach(params, development = false, permittedPartitions = null) {
  return !!params && isAllowedGuestPartition(params.partition) &&
    (!permittedPartitions || permittedPartitions.has(params.partition)) &&
    safeGuestUrl(params.src, development) &&
    !params.preload &&
    !params.nodeintegration &&
    !params.allowpopups;
}
module.exports = {
  safeExternalUrl, safeGuestUrl, isAllowedGuestPartition,
  isTrustedRenderer, nativePermissionAllowedRequest, safeWindowTarget,
  checkGuestAttach, partitionForVerifiedAccount,
};
