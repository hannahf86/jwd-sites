// =============================================================================
// lib/supabase/server.ts — the database, as the person asking
// =============================================================================
// Every query from a page or server action goes through this client. It
// carries the user's Supabase session, so auth.uid() is real inside Postgres
// and RLS decides what comes back. A missing `.eq("site_id", …)` can't leak
// another client's content: Postgres won't send it.
//
// Wrapped in cache() so it's built once per request, not once per call.
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { cache } from "react";

export const db = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't set cookies. The proxy refreshes the
            // session on every request first, so this is safe to swallow.
          }
        },
      },
    },
  );
});
