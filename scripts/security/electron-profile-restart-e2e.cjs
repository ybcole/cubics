"use strict";
const http = require("node:http");
const path = require("node:path");
const { app, BrowserWindow, session } = require("electron");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeoutMs = 18000) {
  const began = Date.now();
  while (Date.now() - began < timeoutMs) {
    const value = check();
    if (value) return value;
    await sleep(80);
  }
  throw new Error("M05 restart fixture timeout");
}
async function run() {
  if (!process.env.CUBICS_TEST_PROFILE) throw new Error("Missing shared test device profile");
  const server = http.createServer((req, res) => {
    if (req.url === "/v1/identity") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ userId: "user_test", protocolVersion: 1 }));
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<!DOCTYPE html><title>Restart profile fixture</title>");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject); server.listen(0, "127.0.0.1", resolve);
  });
  const origin = "http://127.0.0.1:" + server.address().port;
  process.env.CUBICS_SERVER_URL = origin;
  process.env.CUBICS_PROFILE = process.env.CUBICS_TEST_PROFILE;
  require(path.resolve(__dirname, "../../electron/main.js"));
  await app.whenReady();
  const win = await until(() => BrowserWindow.getAllWindows().find(w => w.getTitle() === "Cubics"));
  await until(() => win.webContents.getURL().startsWith(origin) && !win.webContents.isLoadingMainFrame());
  const personal = await win.webContents.executeJavaScript(
    'window.cubics.getBrowserPartition("personal",null,"user_test")');
  const live = await win.webContents.executeJavaScript(
    'window.cubics.getBrowserPartition("tab","widget_test","user_test")');
  const shared = await win.webContents.executeJavaScript(
    'window.cubics.getBrowserPartition("shared","widget_test","user_test")');
  const info = await win.webContents.executeJavaScript(
    'window.cubics.getBrowserProfileInfo("personal",null,"user_test")');
  const p = session.fromPartition(personal);
  const l = session.fromPartition(live);
  const s = session.fromPartition(shared);
  const values = async (ses, name) => (await ses.cookies.get({ url: origin, name }))
    .map(cookie => cookie.value);
  const saved = await values(p, "m05_profile_id");
  if (saved.length !== 1 || saved[0] !== info.profileId) {
    throw new Error("M05 opaque profile ID changed after restart");
  }
  if ((await values(p, "m05_personal")).join() !== "owner-only" ||
      (await values(l, "m05_live")).join() !== "live-only") {
    throw new Error("M05 persisted Personal/Live cookies were lost on restart");
  }
  if ((await values(s, "m05_ephemeral")).length !== 0 ||
      (await values(s, "m05_personal")).length !== 0 ||
      (await values(p, "m05_live")).length !== 0 ||
      (await values(l, "m05_personal")).length !== 0) {
    throw new Error("M05 cross-mode or temporary Shared cookie leaked across restart");
  }
  const deviceOnly = await win.webContents.executeJavaScript(
    'window.cubics.getBrowserPartition("personal",null,"user_other").then(()=>false,()=>true)');
  if (!deviceOnly) throw new Error("M05 second account forged profile after restart");
  console.log("M05_RESTART_E2E_PASS: stable profile IDs, persistent Personal/Live cookies, ephemeral Shared, cross-account denial");
  server.close();
  process.exit(0);
}
run().catch(error => {
  console.error("M05_RESTART_E2E_FAIL:", error?.stack || String(error));
  process.exit(1);
});
