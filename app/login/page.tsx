"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [oauthSubmitting, setOauthSubmitting] = useState<"google" | "apple" | null>(null);
  const [email, setEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  function callbackUrl() {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async function signInWithProvider(provider: "google" | "apple") {
    setOauthSubmitting(provider);
    setError(null);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setError(error.message);
      setOauthSubmitting(null);
    }
    // On success the browser navigates away to the provider — nothing else to do here.
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setEmailSubmitting(true);
    setError(null);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setEmailSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMagicLinkSent(true);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">🏈</span>
        <h1 className="font-display text-4xl tracking-wide text-chalk">Commissioner Sign-In</h1>
        <p className="text-sm text-chalk-muted">Sign in to create and manage your league&apos;s seasons.</p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={() => signInWithProvider("google")}
          disabled={oauthSubmitting !== null}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-turf-600 bg-turf-800 px-6 py-3 font-display text-lg tracking-wide text-chalk hover:bg-turf-700 disabled:opacity-50"
        >
          <GoogleIcon />
          {oauthSubmitting === "google" ? "Redirecting…" : "Continue with Google"}
        </button>

        <button
          type="button"
          onClick={() => signInWithProvider("apple")}
          disabled={oauthSubmitting !== null}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-turf-600 bg-turf-800 px-6 py-3 font-display text-lg tracking-wide text-chalk hover:bg-turf-700 disabled:opacity-50"
        >
          <AppleIcon />
          {oauthSubmitting === "apple" ? "Redirecting…" : "Continue with Apple"}
        </button>
      </div>

      <div className="flex w-full items-center gap-3">
        <div className="h-px flex-1 bg-turf-700" />
        <span className="text-xs uppercase tracking-wide text-chalk-faint">or</span>
        <div className="h-px flex-1 bg-turf-700" />
      </div>

      {magicLinkSent ? (
        <p className="text-center text-sm text-chalk-muted">
          Check <span className="text-chalk">{email}</span> for a sign-in link.
        </p>
      ) : (
        <form onSubmit={sendMagicLink} className="flex w-full flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-turf-600 bg-turf-900 px-3 py-3 text-chalk placeholder:text-chalk-faint"
          />
          <button
            type="submit"
            disabled={emailSubmitting}
            className="w-full rounded-full bg-endzone-500 px-6 py-3 font-display text-lg tracking-wide text-chalk hover:bg-endzone-600 disabled:opacity-50"
          >
            {emailSubmitting ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-endzone-400">{error}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path
        d="M16.365 1.43c0 1.14-.437 2.148-1.312 3.022-.916.916-2.098 1.418-3.297 1.418-.033-1.16.475-2.328 1.351-3.198.926-.914 2.14-1.5 3.258-1.242zM20.5 17.5c-.532 1.24-.79 1.792-1.487 2.9-.976 1.55-2.35 3.48-4.06 3.5-1.52.02-1.91-1-3.97-.99-2.06.01-2.49.99-4.01 1-1.71.02-3-1.72-3.98-3.26-2.73-4.27-3.02-9.29-1.33-11.96 1.2-1.9 3.1-3.01 4.88-3.01 1.81 0 2.95 1 4.45 1 1.45 0 2.34-1 4.44-1 1.6 0 3.29.87 4.5 2.38-3.96 2.17-3.32 7.83.56 9.44z"
      />
    </svg>
  );
}
