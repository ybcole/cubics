"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSign, generateKeyPairSync } = require("node:crypto");
const {
  createTokenVerifier, clerkIssuer, allowedSocketOrigins
} = require("../../src/lib/security/realtime-identity.cjs");

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), alg: "RS256", use: "sig", kid: "fixture-1" };
const issuer = "https://auth.example.clerk.accounts.dev";
const origin = "http://localhost:3000";
const now = Math.floor(Date.now() / 1000);
function token(overrides = {}, header = {}) {
  const h = { typ: "JWT", alg: "RS256", kid: "fixture-1", ...header };
  const body = { iss: issuer, azp: origin, sub: "user_alice", sid: "sess_alice",
    iat: now-2, nbf: now-2, exp: now+90, ...overrides };
  const encoded = [h, body].map(data => Buffer.from(JSON.stringify(data)).toString("base64url")).join(".");
  const signature = createSign("RSA-SHA256").update(encoded).end().sign(privateKey).toString("base64url");
  return encoded+"."+signature;
}
const verify = createTokenVerifier({ issuer, authorizedParties: [origin], loadJwks: async () => [jwk] });

test("verifies real RS256 signature, issuer, session and authorized party", async () => {
  assert.deepEqual(await verify(token()), { userId:"user_alice", sessionId:"sess_alice", expiresAt:now+90 });
});
test("rejects forged identity, expired JWT, wrong issuer and unauthorized parties", async () => {
  await assert.rejects(verify(token({sub:"user_other"}).slice(0,-5)+"abcde"));
  await assert.rejects(verify(token({exp:now-20})));
  await assert.rejects(verify(token({iss:"https://attacker.example"})));
  await assert.rejects(verify(token({azp:"https://attacker.example"})));
  await assert.rejects(verify(token({nbf:now+30})));
});
test("rejects alg none and untrusted signing key IDs", async () => {
  await assert.rejects(verify(token({}, {alg:"none"})));
  await assert.rejects(verify(token({}, {kid:"attacker"})));
});
test("accepts only configured origins and canonical HTTPS Clerk issuer", () => {
  assert.deepEqual(allowedSocketOrigins({CUBICS_SOCKET_ALLOWED_ORIGINS:"http://localhost:3000,https://cubics.example"}),[origin,"https://cubics.example"]);
  assert.throws(()=>allowedSocketOrigins({CUBICS_SOCKET_ALLOWED_ORIGINS:"*"}));
  assert.throws(()=>allowedSocketOrigins({CUBICS_SOCKET_ALLOWED_ORIGINS:"https://cubics.example/malicious"}));
  assert.throws(()=>allowedSocketOrigins({NODE_ENV:"production",CUBICS_SOCKET_ALLOWED_ORIGINS:"http://attacker.example"}));
  const pk = "pk_test_" + Buffer.from("auth.example.clerk.accounts.dev$").toString("base64url");
  assert.equal(clerkIssuer({NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:pk}),issuer);
  assert.throws(()=>clerkIssuer({CLERK_ISSUER:"http://attacker.example"}));
});
