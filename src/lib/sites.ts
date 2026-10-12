// =============================================================================
// lib/sites.ts — reading sites, as the signed-in person
// =============================================================================
// Every query here goes through db(), so RLS has already narrowed the rows
// to the sites this person may edit. No site_id filter is needed for safety;
// the ones below are for picking a row, not for protection.
import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase/server";
import { sameValue } from "@/lib/content";

export type SiteStatus = "active" | "paused" | "archived";

export type Site = {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  status: SiteStatus;
  timezone: string;
  revalidate_url: string | null;
  created_at: string;
};

const SITE_COLUMNS = "id, slug, name, domain, status, timezone, revalidate_url, created_at";

/** Every site this person can see: all of them for staff, theirs for editors. */
export const listSites = cache(async (): Promise<Site[]> => {
  const supabase = await db();
  const { data, error } = await supabase
    .from("sites")
    .select(SITE_COLUMNS)
    .neq("status", "archived")
    .order("name");
  if (error) throw new Error(`Couldn't load sites: ${error.message}`);
  return (data ?? []) as Site[];
});

/** One site by slug, or null — which is also what someone else's site gives. */
export const getSite = cache(async (slug: string): Promise<Site | null> => {
  const supabase = await db();
  const { data, error } = await supabase
    .from("sites")
    .select(SITE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load site: ${error.message}`);
  return (data as Site | null) ?? null;
});

export type SiteCounts = {
  fields: number;
  liveFields: number;
  unpublishedFields: number;
  posts: number;
  upcomingEvents: number;
  unreadSubmissions: number;
};

/** The numbers on a site's overview tiles. Head-only counts, no rows. */
export async function siteCounts(siteId: string): Promise<SiteCounts> {
  const supabase = await db();
  const nowIso = new Date().toISOString();
  const head = { count: "exact" as const, head: true };

  const [fields, posts, events, unread] = await Promise.all([
    // Values rather than a count: "unpublished" means draft differs from
    // live, and PostgREST can't compare two columns. A site has dozens of
    // fields, not thousands, so comparing here is cheap.
    supabase.from("content_fields").select("draft_value, published_value").eq("site_id", siteId),
    supabase.from("posts").select("id", head).eq("site_id", siteId),
    supabase.from("events").select("id", head).eq("site_id", siteId).gte("starts_at", nowIso),
    supabase.from("form_submissions").select("id", head).eq("site_id", siteId).eq("is_read", false),
  ]);

  const values = (fields.data ?? []) as { draft_value: unknown; published_value: unknown }[];
  return {
    fields: values.length,
    liveFields: values.filter((f) => f.published_value !== null).length,
    unpublishedFields: values.filter((f) => f.draft_value !== null && !sameValue(f.draft_value, f.published_value))
      .length,
    posts: posts.count ?? 0,
    upcomingEvents: events.count ?? 0,
    unreadSubmissions: unread.count ?? 0,
  };
}

export type Editor = {
  user_id: string;
  email: string;
  added_at: string;
  last_sign_in_at: string | null;
};

/** A site's editors with their emails. Staff only — empty for anyone else. */
export async function siteEditors(siteId: string): Promise<Editor[]> {
  const supabase = await db();
  const { data, error } = await supabase.rpc("site_editors", { p_site: siteId });
  if (error) throw new Error(`Couldn't load editors: ${error.message}`);
  return (data ?? []) as Editor[];
}
