"use strict";

/** Hosted service-to-service lookup. Fail closed if origin/token/db are missing,
 * if HTTPS validation fails, or if the authoritative API is unavailable.
 * Prisma is NOT imported into the standalone realtime service. */
function serviceOrigin(env = process.env) {
  const supplied = env.CUBICS_INTERNAL_API_ORIGIN;
  if (!supplied) throw new Error("CUBICS_INTERNAL_API_ORIGIN must be configured");
  const url = new URL(supplied);
  if (url.username || url.password || url.search || url.hash ||
    (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("Internal API must be a bare origin");
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" &&
      !(url.protocol === "http:" && local && env.NODE_ENV !== "production")) {
    throw new Error("Internal membership API requires HTTPS");
  }
  return url.origin;
}

async function getRoomRole(userId, roomId, { env = process.env, fetchImpl = fetch } = {}) {
  if (typeof userId !== "string" || typeof roomId !== "string" ||
      !userId || !roomId || userId.length > 128 || roomId.length > 128) return null;
  const token = env.CUBICS_REALTIME_SERVICE_TOKEN;
  if (!token || Buffer.byteLength(token) < 32) throw new Error("Missing internal realtime service credentials");
  const url = serviceOrigin(env) + "/api/internal/realtime/membership";
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cubics-Internal-Service-Token": token,
    },
    body: JSON.stringify({ userId, roomId }),
    redirect: "error",
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error("Authoritative room lookup failed");
  const payload = await response.json();
  return payload.allowed === true && ["OWNER", "ADMIN", "MEMBER"].includes(payload.role)
    ? payload.role : null;
}

async function checkRoomMembership(userId, roomId, options) {
  return !!(await getRoomRole(userId, roomId, options));
}

module.exports = { serviceOrigin, getRoomRole, checkRoomMembership };
