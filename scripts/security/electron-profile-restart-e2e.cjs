"use strict";
const http = require("node:http");
const path = require("node:path");
const { serveProfileFixture, openProfileProbe, readProfileStorage,
  assertProfileStorage, closeProfileProbes } = require("./electron-profile-storage.cjs");
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
    if (serveProfileFixture(req, res)) return;
    if (req.url === "/api/spaces/room_test/widgets/widget_test/personal-vault") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "private, no-store" });
      res.end(JSON.stringify({ legacyUrl: "https://private.example/legacy?token=test-secret" }));
      return;
    }
    if (req.url === "/v1/identity") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ userId: "user_test", protocolVersion: 1 }));
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<!DOCTYPE html><title>Restart profile fixture</title>");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject); server.listen(Number(process.env.CUBICS_TEST_PORT)||0, "127.0.0.1", resolve);
  });
  const origin = "http://127.0.0.1:" + server.address().port;
  process.env.CUBICS_SERVER_URL = origin;
  process.env.CUBICS_PROFILE = process.env.CUBICS_TEST_PROFILE;
  app.on("before-quit", () => console.error("M05_RESTART_PREMATURE_APP_QUIT"));
  require(path.resolve(__dirname, "../../electron/main.js"));
  console.log("M05_RESTART_FIXTURE_PID:" + process.pid);
  await app.whenReady();
  // On Linux the document <title> changes BrowserWindow.getTitle(), so the
  // app can be healthy even when the window's visible title is not "Cubics".
  // Identify our real trusted test origin rather than relying on window text.
  const win = await until(() => BrowserWindow.getAllWindows().find(w =>
    !w.isDestroyed() && w.webContents.getURL().startsWith(origin)));
  await until(() => win.webContents.getURL().startsWith(origin) && !win.webContents.isLoadingMainFrame());
  const vaultAvailable=await win.webContents.executeJavaScript(
    'window.cubics.personalVaultStatus("user_test")');
  if(vaultAvailable.available){
    const persisted=await win.webContents.executeJavaScript(
      'window.cubics.readPersonalNavigation("room_test","widget_test","user_test")');
    if(persisted.url!=="https://private.example/local?private=only" || persisted.imported)
      throw Error("M05 native OS-encrypted Personal vault lost its last local URL");
  }
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
  // The exact same localhost origin must be used in both test processes.
  const personalProbe=await openProfileProbe(personal,origin);
  const liveProbe=await openProfileProbe(live,origin);
  const sharedProbe=await openProfileProbe(shared,origin);
  const otherProbe=await openProfileProbe("persist:cubics-personal-user_other",origin);
  try{
    assertProfileStorage(await readProfileStorage(personalProbe),"personal_secret","Personal after restart");
    assertProfileStorage(await readProfileStorage(liveProbe),"live_secret","Live after restart");
    assertProfileStorage(await readProfileStorage(sharedProbe),null,"temporary Shared after restart");
    assertProfileStorage(await readProfileStorage(otherProbe),null,"other account after restart");
    if(personalProbe.webContents.navigationHistory.canGoBack() ||
       liveProbe.webContents.navigationHistory.canGoBack())
      throw Error("M05 new WebContents inherited previous back history");
  }finally{
    await closeProfileProbes(personalProbe,liveProbe,sharedProbe,otherProbe);
  }
  const deviceOnly = await win.webContents.executeJavaScript(
    'window.cubics.getBrowserPartition("personal",null,"user_other").then(()=>false,()=>true)');
  if (!deviceOnly) throw new Error("M05 second account forged profile after restart");
  console.log("M05_RESTART_E2E_PASS: stable IDs, cookies, localStorage, IndexedDB, CacheStorage, SW, isolated history and accounts");
  server.close();
  process.exit(0);
}
run().catch(error => {
  console.error("M05_RESTART_E2E_FAIL:", error?.stack || String(error));
  process.exit(1);
});
