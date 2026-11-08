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
    case "control.request":
      // Later milestones additionally verify host ownership, consent,
      // controller generation and a scoped LiveKit grant.
      return options.ownsWidget === true || elevated;
    default:
      return false;
  }
}
module.exports = { ROLES, normalizeRoomRole, canRoomAction };
