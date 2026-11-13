"use strict";

/** M05: The server, never the renderer, decides which workspace tab fields
 * are visible to another participant. Keep legacy widget shapes intact so
 * existing canvas geometry still converges. Unknown/legacy owners fail closed.
 */
function isPersonalWidget(widget) {
  return !!widget && widget.type !== "shared-browser" && widget.type !== "live-tab";
}
function redactWidgetForViewer(widget, authenticatedUserId) {
  if (!widget || typeof widget !== "object") throw new TypeError("Widget required");
  const ownerCanView = typeof authenticatedUserId === "string" &&
    authenticatedUserId.length > 0 && widget.createdBy === authenticatedUserId;
  if (!isPersonalWidget(widget) || ownerCanView) return { ...widget };
  return { ...widget, title: "Private tab", url: "about:blank" };
}
module.exports = { isPersonalWidget, redactWidgetForViewer };
