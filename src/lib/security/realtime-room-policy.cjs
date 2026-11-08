"use strict";

/** Legacy cross-room messaging guard. This does not authenticate users or
 * verify workspace membership; those are required in M03/M15. */
function joinedRoom(socket) {
  const roomId = socket?.data?.roomId;
  return typeof roomId === "string" && roomId.length > 0 ? roomId : null;
}
function isInJoinedRoom(socket, roomId) {
  return typeof roomId === "string" && roomId.length > 0 && joinedRoom(socket) === roomId;
}
function sameJoinedRoom(sender, recipient) {
  const roomId = joinedRoom(sender);
  return roomId !== null && joinedRoom(recipient) === roomId;
}
module.exports = { joinedRoom, isInJoinedRoom, sameJoinedRoom };
