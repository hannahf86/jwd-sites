// =============================================================================
// app/(auth)/login/page.tsx — sign in
// =============================================================================
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { browserDb } from "@/lib/supabase/browser";
import AuthShell, { Message } from "../AuthShell";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // An email link that fails (expired, already used, or opened first by an
  // inbox's link scanner) lands people on the Site URL with the reason in
  // the hash, and from there on this page. Say what happened instead of
  // showing a blank sign-in form, then tidy the address bar.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (!hash.get("error")) return;
    setError(
      hash.get("error_code") === "otp_expired"
        ? "That email link has expired or has already been used. Use “Forgot password?” to get a new one."
        : "That email link didn't work. Use “Forgot password?” to get a new one.",
    );
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: err } = await browserDb().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (err) {
      // Not repeating Supabase's message. "Invalid credentials" and "email
      // not confirmed" tell a stranger different things about whether an
      // account exists. Rate limits are the exception: worth saying.
      setError(
        /rate|too many/i.test(err.message)
          ? "Too many attempts. Wait a few minutes and try again."
          : "That email and password don't match.",
      );
      setLoading(false);
      return;
    }

    // A full navigation, not router.push: the browser just wrote the
    // session cookie and the server needs to see it on the next request.
    window.location.href = "/sites";
  }

  return (
    <AuthShell title="Welcome back" intro="Sign in to update your website.">
      {error && <Message tone="error">{error}</Message>}

      <form onSubmit={signIn}>
        <div className="form-row">
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            className="field"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            className="field"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <p style={{ textAlign: "right", margin: "10px 0 20px" }}>
          <Link href="/forgot-password" style={{ fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
            Forgot password?
          </Link>
        </p>

        <button type="submit" className="btn-primary btn-block" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
