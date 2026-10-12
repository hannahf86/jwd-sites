// =============================================================================
// lib/pages.ts — reading a site's editable pages
// =============================================================================
// A "page" is not a table: it's the `page` column shared by content_fields
// and lists. Pages appear in the order of their first field, so the site
// setup file decides the order by the order it lists them in.
import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase/server";
import { pageSlug, sameValue, type ContentField } from "@/lib/content";

const FIELD_COLUMNS =
  "id, key, page, section, label, help, type, max_length, sort_order, draft_value, published_value, published_at, updated_at";

export type ListSummary = {
  id: string;
  key: string;
  label: string;
  help: string | null;
  page: string | null;
  section: string | null;
  sort_order: number;
  item_count: number;
};

export type PageSummary = { name: string; slug: string; fields: number; unpublished: number };

export type PageSection = { name: string; fields: ContentField[]; lists: ListSummary[] };

export type MediaItem = {
  id: string;
  path: string;
  alt: string;
  width: number | null;
  height: number | null;
  mime_type: string | null;
};

/** Every field on the site, in order. Cached per request. */
const siteFields = cache(async (siteId: string): Promise<ContentField[]> => {
  const supabase = await db();
  const { data, error } = await supabase
    .from("content_fields")
    .select(FIELD_COLUMNS)
    .eq("site_id", siteId)
    .order("sort_order")
    .order("key");
  if (error) throw new Error(`Couldn't load page content: ${error.message}`);
  return (data ?? []) as ContentField[];
});

const siteLists = cache(async (siteId: string): Promise<ListSummary[]> => {
  const supabase = await db();
  const { data, error } = await supabase
    .from("lists")
    .select("id, key, label, help, page, section, sort_order, list_items(count)")
    .eq("site_id", siteId)
    .order("sort_order");
  if (error) throw new Error(`Couldn't load lists: ${error.message}`);
  return (data ?? []).map((row) => {
    const { list_items, ...rest } = row as typeof row & { list_items: { count: number }[] };
    return { ...rest, item_count: list_items?.[0]?.count ?? 0 } as ListSummary;
  });
});

const hasUnpublished = (f: ContentField) => f.draft_value !== null && !sameValue(f.draft_value, f.published_value);

/** The page tabs: each page's name, URL slug, and how many changes wait. */
export async function listPages(siteId: string): Promise<PageSummary[]> {
  const fields = await siteFields(siteId);
  const pages = new Map<string, PageSummary>();
  for (const f of fields) {
    const page = pages.get(f.page) ?? { name: f.page, slug: pageSlug(f.page), fields: 0, unpublished: 0 };
    page.fields++;
    if (hasUnpublished(f)) page.unpublished++;
    pages.set(f.page, page);
  }
  return [...pages.values()];
}

/** One page's fields and lists, grouped into sections in order. */
export async function loadPage(siteId: string, slug: string) {
  const [fields, lists] = await Promise.all([siteFields(siteId), siteLists(siteId)]);
  const pageFields = fields.filter((f) => pageSlug(f.page) === slug);
  if (pageFields.length === 0) return null;

  const name = pageFields[0].page;
  const sections = new Map<string, PageSection>();
  const section = (key: string | null) => {
    const k = key ?? "";
    if (!sections.has(k)) sections.set(k, { name: k, fields: [], lists: [] });
    return sections.get(k)!;
  };

  for (const f of pageFields) section(f.section).fields.push(f);
  for (const l of lists.filter((l) => l.page === name)) section(l.section).lists.push(l);

  return { name, sections: [...sections.values()] };
}

/** The site's image library, newest first. */
export async function listMedia(siteId: string): Promise<MediaItem[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("media")
    .select("id, path, alt, width, height, mime_type")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(`Couldn't load images: ${error.message}`);
  return (data ?? []) as MediaItem[];
}
