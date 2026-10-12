// =============================================================================
// proxy.ts — refresh the session, then route (Next 16's renamed middleware)
// =============================================================================
// The refresh is not optional. Supabase access tokens are short-lived and
// Server Components can't write cookies, so without this people would be
// signed out mid-visit whenever their token expired.
//
// The routing half is routing, not security: it decides where someone
// lands. What they can read is decided by RLS.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Pages a signed-out visitor may see.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, origin } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", origin));
  }
  // Already signed in: the login page has nothing for you.
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/sites", origin));
  }

  return response;
}

export const config = {
  // Everything except static assets and image optimisation.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|svg|webp|ico)$).*)"],
};
