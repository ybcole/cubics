const { validateClerkEnv } = require("./scripts/validate-clerk-env");

// Fail before Clerk starts a session handshake with unusable local keys.
validateClerkEnv(process.env);

  // M04: enforce host-app CSP. Next/Clerk currently require inline hydration
  // scripts and inline style; this exception must be removed with nonce
  // injection and a tested deployment in M21. Never strip external site CSP.
  const isDev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https:",
    "script-src 'self' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev" +
      (isDev ? " 'unsafe-eval' http://localhost:* http://127.0.0.1:*" : ""),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "connect-src 'self' https: wss:" +
      (isDev ? " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*" : ""),
    "frame-src 'self' https: about:" +
      (isDev ? " http://localhost:* http://127.0.0.1:*" : ""),
  ].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;