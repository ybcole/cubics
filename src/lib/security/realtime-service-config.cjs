"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash, randomBytes } = require("node:crypto");

function serviceOrigin(env = process.env) {
  const supplied = env.CUBICS_INTERNAL_API_ORIGIN ||
    (env.NODE_ENV !== "production" ? "http://127.0.0.1:3000" : null);
  if (!supplied) throw new Error("CUBICS_INTERNAL_API_ORIGIN must be configured");
  const url = new URL(supplied);
  if (url.username || url.password || url.search || url.hash ||
      (url.pathname !== "/" && url.pathname !== "")) throw new Error("Internal API must be a bare origin");
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local && env.NODE_ENV !== "production"))
    throw new Error("Internal membership API requires HTTPS");
  return url.origin;
}

// Server processes in the same checkout share one random local credential.
// It is neither a cloud secret nor a browser credential. Nothing is written
// into the repository, renderer, packaged app or collaborative state.
function realtimeServiceToken(env = process.env, { cwd = process.cwd(), tempRoot = os.tmpdir() } = {}) {
  const configured = env.CUBICS_REALTIME_SERVICE_TOKEN;
  if (configured !== undefined) {
    if (typeof configured !== "string" || Buffer.byteLength(configured) < 32)
      throw new Error("CUBICS_REALTIME_SERVICE_TOKEN must contain at least 32 bytes");
    return configured;
  }
  const origin = new URL(serviceOrigin(env));
  if (env.NODE_ENV === "production" || !["127.0.0.1", "localhost"].includes(origin.hostname))
    throw new Error("Configure CUBICS_REALTIME_SERVICE_TOKEN on both API and realtime servers");
  const uid = process.getuid?.();
  const key = createHash("sha256").update(path.resolve(cwd)).digest("hex").slice(0, 32);
  const dir = path.join(tempRoot, `cubics-realtime-${uid ?? "local"}-${key}`);
  fs.mkdirSync(dir, { mode: 0o700, recursive: true });
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      (uid !== undefined && (stat.uid !== uid || (stat.mode & 0o077) !== 0)))
    throw new Error("Unsafe local realtime credential directory");
  const file = path.join(dir, "service-token");
  if (!fs.existsSync(file)) {
    const pending = path.join(dir, randomBytes(12).toString("hex") + ".pending");
    try {
      fs.writeFileSync(pending, randomBytes(32).toString("base64url"), { flag: "wx", mode: 0o600 });
      // Publish only a complete credential; concurrent processes reuse the winner.
      try { fs.linkSync(pending, file); } catch (error) { if (error.code !== "EEXIST") throw error; }
    } finally { fs.rmSync(pending, { force: true }); }
  }
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error("Unsafe local realtime credential file");
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const meta = fs.fstatSync(fd);
    if (!meta.isFile() || meta.size !== 43 ||
        (uid !== undefined && (meta.uid !== uid || (meta.mode & 0o077) !== 0)))
      throw new Error("Unsafe local realtime credential file");
    const token = fs.readFileSync(fd, "utf8");
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Invalid local realtime credential");
    return token;
  } finally { fs.closeSync(fd); }
}

module.exports = { serviceOrigin, realtimeServiceToken };
