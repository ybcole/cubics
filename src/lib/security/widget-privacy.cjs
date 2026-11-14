"use strict";

/** M05: Server-owned viewer redaction; never relay raw Personal navigation.
 * Live URLs are not needed by spectators; Shared non-owners may see a safe
 * site origin only, NEVER a full path, token, fragment, or custom page title.
 * Unknown/legacy owners fail closed.
 */
function isPersonalWidget(widget) {
  return !!widget && widget.type !== "shared-browser" && widget.type !== "live-tab";
}
function safeSharedSite(value) {
  try {
    const url = new URL(value);
    if ((url.protocol === "https:" || url.protocol === "http:") &&
        !url.username && !url.password) return url.origin + "/";
  } catch { /* no URL is safer than guessing */ }
  return "about:blank";
}
function redactWidgetForViewer(widget, authenticatedUserId) {
  if (!widget || typeof widget !== "object") throw new TypeError("Widget required");
  const ownerCanView = typeof authenticatedUserId === "string" &&
    authenticatedUserId.length > 0 && widget.createdBy === authenticatedUserId;
  if (ownerCanView) return { ...widget };
  if (isPersonalWidget(widget)) {
    return { ...widget, title: "Private tab", url: "about:blank" };
  }
  if (widget.type === "live-tab") {
    return { ...widget, title: "Live tab", url: "about:blank" };
  }
  return { ...widget, title: "Shared tab", url: safeSharedSite(widget.url) };
}
module.exports = { isPersonalWidget, redactWidgetForViewer, safeSharedSite };
