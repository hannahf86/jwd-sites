// =============================================================================
// app/auth/sign-out/route.ts — sign out (POST only)
// =============================================================================
// POST, never GET: a GET sign-out can be triggered by any image tag on any
// page, and link prefetching would sign people out just by hovering.
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await db();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
