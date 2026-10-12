// =============================================================================
// lib/supabase/browser.ts — browser clients
// =============================================================================
import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * The signed-in session, from the browser. Same cookies as the server, so
 * RLS applies identically. Used to sign in, and later for direct-to-storage
 * uploads (browser → Supabase, avoiding Vercel's 4.5MB body limit).
 */
export function browserDb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

/**
 * For the invite and password-reset links only.
 *
 * The session lives in memory: it exists to set one password and shouldn't
 * outlive the tab. And the page reads the token out of the URL itself, so
 * auto-detection is off — otherwise the two race and a failure can't be
 * reported properly.
 */
export function recoveryClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, detectSessionInUrl: false } },
  );
}
