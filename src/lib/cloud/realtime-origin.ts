/** M02: realtime is a public WSS/HTTPS service, not localhost on an
 * installed user's machine. Missing hosted config must fail closed. */
export function resolveRealtimeOrigin(configured = process.env.NEXT_PUBLIC_SOCKET_URL): string {
  const raw = configured ||
    (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:3001" : "");
  if (!raw) throw new Error("Production Cubics realtime URL is not configured");
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
    (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("Realtime URL must be an origin, without credentials or path");
  }
  if (process.env.NODE_ENV === "production") {
    if (!["wss:", "https:"].includes(url.protocol)) {
      throw new Error("Production realtime service requires WSS or HTTPS");
    }
  } else if (!["wss:", "https:"].includes(url.protocol) &&
    !(["ws:", "http:"].includes(url.protocol) && local)) {
    throw new Error("Development realtime URL must be encrypted or loopback");
  }
  return url.origin;
}
