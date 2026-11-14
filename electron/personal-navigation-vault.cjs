"use strict";

// M05 device-local encrypted URL vault. Only the Electron main process may
// construct this class. No unencrypted fallback: Linux basic_text is denied.
const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ID = /^[a-zA-Z0-9_-]{3,128}$/;
function scopeDigest(scope) {
  if (!scope || ![scope.userId, scope.roomId, scope.widgetId].every(
    id => typeof id === "string" && ID.test(id)
  )) throw new TypeError("Invalid Personal navigation scope");
  return createHash("sha256").update(JSON.stringify([
    "cubics-personal-navigation-v1", scope.userId, scope.roomId, scope.widgetId,
  ])).digest("hex");
}
async function protectedVaultAvailable(storage, platform = process.platform) {
  // Electron 45's async OS provider is preferred; deprecated sync
  // isEncryptionAvailable is deliberately not used.
  if (!storage || typeof storage.isAsyncEncryptionAvailable !== "function" ||
      typeof storage.encryptStringAsync !== "function" ||
      typeof storage.decryptStringAsync !== "function") return false;
  if (platform === "linux" &&
      (typeof storage.getSelectedStorageBackend !== "function" ||
       ["basic_text", "unknown"].includes(storage.getSelectedStorageBackend()))) return false;
  try { return await storage.isAsyncEncryptionAvailable() === true; }
  catch { return false; }
}
class PersonalNavigationVault {
  constructor(userData, storage, platform = process.platform) {
    if (typeof userData !== "string" || !path.isAbsolute(userData))
      throw new TypeError("Absolute userData directory required");
    this.root = path.join(userData, "personal-navigation-v1");
    this.storage = storage;
    this.platform = platform;
  }
  async assertProtected() {
    if (!await protectedVaultAvailable(this.storage, this.platform))
      throw new Error("OS-protected navigation storage is unavailable");
  }
  async ensureRoot() {
    await fs.promises.mkdir(this.root, { recursive: true, mode: 0o700 });
    const stat = await fs.promises.lstat(this.root);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("Untrusted navigation storage directory");
    if (this.platform !== "win32") await fs.promises.chmod(this.root, 0o700);
  }
  file(scope) {
    return path.join(this.root, scopeDigest(scope) + ".bin");
  }
  async read(scope, skipRotation = false) {
    await this.assertProtected();
    await this.ensureRoot();
    const digest = scopeDigest(scope), target = this.file(scope);
    let fh;
    try { fh = await fs.promises.open(target, "r"); }
    catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
    try {
      const stat = await fh.stat();
      if (!stat.isFile() || stat.size < 1 || stat.size > 64_000)
        throw new Error("Invalid navigation record");
      const data = await fh.readFile();
      const decrypted = await this.storage.decryptStringAsync(data);
      const parsed = JSON.parse(decrypted.result);
      if (!parsed || parsed.version !== 1 || parsed.digest !== digest ||
          typeof parsed.url !== "string" || parsed.url.length > 4096)
        throw new Error("Invalid navigation record scope");
      if (decrypted.shouldReEncrypt && !skipRotation) await this.write(scope, parsed.url);
      return parsed.url;
    } finally { await fh.close(); }
  }
  async write(scope, url) {
    await this.assertProtected();
    if (typeof url !== "string" || !url || url.length > 4096)
      throw new TypeError("Invalid Personal URL");
    const digest = scopeDigest(scope);
    await this.ensureRoot();
    const encrypted = await this.storage.encryptStringAsync(
      JSON.stringify({ version: 1, digest, url })
    );
    if (!Buffer.isBuffer(encrypted) || encrypted.length < 1 || encrypted.length > 64_000)
      throw new Error("Invalid OS-encrypted navigation payload");
    const target = this.file(scope), temp = target + "." + randomUUID() + ".tmp";
    let handle;
    try {
      handle = await fs.promises.open(temp, "wx", 0o600);
      await handle.writeFile(encrypted);
      await handle.sync();
      await handle.close();
      handle = null;
      // Refuse to replace a symlink or non-regular record.
      const existing = await fs.promises.lstat(target).catch(err => {
        if (err.code === "ENOENT") return null;
        throw err;
      });
      if (existing && (!existing.isFile() || existing.isSymbolicLink()))
        throw new Error("Untrusted existing navigation record");
      await fs.promises.rename(temp, target);
      if (this.platform !== "win32") await fs.promises.chmod(target, 0o600);
      // Best-effort directory durability; Windows may not allow sync on dirs.
      try {
        const dir = await fs.promises.open(this.root, "r");
        try { await dir.sync(); } finally { await dir.close(); }
      } catch { /* sync already completed for encrypted file */ }
    } finally {
      if (handle) await handle.close().catch(() => {});
      await fs.promises.unlink(temp).catch(err => {
        if (err.code !== "ENOENT") throw err;
      });
    }
    // A read-after-write verifies both OS unwrap and scope integrity.
    const checked = await this.read(scope, true);
    if (checked !== url) throw new Error("Personal URL vault verification failed");
    return true;
  }
}
module.exports = { scopeDigest, protectedVaultAvailable, PersonalNavigationVault };
