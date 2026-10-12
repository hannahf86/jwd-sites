// =============================================================================
// lib/supabase/admin.ts — the secret-key client (bypasses RLS)
// =============================================================================
// Reserved for the one job with no user to act as: creating, finding and
// deleting auth accounts when an editor is invited. Everything else uses
// db() and lets the policies do their work. Reaching for this anywhere new
// is a decision to defend in review.
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
