"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const base=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(base,p),"utf8");
test("target free-first stack is documented without premature deployment or paid-only promises",()=>{
  const adr=read("docs/adr/0008-free-first-upgrade-path.md");
  for(const x of ["Vercel Hobby","Supabase Realtime","Clerk Free","LiveKit","IN PROGRESS","Socket.IO"])
    assert.match(adr,new RegExp(x.replace(".","\\.")));
  assert.match(adr,/non-commercial/);
  assert.match(adr,/not a deployed claim|not deployed/i);
});
test("Supabase Realtime policies use Clerk subject, private rooms and bidirectional authorization",()=>{
  const sql=read("supabase/migrations/20261108000001_realtime_private_room_policies.sql");
  assert.match(sql,/auth\.jwt\(\) ->> 'sub'/);
  assert.match(sql,/public\."RoomMember"/);
  assert.match(sql,/public\."Room"/);
  assert.match(sql,/security definer/);
  assert.match(sql,/revoke all.*from public, anon/);
  assert.match(sql,/on realtime\.messages[\s\S]*for select to authenticated/);
  assert.match(sql,/on realtime\.messages[\s\S]*for insert to authenticated/);
  assert.match(sql,/realtime\.topic\(\)/);
  assert.doesNotMatch(sql,/alter table realtime\.messages enable row level security/i);
  assert.doesNotMatch(sql,/service_role/);
});
