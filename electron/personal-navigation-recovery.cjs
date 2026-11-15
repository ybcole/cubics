"use strict";

// Portable recovery is deliberately separate from Electron's device-bound
// safeStorage key. A user-chosen passphrase protects the offline file.
const { randomBytes, createCipheriv, createDecipheriv, scrypt } = require("node:crypto");
const { promisify } = require("node:util");
const { scopeDigest } = require("./personal-navigation-vault.cjs");
const derive = promisify(scrypt);
const FORMAT = "cubics-personal-url-recovery";
const AAD = Buffer.from("cubics-personal-url-recovery-v1");
const WORK = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function checkPassphrase(value) {
  if (typeof value !== "string" || value.length < 16 || value.length > 512)
    throw new TypeError("Recovery passphrase must contain 16 to 512 characters");
}
function decode(value, expected = null, max = 8192) {
  if (typeof value !== "string" || value.length > Math.ceil(max / 3) * 4 + 4 ||
      !B64.test(value)) throw new Error("Invalid recovery file");
  const decoded = Buffer.from(value, "base64");
  if (!decoded.length || decoded.length > max || (expected !== null && decoded.length !== expected))
    throw new Error("Invalid recovery file");
  return decoded;
}
function validUrl(url) {
  if (typeof url !== "string" || url.length > 4096 || !url.length)
    throw new Error("Invalid saved navigation");
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error("Invalid saved navigation");
  return url;
}
async function createRecoveryBundle(scope, url, passphrase) {
  checkPassphrase(passphrase);
  validUrl(url);
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = await derive(passphrase, salt, 32, WORK);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(AAD);
    const plaintext = JSON.stringify({ scope: scopeDigest(scope), url });
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return Buffer.from(JSON.stringify({
      format: FORMAT, version: 1, kdf: "scrypt-N32768-r8-p1", cipher: "aes-256-gcm",
      salt: salt.toString("base64"), iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64"),
    }) + "\n", "utf8");
  } finally { key.fill(0); }
}
async function openRecoveryBundle(scope, file, passphrase) {
  checkPassphrase(passphrase);
  if (!Buffer.isBuffer(file) || file.length < 80 || file.length > 24_000)
    throw new Error("Invalid recovery file");
  let bundle;
  try { bundle = JSON.parse(file.toString("utf8")); }
  catch { throw new Error("Invalid recovery file"); }
  if (!bundle || bundle.format !== FORMAT || bundle.version !== 1 ||
      bundle.kdf !== "scrypt-N32768-r8-p1" || bundle.cipher !== "aes-256-gcm")
    throw new Error("Unsupported recovery file");
  const salt = decode(bundle.salt, 16), iv = decode(bundle.iv, 12);
  const tag = decode(bundle.tag, 16), ciphertext = decode(bundle.data, null, 8192);
  const key = await derive(passphrase, salt, 32, WORK);
  let decoded;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    decoded = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch { throw new Error("Invalid recovery passphrase or file"); }
  finally { key.fill(0); }
  let payload;
  try { payload = JSON.parse(decoded); }
  catch { throw new Error("Invalid recovery file"); }
  if (!payload || payload.scope !== scopeDigest(scope))
    throw new Error("Recovery file belongs to a different Personal tab or account");
  return validUrl(payload.url);
}
module.exports = { createRecoveryBundle, openRecoveryBundle };
