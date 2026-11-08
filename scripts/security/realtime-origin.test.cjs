"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
test("desktop and hosted web never fall back to localhost for production sockets",()=>{
  const source=fs.readFileSync(path.join(root,"src/lib/cloud/realtime-origin.ts"),"utf8");
  const page=fs.readFileSync(path.join(root,"src/app/spaces/[id]/page.tsx"),"utf8");
  assert.match(source,/process\.env\.NODE_ENV !== "production"/);
  assert.match(source,/\["wss:", "https:"\]/);
  assert.match(page,/resolveRealtimeOrigin\(\)/);
  assert.doesNotMatch(page,/io\(process\.env\.NEXT_PUBLIC_SOCKET_URL \|\|/);
});
