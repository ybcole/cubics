"use strict";

// Server-owned LiveKit publish rights. Only existing Live/Shared widgets may
// be published; a personal browser and an arbitrary room member never
// acquire a Live publisher identity. Share-mode consent is explicit in UI.
function canPublishWidget(role, userId, widget) {
  if (!["OWNER", "ADMIN", "MEMBER"].includes(role) ||
      typeof userId !== "string" || !userId || !widget) return false;
  if (widget.type === "live-tab") return widget.createdBy === userId;
  if (widget.type === "shared-browser") return true;
  return false;
}
function publishedIdentityMatches(identity, widgetId) {
  return typeof widgetId === "string" && widgetId.length > 0 &&
    typeof identity === "string" && identity.startsWith("host:" + widgetId + ":");
}
module.exports = { canPublishWidget, publishedIdentityMatches };
