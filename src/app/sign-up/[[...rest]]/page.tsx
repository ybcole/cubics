"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk, useSignUp } from "@clerk/nextjs";
import {
  AuthShell,
  AuthField,
  AuthError,
  AuthDivider,
  GoogleButton,
  clerkErrorMessage,
} from "@/components/AuthShell";
import { withEnglishGoogleUi } from "@/lib/google-oauth";

export default function SignUpPage() {
  const { signUp, isLoaded, setActive } = useSignUp();
  const clerk = useClerk();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"register" | "verify">("register");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await signUp.create({
        username: username.trim(),
        emailAddress: email.trim(),
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/");
        return;
      }

      await signUp.prepareVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err) {
      setError(clerkErrorMessage(err, "Sign-up failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await signUp.attemptVerification({
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
      const attempt = await signUp.create({
        strategy: "oauth_google",
        redirectUrl: clerk.buildUrlWithAuth(`${origin}/sso-callback`),
        actionCompleteRedirectUrl: `${origin}/`,
      });
      const redirect = withEnglishGoogleUi(
        attempt.verifications.externalAccount.externalVerificationRedirectURL
      );
      if (!redirect) {
        throw new Error("Google sign-up is unavailable.");
      }
      window.location.assign(redirect);
    } catch (err) {
      setError(clerkErrorMessage(err, "Google sign-up failed."));
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="Create an account to start building">
      {step === "register" ? (
        <form onSubmit={handleRegister}>
          <AuthError message={error} />
          <AuthField label="Username">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-base w-full"
              placeholder="your-username"
              autoFocus
              autoComplete="username"
            />
          </AuthField>
          <AuthField label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base w-full"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </AuthField>
          <AuthField label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base w-full"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </AuthField>
          <div id="clerk-captcha" className="my-2" />
          <button
            type="submit"
            disabled={
              loading || !username.trim() || !email.trim() || password.length < 8
            }
            className="btn btn-primary w-full mt-1"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>

          <AuthDivider />

          <GoogleButton onClick={handleGoogle} label="Continue with Google" />

          <p className="text-small text-fg-muted text-center mt-6">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-accent-ink font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify}>
          <h2 className="text-h2 text-fg mb-1">
            Verify your email
          </h2>
          <p className="text-small text-fg-muted mb-5">
            We sent a verification code to {email}.
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
            {loading ? "Verifying…" : "Verify email"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("register");
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
