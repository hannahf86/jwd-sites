// =============================================================================
// app/(auth)/reset-password/page.tsx — set a password (reset AND invite)
// =============================================================================
// Both emails land here. An invite is the same flow with a different link
// type, and it's a first password rather than a replacement, so only the
// wording changes. Ported from the client portal, where it's been through
// every shape of link Supabase sends.
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recoveryClient } from "@/lib/supabase/browser";
import AuthShell, { BackToLogin, Message } from "../AuthShell";

const MIN_LENGTH = 8;

type Stage = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const [stage, setStage] = useState<Stage>("checking");
  const [invited, setInvited] = useState(false);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // The token exchange and updateUser share one session, so one client.
  const clientRef = useRef<SupabaseClient | null>(null);
  // Links are single-use, and dev StrictMode runs effects twice. Without
  // this the second run burns the token and calls a good link expired.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const supabase = recoveryClient();
    clientRef.current = supabase;

    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

    // Get the token out of the address bar first. Until it's used it's a
    // live credential, and it shouldn't survive in history or a screenshot.
    const clean = () => window.history.replaceState(null, "", window.location.pathname);
    const fail = (message: string) => {
      clean();
      setReason(message);
      setStage("invalid");
    };

    (async () => {
      // A dead link arrives as an error in the hash, not a failed call.
      const hashError = hash.get("error_description") || hash.get("error");
      if (hashError) {
        return fail(/expired/i.test(hashError) ? "That link has expired." : "That link isn't valid any more.");
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const linkType = url.searchParams.get("type") ?? hash.get("type");
      if (linkType === "invite" || linkType === "signup") setInvited(true);

      // Three shapes reach this page depending on the email template:
      // tokens in the hash, a PKCE code, or a token_hash to verify.
      let err = null;
      if (accessToken && refreshToken) {
        ({ error: err } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }));
      } else if (code) {
        ({ error: err } = await supabase.auth.exchangeCodeForSession(code));
      } else if (tokenHash) {
        ({ error: err } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: linkType === "invite" ? "invite" : "recovery",
        }));
      } else {
        return fail("This page needs the link from your email to work.");
      }

      if (err) {
        return fail(
          /expired|invalid/i.test(err.message)
            ? "That link has expired or has already been used."
            : "That link couldn't be checked.",
        );
      }

      clean();
      setStage("ready");
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_LENGTH) return setError(`Passwords need at least ${MIN_LENGTH} characters.`);
    if (password !== confirm) return setError("Those two passwords don't match.");

    setSaving(true);
    setError("");
    const supabase = clientRef.current!;
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message || "Couldn't save that password. Please try again.");
      setSaving(false);
      return;
    }

    // Drop the one-job session; signing in properly creates the real one.
    await supabase.auth.signOut();
    setStage("done");
  }

  if (stage === "checking") {
    return (
      <AuthShell title="One moment" intro="Checking your link…">
        <div />
      </AuthShell>
    );
  }

  if (stage === "invalid") {
    return (
      <AuthShell title="That link won't work" intro="Links from our emails work once, and expire after a while.">
        <Message tone="error">{reason}</Message>
        <Link href="/forgot-password" className="btn-primary btn-block">
          Send a new link
        </Link>
        <BackToLogin />
      </AuthShell>
    );
  }

  if (stage === "done") {
    return (
      <AuthShell
        title={invited ? "You're all set" : "Password changed"}
        intro={invited ? "Sign in and you'll see your website." : "Sign in with your new password."}
      >
        <Message tone="success">Saved.</Message>
        <Link href="/login" className="btn-primary btn-block">
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={invited ? "Welcome! Choose a password" : "Choose a new password"}
      intro={`At least ${MIN_LENGTH} characters. A password manager is a better place for it than your memory.`}
    >
      {error && <Message tone="error">{error}</Message>}
      <form onSubmit={save}>
        <div className="form-row">
          <label className="label" htmlFor="password">{invited ? "Password" : "New password"}</label>
          <input
            id="password"
            className="field"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label className="label" htmlFor="confirm">Type it again</label>
          <input
            id="confirm"
            className="field"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary btn-block" style={{ marginTop: 20 }} disabled={saving}>
          {saving ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthShell>
  );
}
