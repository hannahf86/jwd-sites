// =============================================================================
// lib/content.ts — page content: types, value shapes, and checks
// =============================================================================
// Pure: no React, no Supabase, so the editor (browser) and the server
// actions share one copy of the rules.
//
// These checks mirror content_value_ok() in migration 0003. They exist to
// give a friendly message before saving; the database is still the
// boundary and refuses a bad value whatever this file says.

export type FieldType = "text" | "long_text" | "rich_text" | "image" | "link";

export type ImageValue = { media_id: string; path: string; alt: string };
export type LinkValue = { label: string; href: string };
export type RichTextValue = { type: "doc"; content?: unknown[] };
export type FieldValue = string | ImageValue | LinkValue | RichTextValue | null;

export type ContentField = {
  id: string;
  key: string;
  page: string;
  section: string | null;
  label: string;
  help: string | null;
  type: FieldType;
  max_length: number | null;
  sort_order: number;
  draft_value: FieldValue;
  published_value: FieldValue;
  published_at: string | null;
  updated_at: string;
};

/** Same pattern as the database: web, relative, anchor, email or phone. */
const SAFE_HREF = /^(https?:\/\/|\/|#|mailto:|tel:)/;

export function isSafeHref(href: string) {
  return SAFE_HREF.test(href.trim());
}

/**
 * Why this value can't be saved, or null if it can.
 * Messages are written for the client, not for us.
 */
export function valueProblem(
  type: FieldType,
  value: FieldValue,
  maxLength: number | null,
  siteId: string,
): string | null {
  if (value === null) return null;

  switch (type) {
    case "text":
    case "long_text": {
      if (typeof value !== "string") return "This should be text.";
      if (maxLength && [...value].length > maxLength) {
        return `This is ${[...value].length - maxLength} characters too long (the limit is ${maxLength}).`;
      }
      return null;
    }
    case "rich_text": {
      const ok = typeof value === "object" && value !== null && (value as RichTextValue).type === "doc";
      return ok ? null : "This text couldn't be read. Try retyping it.";
    }
    case "image": {
      const img = value as ImageValue;
      if (typeof img !== "object" || !img.path) return "Choose an image.";
      if (img.path.split("/")[0] !== siteId) return "That image belongs to a different website.";
      return null;
    }
    case "link": {
      const link = value as LinkValue;
      if (typeof link !== "object" || !link.href?.trim()) return "Add the web address the button goes to.";
      if (!isSafeHref(link.href)) {
        return "Start the address with https://, or with / for a page on your own site.";
      }
      return null;
    }
  }
}

/**
 * JSON with keys sorted, for "has this changed" comparisons.
 * Postgres returns jsonb with its keys in its own order and Tiptap in
 * another, so a plain JSON.stringify would call identical values different.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export const sameValue = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);

/** "Tips & Resources" → "tips-resources", for page URLs. */
export function pageSlug(page: string) {
  return page
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Public URL of an object in the site-media bucket. */
export function mediaUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-media/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
