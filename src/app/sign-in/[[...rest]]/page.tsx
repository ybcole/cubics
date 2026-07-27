"use client";

import { SignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200">
        <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Welcome to Room Canvas</h1>
          <p className="text-zinc-600">Sign in to start building your rooms</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              form: {
                backgroundColor: "white",
                borderRadius: "12px",
                padding: "32px",
                boxShadow: "0 10px 40px -5px rgba(0, 0, 0, 0.1)",
              },
              header: {
                backgroundColor: "transparent",
                marginBottom: "24px",
              },
              title: {
                color: "#1e293b",
                fontSize: "24px",
                fontWeight: 600,
              },
              socialButtonsBlock: {
                marginBottom: "16px",
              },
              divider: {
                color: "#cbd5e1",
              },
              formFieldInput: {
                borderRadius: "8px",
                backgroundColor: "#f8fafc",
                borderColor: "#e2e8f0",
                color: "#0f172a",
                "::placeholder": {
                  color: "#64748b",
                },
              },
              formFieldLabel: {
                color: "#334155",
                fontWeight: 500,
              },
              primarButton: {
                backgroundColor: "#6366f1",
                color: "white",
                borderRadius: "8px",
                padding: "12px 16px",
                "&:hover": {
                  backgroundColor: "#4f46e5",
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}