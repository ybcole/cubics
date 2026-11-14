"use strict";

// Intentionally read-only and redacted: this can run against a real database
// without exposing customer browsing URLs, widget titles or user IDs.
function assessWidgetMetadata(widget) {
  if (!widget || typeof widget !== "object") throw new TypeError("Invalid widget");
  const personal = widget.type !== "live-tab" && widget.type !== "shared-browser" &&
    widget.type !== "tab-share";
  let fullSite = false, hasUrl = false;
  if (typeof widget.url === "string" && widget.url !== "about:blank" &&
      widget.url !== "tab-share" && widget.url !== "") {
    hasUrl = true;
    try {
      const url = new URL(widget.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") fullSite = true;
      else fullSite = !!(url.username || url.password || url.search || url.hash ||
        url.pathname !== "/");
    } catch { fullSite = true; }
  }
  const title = typeof widget.title === "string" && widget.title.trim().length > 0
    ? widget.title : "";
  const genericTitle = widget.type === "live-tab" ? "Live tab" :
    widget.type === "shared-browser" ? "Shared tab" : "Private tab";
  return {
    personalUrlStored: personal && hasUrl,
    personalTitleStored: personal && title !== genericTitle,
    liveUrlStored: widget.type === "live-tab" && hasUrl,
    liveTitleStored: widget.type === "live-tab" && title !== genericTitle,
    sharedFullUrlStored: widget.type === "shared-browser" && fullSite,
    sharedTitleStored: widget.type === "shared-browser" && title !== genericTitle,
    profileIdInSyncedMetadata: /bp1_[a-f0-9]{40}/.test(String(widget.url || "") + " " + title),
  };
}
function createAggregate() {
  return {
    rowsInspected:0, personalUrlStored:0, personalTitleStored:0,
    liveUrlStored:0, liveTitleStored:0,
    sharedFullUrlStored:0, sharedTitleStored:0,
    profileIdInSyncedMetadata:0,
  };
}
function countWidget(aggregate, widget) {
  const assessed=assessWidgetMetadata(widget);
  aggregate.rowsInspected++;
  for(const [key,value] of Object.entries(assessed)) if(value) aggregate[key]++;
  return aggregate;
}
module.exports={assessWidgetMetadata,createAggregate,countWidget};
