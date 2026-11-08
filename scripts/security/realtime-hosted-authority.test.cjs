"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { serviceOrigin, getRoomRole, checkRoomMembership } =
  require("../../src/lib/security/realtime-membership.cjs");

const secret = "integration-only-secret-which-is-never-deployed";
const env = {
  NODE_ENV:"production",
  CUBICS_INTERNAL_API_ORIGIN:"https://api.cubics.com",
  CUBICS_REALTIME_SERVICE_TOKEN:secret,
};

test("room authority lives in the private API and not Prisma in the socket process",()=>{
  const src = fs.readFileSync(path.resolve(__dirname, "../../src/lib/security/realtime-membership.cjs"),"utf8");
  assert.doesNotMatch(src, /require\(["']@prisma\/client/);
  assert.match(src, /CUBICS_REALTIME_SERVICE_TOKEN/);
});
test("realtime service accepts only HTTPS internal API outside development",()=>{
  assert.equal(serviceOrigin(env),"https://api.cubics.com");
  for(const target of ["http://api.cubics.com","https://api.cubics.com/evil",
    "https://user:secret@api.cubics.com","file:///etc/passwd"])
    assert.throws(()=>serviceOrigin({...env,CUBICS_INTERNAL_API_ORIGIN:target}));
});
test("authorized service maps server-only room roles with no client-supplied identity",async()=>{
  const calls=[];
  const request = async (url,options)=>{
    calls.push({url,options});
    return {ok:true,json:async()=>({allowed:true,role:"ADMIN"})};
  };
  assert.equal(await getRoomRole("userA","roomA",{env,fetchImpl:request}),"ADMIN");
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,"https://api.cubics.com/api/internal/realtime/membership");
  assert.equal(calls[0].options.headers["X-Cubics-Internal-Service-Token"],secret);
  assert.deepEqual(JSON.parse(calls[0].options.body),{userId:"userA",roomId:"roomA"});
});
test("private API errors, absent tokens, missing membership and bad response fail closed",async()=>{
  const empty = async()=>({ok:true,json:async()=>({allowed:false,role:null})});
  assert.equal(await checkRoomMembership("userA","roomA",{env,fetchImpl:empty}),false);
  const invalid = async()=>({ok:true,json:async()=>({allowed:true,role:"SUPERADMIN"})});
  assert.equal(await getRoomRole("userA","roomA",{env,fetchImpl:invalid}),null);
  await assert.rejects(getRoomRole("userA","roomA",{env,fetchImpl:async()=>({ok:false})}));
  await assert.rejects(getRoomRole("userA","roomA",{env:{...env,CUBICS_REALTIME_SERVICE_TOKEN:"short"},fetchImpl:empty}));
  assert.equal(await getRoomRole("","roomA",{env,fetchImpl:empty}),null);
});
test("authoritative Next API checks service token with constant-time comparison",()=>{
  const src=fs.readFileSync(path.resolve(__dirname,"../../src/app/api/internal/realtime/membership/route.ts"),"utf8");
  assert.match(src,/timingSafeEqual/);
  assert.match(src,/CUBICS_REALTIME_SERVICE_TOKEN/);
  assert.match(src,/prisma\.room\.findUnique/);
  assert.match(src,/Cache-Control/);
});
