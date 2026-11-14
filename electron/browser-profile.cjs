"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { partitionForVerifiedAccount } = require("./security-policy.cjs");

// Not an authentication token or encryption key. This device-local random
// installation marker only namespaces opaque profile IDs for support/export;
// its contents and the derived ID must never be synced to room metadata.
const DEVICE_MARKER = "browser-device-id";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function getOrCreateBrowserDeviceId(userDataPath) {
  if (typeof userDataPath !== "string" || !path.isAbsolute(userDataPath)) {
    throw new TypeError("Absolute userData directory required");
  }
  fs.mkdirSync(userDataPath, { recursive: true, mode: 0o700 });
  const target = path.join(userDataPath, DEVICE_MARKER);
  try {
    // Atomic create protects concurrent app startups from replacing identity.
    fs.writeFileSync(target, crypto.randomUUID() + "\n", {
      flag: "wx", mode: 0o600, encoding: "utf8",
    });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 80) {
    throw new Error("Browser device marker is not a regular file");
  }
  const id = fs.readFileSync(target, "utf8").trim();
  if (!UUID.test(id)) throw new Error("Browser device marker is invalid");
  return id;
}

function browserProfileDescriptor(deviceId, userId, kind, widgetId = null) {
  if (!UUID.test(deviceId)) throw new TypeError("Invalid browser device marker");
  // Use exactly the same scope validation as the partition issuer.
  partitionForVerifiedAccount(userId, kind, widgetId);
  const scope = kind === "personal" ? null : widgetId;
  const digest = crypto.createHash("sha256")
    .update(JSON.stringify(["cubics-browser-profile-v1", deviceId, userId, kind, scope]))
    .digest("hex");
  return Object.freeze({
    schemaVersion: 1,
    profileId: "bp1_" + digest.slice(0, 40),
    kind,
    persistence: kind === "shared" ? "temporary" : "persistent",
    deviceLocal: true,
    containsBrowsingData: false,
  });
}

module.exports = { getOrCreateBrowserDeviceId, browserProfileDescriptor };
