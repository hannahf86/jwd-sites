// =============================================================================
// app/not-found.tsx — 404 (also what someone else's site looks like)
// =============================================================================
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>Page not found</h1>
        <p className="auth-intro">That page doesn&apos;t exist, or it isn&apos;t one you have access to.</p>
        <Link href="/sites" className="btn-primary btn-block">
          Back to your sites
        </Link>
      </div>
    </main>
  );
}
