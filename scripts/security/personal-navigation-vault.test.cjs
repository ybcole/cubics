"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { scopeDigest, protectedVaultAvailable, PersonalNavigationVault } =
  require("../../electron/personal-navigation-vault.cjs");

function fakeProtectedStorage() {
  const key = crypto.randomBytes(32);
  return {
    getSelectedStorageBackend: () => "gnome_libsecret",
    isAsyncEncryptionAvailable: async () => true,
    async encryptStringAsync(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      return Buffer.concat([iv, cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()]);
    },
    async decryptStringAsync(buffer) {
      const iv = buffer.subarray(0, 12);
      const tag = buffer.subarray(buffer.length - 16);
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(buffer.subarray(12, -16)), decipher.final(),
      ]).toString("utf8");
      return { result: plaintext, shouldReEncrypt: false };
    },
  };
}
const alice = { userId: "user_alice", roomId: "room_alpha", widgetId: "widget_one" };
test("M05 encrypted Personal vault is scoped and persists, without plaintext on disk",async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"cubics-vault-"));
  try {
    const crypt=fakeProtectedStorage();
    const vault=new PersonalNavigationVault(root,crypt,"linux");
    const secret="https://private.example/banking?secret=abc123#account";
    assert.equal(await vault.read(alice),null);
    assert.equal(await vault.write(alice,secret),true);
    const ciphertext=fs.readFileSync(vault.file(alice));
    assert.ok(ciphertext.length>32);
    assert.equal(ciphertext.includes("private.example"),false);
    assert.equal(ciphertext.includes("abc123"),false);
    const reopened=new PersonalNavigationVault(root,crypt,"linux");
    assert.equal(await reopened.read(alice),secret);
    assert.equal(await reopened.read({...alice,userId:"user_bob"}),null);
    assert.equal(await reopened.read({...alice,roomId:"room_beta"}),null);
    assert.equal(await reopened.read({...alice,widgetId:"widget_two"}),null);
    assert.equal(await reopened.write(alice,"https://private.example/updated"),true);
    assert.equal(await vault.read(alice),"https://private.example/updated");
    assert.equal(fs.readdirSync(path.join(root,"personal-navigation-v1")).length,1);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test("M05 reject plaintext Linux backend and unavailable system keychain",async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"cubics-vault-fail-"));
  try {
    const provider=fakeProtectedStorage();
    provider.getSelectedStorageBackend=()=> "basic_text";
    assert.equal(await protectedVaultAvailable(provider,"linux"),false);
    await assert.rejects(new PersonalNavigationVault(root,provider,"linux").write(alice,
      "https://private.example/"),/OS-protected navigation storage is unavailable/);
    assert.equal(fs.existsSync(path.join(root,"personal-navigation-v1")),false);
    provider.getSelectedStorageBackend=()=> "gnome_libsecret";
    provider.isAsyncEncryptionAvailable=async()=>false;
    assert.equal(await protectedVaultAvailable(provider,"linux"),false);
    await assert.rejects(new PersonalNavigationVault(root,provider,"linux").read(alice));
    assert.throws(()=>scopeDigest({...alice,widgetId:"../escape"}));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("M05 malicious symlink and altered ciphertext cannot escape Personal vault",async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"cubics-vault-symlink-"));
  try{
    const provider=fakeProtectedStorage();
    const vault=new PersonalNavigationVault(root,provider,"linux");
    await vault.write(alice,"https://private.example/auth");
    const target=vault.file(alice);
    fs.writeFileSync(target,Buffer.alloc(48,0x42));
    await assert.rejects(vault.read(alice));
    fs.unlinkSync(target);
    const external=path.join(root,"external");
    fs.writeFileSync(external,"other data");
    fs.symlinkSync(external,target);
    await assert.rejects(vault.read(alice),/Untrusted navigation record|ELOOP/);
    await assert.rejects(vault.write(alice,"https://other.example/"),/Untrusted existing navigation record/);
    assert.equal(fs.readFileSync(external,"utf8"),"other data");
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("M05 API and UI never sync Personal URLs to PostgreSQL after vault rollout",()=>{
  const read=p=>fs.readFileSync(path.resolve(__dirname,"../../",p),"utf8");
  const api=read("src/app/api/spaces/[id]/widgets/route.ts");
  const cloud=read("src/app/spaces/[id]/page.tsx");
  const view=read("src/components/PersonalTabView.tsx");
  const owner=read("src/app/api/spaces/[id]/widgets/[widgetId]/personal-vault/route.ts");
  const main=read("electron/main.js");
  assert.match(api,/Personal destinations must remain on this device/);
  assert.match(api,/Personal URLs cannot be synced to cloud widgets/);
  assert.match(cloud,/url: personal \? "about:blank" : url/);
  assert.match(cloud,/await window.cubics!\.writePersonalNavigation/);
  assert.match(view,/readPersonalNavigation\(widget.roomId, widget.id, userId\)/);
  assert.match(view,/src=\{vaultUrl\}/);
  assert.doesNotMatch(view,/src=\{widget.url\}/);
  assert.match(owner,/createdBy: userId, type: "iframe"/);
  assert.match(main,/authorizedPersonalScope\(roomId, widgetId, expectedUserId\)/);
  assert.doesNotMatch(main,/session\.defaultSession\.clearData/);
});
