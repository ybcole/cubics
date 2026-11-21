"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { isLoginPopup, isAuthTarget, isAuthContinuation, createGuestPopupManager } = require("../../electron/guest-popups.cjs");

test("M04.04 only validated guests receive main-owned popup dispatch", () => {
  const main = fs.readFileSync(path.join(__dirname, "../../electron/main.js"), "utf8");
  const attach = main.slice(main.indexOf('on("will-attach-webview"'), main.indexOf('on("did-attach-webview"'));
  assert.match(attach, /checkGuestAttach\(params, isDev, issuedGuestPartitions\)/);
  assert.match(attach, /delete params\.allowpopups/);
  assert.match(attach, /preferences\.disablePopups = false/);
  assert.ok(attach.indexOf("checkGuestAttach") < attach.indexOf("preferences.disablePopups = false"));
});

class Contents extends EventEmitter {
  constructor(session = {}) { super(); this.session = session; this.dead = false; this.reloads = 0; }
  setWindowOpenHandler(handler) { this.open = handler; }
  isDestroyed() { return this.dead; }
  getURL() { return "https://example.com/"; }
  reload() { this.reloads += 1; }
  destroy() { this.dead = true; this.emit("destroyed"); }
}
class Window extends EventEmitter {
  constructor(options) { super(); this.options = options; this.webContents = new Contents(options.webPreferences.session); }
  isDestroyed() { return this.webContents.isDestroyed(); }
  destroy() { this.webContents.destroy(); this.emit("closed"); }
}
function fixture(limits = {}) {
  let allowed = true;
  const root = new Contents(), canvas = [];
  const windows = [];
  class TrackedWindow extends Window { constructor(options) { super(options); windows.push(this); } }
  const manager = createGuestPopupManager({ BrowserWindow: TrackedWindow,
    parentWindow: () => null, isAllowedRoot: () => allowed,
    openCanvasTab: (_root, url) => canvas.push(url), ...limits });
  manager.install(root);
  return { root, manager, canvas, windows, revoke: () => { allowed = false; } };
}

test("M04.04 popup classification covers blanks and auth across dispositions; unsafe targets deny", () => {
  for (const disposition of ["default", "new-window", "foreground-tab", "background-tab", "other"]) {
    assert.ok(isLoginPopup({ url: "about:blank", disposition }));
    assert.ok(isLoginPopup({ url: "https://accounts.google.com/o/oauth2/v2/auth", disposition }));
    assert.ok(isLoginPopup({ url: "https://claude.ai/api/auth/login", disposition }));
    for (const url of ["javascript:alert(1)", "file:///tmp/test", "data:text/html,test", "http://evil.example", "https://u:p@example.com/"])
      assert.equal(isLoginPopup({ url, disposition }), false);
  }
  assert.equal(isLoginPopup({ url: "https://example.com/article", disposition: "foreground-tab" }), false);
  assert.equal(isLoginPopup({ url: "https://accounts.google.com.evil.test/article", disposition: "foreground-tab" }), false);
  assert.ok(isLoginPopup({ url: "https://accounts.google.com/o/oauth2/auth?state=" + "x".repeat(3000) }));
  assert.equal(isLoginPopup({ url: "https://accounts.google.com/?state=" + "x".repeat(16384) }), false);
});
test("M04.04 createWindow preserves native options while pinning session and privileges", () => {
  const f = fixture();
  const decision = f.root.open({ url: "about:blank", disposition: "foreground-tab" });
  assert.equal(decision.action, "allow");
  assert.equal(decision.outlivesOpener, false);
  assert.equal(decision.overrideBrowserWindowOptions.webPreferences.session, f.root.session);
  assert.equal(decision.overrideBrowserWindowOptions.webPreferences.sandbox, true);
  const child = decision.createWindow({ title: "Native child", webPreferences: {
    preload: "/evil.js", partition: "persist:default", session: {},
    nodeIntegration: true, sandbox: false, webviewTag: true, contextIsolation: false,
  } });
  const options = f.windows[0].options, prefs = options.webPreferences;
  assert.equal(options.title, "Native child");
  assert.equal(child.session, f.root.session);
  for (const key of ["sandbox", "contextIsolation", "webSecurity"]) assert.equal(prefs[key], true);
  for (const key of ["nodeIntegration", "nodeIntegrationInWorker", "nodeIntegrationInSubFrames", "webviewTag", "allowRunningInsecureContent"]) assert.equal(prefs[key], false);
  assert.equal(prefs.preload, undefined);
  assert.equal(prefs.partition, undefined);
  f.manager.closeAll();
  assert.ok(child.isDestroyed());
});
test("M04.04 nested popup budget, navigation guards, cleanup and revoked owner deny", () => {
  const f = fixture({ maxWindows: 2, maxDepth: 2 });
  const request = { url: "https://example.com/auth", disposition: "background-tab" };
  const child = f.root.open(request).createWindow({});
  const nested = child.open(request).createWindow({});
  assert.equal(nested.open(request).action, "deny");
  assert.equal(f.root.open(request).action, "deny");
  for (const event of ["will-navigate", "will-redirect"]) {
    let blocked = false;
    child.emit(event, { preventDefault: () => { blocked = true; } }, "file:///tmp/test");
    assert.ok(blocked);
  }
  f.windows[1].destroy();
  assert.equal(f.root.open(request).action, "allow");
  const pending = f.root.open(request);
  f.revoke();
  assert.equal(child.open(request).action, "deny");
  assert.throws(() => pending.createWindow({}), /owner/);
  f.manager.closeAll();
  assert.ok(child.isDestroyed());
});
test("M04.04 root destruction closes descendants; ordinary tab links stay on canvas", () => {
  const f = fixture();
  assert.equal(f.root.open({ url: "https://example.com/article", disposition: "foreground-tab" }).action, "deny");
  assert.deepEqual(f.canvas, ["https://example.com/article"]);
  const child = f.root.open({ url: "about:blank" }).createWindow({});
  f.root.destroy();
  assert.ok(child.isDestroyed());
});
test("M04.04 login windows return to the tab instead of lingering as a browser", () => {
  assert.equal(isAuthTarget("https://accounts.google.com/o/oauth2/v2/auth"), true);
  assert.equal(isAuthTarget("https://www.google.com/"), false);
  assert.equal(isAuthContinuation("https://accounts.google.com/v3/signin", "https://example.com"), true);
  assert.equal(isAuthContinuation("https://www.google.com/accounts/CheckCookie", "https://google.com"), true);
  assert.equal(isAuthContinuation("https://example.com/oauth/callback", "https://example.com"), true);
  assert.equal(isAuthContinuation("https://auth.example.com/sso", "https://app.example.com"), true);
  assert.equal(isAuthContinuation("https://www.google.com/", "https://google.com"), false);
  assert.equal(isAuthContinuation("https://myaccount.google.com/", "https://google.com"), false);
  assert.equal(isAuthContinuation("https://evil.test/article", "https://example.com"), false);
  assert.equal(isAuthContinuation("https://evil.co.uk/article", "https://app.co.uk"), false);
  assert.equal(isAuthContinuation("https://auth.app.co.uk/sso", "https://www.app.co.uk"), true);
  assert.equal(isAuthContinuation("javascript:alert(1)", "https://example.com"), false);

  const f = fixture();
  const child = f.root.open({
    url: "https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fwww.google.com%2F",
    disposition: "new-window",
  }).createWindow({});
  let blocked = false;
  child.emit("will-redirect", { preventDefault: () => { blocked = true; } }, "https://www.google.com/");
  assert.equal(blocked, true);
  assert.ok(child.isDestroyed());
  assert.equal(f.root.reloads, 1);
});
test("M04.04 login windows stay open for their callback and ordinary popups are unconfined", () => {
  const f = fixture();
  const callback = f.root.open({ url: "https://accounts.google.com/o/oauth2/v2/auth", disposition: "new-window" }).createWindow({});
  let blocked = false;
  callback.emit("will-navigate", { preventDefault: () => { blocked = true; } }, "https://example.com/oauth/callback");
  assert.equal(blocked, false);
  assert.equal(callback.isDestroyed(), false);

  const blank = f.root.open({ url: "about:blank", disposition: "new-window" }).createWindow({});
  blank.emit("will-navigate", { preventDefault: () => { blocked = true; } }, "https://accounts.google.com/ServiceLogin");
  blank.emit("will-redirect", { preventDefault: () => { blocked = true; } }, "https://www.google.com/");
  assert.equal(blocked, true);
  assert.ok(blank.isDestroyed());

  const ordinary = f.root.open({ url: "https://docs.google.com/document/d/abc", disposition: "new-window" }).createWindow({});
  let confined = false;
  ordinary.emit("will-navigate", { preventDefault: () => { confined = true; } }, "https://www.google.com/");
  assert.equal(confined, false);
  assert.equal(ordinary.isDestroyed(), false);
});
