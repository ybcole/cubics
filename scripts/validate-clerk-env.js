"use strict";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Fail before Clerk starts its session handshake when the local environment
 * cannot authenticate successfully. Same-type keys from different instances
 * cannot be identified offline; those must be checked in the Clerk Dashboard.
 */
function validateClerkEnv(env) {
  const publishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secretKey = env.CLERK_SECRET_KEY?.trim();

  if (!publishableKey || !secretKey) {
    throw new Error(
      "[Cubics auth] Missing Clerk keys. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY from the same Clerk instance in .env."
    );
  }

  const publishableMatch = /^pk_(test|live)_([^\s]+)$/.exec(publishableKey);
  const secretMatch = /^sk_(test|live)_([^\s]+)$/.exec(secretKey);
  if (
    !publishableMatch ||
    !secretMatch ||
    publishableMatch[2].includes("...") ||
    secretMatch[2].includes("...")
  ) {
    throw new Error(
      "[Cubics auth] Invalid or placeholder Clerk keys. Copy the complete publishable and secret keys from the Clerk Dashboard."
    );
  }

  if (publishableMatch[1] !== secretMatch[1]) {
    throw new Error(
      "[Cubics auth] Clerk key environments differ (test vs live). Copy both keys from the same Clerk instance."
    );
  }

  let siteHost = "localhost";
  if (env.NEXT_PUBLIC_SITE_URL) {
    try {
      siteHost = new URL(env.NEXT_PUBLIC_SITE_URL).hostname.toLowerCase();
    } catch {
      throw new Error("[Cubics auth] NEXT_PUBLIC_SITE_URL must be a valid absolute URL.");
    }
  }

  // The Electron renderer runs at localhost, even for packaged builds.
  // Clerk production keys require a configured production HTTPS domain.
  if (
    publishableMatch[1] === "live" &&
    (env.NODE_ENV === "development" || LOOPBACK_HOSTS.has(siteHost))
  ) {
    throw new Error(
      "[Cubics auth] Clerk production keys cannot be used on localhost. Use pk_test_ and sk_test_ from the same development instance for the Electron app."
    );
  }
}

module.exports = { validateClerkEnv };
