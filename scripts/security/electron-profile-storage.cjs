"use strict";

// Native test-only Chromium profile storage probe. Never import into the app.
// Each hidden window uses the exact Electron Session partition being tested.
const { BrowserWindow } = require("electron");

function serveProfileFixture(req, res) {
  if (req.url === "/profile/sw.js") {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/profile/",
    });
    res.end('self.addEventListener("install", () => self.skipWaiting());' +
      'self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));');
    return true;
  }
  if (req.url?.startsWith("/profile/")) {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end("<!doctype html><html><title>M05 profile storage fixture</title>" +
      "<body>Chromium profile isolation probe</body></html>");
    return true;
  }
  return false;
}
async function openProfileProbe(partition, origin) {
  const win = new BrowserWindow({
    show: false,
    width: 320, height: 200,
    webPreferences: {
      partition, sandbox: true, contextIsolation: true, nodeIntegration: false,
      webSecurity: true, allowRunningInsecureContent: false, webviewTag: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  await win.loadURL(origin + "/profile/index");
  const prefs = win.webContents.getLastWebPreferences();
  if (!prefs.sandbox || !prefs.contextIsolation || prefs.nodeIntegration ||
      win.webContents.session.isPersistent() !== partition.startsWith("persist:")) {
    throw new Error("M05 unsafe or mismatched native profile probe");
  }
  return win;
}
// This code executes only inside a sandboxed browser frame, not Node.
async function pageReadStorage() {
  const local = localStorage.getItem("cubics_m05_probe");
  const db = await new Promise((resolve, reject) => {
    const open = indexedDB.open("cubics_m05_partition_db", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => resolve(open.result);
  });
  const indexed = await new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly");
    const get = tx.objectStore("kv").get("probe");
    get.onsuccess = () => resolve(get.result ?? null);
    get.onerror = () => reject(get.error);
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  const cache = await caches.open("cubics-m05-cache");
  const cached = await cache.match(location.origin + "/profile/cache-data");
  const cacheValue = cached ? await cached.text() : null;
  const registrations = await navigator.serviceWorker.getRegistrations();
  return { local, indexed, cache: cacheValue, serviceWorkers: registrations.length };
}
async function pageWriteStorage(value) {
  localStorage.setItem("cubics_m05_probe", value);
  const db = await new Promise((resolve, reject) => {
    const open = indexedDB.open("cubics_m05_partition_db", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => resolve(open.result);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, "probe");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  const cache = await caches.open("cubics-m05-cache");
  await cache.put(location.origin + "/profile/cache-data", new Response(value));
  if (!("serviceWorker" in navigator)) throw Error("Service Workers unsupported");
  await navigator.serviceWorker.register("/profile/sw.js", { scope: "/profile/" });
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(Error("Service Worker activation timeout")), 12000)),
  ]);
  return true;
}
async function readProfileStorage(win) {
  return win.webContents.executeJavaScript("(" + pageReadStorage.toString() + ")()", true);
}
async function writeProfileStorage(win, value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{3,50}$/.test(value)) {
    throw new Error("Invalid profile test marker");
  }
  await win.webContents.executeJavaScript("(" + pageWriteStorage.toString() + ")(" +
    JSON.stringify(value) + ")", true);
  assertProfileStorage(await readProfileStorage(win), value, "seed");
}
function assertProfileStorage(actual, expected, context) {
  if (!actual || typeof actual !== "object") {
    throw new Error("M05 " + context + ": missing storage result");
  }
  if (expected === null) {
    if (actual.local !== null || actual.indexed !== null || actual.cache !== null ||
        actual.serviceWorkers !== 0) {
      throw new Error("M05 " + context + ": cross-profile data: " + JSON.stringify(actual));
    }
  } else if (actual.local !== expected || actual.indexed !== expected ||
      actual.cache !== expected || actual.serviceWorkers < 1) {
    throw new Error("M05 " + context + ": storage mismatch: " + JSON.stringify(actual));
  }
}
async function closeProfileProbes(...wins) {
  for (const win of wins) if (win && !win.isDestroyed()) win.destroy();
}
module.exports = { serveProfileFixture, openProfileProbe, readProfileStorage,
  writeProfileStorage, assertProfileStorage, closeProfileProbes };
