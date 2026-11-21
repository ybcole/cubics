"use strict";

/** Service-to-service lookup. Production fails closed if origin/token are missing;
 * local development resolves a private loopback credential shared with Next.
 * if HTTPS validation fails, or if the authoritative API is unavailable.
 * Prisma is NOT imported into the standalone realtime service. */
const { serviceOrigin, realtimeServiceToken } = require("./realtime-service-config.cjs");
// CUBICS_REALTIME_SERVICE_TOKEN is resolved only in server processes.
class MembershipAuthorityError extends Error {
  constructor(code, retryable, status) {
    super("Realtime membership authority: " + code);
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

async function getRoomRole(userId, roomId, { env = process.env, fetchImpl = fetch, action, widgetId } = {}) {
  if (typeof userId !== "string" || typeof roomId !== "string" ||
      !userId || !roomId || userId.length > 128 || roomId.length > 128) return null;
  let token, url;
  try {
    token = realtimeServiceToken(env);
    url = serviceOrigin(env) + "/api/internal/realtime/membership";
  } catch { throw new MembershipAuthorityError("MEMBERSHIP_CONFIG", false); }
  let response;
  try { response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cubics-Internal-Service-Token": token,
    },
    body: JSON.stringify({
      userId, roomId,
      ...(action === undefined ? {} : { action, widgetId }),
    }),
    redirect: "error",
    signal: AbortSignal.timeout(4000),
  }); } catch { throw new MembershipAuthorityError("AUTHORITY_UNAVAILABLE", true); }
  if (!response.ok) {
    throw new MembershipAuthorityError(
      [401, 403].includes(response.status) ? "SERVICE_AUTH_FAILED" : "AUTHORITY_HTTP_ERROR",
      response.status === 429 || response.status >= 500, response.status);
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw new MembershipAuthorityError("INVALID_AUTHORITY_RESPONSE", true); }
  if (!payload || typeof payload !== "object")
    throw new MembershipAuthorityError("INVALID_AUTHORITY_RESPONSE", true);
  return payload.allowed === true && ["OWNER", "ADMIN", "MEMBER"].includes(payload.role)
    ? payload.role : null;
}

async function checkRoomMembership(userId, roomId, options) {
  return !!(await getRoomRole(userId, roomId, options));
}
async function checkRoomAction(userId, roomId, action, widgetId, options = {}) {
  if (typeof action !== "string" || !action) return false;
  const role = await getRoomRole(userId, roomId, { ...options, action, widgetId });
  // Authorization is asserted by the API response's 'allowed' flag;
  // getRoomRole already returns null when the operation is forbidden.
  return !!role;
}

module.exports = { serviceOrigin, getRoomRole, checkRoomMembership, checkRoomAction, MembershipAuthorityError };
