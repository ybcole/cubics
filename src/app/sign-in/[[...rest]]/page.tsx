"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk, useSignIn } from "@clerk/nextjs";
import {
  AuthShell,
  AuthField,
  AuthError,
  AuthDivider,
  GoogleButton,
  clerkErrorMessage,
} from "@/components/AuthShell";
import { withEnglishGoogleUi } from "@/lib/google-oauth";

export default function SignInPage() {
  const { signIn, isLoaded, setActive } = useSignIn();
  const clerk = useClerk();
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: identifier.trim(),
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/");
        return;
      }

      if (result.status === "needs_first_factor") {
        const factors = result.supportedFirstFactors ?? [];
        const emailFactor = factors.find((f) => f.strategy === "email_code");
        if (emailFactor && emailFactor.strategy === "email_code" && emailFactor.emailAddressId) {
          await signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailFactor.emailAddressId,
          });
          setStep("code");
          return;
        }
        setError("Sign-in needs additional verification.");
        return;
      }

      setError("Sign-in needs additional verification.");
    } catch (err) {
      setError(clerkErrorMessage(err, "Sign-in failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code: code.trim(),
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/");
        return;
      }

      setError("Verification failed. Please try again.");
    } catch (err) {
      setError(clerkErrorMessage(err, "Verification failed."));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!isLoaded || loading) return;
    setError("");
    setLoading(true);
    try {
      const origin = window.location.origin;
      const attempt = await signIn.create({
        strategy: "oauth_google",
        redirectUrl: clerk.buildUrlWithAuth(`${origin}/sso-callback`),
        actionCompleteRedirectUrl: `${origin}/`,
      });
      const redirect = withEnglishGoogleUi(
        attempt.firstFactorVerification.externalVerificationRedirectURL
      );
      if (!redirect) {
        throw new Error("Google sign-in is unavailable.");
      }
      window.location.assign(redirect);
    } catch (err) {
      setError(clerkErrorMessage(err, "Google sign-in failed."));
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="Sign in to start building your rooms">
      {step === "credentials" ? (
        <form onSubmit={handleCredentials}>
          <AuthError message={error} />
          <AuthField label="Email or username">
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="input-base w-full"
              placeholder="you@example.com"
              autoFocus
              autoComplete="username"
            />
          </AuthField>
          <AuthField label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base w-full"
              placeholder="Your password"
              autoComplete="current-password"
            />
          </AuthField>
          <div id="clerk-captcha" className="my-2" />
          <button
            type="submit"
            disabled={loading || !identifier.trim() || !password}
            className="btn btn-primary w-full mt-1"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <AuthDivider />

          <GoogleButton onClick={handleGoogle} />

          <p className="text-small text-fg-muted text-center mt-6">
            New to Cubics?{" "}
            <Link
              href="/sign-up"
              className="text-accent-ink font-medium hover:underline"
            >
              Create an account
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleCode}>
          <h2 className="text-h2 text-fg mb-1">
            Check your email
          </h2>
          <p className="text-small text-fg-muted mb-5">
            We sent a verification code to {identifier}.
          </p>
          <AuthError message={error} />
          <AuthField label="Verification code">
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input-base w-full tracking-[0.3em] text-center placeholder:tracking-normal font-mono"
              placeholder="123456"
              maxLength={6}
              autoFocus
            />
          </AuthField>
          <button
            type="submit"
            disabled={loading || code.trim().length < 6}
            className="btn btn-primary w-full mt-1"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setCode("");
              setError("");
            }}
            className="btn btn-ghost btn-sm w-full mt-2"
          >
            Back
          </button>
        </form>
      )}
    </AuthShell>
  );
}
