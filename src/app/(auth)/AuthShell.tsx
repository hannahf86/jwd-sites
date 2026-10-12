// =============================================================================
// app/(auth)/AuthShell.tsx — the centred card behind every sign-in page
// =============================================================================
// Shared by login, forgot-password and reset-password so the three can't
// drift apart. Also exports the message box and the "back to sign in" link.
import Link from "next/link";
import Wordmark from "@/components/Wordmark";

export default function AuthShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div style={{ marginBottom: 34 }}>
          <Wordmark />
        </div>
        <h1>{title}</h1>
        <p className="auth-intro">{intro}</p>
        {children}
      </div>
    </main>
  );
}

export function Message({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div className={`message message-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function BackToLogin() {
  return (
    <p style={{ textAlign: "center", marginTop: 20 }}>
      <Link href="/login" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
        ← Back to sign in
      </Link>
    </p>
  );
}
