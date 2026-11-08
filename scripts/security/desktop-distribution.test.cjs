"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { inspectDesktopStage } = require("../verify-desktop-distribution.cjs");
const { prepareDesktop } = require("../prepare-desktop-release.cjs");
const { normalizedAppOrigin, isAppUrl, isAuthUrl } = require("../../electron/app-origin.cjs");

test("production origin must be an exact remote HTTPS origin", () => {
  assert.equal(normalizedAppOrigin("https://app.cubics.com/",{packaged:true}),"https://app.cubics.com");
  for(const url of ["http://app.cubics.com", "https://localhost:3000",
    "https://127.0.0.1","https://app.cubics.com/path","https://a:b@app.cubics.com",
    "https://app.cubics.com?query=1","file:///app","https://example.test"])
    assert.throws(()=>normalizedAppOrigin(url,{packaged:true}));
  assert.equal(isAppUrl("https://app.cubics.com/spaces/abc","https://app.cubics.com"),true);
  assert.equal(isAppUrl("https://app.cubics.com.evil.example/spaces","https://app.cubics.com"),false);
  assert.equal(isAppUrl("http://app.cubics.com/spaces","https://app.cubics.com"),false);
  assert.equal(isAuthUrl("http://accounts.google.com/sign-in"),false);
  assert.equal(isAuthUrl("https://accounts.google.com/sign-in"),true);
});
test("desktop stage contains no privileged server or dependent Node packages",()=>{
  const root=path.resolve(__dirname,"../..");
  const prepared=prepareDesktop({root,publicAppOrigin:"https://staging.cubics.com"});
  assert.deepEqual(inspectDesktopStage(prepared.stage),[]);
  const manifest=JSON.parse(fs.readFileSync(path.join(prepared.stage,"package.json"),"utf8"));
  assert.deepEqual(manifest.dependencies,{});
  assert.equal(fs.existsSync(path.join(prepared.stage,"server.js")),false);
  assert.equal(fs.existsSync(path.join(prepared.stage,".next")),false);
  fs.rmSync(prepared.stage,{recursive:true,force:true});
});
test("secret, privileged Node route, and symlink poison fail closed",()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"cubics-dist-"));
  try{
    fs.mkdirSync(path.join(temp,"electron"),{recursive:true});
    fs.writeFileSync(path.join(temp,"package.json"),JSON.stringify({main:"electron/main.js",dependencies:{}}));
    fs.writeFileSync(path.join(temp,"electron/release-config.json"),JSON.stringify({schemaVersion:1,appOrigin:"https://staging.cubics.com"}));
    assert.deepEqual(inspectDesktopStage(temp),[]);
    fs.writeFileSync(path.join(temp,".env.local"),"CANARY_SECRET");
    fs.mkdirSync(path.join(temp,"server"),{recursive:true});
    fs.writeFileSync(path.join(temp,"electron/token.txt"),"DATABASE_URL=test");
    const findings=inspectDesktopStage(temp);
    assert.ok(findings.some(x=>x.includes(".env.local")));
    assert.ok(findings.some(x=>x.includes("server")));
    assert.ok(findings.some(x=>x.includes("token.txt")));
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test("legacy standalone staging never copies .env",()=>{
  const source=fs.readFileSync(path.resolve(__dirname,"../prepare-standalone.js"),"utf8");
  assert.doesNotMatch(source,/copy\s*\(\s*["']\.env["']/);
});
