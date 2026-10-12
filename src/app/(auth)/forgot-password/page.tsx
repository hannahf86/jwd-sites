// =============================================================================
// app/(auth)/forgot-password/page.tsx — ask for a reset link
// =============================================================================
"use client";

import { useState } from "react";
import { recoveryClient } from "@/lib/supabase/browser";
import AuthShell, { BackToLogin, Message } from "../AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");

    const { error: err } = await recoveryClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    // Rate limits are worth showing: "check your email" when nothing was
    // sent leaves someone refreshing an inbox for nothing.
    if (err && /rate|limit|too many/i.test(err.message)) {
      setError("That's a few too many requests in a row. Wait an hour and try again.");
      setSending(false);
      return;
    }

    // Any other failure still reports success. "No account with that email"
    // would tell a stranger which addresses are registered.
    setSent(true);
    setSending(false);
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" intro="If that address has an account, a reset link is on its way.">
        <Message tone="success">
          The link lasts one hour and works once. If it hasn&apos;t arrived in a few minutes, check your
          spam folder.
        </Message>
        <BackToLogin />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" intro="Enter your email and we'll send you a link to choose a new one.">
      {error && <Message tone="error">{error}</Message>}
      <form onSubmit={send}>
        <div className="form-row">
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            className="field"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary btn-block" style={{ marginTop: 20 }} disabled={sending}>
          {sending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <BackToLogin />
    </AuthShell>
  );
}
