// =============================================================================
// lib/viewer.ts — who is signed in, and are they staff
// =============================================================================
// Identity and routing only. What someone can read or change is decided by
// RLS in Postgres; these helpers decide where to send people and what to
// show them. requireStaff() in a server action is a friendlier error, not
// the boundary — the policies refuse the write either way.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";

export type Viewer = { id: string; email: string; isStaff: boolean };

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await db();
  // getUser(), not getSession(): it verifies with Supabase rather than
  // trusting whatever is in the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS only returns your own staff row, so this is "am I staff".
  const { data: staff } = await supabase
    .from("staff")
    .select("user_id")
    .maybeSingle();

  return { id: user.id, email: user.email ?? "", isStaff: Boolean(staff) };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireStaff(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isStaff) redirect("/sites");
  return viewer;
}

/** Base URL for links in emails. No trailing slash. */
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3108").replace(/\/$/, "");
}
