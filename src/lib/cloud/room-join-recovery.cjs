"use strict";

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
      clear(); onDenied(payload.reason); return;
    }
    if (timer !== null || !isConnected()) return;
    if (attempts >= maxRetries) { onDenied(payload.reason); return; }
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

module.exports = { createRoomJoinRecovery };
