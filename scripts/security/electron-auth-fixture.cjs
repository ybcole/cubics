"use strict";
const assert = require("node:assert/strict");

function serveAuthFixture(req, res, origin) {
  const url = new URL(req.url, origin);
  if (!url.pathname.startsWith("/auth/")) return false;
  if (url.pathname === "/auth/provider") {
    res.writeHead(302, { Location: origin + "/auth/callback" });
    res.end();
  } else if (url.pathname === "/auth/callback") {
    res.writeHead(200, { "Content-Type": "text/html", "Set-Cookie": "auth_fixture=complete; SameSite=Lax; Path=/" });
    res.end(`<script>window.opener.postMessage({tag:'cubics-auth-fixture'},${JSON.stringify(origin)}); window.close();</script>`);
  } else if (url.pathname === "/auth/post") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<script>window.opener.postMessage({tag:'cubics-post-fixture',method:${JSON.stringify(req.method)},body:${JSON.stringify(body)}},${JSON.stringify(origin)}); window.close();</script>`);
    });
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<!doctype html><title>Login fixture</title><body>Login fixture</body>");
  }
  return true;
}

async function testAuthPopups({ guest, BrowserWindow, origin, until, isolatedSession }) {
  await guest.loadURL(origin + "/auth/start");
  await guest.executeJavaScript(`window.authMessages=[]; addEventListener('message',event=>{
    if(event.origin===location.origin) window.authMessages.push(event.data);
  });`);
  const baseline = new Set(BrowserWindow.getAllWindows());
  const popup = () => BrowserWindow.getAllWindows().find(w => !baseline.has(w));
  // A blank bootstrap must return a real WindowProxy even without allowpopups.
  assert.equal(await guest.executeJavaScript("window.login=window.open('', 'cubics-login'); !!window.login", true), true);
  const blank = await until(popup);
  assert.equal(blank.webContents.session, guest.session);
  const prefs = blank.webContents.getLastWebPreferences();
  assert.ok(prefs.sandbox && prefs.contextIsolation && !prefs.nodeIntegration && !prefs.webviewTag);
  assert.equal(await blank.webContents.executeJavaScript("({opener:!!window.opener,node:typeof require,bridge:!!window.cubics})").then(v => v.opener && v.node === "undefined" && !v.bridge), true);
  // Named window reuse must not create another child or lose the opener.
  assert.equal(await guest.executeJavaScript("window.login===window.open('', 'cubics-login')", true), true);
  assert.equal(BrowserWindow.getAllWindows().filter(w => !baseline.has(w)).length, 1);
  // Cross-origin provider redirect returns via native postMessage + window.close.
  const provider = origin.replace("127.0.0.1", "localhost") + "/auth/provider";
  await guest.executeJavaScript(`window.login.location=${JSON.stringify(provider)};`);
  await until(() => blank.isDestroyed());
  assert.ok(await guest.executeJavaScript("window.authMessages.some(x=>x.tag==='cubics-auth-fixture')"));
  assert.equal((await guest.session.cookies.get({ url: origin, name: "auth_fixture" }))[0]?.value, "complete");
  assert.equal((await isolatedSession.cookies.get({ url: origin, name: "auth_fixture" })).length, 0);

  // Native creation must preserve form-target POST rather than replay a GET.
  await guest.executeJavaScript(`(()=>{
    const f=document.createElement('form'); f.id='auth-post-form'; f.method='POST';
    f.action='/auth/post'; f.target='cubics-post-login';
    const input=document.createElement('input'); input.name='state'; input.value='fixture+state';
    f.append(input); document.body.append(f); f.submit();
  })()`, true);
  // until takes synchronous predicates; query the renderer with a bounded loop.
  let posted;
  for (let i = 0; i < 100 && !posted; i++) {
    posted = await guest.executeJavaScript("window.authMessages.find(x=>x.tag==='cubics-post-fixture')");
    if (!posted) await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(posted?.method, "POST");
  assert.equal(posted?.body, "state=fixture%2Bstate");
  await guest.executeJavaScript("document.getElementById('auth-post-form').remove()");
  await until(() => BrowserWindow.getAllWindows().every(w => baseline.has(w)));

  await guest.executeJavaScript("void window.open('/auth/keep', 'cubics-parent', 'width=520,height=720')", true);
  const parent = await until(popup);
  await until(() => !parent.webContents.isLoadingMainFrame());
  assert.equal(await parent.webContents.executeJavaScript("!!window.open('/auth/nested', 'cubics-nested', 'width=500,height=700')", true), true);
  const nested = await until(() => BrowserWindow.getAllWindows().find(w => !baseline.has(w) && w !== parent));
  assert.equal(nested.webContents.session, guest.session);
  // Leave both alive so the caller proves account switch revokes the chain.
  return { parent, nested };
}

module.exports = { serveAuthFixture, testAuthPopups };
