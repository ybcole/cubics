"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRecoveryBundle, openRecoveryBundle } =
  require("../../electron/personal-navigation-recovery.cjs");
const scope = {userId:"user_alice",roomId:"room_alpha",widgetId:"widget_one"};
const url = "https://private.example/session?id=SECRET#fragment";
test("M05 portable Personal recovery is authenticated, randomized, not plaintext",async()=>{
  const first=await createRecoveryBundle(scope,url,"this is a long unique test phrase");
  const second=await createRecoveryBundle(scope,url,"this is a long unique test phrase");
  assert.notDeepEqual(first,second);
  assert.ok(!first.toString().includes("private.example"));
  assert.ok(!first.toString().includes("SECRET"));
  assert.ok(!first.toString().includes("user_alice"));
  assert.equal(await openRecoveryBundle(scope,first,"this is a long unique test phrase"),url);
  await assert.rejects(openRecoveryBundle(scope,first,"a different long test phrase"));
  await assert.rejects(openRecoveryBundle({...scope,userId:"user_bob"},first,
    "this is a long unique test phrase"),/different Personal tab/);
  await assert.rejects(openRecoveryBundle({...scope,widgetId:"widget_two"},first,
    "this is a long unique test phrase"),/different Personal tab/);
});
test("M05 recovery refuses tampering, unsafe URLs, weak passwords and malformed input",async()=>{
  const passphrase="the long correct recovery passphrase";
  const valid=await createRecoveryBundle(scope,url,passphrase);
  const object=JSON.parse(valid.toString());
  object.tag=Buffer.alloc(16,0).toString("base64");
  await assert.rejects(openRecoveryBundle(scope,Buffer.from(JSON.stringify(object)),
    passphrase),/Invalid recovery/);
  await assert.rejects(createRecoveryBundle(scope,"javascript:alert(1)",passphrase));
  await assert.rejects(createRecoveryBundle(scope,url,"too short"));
  await assert.rejects(openRecoveryBundle(scope,Buffer.alloc(26000),passphrase));
  await assert.rejects(openRecoveryBundle(scope,Buffer.from("not JSON"),passphrase));
});
