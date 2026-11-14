"use strict";

/** M03 baseline workspace authorization. Never accept role or owner status
 * from client JSON; these are derived from the database on the server. */
const ROLES = Object.freeze(["OWNER", "ADMIN", "MEMBER"]);
function normalizeRoomRole(role) {
  return ROLES.includes(role) ? role : null;
}
function canRoomAction(role, action, options = {}) {
  role = normalizeRoomRole(role);
  if (!role) return false;
  const elevated = role === "OWNER" || role === "ADMIN";
  switch (action) {
    case "room.view":
    case "members.read":
    case "widget.create":
    case "chat.send":
    case "presence.publish":
    case "media.view":
      return true;
    case "room.rename":
    case "members.invite":
    case "members.remove":
      return elevated;
    case "room.delete":
    case "members.role":
    case "room.transfer":
      return role === "OWNER";
    case "widget.modify":
    case "widget.delete":
      return elevated || options.ownsWidget === true || options.legacyUnowned === true;
    case "media.host":
      // Transitional permission alias. Require the authoritative widget lookup.
      return options.ownsWidget === true || elevated;
    case "media.host.live":
      // A personal Live tab is broadcast only by its creator, not a room admin.
      return options.ownsWidget === true;
    case "media.host.shared":
    case "control.send":
      // A host explicitly started a Shared widget; joined members may interact
      // with that widget only after DB mode verification and watch/host checks.
      return options.isSharedWidget === true;
    case "control.request":
      // Generic control leases are not permission to inject into a Live tab.
      return options.ownsWidget === true || elevated;
    default:
      return false;
  }
}
module.exports = { ROLES, normalizeRoomRole, canRoomAction };
