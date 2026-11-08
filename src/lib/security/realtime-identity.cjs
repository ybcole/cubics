"use strict";

const { createPublicKey, verify: verifySignature } = require("node:crypto");

const CLOCK_SKEW_SECONDS = 5;
const MAX_JWT_BYTES = 8192;
const JWKS_CACHE_MS = 10 * 60 * 1000;

function clerkIssuer(env = process.env) {
  let candidate = env.CLERK_ISSUER;
  if (!candidate) {
    const pub = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
    const match = /^pk_(?:test|live)_([A-Za-z0-9_=-]+)$/.exec(pub);
    if (!match) throw new Error("Set CLERK_ISSUER or a valid NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    const host = Buffer.from(match[1], "base64url").toString("utf8").split("$")[0];
    candidate = "https://" + host;
  }
  const u = new URL(candidate);
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || u.pathname !== "/") {
    throw new Error("Clerk issuer must be an HTTPS origin");
  }
  return u.origin;
}

function allowedSocketOrigins(env = process.env) {
  const origins = (env.CUBICS_SOCKET_ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",").map(x => x.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => {
    try {
      const u = new URL(origin);
      return !["https:", "http:"].includes(u.protocol) || u.origin !== origin || origin.includes("*");
    } catch { return true; }
  })) throw new Error("Configure exact CUBICS_SOCKET_ALLOWED_ORIGINS");
  if (env.NODE_ENV === "production" && origins.some(origin =>
    origin.startsWith("http:") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  )) throw new Error("Production remote socket origins must use HTTPS");
  return origins;
}

function decodeSegment(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("Malformed JWT segment");
  const data = Buffer.from(segment, "base64url");
  if (data.length > MAX_JWT_BYTES) throw new Error("JWT segment too large");
  return JSON.parse(data.toString("utf8"));
}

function createTokenVerifier({ issuer, authorizedParties, loadJwks, jwtKey, now = () => Date.now() } = {}) {
  if (typeof issuer !== "string" || !issuer.startsWith("https://")) throw new Error("Trusted issuer required");
  if (!Array.isArray(authorizedParties) || !authorizedParties.length) throw new Error("Authorized origins required");
  const allowed = new Set(authorizedParties);
  let cachedKeys = null, cacheUntil = 0, pending = null;

  const fetchJwks = async () => {
    if (loadJwks) return loadJwks();
    const response = await fetch(issuer + "/.well-known/jwks.json", {
      redirect: "error", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok || Number(response.headers.get("content-length") || "0") > 100000) throw new Error("JWKS unavailable");
    const body = await response.text();
    if (body.length > 100000) throw new Error("JWKS too large");
    return JSON.parse(body).keys;
  };
  async function publicKeys() {
    if (cachedKeys && now() < cacheUntil) return cachedKeys;
    if (!pending) {
      pending = Promise.resolve().then(fetchJwks).then(keys => {
        if (!Array.isArray(keys) || !keys.length || keys.length > 32) throw new Error("Malformed JWKS");
        cachedKeys = keys; cacheUntil = now() + JWKS_CACHE_MS;
        return keys;
      }).finally(() => { pending = null; });
    }
    return pending;
  }

  return async function verifySessionToken(token) {
    if (typeof token !== "string" || !token || token.length > MAX_JWT_BYTES) throw new Error("Session token missing or oversized");
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Malformed JWT");
    const [header64, payload64, signature64] = parts;
    const header = decodeSegment(header64);
    const payload = decodeSegment(payload64);
    if (header.alg !== "RS256" || (header.typ && header.typ !== "JWT")) throw new Error("Unexpected signing algorithm");
    const key = jwtKey
      ? createPublicKey(jwtKey)
      : createPublicKey({
        key: (await publicKeys()).find(item => item.kid === header.kid && item.kty === "RSA" &&
          (!item.alg || item.alg === "RS256") && (!item.use || item.use === "sig")) ||
          (() => { throw new Error("Unknown signing key"); })(),
        format: "jwk",
      });
    const signature = Buffer.from(signature64, "base64url");
    if (!signature.length || !verifySignature("RSA-SHA256", Buffer.from(header64 + "." + payload64), key, signature)) {
      throw new Error("Invalid session signature");
    }
    const seconds = Math.floor(now() / 1000);
    if (payload.iss !== issuer || typeof payload.sub !== "string" || !payload.sub ||
      typeof payload.sid !== "string" || !payload.sid ||
      typeof payload.exp !== "number" || payload.exp <= seconds - CLOCK_SKEW_SECONDS ||
      typeof payload.iat !== "number" || payload.iat > seconds + CLOCK_SKEW_SECONDS ||
      (payload.nbf !== undefined && (typeof payload.nbf !== "number" || payload.nbf > seconds + CLOCK_SKEW_SECONDS)) ||
      typeof payload.azp !== "string" || !allowed.has(payload.azp)) {
      throw new Error("Invalid session claims");
    }
    return { userId: payload.sub, sessionId: payload.sid, expiresAt: payload.exp };
  };
}

function createProductionVerifier(env = process.env) {
  return createTokenVerifier({
    issuer: clerkIssuer(env),
    authorizedParties: allowedSocketOrigins(env),
    jwtKey: env.CLERK_JWT_KEY || undefined,
  });
}

module.exports = { clerkIssuer, allowedSocketOrigins, createTokenVerifier, createProductionVerifier };
