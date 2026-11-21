"use strict";

function roomDenialMessage(payload) {
  const reason = payload?.reason || "Workspace access could not be verified";
  if (reason !== "Unable to verify membership") return reason;
  if (!payload.code) {
    return "The connected realtime server has not loaded the membership fix. Fully stop and restart npm run app:dev (both Next.js and Socket.IO).";
  }
  const messages = {
    MEMBERSHIP_CONFIG: "Realtime service configuration is invalid. Check the internal API origin and service credential on both servers.",
    SERVICE_AUTH_FAILED: "The API rejected the realtime service credential. Both servers must use the same service token.",
    AUTHORITY_HTTP_ERROR: "The membership API returned an error. Check the realtime server's internal API address and API health.",
    AUTHORITY_UNAVAILABLE: "The realtime server cannot reach the membership API.",
    INVALID_AUTHORITY_RESPONSE: "The internal API returned an invalid membership response. Check that realtime is connected to the Cubics API.",
  };
  if (!Object.hasOwn(messages, payload.failureCode)) return reason;
  const status = Number.isInteger(payload.httpStatus) && payload.httpStatus >= 100 && payload.httpStatus <= 599
    ? ` (HTTP ${payload.httpStatus})` : "";
  return messages[payload.failureCode] + status;
}

// Retry only explicit authority outages. A denied membership is never a grant,
// and subscriptions remain disabled until the server emits room:joined.
function createRoomJoinRecovery({ roomId, join, isConnected, onDenied, onUnavailable,
  setTimer = setTimeout, clearTimer = clearTimeout, maxRetries = 5 }) {
  let timer = null, attempts = 0, disposed = false;
  const clear = () => { if (timer !== null) clearTimer(timer); timer = null; };
  function connect() {
    clear(); attempts = 0;
    if (!disposed && isConnected()) join();
  }
  function joined(payload) {
    if (disposed || payload?.roomId !== roomId) return;
    clear(); attempts = 0;
  }
  function denied(payload) {
    if (disposed || payload?.roomId !== roomId) return;
    if (payload.code !== "MEMBERSHIP_UNAVAILABLE" || payload.retryable !== true) {
      clear(); onDenied(roomDenialMessage(payload)); return;
    }
    if (timer !== null || !isConnected()) return;
    if (attempts >= maxRetries) { onDenied(roomDenialMessage(payload)); return; }
    if (attempts === 0) onUnavailable();
    const delay = Math.min(1000 * 2 ** attempts++, 15000);
    timer = setTimer(() => {
      timer = null;
      if (!disposed && isConnected()) join();
    }, delay);
  }
  return { connect, joined, denied, disconnect: clear,
    dispose() { disposed = true; clear(); } };
}

module.exports = { createRoomJoinRecovery, roomDenialMessage };
