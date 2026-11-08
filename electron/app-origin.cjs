"use strict";

/** The desktop is an HTTPS client, not a privileged local web server.
 * Production's app origin is pinned at packaging time and may not be replaced
 * by an environment variable on the end user's machine. */
function normalizedAppOrigin(value, { packaged = false } = {}) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Cubics app origin is required");
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("Cubics app origin may not contain credentials, path, query or fragment");
  }
  if (packaged) {
    if (url.protocol !== "https:" || !hostname.includes(".") ||
      hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".invalid") ||
      hostname.endsWith(".test") || hostname.endsWith(".example") ||
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      throw new Error("Packaged Cubics needs a real public HTTPS application origin");
    }
  } else if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Invalid development origin");
  }
  return url.origin;
}
function isAppUrl(candidate, origin) {
  try {
    const u = new URL(candidate);
    return !!origin && (u.protocol === "https:" || u.protocol === "http:") && u.origin === origin;
  } catch { return false; }
}
const AUTH_HOST_RE = /(^|\.)(google\.com|clerk\.com|clerk\.accounts\.dev|lcl\.dev|github\.com|apple\.com|facebook\.com)$/;
function isAuthUrl(candidate) {
  try {
    const u = new URL(candidate);
    return u.protocol === "https:" && !u.username && !u.password && AUTH_HOST_RE.test(u.hostname.toLowerCase());
  } catch { return false; }
}
function isExternalBrowserUrl(candidate) {
  try {
    const u = new URL(candidate);
    return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password;
  } catch { return false; }
}
module.exports = { normalizedAppOrigin, isAppUrl, isAuthUrl, isExternalBrowserUrl };
