import Link from "next/link";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

export function AuthShell({
  subtitle,
  children,
}: {
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="text-display text-fg"
          >
            Cubics
          </Link>
          <p className="text-body text-fg-muted mt-2">{subtitle}</p>
        </div>
        <div className="card rounded-lg p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="field-label">
        {label}
      </label>
      {children}
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="alert-danger mb-4">
      {message}
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="divider">or</div>
  );
}

export function GoogleButton({
  onClick,
  label = "Continue with Google",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-secondary w-full"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {label}
    </button>
  );
}

export function clerkErrorMessage(err: unknown, fallback: string): string {
  if (isClerkAPIResponseError(err)) {
    const first = err.errors?.[0];
    if (first?.code === "form_identifier_not_found") {
      return "No account found with that email or username.";
    }
    if (first?.code === "form_password_incorrect") {
      return "Incorrect password.";
    }
    if (first?.code === "form_param_exists") {
      return first.longMessage || first.message || "That value is already taken.";
    }
    return first?.longMessage || first?.message || fallback;
  }
  return fallback;
}
