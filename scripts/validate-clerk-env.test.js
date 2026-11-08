"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateClerkEnv } = require("./validate-clerk-env");

const validLocal = {
  NODE_ENV: "development",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
  CLERK_SECRET_KEY: "sk_test_example",
};

test("accepts development keys on the local desktop origin", () => {
  assert.doesNotThrow(() => validateClerkEnv(validLocal));
});

test("rejects missing keys and example placeholders", () => {
  assert.throws(() => validateClerkEnv({ ...validLocal, CLERK_SECRET_KEY: "" }), /Missing Clerk keys/);
  assert.throws(() => validateClerkEnv({ ...validLocal, CLERK_SECRET_KEY: "sk_test_..." }), /placeholder/);
});

test("rejects mixing development and production keys", () => {
  assert.throws(
    () => validateClerkEnv({ ...validLocal, CLERK_SECRET_KEY: "sk_live_example" }),
    /environments differ/
  );
});

test("rejects production keys on localhost, including packaged builds", () => {
  const liveLocal = {
    ...validLocal,
    NODE_ENV: "production",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example",
    CLERK_SECRET_KEY: "sk_live_example",
  };
  assert.throws(() => validateClerkEnv(liveLocal), /cannot be used on localhost/);
  assert.throws(
    () => validateClerkEnv({ ...liveLocal, NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000" }),
    /cannot be used on localhost/
  );
});

test("accepts paired production keys for a configured web production origin", () => {
  assert.doesNotThrow(() => validateClerkEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://app.example.com",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example",
    CLERK_SECRET_KEY: "sk_live_example",
  }));
});

test("rejects malformed site URLs", () => {
  assert.throws(() => validateClerkEnv({ ...validLocal, NEXT_PUBLIC_SITE_URL: "not a URL" }), /valid absolute URL/);
});
